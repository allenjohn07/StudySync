"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ChevronRight, LogOut, PanelLeft, Plus, RotateCw } from "lucide-react";
import { AppSidebar, SessionTitle, whenLabel } from "@/components/app-sidebar";
import { BrandMark } from "@/components/brand-mark";
import { AddToCalendar } from "@/components/calendar-actions";
import { NewSessionDialog, type RecordingTarget } from "@/components/new-session-dialog";
import { ScrollFade } from "@/components/scroll-fade";
import { SummaryStream } from "@/components/summary-stream";
import { ThemeToggle } from "@/components/theme-toggle";
import { TopicResources } from "@/components/topic-resources";
import { Words, splitWords } from "@/components/words";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WritingText } from "@/components/ui/writing-text";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import {
  useAddChunk,
  useClearLessons,
  useCreateLesson,
  useDeleteLesson,
  useFinishLesson,
  useLesson,
  useLessons,
  useResumeLesson,
  useResummarize,
} from "@/hooks/use-lessons";
import { useLocalAuth } from "@/hooks/use-local-auth";
import { useSubjects } from "@/hooks/use-subjects";
import { ApiError } from "@/lib/api";
import { subjectDot } from "@/lib/subjects";
import { cn } from "@/lib/utils";

// How long a summary may run before "Try again" is offered (it normally takes well under half a minute).
const SLOW_SUMMARY_MS = 40_000;

// Two Control taps closer together than this count as a double tap.
const HOTKEY_WINDOW_MS = 400;

const SIDEBAR_KEY = "studysync_sidebar_open";
const DIALOG_FORM_ID = "new-recording-form";

function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function errorMessage(err: unknown) {
  return err instanceof ApiError ? err.message : "Couldn't reach the backend. Is it running on port 4000?";
}

/** Open on wide screens unless it was closed last time; closed on phones. Read only in the browser. */
function initialSidebarOpen() {
  if (typeof window === "undefined") return true;
  if (!window.matchMedia("(min-width: 1024px)").matches) return false;
  return localStorage.getItem(SIDEBAR_KEY) !== "0";
}

