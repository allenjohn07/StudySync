import { Hono } from "hono";
import db from "../db.js";
import { DEFAULT_TITLE, titleFromSummary } from "./lessons.js";

// A live iCalendar feed of every assignment with a due date. Subscribe to it once (Apple Calendar, Outlook,
// Thunderbird… on this computer) and assignments from new lectures show up by themselves.

const calendar = new Hono();

interface Row {
  id: number;
  title: string;
  summary: string;
  subject: string | null;
}

/** RFC 5545 text escaping. */
const escape = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** RFC 5545 line folding: lines longer than 75 octets continue on the next line after a space. */
function fold(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + (start === 0 ? 75 : 74), bytes.length);
    // don't split a multi-byte character
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
  }
  return parts.join("\r\n ");
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const compact = (iso: string) => iso.replace(/-/g, "");
function nextDay(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

calendar.get("/calendar.ics", (c) => {
  const rows = db
    .prepare(
      `SELECT l.id, l.title, l.summary, s.name AS subject
       FROM lessons l LEFT JOIN subjects s ON s.id = l.subject_id
       WHERE l.summary IS NOT NULL`
    )
    .all() as unknown as Row[];

  const now = stamp();
  const events: string[] = [];
  for (const row of rows) {
    let summary: { topics?: string[]; assignments?: { title: string; dueDate: string | null }[] };
    try {
      summary = JSON.parse(row.summary);
    } catch {
      continue;
    }
    const assignments = summary.assignments ?? [];
    // the same name the app shows: one the student gave, or the topics
    const sessionTitle = row.title === DEFAULT_TITLE ? titleFromSummary(summary.topics) : row.title;
    assignments.forEach((a, i) => {
      if (!a.dueDate || !ISO_DATE.test(a.dueDate)) return;
      const subject = row.subject ? ` (${row.subject})` : "";
      events.push(
        "BEGIN:VEVENT",
        `UID:studysync-${row.id}-${i}@studysync.local`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${compact(a.dueDate)}`,
        `DTEND;VALUE=DATE:${compact(nextDay(a.dueDate))}`,
        `SUMMARY:${escape(`Due: ${a.title}${subject}`)}`,
        `DESCRIPTION:${escape(`Mentioned in "${sessionTitle}". Added by StudySync.`)}`,
        "TRANSP:TRANSPARENT",
        // a reminder at 9:00 the day before
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escape(`Due tomorrow: ${a.title}`)}`,
        "TRIGGER:-PT15H",
        "END:VALARM",
        "END:VEVENT"
      );
    });
  }

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StudySync//Assignments//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:StudySync assignments",
    "X-WR-CALDESC:Due dates mentioned in your recorded classes",
    // ask subscribed calendars to refresh hourly
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...events,
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n");

  return c.body(`${body}\r\n`, 200, {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": 'inline; filename="studysync.ics"',
    "Cache-Control": "no-cache",
  });
});

export default calendar;
