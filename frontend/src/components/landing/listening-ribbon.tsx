"use client";

import { useEffect, useRef, useState } from "react";
import { Sticker } from "@/components/sticker";
import { cn } from "@/lib/utils";

// "Just listen, and the text appears": a lecture transcript flows out of a mic along a gentle wave,
// left to right across the hero. Built on an SVG <textPath> whose startOffset is moved every frame.

type Part = { text: string; strong?: boolean };

// One loop of the transcript. `strong` parts (what a student would want to catch) are darker and bolder.
const LINE: Part[] = [
  { text: "So the light reactions happen in the thylakoid membrane, " },
  { text: "that's where water gets split", strong: true },
  { text: " · the Calvin cycle then uses ATP and NADPH to " },
  { text: "build sugar", strong: true },
  { text: " · quick reminder, " },
  { text: "the lab report is due next Friday", strong: true },
  { text: " · and " },
  { text: "chapter 8 is on the quiz", strong: true },
  { text: " · any questions before we wrap up? · " },
];

const HEIGHT = 150;
const FONT_SIZE = 21;
const SPEED = 46; // px per second along the path
const COPIES = 4; // enough repeats to always cover the whole path

/** A smooth wave across `width`, two and a half crests, centred vertically. */
function wavePath(width: number) {
  const mid = HEIGHT / 2 + 6;
  const amp = 30;
  const steps = 5; // half-waves
  const seg = (width + 80) / steps; // starts and ends just off the edges
  let d = `M -40 ${mid}`;
  for (let i = 0; i < steps; i++) {
    const x0 = -40 + i * seg;
    const x1 = x0 + seg;
    const y = i % 2 === 0 ? mid - amp : mid + amp;
    d += ` C ${x0 + seg * 0.4} ${y}, ${x1 - seg * 0.4} ${y}, ${x1} ${mid}`;
  }
  return d;
}

export function ListeningRibbon({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textPathRef = useRef<SVGTextPathElement>(null);
  const measureRef = useRef<SVGTextElement>(null);
  const [width, setWidth] = useState(0);

  // The path is drawn in real pixels so the text never stretches; redraw it when the hero resizes.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Slide the text along the path. One copy's length later it looks exactly the same, so it loops seamlessly.
  useEffect(() => {
    const textPath = textPathRef.current;
    const measure = measureRef.current;
    if (!width || !textPath || !measure) return;
    const copyLength = measure.getComputedTextLength();
    if (!copyLength) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      textPath.setAttribute("startOffset", String(-copyLength * 0.35));
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const travelled = (((now - start) / 1000) * SPEED) % copyLength;
      // moving right: begin one copy to the left and slide towards zero
      textPath.setAttribute("startOffset", String(travelled - copyLength));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [width]);

  const spans = (key: string) =>
    LINE.map((part, i) => (
      <tspan
        key={`${key}-${i}`}
        className={part.strong ? "fill-foreground font-semibold" : "fill-muted-foreground"}
      >
        {part.text}
      </tspan>
    ));

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className={cn("pointer-events-none relative select-none", className)}
      style={{ height: HEIGHT }}
    >
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="absolute inset-0 overflow-visible [mask-image:linear-gradient(to_right,transparent_3%,black_14%,black_82%,transparent)]"
          style={{ fontSize: FONT_SIZE, letterSpacing: "-0.01em" }}
        >
          <defs>
            <path id="listening-ribbon-path" d={wavePath(width)} />
          </defs>
          {/* off-screen copy, only used to measure one loop of text */}
          <text ref={measureRef} x={-99999} y={-99999} className="font-sans">
            {spans("m")}
          </text>
          <text className="font-sans">
            <textPath ref={textPathRef} href="#listening-ribbon-path" startOffset="0">
              {Array.from({ length: COPIES }, (_, c) => spans(`c${c}`))}
            </textPath>
          </text>
        </svg>
      )}
      {/* the words come out of the mic */}
      <Sticker
        name="mic"
        color="pink"
        rotate={-10}
        size={46}
        float
        className="absolute top-1/2 left-4 -translate-y-1/2 sm:left-10"
      />
    </div>
  );
}
