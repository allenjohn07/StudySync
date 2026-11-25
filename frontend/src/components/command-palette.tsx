"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  CalendarClock,
  FileText,
  Folder,
  LogOut,
  Monitor,
  Moon,
  PanelLeft,
  Plus,
  RotateCw,
  CalendarPlus,
  Search,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { SessionTitle, whenLabel } from "@/components/app-sidebar";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { useTurnOnAppleCalendar } from "@/components/calendar-actions";
import { useAppleCalendar } from "@/hooks/use-apple-calendar";
import { upcomingDue } from "@/lib/calendar";
import { subjectDot } from "@/lib/subjects";
import type { Lesson, Subject } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Whole-word-ish matching instead of cmdk's fuzzy default, which matches scattered letters anywhere in a long
 * transcript (so every session matched everything). Every word typed must appear; title matches rank first.
 */
function matchScore(value: string, search: string, keywords: string[] = []) {
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return 1;
  const label = value.toLowerCase();
  const all = `${label} ${keywords.join(" ").toLowerCase()}`;
  if (!terms.every((t) => all.includes(t))) return 0;
  return terms.every((t) => label.includes(t)) ? 1 : 0.5;
}

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** ⌘L (Ctrl+L elsewhere) opens the palette; ⌘K / Ctrl+K too, as most apps use it. */
export function usePaletteShortcut(onToggle: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((key === "l" || key === "k") && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onToggle]);
}

/** The "Search…" button in the header, like the one on ui.shadcn.com. */
export function PaletteButton({ onClick, className }: { onClick: () => void; className?: string }) {
  // the platform is only known in the browser; assume a Mac until then
  const mac = useSyncExternalStore(
    () => () => {},
    isMac,
    () => true,
  );
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Search everything"
      className={cn(
        "group inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-sm text-muted-foreground shadow-xs transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 sm:w-52 dark:bg-white/[0.03]",
        className,
      )}
    >
      <Search className="size-4 shrink-0" />
      <span className="whitespace-nowrap max-sm:hidden">Search…</span>
      <span className="ml-auto flex gap-0.5 max-sm:hidden">
        <Kbd>{mac ? "⌘" : "Ctrl"}</Kbd>
        <Kbd>L</Kbd>
      </span>
    </button>
  );
}

/** Where a query matches a session's transcript: a few words either side, for showing under the title. */
function transcriptSnippet(transcript: string | null, query: string) {
  const q = query.trim().toLowerCase();
  if (!transcript || q.length < 2) return null;
  const at = transcript.toLowerCase().indexOf(q);
  if (at < 0) return null;
  const start = Math.max(0, transcript.lastIndexOf(" ", Math.max(0, at - 40)));
  const end = Math.min(transcript.length, at + q.length + 50);
  return {
    before: `${start > 0 ? "…" : ""}${transcript.slice(start, at).trimStart()}`,
    match: transcript.slice(at, at + q.length),
    after: `${transcript.slice(at + q.length, end)}${end < transcript.length ? "…" : ""}`,
  };
}

