import { ArrowUpRight } from "lucide-react";
import { Sticker } from "@/components/sticker";
import { resourcesFor } from "@/lib/resources";
import { cn } from "@/lib/utils";

/** "Learn more": for each topic from class, links to Wikipedia, Khan Academy and YouTube. */
export function TopicResources({ topics, className }: { topics: string[]; className?: string }) {
  if (!topics.length) return null;
  return (
    <section className={cn("flex flex-col gap-2.5", className)}>
      <h2 className="label-mono flex items-center gap-2">
        <Sticker name="book" color="purple" rotate={-8} size={18} />
        Learn more
      </h2>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {topics.map((topic) => (
          <li key={topic} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3.5 py-2.5">
            <span className="text-[15px] font-medium">{topic}</span>
            <span className="flex flex-wrap gap-1.5">
              {resourcesFor(topic).map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group/link inline-flex h-7 items-center gap-1 rounded-full border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-accent hover:text-foreground"
                >
                  {link.label}
                  <ArrowUpRight className="size-3 transition-transform duration-150 group-hover/link:translate-x-px group-hover/link:-translate-y-px" />
                </a>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
