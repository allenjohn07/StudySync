"use client";

import { useState } from "react";
import { WritingWord, writingDelays } from "@/components/ui/writing-text";
import { splitWords } from "@/components/words";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface SummaryData {
  topics: string[];
  keyPoints: string[];
  assignments: { title: string; dueDate: string | null; dueLabel?: string }[];
  tasks: string[];
  studyTip: string;
}

export function formatDue(iso: string | null) {
  if (!iso) return "No due date";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `Due ${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`;
}

type Kind = "topic" | "point" | "assignment" | "due" | "task" | "tip";
interface Item {
  kind: Kind;
  words: string[];
  index: number;
  delays: number[]; // when each word starts to appear (ms from the start of the reveal)
}

// Milliseconds each character holds the next word back (slightly quicker than the titles, since a summary is long).
const SUMMARY_SPEED = 18;
const RISE_MS = 1000; // matches the writing effect's default

/** Flattens the summary into the order it appears in. Everything else derives from this list. */
function buildItems(s: SummaryData): Item[] {
  const raw: { kind: Kind; text: string; index: number }[] = [];
  s.topics.forEach((text, index) => raw.push({ kind: "topic", text, index }));
  s.keyPoints.forEach((text, index) =>
    raw.push({ kind: "point", text, index }),
  );
  s.assignments.forEach((a, index) => {
    raw.push({ kind: "assignment", text: a.title, index });
    raw.push({ kind: "due", text: a.dueLabel ?? formatDue(a.dueDate), index });
  });
  s.tasks.forEach((text, index) => raw.push({ kind: "task", text, index }));
  if (s.studyTip.trim()) raw.push({ kind: "tip", text: s.studyTip, index: 0 });

  const split = raw.map((r) => ({ ...r, words: splitWords(r.text) }));
  // One continuous rhythm across the whole summary; each item ends with a short pause before the next.
  const flat = split.flatMap((r) =>
    r.words.map((w, i) =>
      i === r.words.length - 1 && !/[.!?,;:]$/.test(w) ? `${w},` : w,
    ),
  );
  const all = writingDelays(flat, SUMMARY_SPEED);
  let at = 0;
  return split.map((r) => {
    const delays = all.slice(at, at + r.words.length);
    at += r.words.length;
    return { kind: r.kind, words: r.words, index: r.index, delays };
  });
}

/** How long the whole summary takes to write itself in, in ms. */
export function summaryRevealMs(s: SummaryData) {
  const last = buildItems(s).at(-1);
  return last ? (last.delays.at(-1) ?? 0) + RISE_MS : 0;
}

const SIZES = {
  md: { body: "text-[15px]", heading: "gap-6", pill: "text-[13px]" },
  lg: {
    body: "text-[15px] sm:text-base",
    heading: "gap-8",
    pill: "text-[13px]",
  },
} as const;

function Section({
  title,
  className,
  style,
  children,
}: {
  title: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <h2 className={cn("label-mono", className)} style={style}>
        {title}
      </h2>
      {children}
    </div>
  );
}

const delayStyle = (ms: number) =>
  ({ "--writing-text-delay": `${ms}ms` }) as React.CSSProperties;

/**
 * The summary sections (topics, key points, assignments, tasks, study tip). Sections with nothing in
 * them are not rendered. With `animate`, the words write themselves in with the same effect as the
 * page titles: the layout is there from the start, and each label, pill and word fades in on its turn.
 */
