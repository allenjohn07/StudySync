import { execFile } from "node:child_process";
import { getSetting, setSetting } from "../db.js";
import { type DueItem, dueItems, eventNotes, eventTitle } from "./due-items.js";

// Writes every due date straight into a "StudySync" calendar in Apple Calendar (macOS only), through the
// Calendar app's scripting interface: no subscription, no network. The calendar belongs to StudySync: each sync
// replaces its events with the current list, so deleted or moved deadlines disappear or move too.
//
// The first sync makes macOS ask whether the app running the backend (Terminal, VS Code…) may control Calendar.
// The script is AppleScript run by `osascript`.

export const CALENDAR_NAME = "StudySync";
const ENABLED_KEY = "apple_calendar_enabled";
const LAST_SYNC_KEY = "apple_calendar_last_sync";
const LAST_ERROR_KEY = "apple_calendar_last_error";
const LAST_COUNT_KEY = "apple_calendar_events";
// Long enough for the student to answer the macOS permission prompt on the first sync.
const SYNC_TIMEOUT_MS = 120_000;

export const supported = process.platform === "darwin";

// AppleScript, run by osascript. (Calendar's JavaScript scripting failed with "Handler only handles single objects"
// when given a calendar found by a search, so this addresses the calendar by name in AppleScript.)
const SCRIPT = `
-- argv: calendar name, then 5 items per event: year, month, day, title, notes
on run argv
	set calName to item 1 of argv
	set wasRunning to application "Calendar" is running
	tell application "Calendar"
		if not (exists calendar calName) then make new calendar with properties {name:calName}
		set cal to calendar calName
		-- start from a clean slate: this calendar only ever holds StudySync's due dates
		delete every event of cal
		set i to 2
		set added to 0
		repeat while i + 4 ≤ (count of argv)
			set d to current date
			set day of d to 1
			set year of d to (item i of argv) as integer
			set month of d to (item (i + 1) of argv) as integer
			set day of d to (item (i + 2) of argv) as integer
			set time of d to 0
			set ev to make new event at end of events of cal with properties {summary:(item (i + 3) of argv), description:(item (i + 4) of argv), start date:d, end date:(d + 1 * days), allday event:true}
			-- a reminder at 9:00 the day before (15 hours before midnight, in minutes)
			make new display alarm at end of display alarms of ev with properties {trigger interval:-900}
			set added to added + 1
			set i to i + 5
		end repeat
	end tell
	if not wasRunning then tell application "Calendar" to quit
	return added
end run
`;

function runScript(items: DueItem[]): Promise<number> {
  // argv for the script: the calendar name, then year, month, day, title and notes for each event
  const args = [CALENDAR_NAME];
  for (const item of items) {
    const [year, month, day] = item.dueDate.split("-");
    args.push(String(Number(year)), String(Number(month)), String(Number(day)), eventTitle(item), eventNotes(item));
  }
  return new Promise((resolve, reject) => {
    execFile(
      "osascript",
      ["-e", SCRIPT, ...args],
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