export function CommandPalette({
  open,
  onOpenChange,
  sessions,
  subjects,
  activeSession,
  locked,
  onOpenSession,
  onNewRecording,
  onContinue,
  onToggleSidebar,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: Lesson[];
  subjects: Subject[];
  /** The session shown on the page, if any (offers "Continue this session"). */
  activeSession: Lesson | null;
  /** True while recording: switching sessions and starting another recording are disabled. */
  locked: boolean;
  onOpenSession: (id: number) => void;
  onNewRecording: () => void;
  onContinue: (id: number) => void;
  onToggleSidebar: () => void;
  onLogout: () => void;
}) {
  const [query, setQuery] = useState("");
  // Set when an item is chosen: focus then stays put instead of jumping back to whatever was focused before
  // (e.g. the previous session in the sidebar, which would show a focus ring as if it were still selected).
  const choseRef = useRef(false);
  const { setTheme } = useTheme();
  const apple = useAppleCalendar().data;
  const { turnOn: turnOnApple } = useTurnOnAppleCalendar();
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const due = upcomingDue(sessions, subjects);

  // Run an action, then close the palette (and clear the search for next time).
  const run = (action: () => void) => () => {
    choseRef.current = true;
    onOpenChange(false);
    setQuery("");
    action();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQuery("");
      }}
      finalFocus={() => {
        const chose = choseRef.current;
        choseRef.current = false;
        return !chose; // Esc / click outside: back to where you were; after choosing something: nowhere
      }}
      title="Search StudySync"
      description="Search sessions, subjects, topics, transcripts and actions"
    >
      <Command className="rounded-none! bg-transparent p-0" filter={matchScore}>
      <CommandInput value={query} onValueChange={setQuery} placeholder="Search sessions, topics, transcripts, actions…" />
      <CommandList>
        <CommandEmpty>Nothing matches &ldquo;{query.trim()}&rdquo;.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem value="New recording start record" disabled={locked} onSelect={run(onNewRecording)}>
            <Plus /> New recording
            <CommandShortcut>⌃⌃</CommandShortcut>
          </CommandItem>
          {activeSession?.status === "done" && (
            <CommandItem
              value={`Continue this session ${activeSession.title}`}
              disabled={locked}
              onSelect={run(() => onContinue(activeSession.id))}
            >
              <RotateCw /> Continue &ldquo;{activeSession.title}&rdquo;
            </CommandItem>
          )}
          <CommandItem value="Toggle sidebar show hide" onSelect={run(onToggleSidebar)}>
            <PanelLeft /> Toggle sidebar
          </CommandItem>
          <CommandItem value="Light theme mode" onSelect={run(() => setTheme("light"))}>
            <Sun /> Light theme
          </CommandItem>
          <CommandItem value="Dark theme mode" onSelect={run(() => setTheme("dark"))}>
            <Moon /> Dark theme
          </CommandItem>
          <CommandItem value="System theme mode auto" onSelect={run(() => setTheme("system"))}>
            <Monitor /> System theme
          </CommandItem>
          {apple?.supported && !apple.enabled && (
            <CommandItem value="Add due dates to Apple Calendar sync" onSelect={run(turnOnApple)}>
              <CalendarPlus /> Add due dates to Apple Calendar
            </CommandItem>
          )}
          <CommandItem value="Log out sign out" onSelect={run(onLogout)}>
            <LogOut /> Log out
          </CommandItem>
        </CommandGroup>

        {due.length > 0 && (
          <CommandGroup heading="Upcoming deadlines">
            {due.map((item) => (
              <CommandItem
                key={`${item.sessionId}-${item.title}-${item.dueDate}`}
                value={`deadline ${item.title} ${item.dueDate} ${item.subject?.name ?? ""} ${item.sessionId}`}
                keywords={["due", "assignment", item.sessionTitle]}
                disabled={locked}
                onSelect={run(() => onOpenSession(item.sessionId))}
              >
                <CalendarClock />
                <span className="truncate">{item.title}</span>
                <CommandShortcut className="shrink-0 pl-3 tracking-normal tabular-nums">
                  {new Date(`${item.dueDate}T00:00:00`).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {subjects.length > 0 && (
          <CommandGroup heading="Subjects">
            {subjects.map((subject) => {
              const latest = sessions.find((s) => s.subjectId === subject.id);
              const count = sessions.filter((s) => s.subjectId === subject.id).length;
              return (
                <CommandItem
                  key={subject.id}
                  value={`subject ${subject.name}`}
                  disabled={locked || !latest}
                  onSelect={run(() => latest && onOpenSession(latest.id))}
                >
                  <Folder />
                  <span className={cn("size-2 shrink-0 rounded-full", subjectDot(subject))} />
                  {subject.name}
                  <CommandShortcut className="tracking-normal tabular-nums">
                    {count} {count === 1 ? "session" : "sessions"}
                  </CommandShortcut>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {sessions.length > 0 && (
          <CommandGroup heading="Sessions">
            {sessions.map((session) => {
              const subject = session.subjectId !== null ? subjectById.get(session.subjectId) : undefined;
              const summary = session.summary;
              const snippet = transcriptSnippet(session.transcript, query);
              return (
                <CommandItem
                  key={session.id}
                  value={`session ${session.id} ${session.title}`}
                  keywords={[
                    subject?.name ?? "unsorted",
                    ...(summary?.topics ?? []),
                    ...(summary?.keyPoints ?? []),
                    ...(summary?.assignments.map((a) => a.title) ?? []),
                    ...(summary?.tasks ?? []),
                    session.transcript ?? "",
                  ]}
                  disabled={locked && session.id !== activeSession?.id}
                  onSelect={run(() => onOpenSession(session.id))}
                  className="items-start"
                >
                  <FileText className="mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      <SessionTitle session={session} />
                    </span>
                    {snippet ? (
                      <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {snippet.before}
                        <mark className="rounded-[3px] bg-highlight/70 px-0.5 text-highlight-foreground">{snippet.match}</mark>
                        {snippet.after}
                      </span>
                    ) : (
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={cn("size-1.5 shrink-0 rounded-full", subjectDot(subject ?? null))} />
                        {subject?.name ?? "Unsorted"} · {whenLabel(session.createdAt)}
                      </span>
                    )}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
      </Command>
      <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> to move
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>↵</Kbd> to open
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <Kbd>esc</Kbd> to close
        </span>
      </div>
    </CommandDialog>
  );
}
