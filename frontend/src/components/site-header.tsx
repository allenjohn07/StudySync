import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

/** The header of the landing and login pages: the same height and surface as the dashboard's header. */
export function SiteHeader({ children, sticky = false }: { children?: React.ReactNode; sticky?: boolean }) {
  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 sm:px-6",
        sticky && "sticky top-0 z-40 bg-sidebar/85 backdrop-blur-md",
      )}
    >
      <Link href="/" className="inline-flex items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <BrandMark />
      </Link>
      {children}
    </header>
  );
}
