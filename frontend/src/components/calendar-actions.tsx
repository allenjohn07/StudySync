"use client";

import { useState } from "react";
import { AlertCircle, CalendarCheck2, CalendarPlus, Check, Copy, Download, ExternalLink, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useAppleCalendar, useSetAppleCalendar, useSyncAppleCalendar } from "@/hooks/use-apple-calendar";
import { ApiError } from "@/lib/api";
import { CALENDAR_FEED_URL, type DueItem, downloadIcs, googleCalendarUrl } from "@/lib/calendar";
import type { AppleCalendarStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const menuItem =
  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60";

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "Couldn't reach StudySync. Is it running?");

function ago(iso: string | null) {
  if (!iso) return "";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Turning Apple Calendar on: the first sync writes every due date (macOS may ask for permission first), so the
 * result is reported in a toast.
 */
export function useTurnOnAppleCalendar() {
  const setEnabled = useSetAppleCalendar();
  const turnOn = () =>
    setEnabled.mutate(true, {
      onSuccess: (status) =>
        status.lastError
          ? toast.error("Couldn't add your due dates to Apple Calendar", { description: status.lastError })
          : toast.success(`Added to the “${status.calendarName}” calendar`, {
              description: `${status.events} due ${status.events === 1 ? "date" : "dates"}. New ones are added after each class.`,
            }),
      onError: (err) => toast.error("Couldn't turn on Apple Calendar", { description: errorText(err) }),
    });
  return { turnOn, pending: setEnabled.isPending };
}

/** "Add to calendar" for one assignment: Apple Calendar (all due dates, kept up to date), Google Calendar, or a .ics file. */
export function AddToCalendar({ item, index }: { item: DueItem; index: number }) {
  const [open, setOpen] = useState(false);
  const apple = useAppleCalendar().data;
  const { turnOn, pending } = useTurnOnAppleCalendar();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="xs" className="-ml-1 gap-1.5 text-muted-foreground hover:text-foreground" />
        }
      >
        {apple?.enabled ? <CalendarCheck2 /> : <CalendarPlus />} {apple?.enabled ? "In your calendar" : "Add to calendar"}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-1 p-1.5">
        {apple?.supported &&
          (apple.enabled ? (
            <p className="flex items-start gap-2.5 px-2.5 py-2 text-[13px]">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <span className="font-medium">Already in Apple Calendar</span>
                <span className="block text-xs text-muted-foreground">
                  In the &ldquo;{apple.calendarName}&rdquo; calendar, with a reminder the day before.
                </span>
              </span>
            </p>
          ) : (
            <button
              type="button"
              className={menuItem}
              disabled={pending}
              onClick={() => {
                turnOn();
                setOpen(false);
              }}
            >
              {pending ? <Spinner className="size-4" /> : <CalendarPlus className="size-4 text-muted-foreground" />}
              Add all due dates to Apple Calendar
            </button>
          ))}
        <a href={googleCalendarUrl(item)} target="_blank" rel="noreferrer" className={menuItem} onClick={() => setOpen(false)}>
          <ExternalLink className="size-4 text-muted-foreground" />
          Google Calendar
          <span className="ml-auto text-xs font-normal text-muted-foreground">this one</span>
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
          <span className="ml-auto text-xs font-normal text-muted-foreground">this one</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}

function AppleStatusLine({ status }: { status: AppleCalendarStatus }) {
  if (status.syncing) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Spinner className="size-3.5" /> Updating Apple Calendar…
      </p>
    );
  }
  if (status.lastError) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-destructive/[0.07] px-2.5 py-2 text-xs text-destructive">
        <AlertCircle className="mt-px size-3.5 shrink-0" />
        {status.lastError}
      </p>
    );
  }
  return (
    <p className="flex items-start gap-2 text-[13px]">
      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span>
        {status.events} due {status.events === 1 ? "date" : "dates"} in the &ldquo;{status.calendarName}&rdquo; calendar
        <span className="block text-xs text-muted-foreground">Updated {ago(status.lastSyncAt)}</span>
      </span>
    </p>
  );
}

/** The calendar button next to "Upcoming": Apple Calendar sync on/off, plus the feed link for other apps. */
export function CalendarSettings({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  const status = useAppleCalendar().data;
  const { turnOn, pending } = useTurnOnAppleCalendar();
  const setEnabled = useSetAppleCalendar();
  const sync = useSyncAppleCalendar();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Due dates in your calendar"
            title="Due dates in your calendar"
            className={cn("text-muted-foreground", status?.enabled && "text-emerald-600 dark:text-emerald-400", className)}
          />
        }
      >
        {status?.enabled ? <CalendarCheck2 /> : <CalendarPlus />}
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80 gap-3">
        <PopoverHeader>
          <PopoverTitle>Due dates in Apple Calendar</PopoverTitle>
          <PopoverDescription>
            StudySync adds every due date to a &ldquo;StudySync&rdquo; calendar, with a reminder the day before, and
            keeps it up to date after each class.
          </PopoverDescription>
        </PopoverHeader>

        {!status?.supported ? (
          <p className="text-xs text-muted-foreground">Apple Calendar sync is only available on a Mac.</p>
        ) : status.enabled ? (
          <>
            <AppleStatusLine status={status} />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={sync.isPending || status.syncing}
                onClick={() =>
                  sync.mutate(undefined, { onError: (err) => toast.error("Couldn't update Apple Calendar", { description: errorText(err) }) })
                }
              >
                <RotateCw className={cn(sync.isPending && "animate-spin")} /> Update now
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={setEnabled.isPending}
                onClick={() => setEnabled.mutate(false)}
              >
                Turn off
              </Button>
            </div>
          </>
        ) : (
          <>
            <Button size="sm" className="w-fit gap-1.5" disabled={pending} onClick={turnOn}>
              {pending ? <Spinner className="size-3.5" /> : <CalendarPlus />}
              {pending ? "Adding…" : "Add to Apple Calendar"}
            </Button>
            <p className="text-xs text-muted-foreground">
              The first time, macOS asks whether StudySync may use Calendar. Choose OK.
            </p>
          </>
        )}

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            Other calendar apps (Outlook, Thunderbird): subscribe to the feed on this computer.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-fit gap-1.5"
            onClick={() => {
              void navigator.clipboard.writeText(CALENDAR_FEED_URL).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy feed link"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
