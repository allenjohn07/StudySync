import { Sticker } from "@/components/sticker";
import { cn } from "@/lib/utils";

// Sound in, words out: a waveform streams in from the left into a "Transcribing live" chip, and the
// transcript streams out of it to the right. Both tracks are two identical copies slid by half their width,
// so the loop is seamless (CSS only, paused with reduced motion; styles in globals.css).

type Part = { text: string; strong?: boolean };

const TRANSCRIPT: Part[] = [
  { text: "So the light reactions happen in the thylakoid membrane," },
  { text: "that's where water gets split.", strong: true },
  { text: "The Calvin cycle then uses ATP and NADPH to" },
  { text: "build sugar.", strong: true },
  { text: "Quick reminder:" },
  { text: "the lab report is due next Friday,", strong: true },
  { text: "and" },
  { text: "chapter 8 is on the quiz.", strong: true },
  { text: "Any questions before we wrap up?" },
];

// Deterministic bar heights (no randomness, so server and browser render the same thing).
const BARS = Array.from({ length: 48 }, (_, i) =>
  Math.round(6 + Math.abs(Math.sin(i * 0.72) * Math.cos(i * 0.21)) * 30 + (i % 5 === 0 ? 6 : 0)),
);

function Waveform() {
  return (
    <div className="flex shrink-0 items-center gap-[5px] pr-[5px]">
      {BARS.map((h, i) => (
        <span
          key={i}
          className="band-bar w-[3px] rounded-full bg-foreground/70"
          style={{ height: h, animationDelay: `${(i % 12) * -110}ms` }}
        />
      ))}
    </div>
  );
}

function Transcript() {
  return (
    <p className="flex shrink-0 items-center gap-[0.35em] pr-[0.35em] text-lg whitespace-nowrap">
      {TRANSCRIPT.map((part, i) => (
        <span key={i} className={part.strong ? "font-semibold text-foreground" : "text-muted-foreground"}>
          {part.text}
        </span>
      ))}
      <span className="text-muted-foreground/40">·</span>
    </p>
  );
}

export function TranscribeBand({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none flex h-24 items-center select-none", className)}>
      {/* sound coming in */}
      <div className="flex h-full min-w-0 flex-1 items-center overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_30%)]">
        <div className="band-track flex w-max" style={{ animationDuration: "18s" }}>
          <Waveform />
          <Waveform />
        </div>
      </div>

      {/* the converter */}
      <div className="relative z-10 mx-3 flex shrink-0 items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pr-4 pl-1.5 shadow-[0_8px_24px_-12px_oklch(0_0_0/0.25)] dark:bg-white/[0.04]">
        <Sticker name="mic" color="pink" rotate={-8} size={30} />
        <span className="relative flex size-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-destructive opacity-60 motion-reduce:hidden" />
          <span className="relative size-2 rounded-full bg-destructive" />
        </span>
        <span className="text-sm font-medium whitespace-nowrap">Transcribing live</span>
      </div>

      {/* words going out */}
      <div className="flex h-full min-w-0 flex-[1.6] items-center overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_4%,black_70%,transparent)]">
        <div className="band-track flex w-max" style={{ animationDuration: "70s" }}>
          <Transcript />
          <Transcript />
        </div>
      </div>
    </div>
  );
}
