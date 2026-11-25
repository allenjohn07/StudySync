import type { Lesson, Subject, SubjectColor } from "./types";

/** The dot color for each subject color (kept in sync with SUBJECT_COLORS in backend/src/routes/subjects.ts). */
export const SUBJECT_DOT: Record<SubjectColor, string> = {
  gray: "bg-neutral-400",
  blue: "bg-sky-500",
  green: "bg-emerald-500",
  amber: "bg-amber-400",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  teal: "bg-teal-500",
  orange: "bg-orange-500",
};

export const SUBJECT_COLORS = Object.keys(SUBJECT_DOT) as SubjectColor[];

export const subjectDot = (subject: Subject | null | undefined) =>
  subject ? SUBJECT_DOT[subject.color] ?? SUBJECT_DOT.gray : "bg-transparent ring-1 ring-inset ring-muted-foreground/50";

export interface SubjectGroup {
  /** null = sessions that aren't filed under a subject. */
  subject: Subject | null;
  sessions: Lesson[];
}

/** Every subject (even empty ones) with its sessions, newest first, then the unsorted sessions. */
export function groupBySubject(subjects: Subject[], sessions: Lesson[]): SubjectGroup[] {
  const groups: SubjectGroup[] = subjects.map((subject) => ({
    subject,
    sessions: sessions.filter((s) => s.subjectId === subject.id),
  }));
  const known = new Set(subjects.map((s) => s.id));
  const unsorted = sessions.filter((s) => s.subjectId === null || !known.has(s.subjectId));
  if (unsorted.length) groups.push({ subject: null, sessions: unsorted });
  return groups;
}
