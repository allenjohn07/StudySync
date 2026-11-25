import { Hono } from "hono";
import { z } from "zod";
import db, { type LessonRow, type SegmentRow } from "../db.js";
import { summarize } from "../services/summarize.js";
import { transcribe } from "../services/transcribe.js";

const lessons = new Hono();

function findLesson(id: number) {
  return db.prepare("SELECT * FROM lessons WHERE id = ?").get(id) as unknown as LessonRow | undefined;
}

function findSegments(id: number) {
  return db
    .prepare("SELECT seq, start_sec, text FROM segments WHERE lesson_id = ? ORDER BY seq")
    .all(id) as unknown as SegmentRow[];
}

const DEFAULT_TITLE = "Untitled lecture";

// Names a session after what was talked about, so the sidebar list is readable.
function titleFromSummary(topics: string[] | undefined) {
  const title = (topics ?? []).slice(0, 2).join(" · ");
  return title ? title.slice(0, 60) : DEFAULT_TITLE;
}

function serialize(row: LessonRow, withSegments = true) {
  const summary = row.summary ? JSON.parse(row.summary) : null;
  return {
    id: row.id,
    title: row.title === DEFAULT_TITLE ? titleFromSummary(summary?.topics) : row.title,
    status: row.status,
    stage: row.stage,
    transcript: row.transcript,
    segments: withSegments ? findSegments(row.id).map((s) => ({ seq: s.seq, start: s.start_sec, text: s.text })) : [],
    summary,
    error: row.error,
    subjectId: row.subject_id,
    // SQLite stores UTC without a zone marker; make it explicit for the browser.
    createdAt: `${row.created_at.replace(" ", "T")}Z`,
  };
}

// Whisper and the LLM are heavy; run one job at a time, in the order they arrive.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const result = queue.then(job);
  queue = result.catch(() => undefined);
  return result;
}

// Whisper marks silence/noise with tags like [BLANK_AUDIO] or (music); drop those.
// It also tends to invent short phrases like "you" or "Thank you." over silence; drop those too.
const SILENCE_HALLUCINATIONS = /^(you|thank you|thanks|thanks for watching|bye|okay)[.!\s]*$/i;

function cleanText(text: string) {
  const cleaned = text.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
  if (/^\(.*\)$/.test(cleaned) || SILENCE_HALLUCINATIONS.test(cleaned)) return "";
  return cleaned;
}

// While recording, the browser sends a growing preview of the current piece every ~1.5 s ("interim"),
// then the finished piece ("final"). Only the newest request for a piece is worth transcribing.
const latestRequest = new Map<string, number>();
const finalized = new Set<string>();

function saveSegment(lessonId: number, seq: number, start: number, text: string) {
  const existing = db.prepare("SELECT id FROM segments WHERE lesson_id = ? AND seq = ?").get(lessonId, seq) as
    | { id: number }
    | undefined;
  if (!text) {
    if (existing) db.prepare("DELETE FROM segments WHERE id = ?").run(existing.id);
  } else if (existing) {
    db.prepare("UPDATE segments SET text = ?, start_sec = ? WHERE id = ?").run(text, start, existing.id);
  } else {
    db.prepare("INSERT INTO segments (lesson_id, seq, start_sec, text) VALUES (?, ?, ?, ?)").run(
      lessonId,
      seq,
      start,
      text
    );
  }
}

