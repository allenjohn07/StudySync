"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronRight, Check, RotateCw } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ScrollFade } from "@/components/scroll-fade";
import { SessionsSidebar } from "@/components/sessions-sidebar";
import { SummaryStream } from "@/components/summary-stream";
import { Words, splitWords } from "@/components/words";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import {
  useAddChunk,
  useClearLessons,
  useCreateLesson,
  useDeleteLesson,
  useFinishLesson,
  useLesson,
  useLessons,
  useResummarize,
} from "@/hooks/use-lessons";
import { useLocalAuth } from "@/hooks/use-local-auth";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { WritingText } from "@/components/ui/writing-text";
import { ShimmeringText } from "@/components/ui/shimmering-text";

// How long a summary may run before "Try again" is offered (it normally takes well under half a minute).
const SLOW_SUMMARY_MS = 40_000;

// Two Control taps closer together than this count as a double tap.
const HOTKEY_WINDOW_MS = 400;

function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function errorMessage(err: unknown) {
  return err instanceof ApiError
    ? err.message
    : "Couldn't reach the backend. Is it running on port 4000?";
}

/** Shown while a summary is being written: after a while it offers to start over, in case it is stuck. */
function SlowSummaryNotice({
  onRetry,
  pending,
}: {
  onRetry: () => void;
  pending: boolean;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), SLOW_SUMMARY_MS);
    return () => clearTimeout(id);
  }, []);
  if (!slow) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <span>This is taking longer than usual.</span>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={onRetry}
        disabled={pending}
      >
        <RotateCw /> Try again
      </Button>
    </div>
  );
}

