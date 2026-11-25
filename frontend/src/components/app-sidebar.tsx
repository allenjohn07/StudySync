"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  HardDrive,
  Mic,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { groupBySubject, subjectDot } from "@/lib/subjects";
import type { Lesson, Subject } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Today 9:10 AM", "Yesterday", or a short date. */
export function whenLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const daysAgo = Math.round((startOfDay(new Date()) - startOfDay(d)) / DAY_MS);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (daysAgo === 0) return `Today, ${time}`;
  if (daysAgo === 1) return `Yesterday, ${time}`;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** The session's name, or a shimmering placeholder while it is still being recorded or generated. */
export function SessionTitle({ session }: { session: Lesson }) {
  if (session.status === "recording" || session.status === "processing") {
    return (
      <ShimmeringText
        text={session.status === "recording" ? "Recording…" : "Summarizing…"}
        baseColor="var(--muted-foreground)"
        shimmerColor="var(--foreground)"
      />
    );
  }
  return <>{session.title}</>;
}

const groupKey = (subject: Subject | null) => (subject ? String(subject.id) : "unsorted");

export function AppSidebar({
  subjects,
  sessions,
  activeId,
  locked,
  deleting,
  clearing,
  onNew,
  onSelect,
  onDelete,
  onClearAll,
  className,
}: {
  subjects: Subject[];
  sessions: Lesson[];
  activeId: number | null;
  /** True while recording: switching or deleting sessions is disabled. */
  locked: boolean;
  deleting: boolean;
  clearing: boolean;
  onNew: () => void;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onClearAll: () => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const working = sessions.some((s) => s.status === "recording" || s.status === "processing");

  // "/" jumps to the search field (unless you're already typing somewhere).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key !== "/" || target.closest("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const needle = query.trim().toLowerCase();
  const matches = (s: Lesson) =>
    !needle ||
    s.title.toLowerCase().includes(needle) ||
    !!s.summary?.topics.some((t) => t.toLowerCase().includes(needle));
  const groups = groupBySubject(subjects, sessions)
    .map((g) => ({
      ...g,
      sessions: g.sessions.filter(matches),
      nameMatches: !!needle && !!g.subject?.name.toLowerCase().includes(needle),
    }))
    .map((g) => (g.nameMatches ? { ...g, sessions: sessions.filter((s) => s.subjectId === g.subject?.id) } : g))
    .filter((g) => !needle || g.sessions.length > 0);

  return (
    <aside
      className={cn(
        "flex h-full w-[272px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <div className="flex flex-col gap-1 p-3">
        <button
          type="button"
          onClick={onNew}
          disabled={locked}
          className="group/new flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-[background-color,transform] duration-150 ease-out outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
        >
          <span className="flex size-[18px] items-center justify-center rounded-full bg-foreground text-background transition-transform duration-200 ease-out group-hover/new:rotate-90">
            <Plus className="size-3" strokeWidth={3} />
          </span>
          New recording
        </button>

        <label className="group/search relative flex h-9 items-center rounded-lg px-2.5 text-sm text-muted-foreground transition-colors focus-within:bg-sidebar-accent hover:bg-sidebar-accent">
          <Search className="size-4 shrink-0" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (setQuery(""), e.currentTarget.blur())}
            placeholder="Search"
            aria-label="Search sessions and subjects"
            className="ml-2.5 min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="rounded p-0.5 hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <Kbd className="group-focus-within/search:opacity-0">/</Kbd>
          )}
        </label>
      </div>

      <nav aria-label="Sessions" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
        <h2 className="label-mono px-2.5 pt-2 pb-1.5">Subjects</h2>

        {sessions.length === 0 && subjects.length === 0 && (
          <div className="mx-1 mt-1 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <Mic className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium">No sessions yet</p>
            <p className="text-xs text-muted-foreground">Start a recording and it shows up here.</p>
          </div>
        )}

        {needle && groups.length === 0 && (
          <p className="px-2.5 py-2 text-sm text-muted-foreground">Nothing matches “{query.trim()}”.</p>
        )}

        {groups.map(({ subject, sessions: items }) => {
          const key = groupKey(subject);
          const hasActive = items.some((s) => s.id === activeId);
          // Searching opens everything; otherwise a group is open unless you closed it (the open session's group stays open).
          const open = !!needle || hasActive || !collapsed[key];
          return (
            <div key={key} className="flex flex-col">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setCollapsed((c) => ({ ...c, [key]: open }))}
                className="group/row flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-left text-sm font-medium transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span className={cn("size-2 shrink-0 rounded-full", subjectDot(subject))} />
                <span className="min-w-0 flex-1 truncate">{subject?.name ?? "Unsorted"}</span>
                <span className="text-xs text-muted-foreground tabular-nums group-hover/row:hidden">
                  {items.length || ""}
                </span>
                <ChevronRight
                  className={cn(
                    "hidden size-3.5 text-muted-foreground transition-transform duration-200 ease-out group-hover/row:block",
                    open && "rotate-90",
                  )}
                />
              </button>

              {/* Animates open/closed by height (grid rows 0fr → 1fr). */}
              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                  open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                )}
              >
                <ul className="ml-[13px] flex min-h-0 flex-col gap-px overflow-hidden border-l border-sidebar-border pl-2">
                  {items.length === 0 && (
                    <li className="px-2.5 py-1.5 text-xs text-muted-foreground">No sessions yet</li>
                  )}
                  {items.map((s, i) => {
                    const active = s.id === activeId;
                    return (
                      <li key={s.id} className={cn("group/item relative", i === 0 && "mt-0.5", i === items.length - 1 && "mb-1.5")}>
                        <button
                          type="button"
                          disabled={locked && !active}
                          onClick={() => onSelect(s.id)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-1.5 pr-8 text-left transition-colors duration-150 outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50",
                            active && "bg-sidebar-accent",
                          )}
                        >
                          {/* the open session gets a short marker on the guide line */}
                          {active && (
                            <span className="absolute top-2 bottom-2 -left-[9px] w-px bg-foreground" aria-hidden="true" />
                          )}
                          <span
                            className={cn(
                              "w-full truncate text-[13px] leading-5",
                              active ? "font-medium text-foreground" : "text-sidebar-foreground/80",
                            )}
                          >
                            <SessionTitle session={s} />
                          </span>
                          <span className="text-[11px] leading-4 text-muted-foreground tabular-nums">
                            {whenLabel(s.createdAt)}
                          </span>
                        </button>

                        <Popover
                          open={confirmId === s.id}
                          onOpenChange={(o) => setConfirmId(o ? s.id : null)}
                        >
                          <PopoverTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`Delete ${s.title}`}
                                title={s.status === "processing" ? "Wait for this session to finish" : "Delete session"}
                                disabled={locked || deleting || s.status === "processing"}
                                className={cn(
                                  "absolute top-1/2 right-1.5 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 disabled:opacity-0 max-lg:opacity-60",
                                  confirmId === s.id && "opacity-100",
                                )}
                              />
                            }
                          >
                            <Trash2 />
                          </PopoverTrigger>
                          <PopoverContent align="start" side="right" className="w-60">
                            <PopoverHeader>
                              <PopoverTitle>Delete this session?</PopoverTitle>
                              <PopoverDescription>Its transcript and summary will be removed.</PopoverDescription>
                            </PopoverHeader>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => setConfirmId(null)}>
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setConfirmId(null);
                                  onDelete(s.id);
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2 border-t border-sidebar-border p-3">
        {/* a quiet info card, like the one at the bottom of oklch.fyi's sidebar */}
        <div className="rounded-xl border border-sidebar-border bg-card p-1 shadow-xs dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-background px-2.5 py-2 text-[13px] font-medium dark:bg-white/[0.03]">
            <HardDrive className="size-4 text-muted-foreground" />
            Saved on this computer
          </div>
          <p className="px-2.5 pt-1.5 pb-1 text-xs leading-snug text-muted-foreground">
            Audio is transcribed and summarized locally. Nothing leaves your laptop.
          </p>
        </div>

        {sessions.length > 0 && (
          <Popover open={clearOpen} onOpenChange={setClearOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  disabled={locked || clearing || working}
                  title={working ? "Wait for the current session to finish" : "Delete every session"}
                  className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-muted-foreground transition-colors outline-none hover:bg-sidebar-accent hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                />
              }
            >
              <Trash2 className="size-4" /> Clear all sessions
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-64">
              <PopoverHeader>
                <PopoverTitle>Delete all sessions?</PopoverTitle>
                <PopoverDescription>
                  All {sessions.length} {sessions.length === 1 ? "session" : "sessions"} will be removed with their
                  transcripts and summaries. Your subjects stay. This can&apos;t be undone.
                </PopoverDescription>
              </PopoverHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setClearOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setClearOpen(false);
                    onClearAll();
                  }}
                >
                  Delete all
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </aside>
  );
}
