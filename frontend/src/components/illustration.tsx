import Image from "next/image";
import { cn } from "@/lib/utils";

// Hand-drawn line illustrations, stored as black ink on a transparent background (public/illustrations),
// so they sit on any surface. In dark mode they are inverted to white ink.
const ART = {
  notebook: { src: "/illustrations/notebook-v2.webp", width: 884, height: 811 },
  recording: { src: "/illustrations/recording-v2.webp", width: 900, height: 707 },
  "listening-class": { src: "/illustrations/listening-class-v2.webp", width: 900, height: 792 },
  private: { src: "/illustrations/private-v2.webp", width: 834, height: 802 },
  checklist: { src: "/illustrations/checklist-v2.webp", width: 895, height: 895 },
  listening: { src: "/illustrations/listening-v2.webp", width: 848, height: 640 },
} as const;

export type IllustrationName = keyof typeof ART;

export function Illustration({
  name,
  alt,
  className,
  eager = false,
  sizes = "(min-width: 1024px) 480px, 80vw",
}: {
  name: IllustrationName;
  alt: string;
  className?: string;
  /** Above the fold: load it right away (Next 16 replaced `priority` with this). */
  eager?: boolean;
  sizes?: string;
}) {
  const art = ART[name];
  return (
    <Image
      src={art.src}
      width={art.width}
      height={art.height}
      alt={alt}
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      draggable={false}
      className={cn("h-auto w-full select-none dark:invert", className)}
    />
  );
}
