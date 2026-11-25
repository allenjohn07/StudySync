import { resolveDueDate } from "./dates.js";
import type { Summary } from "./summarize.js";

// A safety net under the language model: a small model sometimes hears "Can you add one more submission? On the
// 31st of December." and lists it as a key point but not as an assignment. This scans the transcript itself for a
// piece of work mentioned together with a date it can read, and adds any deadline the summary is missing.

const WORK =
  /\b(submissions?|assignments?|homework|essays?|reports?|projects?|quiz(?:zes)?|exams?|tests?|midterms?|finals?|labs?|presentations?|problem sets?|papers?|worksheets?|deadlines?)\b/i;
// "okay, better not", "that's cancelled": the speaker took it back
const TAKEN_BACK = /\b(not|no longer|cancel\w*|never ?mind|scratch that|forget (it|that))\b/i;
const FILLER = new Set(["a", "an", "the", "one", "more", "another", "our", "your", "my", "this", "that", "next", "new", "have", "having", "add", "for", "of", "is", "be", "also", "second", "extra"]);

const titleCase = (text: string) => text.replace(/\b\w/g, (c) => c.toUpperCase());

/** A short name: the work word plus up to two words before it, e.g. "differential equation submission". */
function titleFor(sentence: string, match: RegExpMatchArray) {
  const before = sentence
    .slice(0, match.index)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2);
  while (before.length && FILLER.has(before[0])) before.shift();
  const kept = before.every((w) => !FILLER.has(w)) ? before : [];
  return titleCase([...kept, match[1].toLowerCase()].join(" "));
}

export function addMissedDeadlines(summary: Summary, transcript: string, now = new Date()): Summary {
  // Audio pieces cut sentences in odd places, so look at each sentence together with the one after it.
  const sentences = transcript
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const assignments = summary.assignments.map((a) => ({ ...a }));

  sentences.forEach((sentence, i) => {
    const work = sentence.match(WORK);
    if (!work) return;
    const next = sentences[i + 1] ?? "";
    if (TAKEN_BACK.test(sentence) || TAKEN_BACK.test(next)) return;
    let dueText = sentence;
    let dueDate = resolveDueDate(sentence, now);
    // "Can you add one more submission?" + "On the 31st of December."
    if (!dueDate && next && !WORK.test(next)) {
      dueDate = resolveDueDate(next, now);
      dueText = `${sentence} ${next}`;
    }
    if (!dueDate) return;
    if (assignments.some((a) => a.dueDate === dueDate)) return; // the model already has it

    const title = titleFor(sentence, work);
    // a matching assignment the model listed without a date: give it this one
    const undated = assignments.find((a) => !a.dueDate && a.title.toLowerCase().includes(work[1].toLowerCase()));
    if (undated) {
      undated.dueDate = dueDate;
      undated.dueText = dueText;
    } else {
      assignments.push({ title, dueText, dueDate });
    }
  });

  return { ...summary, assignments };
}
