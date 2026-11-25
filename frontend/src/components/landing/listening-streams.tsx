"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// A faint lecture transcript drifting across the whole hero, behind everything, on slow waves: the room is
// talking, and StudySync is catching it. Each line is an SVG <textPath> whose startOffset moves every frame.

type Part = { text: string; strong?: boolean };

const TRANSCRIPT: Part[][] = [
  [
    { text: "So the light reactions happen in the thylakoid membrane, " },
    { text: "that's where water gets split", strong: true },
    { text: " · " },
  ],
  [
    { text: "the Calvin cycle then uses ATP and NADPH to " },
    { text: "build sugar", strong: true },
    { text: " · any questions so far? · " },
  ],
  [
    { text: "quick reminder, " },
    { text: "the lab report is due next Friday", strong: true },
    { text: " · " },
  ],
  [
    { text: "and " },
    { text: "chapter 8 is on the quiz", strong: true },
    { text: " · write that down · see you on Thursday · " },
  ],
];

/** One line per row: height (fraction of the hero), wave size, text size, speed and direction (px/s, minus = leftwards). */
const LINES = [
  { y: 0.14, amp: 18, waves: 2.5, size: 26, speed: 22 },
  { y: 0.4, amp: 26, waves: 2, size: 30, speed: -16 },
  { y: 0.66, amp: 20, waves: 3, size: 24, speed: 26 },
  { y: 0.9, amp: 24, waves: 2, size: 28, speed: -20 },
];

const COPIES = 8; // enough repeats to always cover the whole width

/** A smooth wave across the full width (and a little beyond, so the ends are never seen). */
function wave(width: number, y: number, amp: number, waves: number) {
  const halfWaves = Math.max(2, Math.round(waves * 2));
  const seg = (width + 160) / halfWaves;
  let d = `M -80 ${y}`;
  for (let i = 0; i < halfWaves; i++) {
    const x0 = -80 + i * seg;
    const peak = i % 2 === 0 ? y - amp : y + amp;
    d += ` C ${x0 + seg * 0.4} ${peak}, ${x0 + seg * 0.6} ${peak}, ${x0 + seg} ${y}`;
  }
  return d;
}

export function ListeningStreams({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textPathRefs = useRef<(SVGTextPathElement | null)[]>([]);
  const measureRefs = useRef<(SVGTextElement | null)[]>([]);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  // Drawn in real pixels so the text never stretches; redrawn when the hero resizes.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) }),
    );
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  // Slide each line along its wave; one copy's length later it looks identical, so the loop is seamless.
  useEffect(() => {
    if (!size) return;
    const lengths = measureRefs.current.map((m) => m?.getComputedTextLength() ?? 0);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      LINES.forEach((line, i) => {
        const el = textPathRefs.current[i];
        const length = lengths[i];
        if (!el || !length) return;
        const moved = reduced ? 0 : ((((now - start) / 1000) * line.speed) % length + length) % length;
        el.setAttribute("startOffset", String(moved - length * 2));
      });
      if (!reduced) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [size]);

  const spans = (parts: Part[], key: string) =>
    parts.map((part, i) => (
      <tspan
        key={`${key}-${i}`}
        className={part.strong ? "fill-foreground/[0.16] font-semibold" : "fill-foreground/[0.07]"}
      >
        {part.text}
      </tspan>
    ));

  return (
    <div ref={wrapRef} aria-hidden="true" className={cn("pointer-events-none absolute inset-0 select-none", className)}>
      {size && (
        <svg
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          className="absolute inset-0 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
        >
          <defs>
            {LINES.map((line, i) => (
              <path key={i} id={`hero-stream-${i}`} d={wave(size.w, size.h * line.y, line.amp, line.waves)} />
            ))}
          </defs>
          {LINES.map((line, i) => {
            // each line starts at a different point of the transcript
            const parts = [...TRANSCRIPT.slice(i), ...TRANSCRIPT.slice(0, i)].flat();
            return (
              <g key={i} style={{ fontSize: line.size, letterSpacing: "-0.02em" }}>
                {/* off-screen copy, only used to measure one loop of this line */}
                <text
                  ref={(el) => {
                    measureRefs.current[i] = el;
                  }}
                  x={-99999}
                  y={-99999}
                >
                  {spans(parts, "m")}
                </text>
                <text>
                  <textPath
                    ref={(el) => {
                      textPathRefs.current[i] = el;
                    }}
                    href={`#hero-stream-${i}`}
                  >
                    {Array.from({ length: COPIES }, (_, c) => spans(parts, `c${c}`))}
                  </textPath>
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
