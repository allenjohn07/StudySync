"use client";

import { useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { whenLabel } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { useCreateSubject } from "@/hooks/use-subjects";
import { ApiError } from "@/lib/api";
import { subjectDot } from "@/lib/subjects";
import type { Lesson, Subject } from "@/lib/types";
import { cn } from "@/lib/utils";

export type RecordingTarget =
  | { mode: "new"; subjectId: number | null; title: string }
  | { mode: "continue"; id: number };

type Mode = RecordingTarget["mode"];

const LAST_SUBJECT_KEY = "studysync_last_subject";

function lastSubject(subjects: Subject[]): number | null {
  if (typeof window === "undefined") return null;
  const id = Number(localStorage.getItem(LAST_SUBJECT_KEY));
  return subjects.some((s) => s.id === id) ? id : null;
}

/**
 * Asked before every recording: file it under a subject (or start one), or keep recording into an
 * earlier session. Mounted fresh each time it opens, so it always starts from the given defaults.
 */
export function NewSessionDialog({
  open,
  onOpenChange,
  subjects,
  sessions,
  initialMode = "new",
  initialSessionId = null,
  hotkeyArmed,
  onStart,
  formId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: Subject[];
  sessions: Lesson[];
  initialMode?: Mode;
  initialSessionId?: number | null;
  hotkeyArmed: boolean;
  onStart: (target: RecordingTarget) => void;
  /** Lets the page submit the form (the Ctrl Ctrl hotkey). */
  formId?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 sm:max-w-[480px]">
        {open && (
          <DialogBody
            subjects={subjects}
            sessions={sessions}
            initialMode={initialMode}
            initialSessionId={initialSessionId}
            hotkeyArmed={hotkeyArmed}
            onCancel={() => onOpenChange(false)}
            onStart={onStart}
            formId={formId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DialogBody({
  subjects,
  sessions,
  initialMode,
  initialSessionId,
  hotkeyArmed,
  onCancel,
  onStart,
  formId,
}: {
  subjects: Subject[];
  sessions: Lesson[];
  initialMode: Mode;
  initialSessionId: number | null;
  hotkeyArmed: boolean;
  onCancel: () => void;
  onStart: (target: RecordingTarget) => void;
  formId?: string;
}) {
  const continuable = sessions.filter((s) => s.status === "done");
  const [mode, setMode] = useState<Mode>(continuable.length ? initialMode : "new");
  const [subjectId, setSubjectId] = useState<number | null>(() => lastSubject(subjects));
  const [title, setTitle] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(
    initialSessionId ?? continuable[0]?.id ?? null,
  );

  const canStart = mode === "new" || sessionId !== null;

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canStart) return;
    if (mode === "new") {
      if (subjectId === null) localStorage.removeItem(LAST_SUBJECT_KEY);
      else localStorage.setItem(LAST_SUBJECT_KEY, String(subjectId));
      onStart({ mode: "new", subjectId, title: title.trim() });
    } else if (sessionId !== null) {
      onStart({ mode: "continue", id: sessionId });
    }
  }

  return (
    <form id={formId} onSubmit={submit} className="contents">
      <DialogHeader>
        <DialogTitle className="text-[15px] font-semibold tracking-[-0.01em]">New recording</DialogTitle>
        <DialogDescription>
          File it under a subject, or keep recording into an earlier session.
        </DialogDescription>
      </DialogHeader>

      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "new", label: "New session" },
          { value: "continue", label: "Continue a session", disabled: !continuable.length },
        ]}
      />

      <div className="min-h-[236px]">
        {mode === "new" ? (
          <NewSessionFields
            subjects={subjects}
            subjectId={subjectId}
            onSubjectChange={setSubjectId}
            title={title}
            onTitleChange={setTitle}
          />
        ) : (
          <ContinueFields
            subjects={subjects}
            sessions={continuable}
            sessionId={sessionId}
            onChange={setSessionId}
          />
        )}
      </div>

      <DialogFooter className="sm:justify-between">
        <p className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
          <Kbd className={cn("transition-colors", hotkeyArmed && "border-foreground/30 bg-highlight text-highlight-foreground")}>
            Ctrl
          </Kbd>
          <Kbd>Ctrl</Kbd>
          <span className="ml-1">to start</span>
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canStart} className="gap-2">
            <span className="size-2 rounded-full bg-destructive" />
            {mode === "new" ? "Start recording" : "Continue recording"}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; disabled?: boolean }[];
}) {
  const index = options.findIndex((o) => o.value === value);
  return (
    <div role="tablist" className="relative grid grid-cols-2 rounded-lg bg-muted p-0.5 dark:bg-white/[0.05]">
      <span
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-[7px] bg-card shadow-[0_1px_2px_oklch(0_0_0/0.08),0_0_0_1px_var(--border)] transition-transform duration-200 ease-out dark:bg-white/10"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative z-10 h-8 rounded-[7px] text-[13px] font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40",
            o.value === value && "text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FieldLabel({ children, htmlFor, hint }: { children: React.ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 flex items-baseline justify-between text-[13px] font-medium">
      {children}
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

const chip =
  "inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97]";

function NewSessionFields({
  subjects,
  subjectId,
  onSubjectChange,
  title,
  onTitleChange,
}: {
  subjects: Subject[];
  subjectId: number | null;
  onSubjectChange: (id: number | null) => void;
  title: string;
  onTitleChange: (title: string) => void;
}) {
  const createSubject = useCreateSubject();
  const [adding, setAdding] = useState(subjects.length === 0);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function addSubject() {
    const trimmed = name.trim();
    if (!trimmed) return setAdding(false);
    setError(null);
    createSubject.mutate(
      { name: trimmed },
      {
        onSuccess: (subject) => {
          onSubjectChange(subject.id);
          setName("");
          setAdding(false);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't add the subject."),
      },
    );
  }

  const option = (id: number | null, label: React.ReactNode, dot: string) => {
    const selected = subjectId === id;
    return (
      <button
        key={id ?? "unsorted"}
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => onSubjectChange(id)}
        className={cn(
          chip,
          selected
            ? "border-foreground/30 bg-accent text-foreground dark:bg-white/10"
            : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground dark:bg-white/[0.03]",
        )}
      >
        <span className={cn("size-2 rounded-full", dot)} />
        {label}
        {selected && <Check className="-mr-1 size-3.5" />}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <FieldLabel hint="Subject or class">Subject</FieldLabel>
        <div role="radiogroup" aria-label="Subject" className="flex flex-wrap gap-1.5">
          {subjects.map((s) => option(s.id, s.name, subjectDot(s)))}
          {option(null, "Unsorted", subjectDot(null))}
          {adding ? (
            <span className={cn(chip, "border-ring bg-card pr-1 pl-3 shadow-[0_0_0_3px_var(--border)] dark:bg-white/[0.03]")}>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSubject();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation(); // close the field, not the dialog
                    setAdding(false);
                    setName("");
                  }
                }}
                placeholder="e.g. Physics 101"
                aria-label="New subject name"
                maxLength={60}
                className="w-32 bg-transparent outline-none placeholder:text-muted-foreground"
              />
              <Button type="button" size="icon-xs" onClick={addSubject} disabled={createSubject.isPending} aria-label="Add subject">
                <Check />
              </Button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className={cn(chip, "border-dashed border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground")}
            >
              <Plus className="size-3.5" /> New subject
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>

      <div>
        <FieldLabel htmlFor="session-title" hint="Optional">
          Name
        </FieldLabel>
        <Input
          id="session-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g. Week 6: Thermodynamics"
          maxLength={80}
          autoComplete="off"
        />
        <p className="mt-2 text-xs text-muted-foreground">Leave it empty and it is named after its topics.</p>
      </div>
    </div>
  );
}

function ContinueFields({
  subjects,
  sessions,
  sessionId,
  onChange,
}: {
  subjects: Subject[];
  sessions: Lesson[];
  sessionId: number | null;
  onChange: (id: number) => void;
}) {
  const [query, setQuery] = useState("");
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(needle) ||
          (s.subjectId !== null && byId.get(s.subjectId)?.name.toLowerCase().includes(needle)),
      )
    : sessions;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a session"
          aria-label="Find a session"
          className="pl-9"
          autoComplete="off"
        />
      </div>
      <div
        role="radiogroup"
        aria-label="Session to continue"
        className="-mx-1 flex max-h-[188px] flex-col gap-px overflow-y-auto px-1 py-1"
      >
        {shown.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">No sessions match.</p>}
        {shown.map((s) => {
          const subject = s.subjectId !== null ? byId.get(s.subjectId) : null;
          const selected = s.id === sessionId;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(s.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50",
                selected && "bg-accent dark:bg-white/10",
              )}
            >
              <span className={cn("size-2 shrink-0 rounded-full", subjectDot(subject))} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{s.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {subject?.name ?? "Unsorted"} · {whenLabel(s.createdAt)}
                </span>
              </span>
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border border-input transition-colors",
                  selected && "border-foreground bg-foreground text-background",
                )}
              >
                {selected && <Check className="size-2.5" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        The new part is added after its transcript and the summary is rewritten.
      </p>
    </div>
  );
}
