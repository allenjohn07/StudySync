"use client";

import { useRef } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Illustration, type IllustrationName } from "@/components/illustration";
import { FitText } from "@/components/landing/fit-text";
import { ListeningStreams } from "@/components/landing/listening-streams";
import { LiveDemoWindow } from "@/components/landing/live-demo";
import { SiteHeader } from "@/components/site-header";
import { Sticker, type StickerColor, type StickerName } from "@/components/sticker";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { WritingGroup, WritingText, WritingWord, writingDelays } from "@/components/ui/writing-text";
import { cn } from "@/lib/utils";

// Sections fill the screen (dvh = real visible height, even with mobile browser bars).
// The hero starts below the page margin and the frame's 1px border, so it is shorter by exactly that much:
// its bottom edge then lands on the bottom of the screen and nothing from the next section peeks in.
const HERO_SCREEN = "min-h-[calc(100dvh-0.75rem-1px)] sm:min-h-[calc(100dvh-1rem-1px)]";

// Hero headline: each word rises in after the previous one (longer words and full stops add a pause).
const HERO_RISE_MS = 1000;
const HERO_DELAYS = writingDelays(["Stop", "writing.", "Start", "listening."], 70, 200);

function scrollToDemo(e: React.MouseEvent) {
  e.preventDefault();
  const el = document.getElementById("how-it-works");
  if (!el) return;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: "smooth" });
}

export default function RootPage() {
  return <LandingPage />;
}

function LandingPage() {
  return (
    <div className="flex min-h-dvh bg-background p-3 sm:p-4">
      <div className="w-full overflow-hidden rounded-[22px] border border-border bg-card">
        <section className={cn(HERO_SCREEN, "flex flex-col")}>
          <Nav />
          <Hero />
        </section>
        <WindowBand />
        <Features />
        <ClosingCta />
        <Footer />
      </div>
    </div>
  );
}

function Nav() {
  return (
    <SiteHeader>
      <div className="flex items-center gap-2 text-sm font-medium sm:gap-3">
        <a
          href="#how-it-works"
          onClick={scrollToDemo}
          className="hidden rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline"
        >
          How it works
        </a>
        <ThemeToggle className="max-sm:hidden" />
        <Button render={<Link href="/login" />} nativeButton={false}>
          Start free
        </Button>
      </div>
    </SiteHeader>
  );
}

