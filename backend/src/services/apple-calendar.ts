import { execFile } from "node:child_process";
import { getSetting, setSetting } from "../db.js";
import { type DueItem, dueItems, eventNotes, eventTitle } from "./due-items.js";

// Writes every due date straight into a "StudySync" calendar in Apple Calendar (macOS only), through the
// Calendar app's scripting interface: no subscription, no network. The calendar belongs to StudySync: each sync
// replaces its events with the current list, so deleted or moved deadlines disappear or move too.
//
// The first sync makes macOS ask whether the app running the backend (Terminal, VS Code…) may control Calendar.

export const CALENDAR_NAME = "StudySync";
const ENABLED_KEY = "apple_calendar_enabled";
const LAST_SYNC_KEY = "apple_calendar_last_sync";
const LAST_ERROR_KEY = "apple_calendar_last_error";
const LAST_COUNT_KEY = "apple_calendar_events";
// Long enough for the student to answer the macOS permission prompt on the first sync.
const SYNC_TIMEOUT_MS = 120_000;

export const supported = process.platform === "darwin";

// JavaScript for Automation, run by osascript. Gets the items as JSON in argv[0] and the calendar name in argv[1].
const SCRIPT = `
function run(argv) {
  const items = JSON.parse(argv[0]);
  const name = argv[1];
  const Cal = Application("Calendar");
  const wasRunning = Cal.running();

  let found = Cal.calendars.whose({ name: name })();
  const cal = found.length ? found[0] : Cal.make({ new: "calendar", withProperties: { name: name } });

  // Start from a clean slate: this calendar only ever holds StudySync's due dates.
  const old = cal.events();
  for (let i = old.length - 1; i >= 0; i--) old[i].delete();

  for (const item of items) {
    const p = item.date.split("-").map(Number);
    const event = Cal.make({
      new: "event",
      at: cal.events,
      withProperties: {
        summary: item.summary,
        description: item.notes,
        startDate: new Date(p[0], p[1] - 1, p[2]),
        endDate: new Date(p[0], p[1] - 1, p[2] + 1),
        alldayEvent: true,
      },
    });
    // a reminder at 9:00 the day before (15 hours before midnight, in minutes)
    try {
      Cal.make({ new: "displayAlarm", at: event.displayAlarms, withProperties: { triggerInterval: -900 } });
    } catch (e) {}
  }

  if (!wasRunning) Cal.quit();
  return String(items.length);
}
`;

function runScript(items: DueItem[]): Promise<number> {
  const payload = JSON.stringify(
    items.map((item) => ({ date: item.dueDate, summary: eventTitle(item), notes: eventNotes(item) }))
  );
  return new Promise((resolve, reject) => {
    execFile(
      "osascript",
      ["-l", "JavaScript", "-e", SCRIPT, payload, CALENDAR_NAME],
      { timeout: SYNC_TIMEOUT_MS },
      (err, stdout, stderr) => {
        if (!err) return resolve(Number(stdout.trim()) || 0);
        const text = `${stderr || ""} ${err.message}`;
        if (/-1743|not authori[sz]ed/i.test(text)) {
          reject(
            new Error(
              "macOS didn't allow StudySync to use Calendar. Allow it in System Settings → Privacy & Security → " +
                "Automation (under the app that runs StudySync, e.g. Terminal), then try again."
            )
          );
        } else if (err.killed) {
          reject(new Error("Calendar didn't respond. If macOS is asking for permission, allow it and try again."));
        } else {
          reject(new Error(`Couldn't update Apple Calendar: ${(stderr || err.message).trim().slice(0, 200)}`));
        }
      }
    );
  });
}

export interface AppleCalendarStatus {
  supported: boolean;
  enabled: boolean;
  syncing: boolean;
  calendarName: string;
  lastSyncAt: string | null;
  lastError: string | null;
  events: number;
}

let current: Promise<void> | null = null;
let again = false;

export function status(): AppleCalendarStatus {
  return {
    supported,
    enabled: supported && getSetting(ENABLED_KEY) === "1",
    syncing: current !== null,
    calendarName: CALENDAR_NAME,
    lastSyncAt: getSetting(LAST_SYNC_KEY),
    lastError: getSetting(LAST_ERROR_KEY),
    events: Number(getSetting(LAST_COUNT_KEY) ?? 0),
  };
}

async function syncOnce() {
  try {
    const count = await runScript(dueItems());
    setSetting(LAST_SYNC_KEY, new Date().toISOString());
    setSetting(LAST_COUNT_KEY, String(count));
    setSetting(LAST_ERROR_KEY, null);
  } catch (err) {
    setSetting(LAST_ERROR_KEY, err instanceof Error ? err.message : String(err));
    console.error("Apple Calendar sync failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Updates Apple Calendar now (if it's turned on). Calls that arrive while a sync is running are folded into one
 * more sync afterwards, so a burst of changes costs at most two runs. Resolves when everything is written.
 */
export function syncAppleCalendar(): Promise<void> {
  if (!status().enabled) return Promise.resolve();
  if (current) {
    again = true;
    return current;
  }
  current = (async () => {
    do {
      again = false;
      await syncOnce();
    } while (again);
    current = null;
  })();
  return current;
}

/** For changes that affect due dates (a new summary, a deleted session…): sync in the background. */
export function scheduleAppleSync() {
  void syncAppleCalendar();
}

export async function setEnabled(enabled: boolean) {
  setSetting(ENABLED_KEY, enabled ? "1" : "0");
  if (enabled) await syncAppleCalendar();
  else setSetting(LAST_ERROR_KEY, null);
}
