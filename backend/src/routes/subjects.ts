import { Hono } from "hono";
import { z } from "zod";
import db, { type SubjectRow } from "../db.js";

const subjects = new Hono();

// The palette the frontend knows how to draw (see SUBJECT_COLORS in frontend/src/lib/subjects.ts).
export const SUBJECT_COLORS = ["gray", "blue", "green", "amber", "rose", "violet", "teal", "orange"] as const;

export function serializeSubject(row: SubjectRow) {
  return { id: row.id, name: row.name, color: row.color, createdAt: `${row.created_at.replace(" ", "T")}Z` };
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Give the subject a name").max(60),
  color: z.enum(SUBJECT_COLORS).optional(),
});

subjects.get("/", (c) => {
  const rows = db.prepare("SELECT * FROM subjects ORDER BY name COLLATE NOCASE").all() as unknown as SubjectRow[];
  return c.json(rows.map(serializeSubject));
});

subjects.post("/", async (c) => {
  const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid subject" }, 400);
  const { name } = parsed.data;

  const existing = db.prepare("SELECT * FROM subjects WHERE name = ? COLLATE NOCASE").get(name) as unknown as
    | SubjectRow
    | undefined;
  if (existing) return c.json(serializeSubject(existing));

  // Without a chosen color, take the least-used one in the palette so subjects look different.
  const used = db.prepare("SELECT color, COUNT(*) AS n FROM subjects GROUP BY color").all() as unknown as {
    color: string;
    n: number;
  }[];
  const uses = (c: string) => used.find((u) => u.color === c)?.n ?? 0;
  const color =
    parsed.data.color ?? [...SUBJECT_COLORS].filter((c) => c !== "gray").sort((a, b) => uses(a) - uses(b))[0];
  const { lastInsertRowid } = db.prepare("INSERT INTO subjects (name, color) VALUES (?, ?)").run(name, color);
  const row = db.prepare("SELECT * FROM subjects WHERE id = ?").get(Number(lastInsertRowid)) as unknown as SubjectRow;
  return c.json(serializeSubject(row), 201);
});

// Removing a subject keeps its sessions; they just become unsorted.
subjects.delete("/:id", (c) => {
  const id = Number(c.req.param("id"));
  db.prepare("UPDATE lessons SET subject_id = NULL WHERE subject_id = ?").run(id);
  const { changes } = db.prepare("DELETE FROM subjects WHERE id = ?").run(id);
  if (!changes) return c.json({ error: "Subject not found" }, 404);
  return c.body(null, 204);
});

export default subjects;
