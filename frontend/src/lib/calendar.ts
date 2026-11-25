import { API_URL } from "./api";
import type { Lesson, Subject } from "./types";

// Getting due dates into a calendar, with no accounts: a live feed served by the backend (subscribe once),
// a prefilled Google Calendar link, or a one-off .ics file.

/** The live feed of every due date (backend/src/routes/calendar.ts). */
export const CALENDAR_FEED_URL = `${API_URL}/calendar.ics`;
/** The same feed as a webcal:// link, which opens the system calendar app with "Subscribe" ready. */
export const CALENDAR_WEBCAL_URL = CALENDAR_FEED_URL.replace(/^https?:/, "webcal:");

export interface DueItem {
  title: string;
  /** YYYY-MM-DD */
  dueDate: string;
  sessionId: number;
  sessionTitle: string;
  subject: Subject | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const compact = (iso: string) => iso.replace(/-/g, "");

function nextDay(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Today in the browser's time zone, as YYYY-MM-DD. */
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Every assignment with a usable due date, from today on, soonest first. */
export function upcomingDue(sessions: Lesson[], subjects: Subject[]): DueItem[] {
  const today = todayIso();
  const byId = new Map(subjects.map((s) => [s.id, s]));
  return sessions
    .flatMap((session) =>
      (session.summary?.assignments ?? []).map((a) => ({
        title: a.title,
        dueDate: a.dueDate ?? "",
        sessionId: session.id,
        sessionTitle: session.title,
        subject: session.subjectId !== null ? (byId.get(session.subjectId) ?? null) : null,
      })),
    )
    .filter((item) => ISO_DATE.test(item.dueDate) && item.dueDate >= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

const eventTitle = (item: Pick<DueItem, "title" | "subject">) =>
  `Due: ${item.title}${item.subject ? ` (${item.subject.name})` : ""}`;
const eventDetails = (item: Pick<DueItem, "sessionTitle">) => `Mentioned in "${item.sessionTitle}". Added by StudySync.`;

/** Opens Google Calendar's "new event" page, prefilled as an all-day event on the due date. */
export function googleCalendarUrl(item: Omit<DueItem, "sessionId">) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: eventTitle(item),
    dates: `${compact(item.dueDate)}/${compact(nextDay(item.dueDate))}`,
    details: eventDetails(item),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

const escapeIcs = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Downloads a one-event .ics file (opens in Apple Calendar, Outlook, etc.). */
export function downloadIcs(item: DueItem, index: number) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StudySync//Assignments//EN",
    "BEGIN:VEVENT",
    // same id as in the live feed, so importing both doesn't create a duplicate
    `UID:studysync-${item.sessionId}-${index}@studysync.local`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(item.dueDate)}`,
    `DTEND;VALUE=DATE:${compact(nextDay(item.dueDate))}`,
    `SUMMARY:${escapeIcs(eventTitle(item))}`,
    `DESCRIPTION:${escapeIcs(eventDetails(item))}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(`Due tomorrow: ${item.title}`)}`,
    "TRIGGER:-PT15H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([`${ics}\r\n`], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${item.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "assignment"}.ics`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
