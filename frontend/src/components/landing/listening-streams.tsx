"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// "Just listen": lines of a lecture drift in from the left edge, behind the hero, and disappear into the
// character's ear. Each stream is an SVG <textPath> whose startOffset moves every frame; text that runs past
// the end of the path (inside the head) simply isn't drawn, and the drawing's silhouette hides the last stretch.

type Part = { text: string; strong?: boolean };

const STREAMS: { parts: Part[]; size: number; speed: number; className: string }[] = [
  {
    parts: [
      { text: "So the light reactions happen in the thylakoid membrane, " },
      { text: "that's where water gets split", strong: true },
      { text: " · the Calvin cycle then uses ATP and NADPH to " },
      { text: "build sugar", strong: true },
      { text: " · quick reminder, " },
      { text: "the lab report is due next Friday", strong: true },
      { text: " · " },
    ],
    size: 19,
    speed: 52,
    className: "",
  },
  {
    parts: [
      { text: "and " },
      { text: "chapter 8 is on the quiz", strong: true },
      { text: " · write that down · any questions before we wrap up? · see you on Thursday · " },
    ],
    size: 15,
    speed: 40,
    className: "opacity-60",
  },
];

const COPIES = 8; // enough repeats to always fill the whole path

type Point = { x: number; y: number };

/** Two curves that sweep in low under the hero copy and rise into the ear, then on into the head. */
function streamPaths(w: number, h: number, ear: Point, head: Point) {
  const into = `C ${ear.x + 18} ${ear.y - 4}, ${head.x - 16} ${head.y + 6}, ${head.x} ${head.y}`;
  return [
    // the main line: in from the left under the buttons, a long low sweep, then up into the ear
    `M -60 ${h * 0.86} C ${w * 0.32} ${h * 0.94}, ${ear.x - 330} ${ear.y + 110}, ${ear.x} ${ear.y} ${into}`,
    // a quieter line rising from the bottom edge, staying below the first until they meet at the ear
    `M ${w * 0.12} ${h + 40} C ${w * 0.38} ${h * 0.98}, ${ear.x - 120} ${ear.y + 240}, ${ear.x} ${ear.y + 4} ${into}`,
  ];
}

export function ListeningStreams({
  earRef,
  headRef,
  className,
}: {
  /** Where the text goes in (an element placed on the character's ear). */
  earRef: React.RefObject<HTMLElement | null>;
  /** Where it ends, hidden behind the drawing (an element inside the head). */
  headRef: React.RefObject<HTMLElement | null>;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textPathRefs = useRef<(SVGTextPathElement | null)[]>([]);
  const measureRefs = useRef<(SVGTextElement | null)[]>([]);
  const [layout, setLayout] = useState<{ w: number; h: number; paths: string[] } | null>(null);

  // Recompute the curves whenever the hero (or the drawing in it) changes size.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const update = () => {
      const ear = earRef.current;
      const head = headRef.current;
      if (!ear || !head) return;
      const box = wrap.getBoundingClientRect();
      const at = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left - box.left), y: Math.round(r.top - box.top) };
      };
      const w = Math.round(box.width);
      const h = Math.round(box.height);
      setLayout({ w, h, paths: streamPaths(w, h, at(ear), at(head)) });
    };
    const observer = new ResizeObserver(update);
    observer.observe(wrap);
    if (earRef.current?.parentElement) observer.observe(earRef.current.parentElement);
    update();
    return () => observer.disconnect();
  }, [earRef, headRef]);

  // Move each stream along its path; one copy's length later it looks identical, so the loop is seamless.
  useEffect(() => {
    if (!layout) return;
    const lengths = measureRefs.current.map((m) => m?.getComputedTextLength() ?? 0);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      STREAMS.forEach((stream, i) => {
        const el = textPathRefs.current[i];
        const length = lengths[i];
        if (!el || !length) return;
        const travelled = reduced ? length * 0.4 : (((now - start) / 1000) * stream.speed) % length;
        el.setAttribute("startOffset", String(travelled - length * 2));
      });
      if (!reduced) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [layout]);

  const spans = (parts: Part[], key: string) =>
    parts.map((part, i) => (
      <tspan key={`${key}-${i}`} className={part.strong ? "fill-foreground font-semibold" : "fill-muted-foreground"}>
        {part.text}
      </tspan>
    ));

  return (
    <div ref={wrapRef} aria-hidden="true" className={cn("pointer-events-none absolute inset-0 select-none", className)}>
      {layout && (
        <svg
          width={layout.w}
          height={layout.h}
          viewBox={`0 0 ${layout.w} ${layout.h}`}
          className="absolute inset-0 overflow-visible [mask-image:linear-gradient(to_right,transparent,black_18%)]"
        >
          <defs>
            {layout.paths.map((d, i) => (
              <path key={i} id={`listening-stream-${i}`} d={d} />
            ))}
          </defs>
          {STREAMS.map((stream, i) => (
            <g key={i} className={stream.className} style={{ fontSize: stream.size, letterSpacing: "-0.01em" }}>
              {/* off-screen copy, only used to measure one loop of this stream */}
              <text
                ref={(el) => {
                  measureRefs.current[i] = el;
                }}
                x={-99999}
                y={-99999}
              >
                {spans(stream.parts, "m")}
              </text>
              <text>
                <textPath
                  ref={(el) => {
                    textPathRefs.current[i] = el;
                  }}
                  href={`#listening-stream-${i}`}
                >
                  {Array.from({ length: COPIES }, (_, c) => spans(stream.parts, `c${c}`))}
                </textPath>
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
