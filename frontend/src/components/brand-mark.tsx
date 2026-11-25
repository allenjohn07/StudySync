import { cn } from "@/lib/utils";

/** The logo: a small ink tile with three yellow soundwave bars. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center gap-[2.5px] rounded-[9px] bg-neutral-900 shadow-[inset_0_1px_0_oklch(1_0_0/0.15),0_1px_2px_oklch(0_0_0/0.15)] dark:bg-neutral-800 dark:ring-1 dark:ring-white/10",
        className,
      )}
    >
      <span className="h-[7px] w-[2.5px] rounded-full bg-highlight" />
      <span className="h-[13px] w-[2.5px] rounded-full bg-highlight" />
      <span className="h-[9px] w-[2.5px] rounded-full bg-highlight" />
    </span>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-[-0.01em]">StudySync</span>
    </span>
  );
}
