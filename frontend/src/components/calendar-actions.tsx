"use client";

import { useState } from "react";
import { CalendarPlus, Check, Copy, Download, ExternalLink, Rss } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CALENDAR_FEED_URL,
  CALENDAR_WEBCAL_URL,
  type DueItem,
  downloadIcs,
  googleCalendarUrl,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

const menuItem =
  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50";

/** "Add to calendar" for one assignment: Google Calendar, a .ics file, or subscribing to every due date. */
export function AddToCalendar({ item, index }: { item: DueItem; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="xs" className="-ml-1 gap-1.5 text-muted-foreground hover:text-foreground" />
        }
      >
        <CalendarPlus /> Add to calendar
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-1 p-1.5">
        <a href={googleCalendarUrl(item)} target="_blank" rel="noreferrer" className={menuItem} onClick={() => setOpen(false)}>
          <ExternalLink className="size-4 text-muted-foreground" />
          Google Calendar
        </a>
        <button
          type="button"
          className={menuItem}
          onClick={() => {
            downloadIcs(item, index);
            setOpen(false);
          }}
        >
          <Download className="size-4 text-muted-foreground" />
          Download .ics
          <span className="ml-auto text-xs font-normal text-muted-foreground">Apple, Outlook</span>
        </button>
        <div className="my-1 h-px bg-border" />
        <a href={CALENDAR_WEBCAL_URL} className={menuItem} onClick={() => setOpen(false)}>
          <Rss className="size-4 text-muted-foreground" />
          Subscribe to every due date
        </a>
      </PopoverContent>
    </Popover>
  );
}

/** Explains the live feed: subscribe once and new due dates appear in the calendar by themselves. */
export function CalendarSubscribe({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Add due dates to your calendar"
            title="Add due dates to your calendar"
            className={cn("text-muted-foreground", className)}
          />
        }
      >
        <CalendarPlus />
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-72">
        <PopoverHeader>
          <PopoverTitle>Due dates in your calendar</PopoverTitle>
          <PopoverDescription>
            Subscribe once and every assignment StudySync hears about shows up on its own, with a reminder the day
            before. Works with Apple Calendar and Outlook on this computer.
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex gap-2">
          <Button render={<a href={CALENDAR_WEBCAL_URL} />} nativeButton={false} size="sm" className="gap-1.5">
            <Rss /> Subscribe
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              void navigator.clipboard.writeText(CALENDAR_FEED_URL).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Google Calendar can&apos;t reach this computer, so use &ldquo;Add to calendar&rdquo; on an assignment instead.
        </p>
      </PopoverContent>
    </Popover>
  );
}
