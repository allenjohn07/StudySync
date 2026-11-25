import { DatabaseSync } from "node:sqlite";

export type LessonStatus = "recording" | "processing" | "done" | "error";
export type LessonStage = "transcribing" | "summarizing" | null;

export interface LessonRow {
  id: number;
  title: string;
  status: LessonStatus;
  stage: LessonStage;
  transcript: string | null;
  summary: string | null; // JSON, see services/summarize.ts
  error: string | null;
  created_at: string;
  subject_id: number | null;
  // Added to the browser's piece numbers and timestamps after "continue this session", so the new
  // recording lands after the existing transcript instead of overwriting it.
  seq_offset: number;
  start_offset: number;
}

export interface SubjectRow {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface SegmentRow {
  seq: number;
  start_sec: number;
  text: string;
}

const db = new DatabaseSync(process.env.DB_PATH ?? "./studysync.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing',
    stage TEXT,
    transcript TEXT,
    summary TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL REFERENCES lessons(id),
    seq INTEGER NOT NULL,
    start_sec INTEGER NOT NULL,
    text TEXT NOT NULL
  )
`);

// A subject (or class) groups sessions, e.g. "Biology 101".
db.exec(`
  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'gray',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

// Small app settings (e.g. whether due dates are written into Apple Calendar).
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

export function getSetting(key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string | null) {
  if (value === null) db.prepare("DELETE FROM settings WHERE key = ?").run(key);
  else db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

// Columns added after the first release: add them to databases created before they existed.
const lessonColumns = new Set(
  (db.prepare("PRAGMA table_info(lessons)").all() as unknown as { name: string }[]).map((c) => c.name)
);
const addColumn = (name: string, definition: string) => {
  if (!lessonColumns.has(name)) db.exec(`ALTER TABLE lessons ADD COLUMN ${name} ${definition}`);
};
addColumn("subject_id", "INTEGER REFERENCES subjects(id)");
addColumn("seq_offset", "INTEGER NOT NULL DEFAULT 0");
addColumn("start_offset", "INTEGER NOT NULL DEFAULT 0");

// A restart in the middle of a recording or processing would leave a lesson stuck forever.
// A session that already had a summary (it was being continued) goes back to how it was: the
// unfinished new part is dropped, the earlier transcript and summary are kept.
db.exec(`
  DELETE FROM segments WHERE id IN (
    SELECT s.id FROM segments s JOIN lessons l ON l.id = s.lesson_id
    WHERE l.summary IS NOT NULL AND l.status != 'done' AND s.seq >= l.seq_offset
  );
  UPDATE lessons SET status = 'done', stage = NULL, error = NULL WHERE summary IS NOT NULL AND status != 'done';
`);

// Failed sessions are not kept, and neither are new ones a restart left stuck (their transcript lines go with them).
db.exec(`
  DELETE FROM segments WHERE lesson_id IN (SELECT id FROM lessons WHERE status IN ('error', 'recording', 'processing'));
  DELETE FROM lessons WHERE status IN ('error', 'recording', 'processing');
`);

export default db;