export function SummaryStream({
  summary,
  animate = false,
  size = "md",
  assignmentActions,
}: {
  summary: SummaryData;
  animate?: boolean;
  size?: keyof typeof SIZES;
  /** Extra controls under an assignment's due date (the dashboard's "Add to calendar"), by assignment index. */
  assignmentActions?: (index: number) => React.ReactNode;
}) {
  const [doneTasks, setDoneTasks] = useState<Set<number>>(new Set());
  const items = buildItems(summary);
  const s = SIZES[size];

  const ofKind = (kind: Kind) => items.filter((i) => i.kind === kind);
  const topics = ofKind("topic");
  const points = ofKind("point");
  const assignments = ofKind("assignment");
  const tasks = ofKind("task");
  const tip = ofKind("tip")[0];
  const dueFor = (index: number) =>
    items.find((i) => i.kind === "due" && i.index === index);

  /** Class and delay that make an element fade in when `item` begins to appear. */
  const enter = (item: Item | undefined) => ({
    className: animate ? "writing-text-word" : undefined,
    style: animate && item ? delayStyle(item.delays[0] ?? 0) : undefined,
  });

  // The words of one item, each with its own delay.
  const text = (item: Item) =>
    item.words.map((word, i) => (
      <span key={i}>
        {i > 0 && " "}
        {animate ? (
          <WritingWord delay={item.delays[i]}>{word}</WritingWord>
        ) : (
          <span className="inline-block">{word}</span>
        )}
      </span>
    ));

  function toggleTask(i: number) {
    setDoneTasks((prev) => {
      const next = new Set(prev);
      if (!next.delete(i)) next.add(i);
      return next;
    });
  }

  return (
    <div className={cn("flex flex-col", s.heading)}>
      {topics.length > 0 && (
        <Section title="Topics" {...enter(topics[0])}>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <Badge
                key={t.index}
                variant="outline"
                className={cn("h-auto px-2.5 py-1", s.pill, enter(t).className)}
                style={enter(t).style}
              >
                {t.words.join(" ")}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {points.length > 0 && (
        <Section title="Key points" {...enter(points[0])}>
          <ul className="grid gap-2">
            {points.map((p) => (
              <li
                key={p.index}
                className={cn(
                  "relative pl-5 leading-snug before:absolute before:top-[0.55em] before:left-0.5 before:size-1.5 before:rounded-full before:bg-muted-foreground/50",
                  s.body,
                  enter(p).className,
                )}
                style={enter(p).style}
              >
                {text(p)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(assignments.length > 0 || tasks.length > 0) && (
        <div
          className={cn(
            "grid gap-7",
            assignments.length > 0 && tasks.length > 0 && "sm:grid-cols-2",
          )}
        >
          {assignments.length > 0 && (
            <Section title="Assignments" {...enter(assignments[0])}>
              <div className="grid gap-3">
                {assignments.map((a) => {
                  const due = dueFor(a.index);
                  return (
                    <div
                      key={a.index}
                      className="flex flex-col items-start gap-1.5"
                    >
                      <strong className={s.body}>{text(a)}</strong>
                      {due && (
                        <Badge
                          variant="highlight"
                          className={cn(
                            "h-auto rounded-md px-2 py-0.5 font-mono text-[11px] font-medium text-highlight-foreground tabular-nums",
                            enter(due).className,
                          )}
                          style={enter(due).style}
                        >
                          {due.words.join(" ")}
                        </Badge>
                      )}
                      {assignmentActions && (
                        <span className={enter(due).className} style={enter(due).style}>
                          {assignmentActions(a.index)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}
          {tasks.length > 0 && (
            <Section title="Tasks" {...enter(tasks[0])}>
              <div className="grid gap-2">
                {tasks.map((task) => (
                  <label
                    key={task.index}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 leading-snug",
                      s.body,
                    )}
                  >
                    <span
                      className={cn("mt-1 inline-flex", enter(task).className)}
                      style={enter(task).style}
                    >
                      <Checkbox
                        checked={doneTasks.has(task.index)}
                        onCheckedChange={() => toggleTask(task.index)}
                      />
                    </span>
                    <span
                      className={cn(
                        doneTasks.has(task.index) &&
                          "text-muted-foreground line-through",
                      )}
                    >
                      {text(task)}
                    </span>
                  </label>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {tip && (
        <Section title="Study tip" {...enter(tip)}>
          <p className={cn("rounded-xl border border-border bg-muted/50 px-4 py-3 leading-snug dark:bg-white/[0.03]", s.body)}>
            {text(tip)}
          </p>
        </Section>
      )}
    </div>
  );
}
