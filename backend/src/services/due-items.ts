import db from "../db.js";
import { DEFAULT_TITLE, titleFromSummary } from "./titles.js";

/** One assignment with a due date, as it goes into a calendar (the .ics feed and Apple Calendar). */
export interface DueItem {
  /** Stable across syncs: session id + position of the assignment in its summary. */
  uid: string;
  /** YYYY-MM-DD */
  dueDate: string;
  title: string;
  subject: string | null;
  sessionTitle: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface Row {
  id: number;
  title: string;
  summary: string;
  subject: string | null;
}

/** Every assignment that has a usable due date, across all summarized sessions. */
export function dueItems(): DueItem[] {
  const rows = db
    .prepare(
      `SELECT l.id, l.title, l.summary, s.name AS subject
       FROM lessons l LEFT JOIN subjects s ON s.id = l.subject_id
       WHERE l.summary IS NOT NULL`
    )
    .all() as unknown as Row[];

  const items: DueItem[] = [];
  for (const row of rows) {
    let summary: { topics?: string[]; assignments?: { title: string; dueDate: string | null }[] };
    try {
      summary = JSON.parse(row.summary);
    } catch {
      continue;
    }
    // the same name the app shows: one the student gave, or the topics
    const sessionTitle = row.title === DEFAULT_TITLE ? titleFromSummary(summary.topics) : row.title;
    (summary.assignments ?? []).forEach((a, i) => {
      if (!a.dueDate || !ISO_DATE.test(a.dueDate)) return;
      items.push({ uid: `studysync-${row.id}-${i}`, dueDate: a.dueDate, title: a.title, subject: row.subject, sessionTitle });
    });
  }
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** "Due: Lab report (Biology 101)" */
export const eventTitle = (item: DueItem) => `Due: ${item.title}${item.subject ? ` (${item.subject})` : ""}`;
export const eventNotes = (item: DueItem) => `Mentioned in "${item.sessionTitle}". Added by StudySync.`;