async function transcribeChunk(
  lessonId: number,
  seq: number,
  start: number,
  audio: Buffer,
  isFinal: boolean,
  version: number
) {
  const key = `${lessonId}:${seq}`;
  // Superseded by a newer preview, or the piece is already final: skip the work.
  if (!isFinal && (finalized.has(key) || latestRequest.get(key) !== version)) return { skipped: true, text: "" };

  try {
    const text = cleanText(await transcribe(audio));
    saveSegment(lessonId, seq, start, text);
    return { skipped: false, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Lesson ${lessonId} chunk ${seq} (${isFinal ? "final" : "preview"}) failed:`, message);
    // A failed preview is harmless (the final piece covers it); only real failures are shown to the user.
    if (isFinal) db.prepare("UPDATE lessons SET error = ? WHERE id = ?").run(message, lessonId);
    return { skipped: false, text: null };
  } finally {
    if (isFinal) {
      finalized.add(key);
      latestRequest.delete(key);
    }
  }
}

// The current summary job of each lesson. A newer job (a retry) cancels the older one, and only the newest
// is allowed to write its result, so a cancelled job can never overwrite a retry.
interface Run {
  controller: AbortController;
}
const runs = new Map<number, Run>();

function startRun(id: number): Run {
  runs.get(id)?.controller.abort();
  const run = { controller: new AbortController() };
  runs.set(id, run);
  return run;
}

async function summarizeLesson(id: number, run: Run) {
  const isCurrent = () => runs.get(id) === run;
  try {
    const transcript = findSegments(id)
      .map((s) => s.text)
      .join(" ");
    if (!transcript) throw new Error(findLesson(id)?.error ?? "No speech was detected in the recording");

    db.prepare("UPDATE lessons SET transcript = ?, stage = 'summarizing' WHERE id = ?").run(transcript, id);
    const summary = await summarize(transcript, run.controller.signal);
    if (!isCurrent()) return;

    // The title is left alone: a name the student gave is kept, and an unnamed session is named after
    // its topics when it is sent out (see serialize), so a continued session gets a fresh name too.
    db.prepare("UPDATE lessons SET summary = ?, status = 'done', stage = NULL, error = NULL WHERE id = ?").run(
      JSON.stringify(summary),
      id
    );
  } catch (err) {
    if (!isCurrent()) return;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Lesson ${id} failed:`, message);
    db.prepare("UPDATE lessons SET status = 'error', stage = NULL, error = ? WHERE id = ?").run(message, id);
  } finally {
    if (isCurrent()) runs.delete(id);
  }
}

const subjectExists = (id: number) => !!db.prepare("SELECT 1 FROM subjects WHERE id = ?").get(id);

const createSchema = z.object({
  subjectId: z.number().int().nullable().optional(),
  title: z.string().trim().max(80).optional(),
});

// Start a lesson, optionally filed under a subject and with a name; the browser then sends short audio
// chunks while recording. Without a name, the session is named after its topics once summarized.
lessons.post("/", async (c) => {
  const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Invalid session details" }, 400);
  const subjectId = parsed.data.subjectId ?? null;
  if (subjectId !== null && !subjectExists(subjectId)) return c.json({ error: "Subject not found" }, 404);

  const { lastInsertRowid } = db
    .prepare("INSERT INTO lessons (title, status, subject_id) VALUES (?, 'recording', ?)")
    .run(parsed.data.title || DEFAULT_TITLE, subjectId);
  return c.json({ id: Number(lastInsertRowid) }, 201);
});

// Continue a finished session: the new recording is added after its transcript, and the summary is
// written again from the whole thing when it stops.
lessons.post("/:id/resume", (c) => {
  const id = Number(c.req.param("id"));
  const lesson = findLesson(id);
  if (!lesson) return c.json({ error: "Lesson not found" }, 404);
  if (lesson.status !== "done") return c.json({ error: "Only a finished session can be continued" }, 409);

  const last = db
    .prepare("SELECT MAX(seq) AS seq, MAX(start_sec) AS start FROM segments WHERE lesson_id = ?")
    .get(id) as unknown as { seq: number | null; start: number | null };
  const seqOffset = (last.seq ?? -1) + 1;
  // The last piece started at `start` and lasted up to a few seconds; leave room for it.
  const startOffset = last.start === null ? 0 : last.start + 5;
  db.prepare(
    "UPDATE lessons SET status = 'recording', stage = NULL, error = NULL, seq_offset = ?, start_offset = ? WHERE id = ?"
  ).run(seqOffset, startOffset, id);
  return c.json({ id });
});

const updateSchema = z.object({
  subjectId: z.number().int().nullable().optional(),
  title: z.string().trim().max(80).optional(),
});

// Rename a session or move it to another subject (null = unsorted).
lessons.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!findLesson(id)) return c.json({ error: "Lesson not found" }, 404);
  const parsed = updateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Invalid session details" }, 400);
  const { subjectId, title } = parsed.data;
  if (subjectId !== undefined) {
    if (subjectId !== null && !subjectExists(subjectId)) return c.json({ error: "Subject not found" }, 404);
    db.prepare("UPDATE lessons SET subject_id = ? WHERE id = ?").run(subjectId, id);
  }
  if (title !== undefined) db.prepare("UPDATE lessons SET title = ? WHERE id = ?").run(title || DEFAULT_TITLE, id);
  return c.json(serialize(findLesson(id)!, false));
});

