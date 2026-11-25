import { cn } from "@/lib/utils";

// Playful "sticker" icons: a thick pastel backing traced around a dark line icon, tilted a little.
// Each icon is drawn twice from the same shapes: once fat and pastel (the sticker), once thin and dark (the line).

const ICONS = {
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
    </>
  ),
  book: (
    <>
      <path d="M5 5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2z" />
      <path d="M5 20a2 2 0 0 0 2 1h12v-3M9 7.5h6M9 11h4" />
    </>
  ),
  pencil: (
    <>
      <path d="M12 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L12 14l-4 1 1-4 7.5-7.5z" />
    </>
  ),
  list: (
    <>
      <path d="M9 7h10M9 12h10M9 17h10" />
      <circle cx="5" cy="7" r="0.9" data-dot />
      <circle cx="5" cy="12" r="0.9" data-dot />
      <circle cx="5" cy="17" r="0.9" data-dot />
    </>
  ),
  check: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </>
  ),
  chart: (
    <>
      <rect x="4" y="14" width="4" height="6" rx="1" />
      <rect x="10" y="9" width="4" height="11" rx="1" />
      <rect x="16" y="4" width="4" height="16" rx="1" />
    </>
  ),
  bulb: (
    <>
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" />
      <path d="M9.5 18.5h5M10.5 21h3" />
    </>
  ),
  cap: (
    <>
      <path d="M2.5 9 12 4.5 21.5 9 12 13.5z" />
      <path d="M6.5 11.2v4.3c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3v-4.3M21.5 9v5" />
    </>
  ),
  headphones: (
    <>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3.5" y="14" width="4" height="6.5" rx="1.5" />
      <rect x="16.5" y="14" width="4" height="6.5" rx="1.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M9 3v4M15 3v4" />
      <circle cx="9" cy="14.5" r="0.9" data-dot />
      <circle cx="13" cy="14.5" r="0.9" data-dot />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.6 2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
      <circle cx="12" cy="15.5" r="1" data-dot />
    </>
  ),
  sparkle: <path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z" />,
} as const;

export type StickerName = keyof typeof ICONS;

// Pastels from the sticker reference.
const COLORS = {
  green: "#8be47d",
  yellow: "#ffe074",
  purple: "#c3a6e8",
  peach: "#fca789",
  blue: "#75c7f0",
  pink: "#fc8da7",
} as const;

export type StickerColor = keyof typeof COLORS;

const INK = "#24262b";

export function Sticker({
  name,
  color,
  rotate = -10,
  size = 56,
  float = false,
  delay = 0,
  className,
}: {
  name: StickerName;
  color: StickerColor;
  /** Tilt in degrees. */
  rotate?: number;
  size?: number;
  /** Bob gently up and down (off with reduced motion). */
  float?: boolean;
  /** Offsets the float, so neighbouring stickers don't move in step (ms). */
  delay?: number;
  className?: string;
}) {
  const icon = ICONS[name];
  return (
    <span
      aria-hidden="true"
      className={cn("sticker inline-block", float && "sticker-float", className)}
      style={{ "--sticker-rotate": `${rotate}deg`, animationDelay: `${delay}ms` } as React.CSSProperties}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className="sticker-svg overflow-visible drop-shadow-[0_2px_3px_oklch(0_0_0/0.12)]"
      >
        <g stroke={COLORS[color]} fill={COLORS[color]} strokeWidth={11} strokeLinejoin="round" strokeLinecap="round">
          {icon}
        </g>
        <g
          stroke={INK}
          fill="none"
          strokeWidth={2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="[&_[data-dot]]:fill-[#24262b]"
        >
          {icon}
        </g>
      </svg>
    </span>
  );
}
