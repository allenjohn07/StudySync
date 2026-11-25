# StudySync

**Record a class. Get the notes.**

StudySync records a lecture in the browser, transcribes it live, and when the class ends turns the transcript into a
plain-language study summary: topics, key points, assignments with due dates, tasks and a study tip. Due dates flow
into your calendar, and every topic comes with places to learn more.

Everything runs on your own computer. Speech recognition uses [whisper.cpp](https://github.com/ggerganov/whisper.cpp)
and summaries use a small language model through [Ollama](https://ollama.com). No audio or text leaves your machine,
and no accounts or API keys are needed.

---

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [Commands](#commands)
- [Using StudySync](#using-studysync)
- [How it works](#how-it-works)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)

## Features

- **Live transcript.** Words appear a second or two after they are spoken, with timestamps.
- **Study summary.** Topics, key points, assignments, tasks and a study tip, written when you stop recording. Long and
  short recordings are summarized to a matching length.
- **Subjects.** Every recording is filed under a subject or class (Biology 101, Calculus II…). The sidebar groups
  sessions by subject and is searchable.
- **Continue a session.** Pick up an earlier session; the new recording is added to its transcript and the summary is
  rewritten from the whole thing.
- **Due dates in your calendar.** A live calendar feed of every assignment, an **Upcoming** list in the sidebar, and
  one-click **Add to calendar** (Google Calendar or a `.ics` file) on each assignment.
- **Learn more.** Each topic links to Wikipedia, Khan Academy and YouTube.
- **Search everything** with ⌘L (or ⌘K): sessions, transcripts, topics, subjects, deadlines and actions.
- **Light and dark mode**, following your system setting by default.
- **Private by design.** Transcription, summaries and storage all happen locally.

## Quick start

### Requirements

| | |
| --- | --- |
| **OS** | macOS (tested on Apple Silicon). Linux works if you install the same tools with your package manager. |
| **Node.js** | 22.5 or newer (tested on 24). The backend uses the built-in `node:sqlite`. |
| **Tools** | `ffmpeg`, `whisper-cpp` and `ollama`, installed with [Homebrew](https://brew.sh) below. |
| **Memory** | About 8 GB at peak including the OS, so a 16 GB machine is comfortable. |
| **Disk** | About 3 GB for the two models. |

### Install and run

```bash
# 1. System tools
brew install ffmpeg whisper-cpp ollama

# 2. JavaScript dependencies (installs the root, backend and frontend in one go)
npm install

# 3. One-time setup: creates the settings files and downloads both models (~2.6 GB)
npm run setup

# 4. Start everything
npm run dev
```

`npm run dev` starts Ollama (unless it is already running), the API on <http://localhost:4000> and the web app on
<http://localhost:3000>, with their logs in one terminal. Press `Ctrl+C` to stop all of them. If Ollama was already
running before (for example from the menu-bar app), it is left running.

Open <http://localhost:3000>, choose **Log in**, then **New recording**, pick a subject and allow the microphone.

`npm run setup` is safe to run again at any time: it checks your tools and only does the steps that are missing.

## Commands

Run these from the repository root.

| Command | What it does |
| --- | --- |
| `npm install` | Installs dependencies for the root, `backend/` and `frontend/` |
| `npm run setup` | Checks tools, creates `backend/.env` and `frontend/.env.local`, downloads the Whisper model, pulls the Ollama model |
| `npm run dev` | Starts Ollama, the API and the web app together |
| `npm run seed` | **Deletes all subjects and sessions** and loads demo data (four subjects, seven sessions) |
| `npm run typecheck` | Type-checks the backend and the frontend |
| `npm run lint` | Lints the frontend |
| `npm run build` | Builds the backend (`backend/dist`) and a production frontend |

You can still run a single part on its own, for example `npm run dev:backend` or `npm run dev:frontend`.

## Using StudySync

1. **Start a recording.** Click **New recording** (or tap `Ctrl` twice). Choose a subject or create one, and optionally
   name the session; unnamed sessions are named after their topics. To add to an earlier session instead, choose
   **Continue a session**.
2. **Listen.** The transcript fills in on the left while you record.
3. **Stop** (or tap `Ctrl` twice again). The summary is written on the right, usually within 10 to 30 seconds.
4. **Review later.** Open any session from the sidebar to see its transcript and summary again.

### Calendar

The backend serves every assignment that has a due date as a calendar feed at
<http://localhost:4000/api/calendar.ics>. Each one becomes an all-day event with a reminder at 9:00 the day before.

- **Subscribe once** (recommended): click the calendar icon next to **Upcoming** in the sidebar and choose
  **Subscribe**, or add the URL in Apple Calendar via *File → New Calendar Subscription*. New due dates then appear on
  their own. Calendars refresh the feed about once an hour while StudySync is running.
- **One at a time:** every assignment in a summary has **Add to calendar**, which opens a prefilled Google Calendar
  event or downloads a `.ics` file. Use this for Google Calendar, which cannot subscribe to a feed on your own computer.

### Demo data

`npm run seed` replaces everything with sample subjects and sessions, which is handy for trying the interface. It
deletes your existing sessions first.

## How it works

```
Browser ── audio in ~4 s pieces, plus a live preview every 1.5 s ──▶ POST /api/lessons/:id/chunks
                                                                          │
Backend (Hono) ── ffmpeg ─▶ 16 kHz mono WAV ─▶ whisper.cpp ─▶ transcript lines ─▶ SQLite
                                                                          │
Stop ──▶ POST /api/lessons/:id/finish ─▶ Ollama (llama3.2:3b) ─▶ JSON summary ─▶ SQLite ─▶ browser
```

- The browser records audio only and cuts it into short, self-contained pieces. While a piece is being recorded, a
  growing preview of it is sent so words show up quickly; the finished piece replaces the preview.
- The backend converts each piece with ffmpeg and transcribes it with whisper.cpp. Silence markers and the short
  phrases Whisper tends to invent over silence are dropped.
- When you stop, the backend joins the transcript and asks the Ollama model for a summary in a fixed JSON shape,
  validated with Zod. Small models are poor at date arithmetic, so the prompt includes a list of upcoming dates to copy
  from.
- Heavy work runs one job at a time, so Whisper and the language model never compete for memory.

### Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui on Base UI, TanStack Query |
| Backend | Node.js, Hono, TypeScript (ESM) |
| Database | SQLite through Node's built-in `node:sqlite` (one file: `backend/studysync.db`) |
| Speech to text | whisper.cpp with `ggml-large-v3-turbo-q5_0`, audio converted by ffmpeg |
| Summaries | Ollama running `llama3.2:3b` |

## Configuration

`npm run setup` creates both settings files from their examples. The defaults match the setup steps, so most people
never need to edit them.

### Backend (`backend/.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4000` | API port |
| `FRONTEND_URL` | `http://localhost:3000` | Origin allowed by CORS |
| `DB_PATH` | `./studysync.db` | SQLite file, relative to `backend/` |
| `WHISPER_BIN` | `whisper-cli` | whisper.cpp command |
| `WHISPER_MODEL_PATH` | `./models/ggml-large-v3-turbo-q5_0.bin` | Whisper model file |
| `FFMPEG_BIN` | `ffmpeg` | ffmpeg command |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server |
| `OLLAMA_MODEL` | `llama3.2:3b` | Model used for summaries |
| `OLLAMA_TIMEOUT_MS` | `90000` | How long to wait for a summary before marking it as failed |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api` | Where the web app finds the API |

### Choosing models

Trade accuracy for speed without changing code:

- **Speech:** point `WHISPER_MODEL_PATH` at a smaller model such as `ggml-small.en.bin` or `ggml-tiny.en.bin`
  (download them from the [whisper.cpp models page](https://huggingface.co/ggerganov/whisper.cpp)).
- **Summaries:** set `OLLAMA_MODEL` to any model you have pulled with `ollama pull`. Larger models write better
  summaries but use more memory and take longer.

## API reference

All routes are served under `/api`, except the health check.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET` | `/api/lessons` | List sessions, newest first |
| `POST` | `/api/lessons` | Start a session. Body: `{ subjectId?, title? }`. Returns `{ id }` |
| `GET` | `/api/lessons/:id` | One session: status, transcript lines and summary |
| `PATCH` | `/api/lessons/:id` | Rename a session or move it to another subject. Body: `{ title?, subjectId? }` |
| `POST` | `/api/lessons/:id/chunks` | Upload an audio piece (multipart: `audio`, `seq`, `start`, `final`) |
| `POST` | `/api/lessons/:id/finish` | Stop recording and write the summary |
| `POST` | `/api/lessons/:id/resume` | Continue a finished session |
| `POST` | `/api/lessons/:id/resummarize` | Write the summary again from the saved transcript |
| `DELETE` | `/api/lessons/:id` | Delete a session (refused while it is being processed) |
| `DELETE` | `/api/lessons` | Delete every session (refused while one is recording or processing) |
| `GET` | `/api/subjects` | List subjects |
| `POST` | `/api/subjects` | Create a subject. Body: `{ name, color? }`. Returns the existing one if the name is taken |
| `DELETE` | `/api/subjects/:id` | Delete a subject; its sessions become unsorted |
| `GET` | `/api/calendar.ics` | iCalendar feed of every assignment with a due date |

A session's `status` moves from `recording` to `processing` to `done`, or to `error` if something fails.

## Project structure

```
.
├── package.json            Root scripts: npm run setup / dev / seed / …
├── scripts/
│   ├── setup.mjs           One-time setup (tools check, settings files, models)
│   └── ollama.mjs          Starts Ollama for `npm run dev` unless it is already running
├── backend/                Hono API (port 4000)
│   ├── src/
│   │   ├── index.ts        Server entry point
│   │   ├── app.ts          App, CORS and routes
│   │   ├── db.ts           SQLite schema and migrations
│   │   ├── seed.ts         Demo data (`npm run seed`)
│   │   ├── routes/         lessons.ts, subjects.ts, calendar.ts
│   │   └── services/       transcribe.ts (ffmpeg + whisper.cpp), summarize.ts (Ollama)
│   └── models/             Whisper model (downloaded by setup, not committed)
└── frontend/               Next.js app (port 3000)
    ├── src/app/            Pages: landing, login, dashboard
    ├── src/components/     App components and UI primitives (shadcn/ui)
    ├── src/hooks/          Data and recording hooks
    ├── src/lib/            API client, types, calendar and resource helpers
    ├── public/illustrations/  Landing page artwork
    ├── .claude/skills/     Design system guide
    └── CLAUDE.md           Frontend conventions
```

To look inside the database:

```bash
sqlite3 -header -column backend/studysync.db "SELECT id, title, status, created_at FROM lessons ORDER BY id DESC;"
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `npm run setup` reports a missing tool | Install it with Homebrew (`brew install ffmpeg whisper-cpp ollama`) and run setup again |
| "Could not run ffmpeg" or "Could not run whisper-cli" | The tool is not on your `PATH`. Check with `ffmpeg -version` and `whisper-cli --help` |
| Error about the Whisper model file | Run `npm run setup` to download it again |
| "Ollama returned…" or "fetch failed" when summarizing | Ollama is not running or the model is missing. `npm run dev` starts it; `npm run setup` pulls the model |
| `listen tcp 127.0.0.1:11434: bind: address already in use` | Ollama is already running, so there is nothing to start. `npm run dev` detects this and uses it |
| Stuck on "Summarizing…" | Ollama is busy or stalled. After 90 seconds the summary fails; use **Summarize again** or **Try again** |
| "Couldn't reach the backend" | The API is not running on port 4000. Start it with `npm run dev` |
| "No speech was detected" | Check that the right microphone is selected |
| macOS picks your iPhone as the microphone | Continuity Camera is active. Choose your Mac's microphone in *System Settings → Sound → Input* |

## Known limitations

- **No real accounts yet.** "Log in" sets a flag in the browser, and everyone using the computer sees the same
  sessions.
- **Long lectures:** the summary reads roughly the first 24,000 characters of the transcript.
- **Accuracy:** Whisper occasionally mishears words, especially at the boundary between two audio pieces, and the
  summary is only as accurate as the dates and assignments the model picks out.
- **Audio is not kept.** Only the transcript and summary are saved.
- **Calendar subscriptions** only refresh while StudySync is running, and Google Calendar cannot subscribe to a feed on
  your own computer.
- **No automated tests yet.**
