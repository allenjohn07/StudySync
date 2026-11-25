export type Role = "student" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  notifyEnabled: boolean;
  createdAt: string;
  hasApiKey: boolean;
}

export interface LessonSummary {
  topics: string[];
  keyPoints: string[];
  assignments: { title: string; dueDate: string | null }[];
  tasks: string[];
  studyTip: string;
}

export interface Lesson {
  id: number;
  title: string;
  status: "recording" | "processing" | "done" | "error";
  stage: "transcribing" | "summarizing" | null;
  transcript: string | null;
  segments: { seq: number; start: number; text: string }[];
  summary: LessonSummary | null;
  error: string | null;
  /** The subject (class) it is filed under; null = unsorted. */
  subjectId: number | null;
  createdAt: string;
}

export type SubjectColor = "gray" | "blue" | "green" | "amber" | "rose" | "violet" | "teal" | "orange";

/** A subject or class that groups sessions, e.g. "Biology 101". */
export interface Subject {
  id: number;
  name: string;
  color: SubjectColor;
  createdAt: string;
}

/** Reply to an uploaded audio piece: the text heard so far for that piece (null if transcription failed). */
export interface ChunkResult {
  seq: number;
  start: number;
  final: boolean;
  skipped: boolean;
  text: string | null;
}
