// Turns the words a speaker used for a deadline ("next Wednesday", "tomorrow", "December 3rd") into a date.
// Small language models are unreliable at calendar arithmetic, so the model only reports the phrase and the
// date is worked out here.
//
// Weeks start on Monday. The rules students expect:
//   "Wednesday", "this Wednesday", "on Wednesday", "by Wednesday"  → the next Wednesday from today (never today)
//   "next Wednesday"                                               → Wednesday of next week, never this week
//   "next week"                                                    → Monday of next week
//   "end of the week" / "end of next week"                         → Friday of this / next week
//   "tomorrow", "today", "tonight", "in 3 days", "in two weeks", "a week from today"
//   "December 3", "Dec 3rd", "3 December", "the 3rd"               → the next such date from today

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30,
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Days since Monday (Monday = 0 … Sunday = 6). */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;
const mondayOf = (d: Date) => addDays(d, -mondayIndex(d));

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const toNumber = (word: string) => (/^\d+$/.test(word) ? Number(word) : NUMBER_WORDS[word]);

/** Returns YYYY-MM-DD, or null if the phrase doesn't name a date this understands. */
export function resolveDueDate(phrase: string | null | undefined, now = new Date()): string | null {
  if (!phrase) return null;
  const text = phrase.toLowerCase().replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim();
  const today = startOfDay(now);
  const thisMonday = mondayOf(today);
  const nextMonday = addDays(thisMonday, 7);

  // "in 3 days", "in two weeks", "a week from today", "two weeks from now"
  const relative = text.match(/\b(?:in )?(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty) (day|week)s?(?: from (?:today|now))?\b/);
  if (relative && (/\bin\b/.test(text) || /from (today|now)/.test(text))) {
    const n = toNumber(relative[1]);
    if (n) return isoDate(addDays(today, relative[2] === "week" ? n * 7 : n));
  }

  if (/\b(today|tonight|this evening|end of (the )?day)\b/.test(text)) return isoDate(today);
  if (/\bday after tomorrow\b/.test(text)) return isoDate(addDays(today, 2));
  if (/\btomorrow\b/.test(text)) return isoDate(addDays(today, 1));

  const weekday = WEEKDAYS.findIndex((day) => new RegExp(`\\b${day}\\b`).test(text));

  if (/\bend of (the |this )?week\b/.test(text) && !/\bnext\b/.test(text)) return isoDate(addDays(thisMonday, 4));
  if (/\bend of next week\b/.test(text)) return isoDate(addDays(nextMonday, 4));

  if (weekday >= 0) {
    const target = (weekday + 6) % 7; // Monday = 0
    // "the Wednesday after next" (checked first: it also contains "next")
    if (/\bafter next\b/.test(text)) return isoDate(addDays(nextMonday, target + 7));
    // "next Wednesday" / "Wednesday next week": that day in next week's Monday to Sunday, never this week
    if (/\bnext\b/.test(text)) return isoDate(addDays(nextMonday, target));
    // "Wednesday", "this Wednesday", "by Wednesday": the coming one (a week ahead if that's today)
    const ahead = (target - mondayIndex(today) + 7) % 7 || 7;
    return isoDate(addDays(today, ahead));
  }

  if (/\bweek after next\b/.test(text)) return isoDate(addDays(nextMonday, 7));
  if (/\bnext week\b/.test(text)) return isoDate(nextMonday);

  // "December 3", "Dec 3rd", "3 December", "3rd of December"
  const monthName = MONTHS.findIndex((m) => new RegExp(`\\b${m}[a-z]*\\b`).test(text));
  const dayMatch = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (monthName >= 0 && dayMatch) {
    const day = Number(dayMatch[1]);
    let date = new Date(today.getFullYear(), monthName, day);
    if (date.getMonth() !== monthName) return null; // e.g. February 30
    if (date < today) date = new Date(today.getFullYear() + 1, monthName, day);
    return isoDate(date);
  }

  // "the 3rd": the next 3rd of a month
  const ordinal = text.match(/\bthe (\d{1,2})(?:st|nd|rd|th)\b/);
  if (ordinal) {
    const day = Number(ordinal[1]);
    for (let m = 0; m < 3; m++) {
      const date = new Date(today.getFullYear(), today.getMonth() + m, day);
      if (date.getDate() === day && date >= today) return isoDate(date);
    }
  }

  // Already a date
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  return null;
}