lessons.post("/:id/chunks", async (c) => {
  const id = Number(c.req.param("id"));
  const lesson = findLesson(id);
  if (!lesson) return c.json({ error: "Lesson not found" }, 404);
  if (lesson.status !== "recording") return c.json({ error: "Lesson is no longer recording" }, 409);

  const form = await c.req.parseBody();
  const audio = form["audio"];
  const rawSeq = Number(form["seq"]);
  const rawStart = Number(form["start"]);
  if (!(audio instanceof File) || audio.size === 0 || !Number.isInteger(rawSeq) || !Number.isFinite(rawStart)) {
    return c.json({ error: "Send multipart fields 'audio', 'seq' and 'start'" }, 400);
  }

  const isFinal = form["final"] !== "0";
  // A continued session numbers its new pieces after the ones it already has.
  const seq = rawSeq + lesson.seq_offset;
  const start = Math.max(0, Math.floor(rawStart)) + lesson.start_offset;
  const key = `${id}:${seq}`;
  const version = (latestRequest.get(key) ?? 0) + 1;
  latestRequest.set(key, version);

  const buffer = Buffer.from(await audio.arrayBuffer());
  const result = await enqueue(() => transcribeChunk(id, seq, start, buffer, isFinal, version));
  return c.json({ seq, start, final: isFinal, ...result });
});

// Queued after the pending chunks, so it always sees the full transcript.
lessons.post("/:id/finish", (c) => {
  const id = Number(c.req.param("id"));
  const lesson = findLesson(id);
  if (!lesson) return c.json({ error: "Lesson not found" }, 404);
  if (lesson.status !== "recording") return c.json({ error: "Lesson already finished" }, 409);

  db.prepare("UPDATE lessons SET status = 'processing', stage = 'transcribing' WHERE id = ?").run(id);
  const run = startRun(id);
  enqueue(() => summarizeLesson(id, run));
  return c.json({ ok: true });
});

// Write the summary again from the saved transcript: for a failed summary, or one that is stuck.
lessons.post("/:id/resummarize", (c) => {
  const id = Number(c.req.param("id"));
  const lesson = findLesson(id);
  if (!lesson) return c.json({ error: "Lesson not found" }, 404);
  const stuck = lesson.status === "processing" && lesson.stage === "summarizing";
  if (lesson.status !== "error" && !stuck) return c.json({ error: "Nothing to retry for this session" }, 409);
  if (findSegments(id).length === 0) return c.json({ error: "Nothing was transcribed in this session" }, 409);

  db.prepare("UPDATE lessons SET status = 'processing', stage = 'summarizing', error = NULL WHERE id = ?").run(id);
  const run = startRun(id); // cancels a stuck attempt so it stops blocking the queue
  enqueue(() => summarizeLesson(id, run));
  return c.json({ ok: true });
});

lessons.get("/", (c) => {
  // Failed new sessions are never listed; one stays reachable by id just long enough to show its error.
  // A continued session whose new summary failed is still listed: it has its earlier summary to fall back on.
  const rows = db
    .prepare("SELECT * FROM lessons WHERE status != 'error' OR summary IS NOT NULL ORDER BY created_at DESC, id DESC")
    .all() as unknown as LessonRow[];
  return c.json(rows.map((row) => serialize(row, false)));
});

lessons.get("/:id", (c) => {
  const row = findLesson(Number(c.req.param("id")));
  if (!row) return c.json({ error: "Lesson not found" }, 404);
  return c.json(serialize(row));
});

// Clear everything: removes every session and its transcript lines. Refuses while one is still being
// recorded or processed, since those still have work queued.
lessons.delete("/", (c) => {
  const busy = db.prepare("SELECT COUNT(*) AS n FROM lessons WHERE status IN ('recording', 'processing')").get() as unknown as {
    n: number;
  };
  if (busy.n > 0) return c.json({ error: "Wait for the current session to finish before clearing" }, 409);

  const total = db.prepare("SELECT COUNT(*) AS n FROM lessons").get() as unknown as { n: number };
  db.exec("DELETE FROM segments; DELETE FROM lessons;");
  return c.json({ deleted: total.n });
});

lessons.delete("/:id", (c) => {
  const id = Number(c.req.param("id"));
  const lesson = findLesson(id);
  if (!lesson) return c.json({ error: "Lesson not found" }, 404);
  // Summarizing may still be queued for it; wait until it settles. (A "recording" one can be removed,
  // e.g. after a page refresh left it stuck.)
  if (lesson.status === "processing") {
    return c.json({ error: "Wait for this session to finish before deleting it" }, 409);
  }

  db.prepare("DELETE FROM segments WHERE lesson_id = ?").run(id);
  db.prepare("DELETE FROM lessons WHERE id = ?").run(id);
  return c.body(null, 204);
});

export default lessons;
