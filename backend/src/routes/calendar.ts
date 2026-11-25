import { Hono } from "hono";
import { setEnabled, status, syncAppleCalendar } from "../services/apple-calendar.js";
import { dueItems, eventNotes, eventTitle } from "../services/due-items.js";

// A live iCalendar feed of every assignment with a due date. Subscribe to it once (Apple Calendar, Outlook,
// Thunderbird… on this computer) and assignments from new lectures show up by themselves.

const calendar = new Hono();

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

const compact = (iso: string) => iso.replace(/-/g, "");
function nextDay(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

calendar.get("/calendar.ics", (c) => {
  const now = stamp();
  const events: string[] = [];
  for (const item of dueItems()) {
    events.push(
      "BEGIN:VEVENT",
      `UID:${item.uid}@studysync.local`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${compact(item.dueDate)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(item.dueDate))}`,
      `SUMMARY:${escape(eventTitle(item))}`,
      `DESCRIPTION:${escape(eventNotes(item))}`,
      "TRANSP:TRANSPARENT",
      // a reminder at 9:00 the day before
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escape(`Due tomorrow: ${item.title}`)}`,
      "TRIGGER:-PT15H",
      "END:VALARM",
      "END:VEVENT"
    );
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

// Apple Calendar: write due dates straight into a "StudySync" calendar (macOS).
calendar.get("/calendar/apple", (c) => c.json(status()));

calendar.put("/calendar/apple", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { enabled?: unknown };
  if (typeof body.enabled !== "boolean") return c.json({ error: "Send { enabled: true | false }" }, 400);
  if (body.enabled && !status().supported) return c.json({ error: "Apple Calendar is only available on macOS" }, 400);
  await setEnabled(body.enabled); // turning it on runs the first sync before answering
  return c.json(status());
});

calendar.post("/calendar/apple/sync", async (c) => {
  if (!status().enabled) return c.json({ error: "Apple Calendar isn't turned on" }, 409);
  await syncAppleCalendar();
  return c.json(status());
});

export default calendar;
