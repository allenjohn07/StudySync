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

// Words that mean an existing deadline changed, rather than a new piece of work being added.
const CHANGED = /\b(move[sd]?|moving|changed?|instead|postpone[sd]?|push(ed)? (back|to)|extend(ed)?|reschedul\w*|now due|delay(ed)?|bring (it )?forward)\b/i;
// Words that mean another piece of work, even if it has the same name.
const ANOTHER = /\b(another|one more|second|new|also|additional|extra)\b/i;

/**
 * `newTranscript` is the text of the new part, used to tell "the quiz moves to Monday" (update the existing
 * assignment) from "one more submission on the 31st" (add a second one, even with the same generic name).
 */
export function mergeSummaries(prev: Summary, next: Summary, newTranscript = ""): Summary {
  const assignments = prev.assignments.map((a) => ({ ...a }));
  const changed = CHANGED.test(newTranscript) && !ANOTHER.test(newTranscript);
  for (const item of next.assignments) {
    const existing = assignments.find((a) => sameAssignment(a.title, item.title));
    if (!existing) {
      assignments.push(item);
    } else if (item.dueDate && item.dueDate !== existing.dueDate) {
      if (changed || !existing.dueDate) {
        // the speaker moved (or first gave) this deadline
        existing.dueDate = item.dueDate;
        existing.dueText = item.dueText ?? existing.dueText ?? null;
      } else {
        // same name, different date, no sign of a change: a separate piece of work
        assignments.push(item);
      }
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
