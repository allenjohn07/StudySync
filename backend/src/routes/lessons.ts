import { Hono } from "hono";
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

    db.prepare(
      "UPDATE lessons SET summary = ?, title = ?, status = 'done', stage = NULL, error = NULL WHERE id = ?"
    ).run(JSON.stringify(summary), titleFromSummary(summary.topics), id);
  } catch (err) {
    if (!isCurrent()) return;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Lesson ${id} failed:`, message);
    db.prepare("UPDATE lessons SET status = 'error', stage = NULL, error = ? WHERE id = ?").run(message, id);
  } finally {
    if (isCurrent()) runs.delete(id);
  }
}

// Start a lesson; the browser then sends short audio chunks while recording.
lessons.post("/", (c) => {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO lessons (title, status) VALUES ('Untitled lecture', 'recording')")
    .run();
  return c.json({ id: Number(lastInsertRowid) }, 201);
});

lessons.post("/:id/chunks", async (c) => {
  const id = Number(c.req.param("id"));
  const lesson = findLesson(id);
  if (!lesson) return c.json({ error: "Lesson not found" }, 404);
  if (lesson.status !== "recording") return c.json({ error: "Lesson is no longer recording" }, 409);

  const form = await c.req.parseBody();
  const audio = form["audio"];
  const seq = Number(form["seq"]);
  const start = Number(form["start"]);
  if (!(audio instanceof File) || audio.size === 0 || !Number.isInteger(seq) || !Number.isFinite(start)) {
    return c.json({ error: "Send multipart fields 'audio', 'seq' and 'start'" }, 400);
  }

  const isFinal = form["final"] !== "0";
  const key = `${id}:${seq}`;
  const version = (latestRequest.get(key) ?? 0) + 1;
  latestRequest.set(key, version);

  const buffer = Buffer.from(await audio.arrayBuffer());
  const result = await enqueue(() => transcribeChunk(id, seq, Math.max(0, Math.floor(start)), buffer, isFinal, version));
  return c.json({ seq, start: Math.max(0, Math.floor(start)), final: isFinal, ...result });
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
  // Failed sessions are never listed; one stays reachable by id just long enough to show its error.
  const rows = db.prepare("SELECT * FROM lessons WHERE status != 'error' ORDER BY id DESC").all() as unknown as LessonRow[];
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
