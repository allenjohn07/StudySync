import type { Summary } from "./summarize.js";

// Continuing a session: only the new part of the transcript is summarized, then folded into the summary the
// session already had. Earlier points stay as they were; new ones are added, and anything the speaker updated
// (a deadline that moved, a study tip) is changed in place. Faster than re-summarizing everything, and nothing
// the student already read shifts around.

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "that", "this", "speaker", "says", "explains", "mentions"]);
const words = (text: string) => new Set(normalize(text).split(" ").filter((w) => w && !STOP.has(w)));

/** Same point said twice: identical after normalizing, or sharing most of their meaningful words. */
function similar(a: string, b: string) {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  const wa = words(a);
  const wb = words(b);
  if (!wa.size || !wb.size) return false;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size) >= 0.8;
}

/** Appends the items of `next` that aren't already in `prev`. */
function union(prev: string[], next: string[]) {
  const out = [...prev];
  for (const item of next) if (!out.some((existing) => similar(existing, item))) out.push(item);
  return out;
}

/** One assignment mentioned again: keep it once, with the newest deadline the speaker gave. */
function sameAssignment(a: string, b: string) {
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na) || similar(a, b);
}

export function mergeSummaries(prev: Summary, next: Summary): Summary {
  const assignments = prev.assignments.map((a) => ({ ...a }));
  for (const item of next.assignments) {
    const existing = assignments.find((a) => sameAssignment(a.title, item.title));
    if (!existing) assignments.push(item);
    else if (item.dueDate) {
      // the speaker gave (or changed) the deadline in the new part
      existing.dueDate = item.dueDate;
      existing.dueText = item.dueText ?? existing.dueText ?? null;
    }
  }
  return {
    topics: union(prev.topics, next.topics),
    keyPoints: union(prev.keyPoints, next.keyPoints),
    assignments,
    tasks: union(prev.tasks, next.tasks),
    // a new tip from the speaker replaces the old one; otherwise the old one stays
    studyTip: next.studyTip.trim() || prev.studyTip,
  };
}
