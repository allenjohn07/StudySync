import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6 sm:px-14">
      <Link href="/" className="inline-flex items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <BrandMark />
      </Link>
      {children}
    </header>
  );
}