function Hero() {
  const earRef = useRef<HTMLSpanElement>(null);
  const headRef = useRef<HTMLSpanElement>(null);
  return (
    <div className="relative grid flex-1 items-center gap-12 overflow-hidden px-6 py-14 sm:px-14 lg:grid-cols-[1.1fr_1fr] lg:gap-8">
      {/* the lecture drifts in behind everything and into the character's ear */}
      <ListeningStreams earRef={earRef} headRef={headRef} className="max-lg:hidden" />

      <div className="relative z-10 flex flex-col items-start gap-7">
        <span className="inline-flex h-7 items-center gap-2 rounded-full border border-border bg-card px-3 text-[13px] text-muted-foreground shadow-xs dark:bg-white/[0.03]">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Made for students · runs on your laptop
        </span>
        <h1
          aria-label="Stop writing. Start listening."
          className="text-[48px] leading-[1] font-semibold tracking-[-0.05em] sm:text-[72px] lg:text-[64px] xl:text-[84px] 2xl:text-[96px]"
        >
          <WritingGroup>
            <div aria-hidden="true">
              <WritingWord delay={HERO_DELAYS[0]} duration={HERO_RISE_MS}>
                Stop
              </WritingWord>{" "}
              <WritingWord delay={HERO_DELAYS[1]} duration={HERO_RISE_MS}>
                <span className="relative inline-block">
                  writing.
                  {/* the strike-through is drawn across the word once it has landed */}
                  <span
                    className="writing-text-draw absolute inset-x-0 top-[54%] h-[5px] rounded-full bg-destructive sm:h-[6px] xl:h-[7px]"
                    style={{ "--writing-text-delay": `${HERO_DELAYS[1] + HERO_RISE_MS * 0.7}ms` } as React.CSSProperties}
                  />
                </span>
              </WritingWord>
            </div>
            <div className="mt-2" aria-hidden="true">
              <WritingWord delay={HERO_DELAYS[2]} duration={HERO_RISE_MS}>
                Start
              </WritingWord>{" "}
              <WritingWord delay={HERO_DELAYS[3]} duration={HERO_RISE_MS}>
                <mark className="inline-block -rotate-[1.5deg] rounded-[0.12em] bg-highlight px-3 text-highlight-foreground xl:px-4">
                  listening.
                </mark>
              </WritingWord>
            </div>
          </WritingGroup>
        </h1>
        <p className="max-w-[440px] text-lg leading-relaxed text-muted-foreground">
          Record your class. Get the notes, the due dates and a study tip when it ends.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button render={<Link href="/login" />} nativeButton={false} size="lg" className="h-11 gap-2 px-5 text-[15px]">
            <span className="size-2 rounded-full bg-destructive" />
            Start recording
          </Button>
          <Button
            render={<Link href="#how-it-works" />}
            nativeButton={false}
            onClick={scrollToDemo}
            size="lg"
            variant="outline"
            className="h-11 px-5 text-[15px]"
          >
            See an example
          </Button>
        </div>
      </div>

      {/* The tagline as a picture: eyes closed, listening, notes crossed out, the laptop recording. Stickers in the open space. */}
      <div className="relative z-10 mx-auto w-full max-w-[540px] max-lg:max-w-[400px]">
        {/* a solid copy of the figure's outline, so the text passing behind it is hidden (the drawing's
            light areas are transparent) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-card [mask-image:url(/illustrations/listening-class-mask.png)] [mask-size:100%_100%]"
        />
        {/* where the words go in, and where they end up */}
        <span ref={earRef} aria-hidden="true" className="absolute top-[22%] left-[37.5%]" />
        <span ref={headRef} aria-hidden="true" className="absolute top-[14%] left-[50%]" />
        <Illustration
          name="listening-class"
          alt="A student at a desk with eyes closed, listening, notes crossed out, a laptop recording the lecture"
          eager
          sizes="(min-width: 1024px) 540px, 80vw"
          className="relative"
        />
        <Sticker name="bulb" color="green" rotate={10} size={46} float delay={900} className="absolute top-[10%] right-[8%]" />
        <Sticker name="sparkle" color="yellow" rotate={8} size={34} float delay={1800} className="absolute top-[-2%] right-[30%]" />
      </div>
    </div>
  );
}

function WindowBand() {
  return (
    <section
      id="how-it-works"
      className="dot-grid flex min-h-dvh flex-col items-center justify-center gap-12 border-t border-border bg-muted/40 px-4 py-24 sm:px-10 dark:bg-black/20"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <Sticker name="book" color="purple" rotate={-8} size={48} />
        <h2 className="text-3xl font-semibold tracking-[-0.04em] sm:text-[44px]">
          <WritingText text="A lecture, turned into notes" />
        </h2>
        <p className="text-muted-foreground">Watch one go by. It takes about ten seconds.</p>
      </div>
      <div className="relative w-full max-w-[1180px]">
        <Sticker name="check" color="green" rotate={12} size={52} float delay={1500} className="absolute -right-5 -bottom-6 z-10 max-sm:hidden" />
        <LiveDemoWindow />
      </div>
    </section>
  );
}

const FEATURES: {
  art: IllustrationName;
  alt: string;
  sticker: StickerName;
  color: StickerColor;
  label: string;
  title: string;
  body: string;
}[] = [
  {
    art: "checklist",
    alt: "A student ticking off a checklist on a tablet",
    sticker: "check",
    color: "green",
    label: "Summarize",
    title: "Notes that sort themselves",
    body: "Topics, key points, due dates and to-dos, pulled out the moment class ends.",
  },
  {
    art: "notebook",
    alt: "A student sketching the Calvin cycle in a notebook",
    sticker: "bulb",
    color: "yellow",
    label: "Study",
    title: "A study tip with every class",
    body: "Each summary ends with one small, concrete way to review what you just heard.",
  },
  {
    art: "private",
    alt: "A student writing next to a laptop, behind a big padlock shield",
    sticker: "lock",
    color: "purple",
    label: "Private",
    title: "Stays on your laptop",
    body: "Transcription and summaries run on your own machine. Your recordings never leave it.",
  },
];