export default function DemoPage() {
  const router = useRouter();
  const { status, logout } = useLocalAuth();
  const createLesson = useCreateLesson();
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
  // Resolves to the new lesson's id (or null if it couldn't be created); chunks wait on it.
  const lessonPromiseRef = useRef<Promise<number | null>>(
    Promise.resolve(null),
  );

  const recorder = useAudioRecorder(async (audio, seq, start, final) => {
    const id = await lessonPromiseRef.current;
    if (id === null) return;
    if (!final) {
      // A preview is best-effort: the finished piece will cover it if this one fails.
      await addChunk
        .mutateAsync({ id, audio, seq, start, final })
        .catch(() => {});
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
  // Closed by default; the chevron next to the status opens it.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Hotkey: tapping Control twice quickly starts or stops recording. The handler is kept in a ref so the
  // keydown listener (registered once) always calls the latest version.
  const [hotkeyArmed, setHotkeyArmed] = useState(false);
  const hotkeyRef = useRef<() => void>(() => {});
  useEffect(() => {
    hotkeyRef.current = () => {
      if (status !== "in") return;
      if (recorder.recording) void handleStop();
      else if (!finishLesson.isPending && lesson?.status !== "processing")
        void handleStart();
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
  // Words fade in as they are heard; an old session opened from the sidebar is shown as plain text.
  const liveTranscript =
    !!lesson && (lesson.status === "recording" || lesson.id === streamingId);
  const shownError =
    recorder.error ??
    requestError ??
    (lesson?.status === "recording" ? lesson.error : null);

  async function handleStart() {
    discardIfFailed();
    setLessonId(null);
    setRequestError(null);
    finishLesson.reset();
    if (!(await recorder.start())) return;

    const created = createLesson.mutateAsync();
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
    finishLesson.mutate(id, {
      onError: (err) => setRequestError(errorMessage(err)),
    });
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
    resummarize.mutate(lesson.id, {
      onError: (err) => setRequestError(errorMessage(err)),
    });
  }

  // A session that failed is never kept: once the user moves on, it is deleted.
  function discardIfFailed() {
    if (lesson?.status === "error") deleteLesson.mutate(lesson.id);
  }

  // Switch what the page shows: a past session, or (null) a fresh empty one.
  function openSession(id: number | null) {
    discardIfFailed();
    setLessonId(id);
    setRequestError(null);
    setStreamingId(null);
    finishLesson.reset();
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

  return (
    <div className="flex min-h-screen bg-background p-3 sm:p-4 lg:h-screen">
      <div className="flex w-full flex-col overflow-hidden rounded-[22px] border border-foreground/10 bg-card">
        <SiteHeader>
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm font-medium underline decoration-transparent decoration-2 underline-offset-4 transition-colors hover:decoration-highlight"
            >
              Back to dashboard
            </Link>
            <Button variant="link" onClick={logout}>
              Log out
            </Button>
          </div>
        </SiteHeader>

        <div className="flex flex-1 max-lg:flex-col lg:min-h-0">
          {sidebarOpen && (
            <SessionsSidebar
              sessions={sessions}
              activeId={lessonId}
              locked={recorder.recording}
              deleting={deleteLesson.isPending}
              onNew={() => openSession(null)}
              onSelect={openSession}
              onDelete={handleDelete}
              onClearAll={handleClearAll}
              clearing={clearLessons.isPending}
              onClose={() => setSidebarOpen(false)}
            />
          )}

          <div className="grid min-w-0 flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]">
            <section className="flex min-h-0 min-w-0 flex-col px-6 py-8 sm:px-14 lg:overflow-hidden lg:border-r lg:border-foreground/10">
              <div className="flex h-10 items-center justify-between">
                <div className="relative flex items-center gap-2.5 text-lg">
                  {!sidebarOpen && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="max-sm:-ml-2 sm:absolute sm:top-1/2 sm:right-full sm:mr-3 sm:-translate-y-1/2"
                            aria-label="Open sessions"
                            onClick={() => setSidebarOpen(true)}
                          />
                        }
                      >
                        <ChevronRight />
                      </TooltipTrigger>
                      <TooltipContent>Open sessions</TooltipContent>
                    </Tooltip>
                  )}
                  <span
                    className={cn(
                      "size-3.5 rounded-full",
                      recorder.recording
                        ? "bg-destructive"
                        : "bg-muted-foreground/50",
                    )}
                  />
                  <strong>
                    {recorder.recording ? (
                      "Recording"
                    ) : processing ? (
                      <ShimmeringText text="Processing" />
                    ) : (
                      "Ready"
                    )}
                  </strong>
                </div>
                <span className="label-mono text-base text-foreground">
                  {formatTime(recorder.elapsed)}
                </span>
              </div>

              <div
                aria-label="Audio waveform"
                className={cn(
                  "my-4 flex h-[72px] items-center gap-1 overflow-hidden",
                  !recorder.recording && "opacity-40",
                )}
              >
                {recorder.levels.map((level, i) => (
                  <i
                    key={i}
                    className="w-1 shrink-0 rounded-full bg-foreground"
                    style={{ height: 6 + level * 46 }}
                  />
                ))}
                <span className="mx-[3px] h-[53px] w-[5px] shrink-0 rounded-full bg-destructive" />
                {Array.from({ length: 10 }).map((_, i) => (
                  <b
                    key={i}
                    className="size-[5px] shrink-0 rounded-full bg-foreground/20"
                  />
                ))}
              </div>

              <h2 className="label-mono mb-2">Live transcript</h2>
              <ScrollFade
                className="min-h-48 flex-1 max-lg:max-h-72"
                follow={liveTranscript}
                watch={lesson?.segments}
              >
                {segments.length > 0 ? (
                  <div className="grid gap-3 py-1">
                    {segments.map((seg) => (
                      <div
                        key={seg.seq}
                        className="grid grid-cols-[58px_1fr] gap-2.5 text-lg leading-snug"
                      >
                        <time className="label-mono pt-0.5 normal-case tracking-normal">
                          {formatTime(seg.start)}
                        </time>
                        <p>
                          <Words
                            words={splitWords(seg.text)}
                            animate={liveTranscript}
                          />
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p
                    className="text-muted-foreground"
                    role={recorder.recording ? "status" : undefined}
                  >
                    {recorder.recording ? (
                      <ShimmeringText text="Listening… the first words appear in a moment." />
                    ) : (
                      "Press Start and speak. The transcript shows up here as you talk."
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

              <div className="mt-6 flex gap-3">
                {recorder.recording && (
                  <Button
                    variant="outline"
                    className="h-auto gap-2.5 px-5 py-3"
                    onClick={handleStop}
                  >
                    <span className="size-2.5 rounded-[2px] bg-current" />
                    Stop
                  </Button>
                )}
                {recorder.recording && (
                  <p role="status" className="text-base font-medium">
                    <ShimmeringText text="Transcribing…" />
                  </p>
                )}
                {!recorder.recording && (
                  <Button
                    className="h-auto px-5 py-3"
                    onClick={handleStart}
                    disabled={processing}
                  >
                    {lessonId === null ? "Start recording" : "Record another"}
                  </Button>
                )}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Tap{" "}
                <Kbd
                  className={cn(
                    "h-auto border border-foreground/40 bg-transparent px-1.5 py-0.5 font-semibold text-foreground transition-colors duration-100",
                    hotkeyArmed && "border-foreground bg-highlight",
                  )}
                >
                  Control
                </Kbd>{" "}
                twice to {recorder.recording ? "stop" : "start"} recording
              </p>
            </section>

            <section className="min-w-0 border-t border-foreground/10 px-6 py-8 sm:px-14 lg:overflow-y-auto lg:border-t-0">
              <div className="mb-5 flex h-10 items-center justify-between gap-5">
                <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em]">
                  <WritingText text="Summary" />
                </h1>
                {summary && !summaryEmpty && (
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Check className="size-4" /> Saved
                  </p>
                )}
              </div>

              {processing && (
                <p role="status" className="text-base font-medium">
                  <ShimmeringText
                    text={
                      lesson?.stage === "summarizing"
                        ? "Summarizing…"
                        : "Thinking…"
                    }
                  />
                </p>
              )}

              {processing && lesson?.stage === "summarizing" && (
                <SlowSummaryNotice
                  key={`${lesson.id}-${retries}`}
                  onRetry={handleRetry}
                  pending={resummarize.isPending}
                />
              )}

              {lesson?.status === "error" && (
                <div className="flex flex-col items-start gap-3">
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertDescription>
                      Something went wrong: {lesson.error}
                    </AlertDescription>
                  </Alert>
                  {/* the transcript was saved, so the summary can be written again */}
                  {lesson.segments.length > 0 && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={handleRetry}
                      disabled={resummarize.isPending}
                    >
                      <RotateCw /> Summarize again
                    </Button>
                  )}
                </div>
              )}

              {!processing && !summary && lesson?.status !== "error" && (
                <p className="text-muted-foreground">
                  {recorder.recording
                    ? "The summary is written when you stop recording."
                    : "Your summary will show up here once the recording is processed."}
                </p>
              )}

              {summaryEmpty && (
                <p className="text-muted-foreground">
                  There wasn&apos;t enough said to put together a summary.
                </p>
              )}

              {summary && !summaryEmpty && lesson && (
                <SummaryStream
                  key={lesson.id}
                  summary={summary}
                  animate={lesson.id === streamingId}
                  size="lg"
                />
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