/** Shown while a summary is being written: after a while it offers to start over, in case it is stuck. */
function SlowSummaryNotice({ onRetry, pending }: { onRetry: () => void; pending: boolean }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), SLOW_SUMMARY_MS);
    return () => clearTimeout(id);
  }, []);
  if (!slow) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <span>This is taking longer than usual.</span>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry} disabled={pending}>
        <RotateCw /> Try again
      </Button>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { status, logout } = useLocalAuth();
  const createLesson = useCreateLesson();
  const resumeLesson = useResumeLesson();
  const addChunk = useAddChunk();
  const finishLesson = useFinishLesson();
  const deleteLesson = useDeleteLesson();
  const clearLessons = useClearLessons();
  const resummarize = useResummarize();
  const [retries, setRetries] = useState(0); // restarts the "taking too long" timer after each retry

  const [lessonId, setLessonId] = useState<number | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  // The session whose summary was just written here: it streams in; opening an old session shows it at once.
  const [streamingId, setStreamingId] = useState<number | null>(null);
  // Resolves to the lesson's id (or null if it couldn't be created/continued); chunks wait on it.
  const lessonPromiseRef = useRef<Promise<number | null>>(Promise.resolve(null));

  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen);
  const [dialog, setDialog] = useState<{ open: boolean; mode: RecordingTarget["mode"]; sessionId: number | null }>({
    open: false,
    mode: "new",
    sessionId: null,
  });

  const recorder = useAudioRecorder(async (audio, seq, start, final) => {
    const id = await lessonPromiseRef.current;
    if (id === null) return;
    if (!final) {
      // A preview is best-effort: the finished piece will cover it if this one fails.
      await addChunk.mutateAsync({ id, audio, seq, start, final }).catch(() => {});
      return;
    }
    // The finished piece gets one retry, so a brief hiccup doesn't leave a hole in the transcript.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await addChunk.mutateAsync({ id, audio, seq, start, final });
        return;
      } catch (err) {
        if (attempt === 1) setRequestError(errorMessage(err));
      }
    }
  });
  const lesson = useLesson(lessonId).data;
  const sessions = useLessons().data ?? [];
  const subjects = useSubjects().data ?? [];

  function toggleSidebar(open = !sidebarOpen) {
    setSidebarOpen(open);
    if (window.matchMedia("(min-width: 1024px)").matches) localStorage.setItem(SIDEBAR_KEY, open ? "1" : "0");
  }

  // Hotkey: tapping Control twice quickly opens the new-recording dialog, starts from it, or stops.
  // The handler is kept in a ref so the keydown listener (registered once) always calls the latest version.
  const [hotkeyArmed, setHotkeyArmed] = useState(false);
  const hotkeyRef = useRef<() => void>(() => {});
  useEffect(() => {
    hotkeyRef.current = () => {
      if (status !== "in") return;
      if (recorder.recording) void handleStop();
      else if (dialog.open) (document.getElementById(DIALOG_FORM_ID) as HTMLFormElement | null)?.requestSubmit();
      else if (!finishLesson.isPending && lesson?.status !== "processing") openDialog("new");
    };
  });
  useEffect(() => {
    let lastTap = 0;
    let disarm: ReturnType<typeof setTimeout> | undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Control") {
        lastTap = 0; // Ctrl+C and friends don't count
        clearTimeout(disarm);
        setHotkeyArmed(false);
        return;
      }
      if (e.repeat) return;
      const now = Date.now();
      if (now - lastTap < HOTKEY_WINDOW_MS) {
        lastTap = 0;
        clearTimeout(disarm);
        setHotkeyArmed(false);
        hotkeyRef.current();
      } else {
        lastTap = now;
        setHotkeyArmed(true); // first tap registered: light up the first keycap until the window closes
        clearTimeout(disarm);
        disarm = setTimeout(() => setHotkeyArmed(false), HOTKEY_WINDOW_MS);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(disarm);
    };
  }, []);

  useEffect(() => {
    if (status === "out") router.replace("/login");
  }, [status, router]);

  if (status !== "in") return null;

  const processing = finishLesson.isPending || lesson?.status === "processing";
  const summary = lesson?.summary;
  const segments = lesson?.segments ?? [];
  const subject = lesson?.subjectId != null ? subjects.find((s) => s.id === lesson.subjectId) : null;
  // Words fade in as they are heard; an old session opened from the sidebar is shown as plain text.
  const liveTranscript = !!lesson && (lesson.status === "recording" || lesson.id === streamingId);
  const shownError = recorder.error ?? requestError ?? (lesson?.status === "recording" ? lesson.error : null);
  const busy = processing || createLesson.isPending || resumeLesson.isPending;

  function openDialog(mode: RecordingTarget["mode"], sessionId: number | null = null) {
    setDialog({ open: true, mode, sessionId });
  }

  async function handleStart(target: RecordingTarget) {
    setDialog((d) => ({ ...d, open: false }));
    discardIfFailed();
    setRequestError(null);
    setStreamingId(null);
    finishLesson.reset();

    if (target.mode === "continue") {
      setLessonId(target.id);
      if (!(await recorder.start())) return;
      const resumed = resumeLesson.mutateAsync(target.id).then(() => target.id);
      resumed.catch((err) => setRequestError(errorMessage(err)));
      lessonPromiseRef.current = resumed.then(
        (id) => id,
        () => null,
      );
      return;
    }

    setLessonId(null);
    if (!(await recorder.start())) return;
    const created = createLesson.mutateAsync({ subjectId: target.subjectId, title: target.title || undefined });
    created.then(
      ({ id }) => setLessonId(id),
      (err) => setRequestError(errorMessage(err)),
    );
    lessonPromiseRef.current = created.then(
      ({ id }) => id,
      () => null,
    );
  }

  async function handleStop() {
    await recorder.stop();
    const id = await lessonPromiseRef.current;
    if (id === null) return;
    setStreamingId(id);
    finishLesson.mutate(id, { onError: (err) => setRequestError(errorMessage(err)) });
  }

  function handleClearAll() {
    clearLessons.mutate(undefined, {
      onSuccess: () => openSession(null),
      onError: (err) => setRequestError(errorMessage(err)),
    });
  }

  // Write the summary again from the saved transcript (after a failure, or when it takes too long).
  function handleRetry() {
    if (!lesson) return;
    setRequestError(null);
    setStreamingId(lesson.id);
    setRetries((n) => n + 1);
    resummarize.mutate(lesson.id, { onError: (err) => setRequestError(errorMessage(err)) });
  }

  // A new session that failed is never kept: once the user moves on, it is deleted. (A continued one
  // keeps its earlier summary, so it stays.)
  function discardIfFailed() {
    if (lesson?.status === "error" && !lesson.summary) deleteLesson.mutate(lesson.id);
  }

  // Switch what the page shows: a past session, or (null) nothing.
  function openSession(id: number | null) {
    discardIfFailed();
    setLessonId(id);
    setRequestError(null);
    setStreamingId(null);
    finishLesson.reset();
    if (!window.matchMedia("(min-width: 1024px)").matches) setSidebarOpen(false);
  }

  function handleDelete(id: number) {
    deleteLesson.mutate(id, {
      onSuccess: () => id === lessonId && openSession(null),
      onError: (err) => setRequestError(errorMessage(err)),
    });
  }

  const summaryEmpty =
    !!summary &&
    !summary.topics.length &&
    !summary.keyPoints.length &&
    !summary.assignments.length &&
    !summary.tasks.length &&
    !summary.studyTip.trim();

  const statusLabel = recorder.recording ? "Recording" : processing ? "Processing" : "Ready";

  return (
    <div className="flex h-dvh flex-col bg-sidebar">
      <header className="flex h-14 shrink-0 items-center border-b border-sidebar-border">
        <div className="flex items-center gap-1 px-3 lg:w-[272px]">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                  aria-expanded={sidebarOpen}
                  onClick={() => toggleSidebar()}
                />
              }
            >
              <PanelLeft />
            </TooltipTrigger>
            <TooltipContent side="bottom">{sidebarOpen ? "Close sidebar" : "Open sidebar"}</TooltipContent>
          </Tooltip>
          <Link href="/" className="ml-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            <BrandMark />
          </Link>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-between gap-4 px-3 sm:px-5">
          {/* Breadcrumb: subject / session */}
          <nav aria-label="Current session" className="flex min-w-0 items-center gap-1.5 text-sm max-sm:hidden">
            {lesson ? (
              <>
                <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  <span className={cn("size-2 rounded-full", subjectDot(subject))} />
                  {subject?.name ?? "Unsorted"}
                </span>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
                <span className="truncate font-medium">
                  <SessionTitle session={lesson} />
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">
                {recorder.recording ? <ShimmeringText text="Starting…" /> : "No session open"}
              </span>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={logout}>
              <LogOut className="size-3.5" /> <span className="max-sm:hidden">Log out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Wide screens: the sidebar slides its width open/closed. Phones: it floats over the page. */}
        <div
          className={cn(
            "z-30 shrink-0 overflow-hidden transition-[width,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            "max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:w-[272px] max-lg:shadow-xl",
            sidebarOpen ? "lg:w-[272px]" : "max-lg:-translate-x-full lg:w-0",
          )}
          inert={!sidebarOpen}
        >
          <AppSidebar
            subjects={subjects}
            sessions={sessions}
            activeId={lessonId}
            locked={recorder.recording}
            deleting={deleteLesson.isPending}
            clearing={clearLessons.isPending}
            onNew={() => openDialog("new")}
            onSelect={openSession}
            onDelete={handleDelete}
            onClearAll={handleClearAll}
          />
        </div>
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar"
            className="absolute inset-0 z-20 bg-black/20 lg:hidden"
            onClick={() => toggleSidebar(false)}
          />
        )}

        <main className="grid min-w-0 flex-1 grid-cols-1 overflow-y-auto bg-card lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden dark:bg-background">
          {/* Left: recorder and live transcript */}
          <section className="flex min-h-0 min-w-0 flex-col px-5 py-6 sm:px-10 sm:py-8 lg:overflow-hidden lg:border-r lg:border-border">
            <div className="flex h-8 items-center justify-between">
              <span
                className={cn(
                  "inline-flex h-7 items-center gap-2 rounded-full border border-border px-2.5 text-[13px] font-medium transition-colors",
                  recorder.recording && "border-destructive/30 bg-destructive/[0.06] text-destructive",
                )}
              >
                <span className="relative flex size-2">
                  {recorder.recording && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-destructive opacity-60" />
                  )}
                  <span
                    className={cn(
                      "relative size-2 rounded-full",
                      recorder.recording ? "bg-destructive" : processing ? "bg-highlight" : "bg-muted-foreground/40",
                    )}
                  />
                </span>
                {processing && !recorder.recording ? <ShimmeringText text={statusLabel} /> : statusLabel}
              </span>
              <span className="font-mono text-sm text-muted-foreground tabular-nums">
                {formatTime(recorder.elapsed)}
              </span>
            </div>

            <div
              aria-label="Audio waveform"
              className={cn(
                "my-6 flex h-16 items-center gap-[3px] overflow-hidden transition-opacity duration-300",
                !recorder.recording && "opacity-30",
              )}
            >
              {recorder.levels.map((level, i) => (
                <i
                  key={i}
                  className="w-[3px] shrink-0 rounded-full bg-foreground transition-[height] duration-100 ease-out"
                  style={{ height: Math.round(4 + level * 44) }}
                />
              ))}
              <span className="mx-1 h-12 w-[3px] shrink-0 rounded-full bg-destructive" />
              {Array.from({ length: 12 }).map((_, i) => (
                <b key={i} className="size-[3px] shrink-0 rounded-full bg-foreground/20" />
              ))}
            </div>

            <h2 className="section-rule mb-3">Transcript</h2>
            <ScrollFade className="min-h-48 flex-1 max-lg:max-h-80" follow={liveTranscript} watch={lesson?.segments}>
              {segments.length > 0 ? (
                <div className="grid gap-3 py-1">
                  {segments.map((seg) => (
                    <div key={seg.seq} className="grid grid-cols-[48px_1fr] gap-3 text-[15px] leading-relaxed">
                      <time className="pt-[3px] font-mono text-xs text-muted-foreground tabular-nums">
                        {formatTime(seg.start)}
                      </time>
                      <p>
                        <Words words={splitWords(seg.text)} animate={liveTranscript} />
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[15px] text-muted-foreground" role={recorder.recording ? "status" : undefined}>
                  {recorder.recording ? (
                    <ShimmeringText text="Listening… the first words appear in a moment." />
                  ) : (
                    "Start a recording and the transcript shows up here as you talk."
                  )}
                </p>
              )}
            </ScrollFade>

            {shownError && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle />
                <AlertDescription>{shownError}</AlertDescription>
              </Alert>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {recorder.recording ? (
                <>
                  <Button variant="outline" size="lg" className="gap-2.5 px-4" onClick={handleStop}>
                    <span className="size-2.5 rounded-[3px] bg-destructive" />
                    Stop
                  </Button>
                  <p role="status" className="ml-2 text-sm font-medium">
                    <ShimmeringText text="Transcribing…" />
                  </p>
                </>
              ) : (
                <>
                  <Button size="lg" className="gap-2 px-4" onClick={() => openDialog("new")} disabled={busy}>
                    <Plus /> New recording
                  </Button>
                  {lesson?.status === "done" && (
                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2 px-4"
                      disabled={busy}
                      onClick={() => handleStart({ mode: "continue", id: lesson.id })}
                    >
                      <span className="size-2 rounded-full bg-destructive" />
                      Continue this session
                    </Button>
                  )}
                </>
              )}
            </div>
            <p className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
              <Kbd className={cn("transition-colors duration-100", hotkeyArmed && "border-foreground/30 bg-highlight text-highlight-foreground")}>
                Ctrl
              </Kbd>
              <Kbd>Ctrl</Kbd>
              <span className="ml-1">to {recorder.recording ? "stop" : "start"} recording</span>
            </p>
          </section>

          {/* Right: summary */}
          <section className="min-w-0 border-t border-border px-5 py-6 sm:px-10 sm:py-8 lg:overflow-y-auto lg:border-t-0">
            <div className="mb-6 flex items-start justify-between gap-5">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-[-0.02em]">
                  <WritingText text="Summary" />
                </h1>
                {lesson && (
                  <p className="mt-1 text-sm text-muted-foreground">{whenLabel(lesson.createdAt)}</p>
                )}
              </div>
              {summary && !summaryEmpty && !processing && (
                <p className="flex h-7 shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Check className="size-4" /> Saved to your account
                </p>
              )}
            </div>

            {processing && (
              <p role="status" className="text-[15px] font-medium">
                <ShimmeringText text={lesson?.stage === "summarizing" ? "Summarizing…" : "Thinking…"} />
              </p>
            )}

            {processing && lesson?.stage === "summarizing" && (
              <SlowSummaryNotice key={`${lesson.id}-${retries}`} onRetry={handleRetry} pending={resummarize.isPending} />
            )}

            {lesson?.status === "error" && (
              <div className="mb-6 flex flex-col items-start gap-3">
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>Something went wrong: {lesson.error}</AlertDescription>
                </Alert>
                {/* the transcript was saved, so the summary can be written again */}
                {lesson.segments.length > 0 && (
                  <Button variant="outline" className="gap-2" onClick={handleRetry} disabled={resummarize.isPending}>
                    <RotateCw /> Summarize again
                  </Button>
                )}
              </div>
            )}

            {!processing && !summary && lesson?.status !== "error" && (
              <EmptySummary recording={recorder.recording} />
            )}

            {summaryEmpty && (
              <p className="text-[15px] text-muted-foreground">
                There wasn&apos;t enough said to put together a summary.
              </p>
            )}

            {summary && !summaryEmpty && lesson && !processing && (
              <>
                <SummaryStream
                  key={`${lesson.id}-${retries}`}
                  summary={summary}
                  animate={lesson.id === streamingId}
                  size="lg"
                  assignmentActions={(index) => {
                    const a = summary.assignments[index];
                    if (!a?.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(a.dueDate)) return null;
                    return (
                      <AddToCalendar
                        index={index}
                        item={{ title: a.title, dueDate: a.dueDate, sessionId: lesson.id, sessionTitle: lesson.title, subject: subject ?? null }}
                      />
                    );
                  }}
                />
                <TopicResources
                  key={`resources-${lesson.id}`}
                  topics={summary.topics}
                  className={cn("mt-8", lesson.id === streamingId && "animate-in fade-in-0 fill-mode-both delay-1000 duration-700")}
                />
              </>
            )}
          </section>
        </main>
      </div>

      <NewSessionDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        subjects={subjects}
        sessions={sessions}
        initialMode={dialog.mode}
        initialSessionId={dialog.sessionId}
        hotkeyArmed={hotkeyArmed}
        onStart={handleStart}
        formId={DIALOG_FORM_ID}
      />
    </div>
  );
}

function EmptySummary({ recording }: { recording: boolean }) {
  return (
    <div className="dot-grid flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
      <p className="text-sm font-medium">{recording ? "Listening…" : "Nothing summarized yet"}</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        {recording
          ? "The summary is written when you stop recording."
          : "Pick a session from the sidebar, or start a new recording. Topics, key points and due dates show up here."}
      </p>
    </div>
  );
}