function Features() {
  return (
    <section className="border-t border-border px-6 py-28 sm:px-14 sm:py-36">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-28 sm:gap-36">
        {FEATURES.map((f, i) => (
          <div
            key={f.label}
            className={cn(
              "grid items-center gap-10 md:grid-cols-2 md:gap-16",
              i % 2 === 1 && "md:[&>*:first-child]:order-2",
            )}
          >
            <div className="mx-auto w-full max-w-[420px]">
              <Illustration name={f.art} alt={f.alt} />
            </div>
            <div className="flex flex-col items-start gap-4">
              <div className="flex items-center gap-3">
                <Sticker name={f.sticker} color={f.color} rotate={i % 2 ? 10 : -10} size={44} />
                <span className="label-mono">
                  {String(i + 1).padStart(2, "0")} · {f.label}
                </span>
              </div>
              <h3 className="text-3xl font-semibold tracking-[-0.04em] sm:text-[40px] sm:leading-[1.05]">
                <WritingText text={f.title} />
              </h3>
              <p className="max-w-[380px] text-lg leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="relative flex min-h-[70dvh] flex-col items-center justify-center gap-8 overflow-hidden border-t border-border px-6 py-28 text-center sm:px-14">
      <Sticker name="cap" color="yellow" rotate={-12} size={64} float className="absolute top-[16%] left-[12%] max-sm:hidden" />
      <Sticker name="sparkle" color="pink" rotate={8} size={40} float delay={1200} className="absolute top-[22%] right-[14%] max-sm:hidden" />
      <Sticker name="clock" color="blue" rotate={10} size={50} float delay={600} className="absolute bottom-[18%] left-[18%] max-sm:hidden" />
      <Sticker name="list" color="peach" rotate={-10} size={52} float delay={2000} className="absolute right-[12%] bottom-[16%] max-sm:hidden" />
      <h2 className="text-4xl leading-[1.02] font-semibold tracking-[-0.05em] sm:text-[64px]">
        <WritingText text={"Stop taking notes.\nStart understanding."} speed={40} />
      </h2>
      <Button render={<Link href="/login" />} nativeButton={false} size="lg" className="h-11 px-6 text-[15px]">
        Start free
      </Button>
    </section>
  );
}

const footerLink = "transition-colors hover:text-foreground";

function Footer() {
  return (
    <footer className="overflow-hidden border-t border-border">
      <div className="flex flex-col justify-between gap-8 px-6 py-12 sm:flex-row sm:items-center sm:px-14">
        <div className="flex flex-col gap-3">
          <BrandMark />
          <p className="text-sm text-muted-foreground">Record the lecture. Keep the understanding.</p>
        </div>
        <nav className="flex gap-6 text-sm text-muted-foreground">
          <a href="#how-it-works" onClick={scrollToDemo} className={footerLink}>
            How it works
          </a>
          <Link href="/login" className={footerLink}>
            Log in
          </Link>
          <Link href="/login" className={footerLink}>
            Start free
          </Link>
        </nav>
      </div>

      {/* Scaled to the exact width of the footer, so the left and right margins are equal. */}
      <div aria-hidden="true" className="select-none px-6 sm:px-14">
        <FitText className="leading-[0.8] font-semibold tracking-[-0.06em] text-foreground/[0.05]">StudySync</FitText>
      </div>

      <div className="flex flex-wrap justify-between gap-2 border-t border-border px-6 py-5 text-xs text-muted-foreground sm:px-14">
        <span>© StudySync · Made for students</span>
        <span>Built with Whisper and Ollama</span>
      </div>
    </footer>
  );
}
