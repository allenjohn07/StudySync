# StudySync

Record a class, watch the transcript appear as you speak, and get a plain-language summary
when you stop: topics, key points, assignments with due dates, tasks, and a study tip.

Everything runs **locally on your machine**: speech recognition with Whisper and the summary
with a small model through Ollama. No audio or text leaves your computer, and no API keys are needed.

## How it works

```
Browser (audio only, cut into ~8 s pieces while you record)
   │  POST /api/lessons/:id/chunks   (one request per piece)
   ▼
Hono backend ── ffmpeg ──▶ 16 kHz mono wav ──▶ whisper.cpp (small.en) ──▶ transcript lines
   │                                                                      │ saved in SQLite
   │  POST /api/lessons/:id/finish                                        ▼
   └──────────────▶ Ollama (llama3.2:3b) ──▶ JSON summary ──▶ SQLite ──▶ shown in the browser
```

1. **Start recording** on the demo page. A lesson (session) is created.
2. Every ~8 seconds the browser sends the latest audio piece. The backend transcribes it and the
   line shows up on the left with its timestamp (expect a delay of roughly 8 to 12 seconds).
3. **Stop** sends the last piece and asks the backend to finish. It joins the transcript lines,
   asks the Ollama model for a structured summary, and saves it.
4. The browser polls the lesson and fills in the summary on the right. Sections with nothing
   in them (for example no assignments mentioned) are hidden. Even a single spoken sentence gets
   a topic and a key point.
5. Every session is saved. The sidebar lists past sessions: open one to see its transcript and
   summary again, start a new one, or delete one.

## Pages

| Route | What it is |
| --- | --- |
| `/` | Landing page |
| `/login` | A single "Log in" button. Login state is a flag in `localStorage` for now (no real auth yet) |
| `/dashboard` | A static mock of the recording and summary screen, kept as a safe fallback. Has a "Try the live demo" button |
| `/dashboard/demo` | The real thing: live recording, live transcript, summary, and the sessions sidebar |

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui on Base UI, TanStack Query |
| Backend | Node.js + Hono + TypeScript (ESM) on port 4000 |
| Database | SQLite through Node's built-in `node:sqlite` (one file: `backend/studysync.db`) |
| Speech to text | whisper.cpp with the `ggml-small.en` model, audio converted by ffmpeg |
| Summary | Ollama running `llama3.2:3b`, answering in a fixed JSON schema (validated with Zod) |

Peak memory is roughly 8 GB including macOS, so it runs comfortably on a 16 GB Mac.
Whisper and the language model never run at the same time: jobs are processed one at a time.

## Setup (once)

You need Node.js 24 (tested; the backend uses the built-in `node:sqlite`) and [Homebrew](https://brew.sh).

```bash
# 1. Tools
brew install ffmpeg whisper-cpp ollama

# 2. Summary model (about 2 GB)
ollama pull llama3.2:3b

# 3. Speech model (about 470 MB), saved where the backend expects it
mkdir -p backend/models
curl -L -o backend/models/ggml-small.en.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin

# 4. Install dependencies and create the backend settings file
cd backend && cp .env.example .env && npm install && cd ..
cd frontend && npm install && cd ..
```

The defaults in `.env.example` match the steps above, so you normally don't need to edit `.env`.

## Run it

Use three terminal tabs:

```bash
ollama serve                      # skip if Ollama is already running
cd backend && npm run dev         # http://localhost:4000
cd frontend && npm run dev        # http://localhost:3000
```

Open <http://localhost:3000>, click **Log in**, then **Try the live demo** and allow the
microphone. Say something, press **Stop**, and wait a few seconds for the summary.

To shut down, press `Ctrl+C` in each tab. Your sessions stay in `backend/studysync.db`.

## Configuration (`backend/.env`)

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `4000` | Backend port |
| `FRONTEND_URL` | `http://localhost:3000` | Origin allowed by CORS |
| `DB_PATH` | `./studysync.db` | SQLite file, relative to the folder you start the backend from |
| `WHISPER_BIN` | `whisper-cli` | whisper.cpp command |
| `WHISPER_MODEL_PATH` | `./models/ggml-small.en.bin` | Whisper model file |
| `FFMPEG_BIN` | `ffmpeg` | ffmpeg command |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server |
| `OLLAMA_MODEL` | `llama3.2:3b` | Model used for summaries |
| `OLLAMA_TIMEOUT_MS` | `90000` | How long to wait for Ollama before the summary is marked as failed |

Quality too low, or too slow? Swap models without touching code: another Whisper model (`tiny.en` is
faster but less accurate, `medium.en` is more accurate but slower) via `WHISPER_MODEL_PATH`, or a larger Ollama model via `OLLAMA_MODEL` (needs more memory).

## API

All routes are under `/api` except the health check.

| Method and path | Purpose |
| --- | --- |
| `GET /health` | Health check |
| `POST /api/lessons` | Start a session, returns `{ id }` |
| `POST /api/lessons/:id/chunks` | Send one audio piece (multipart: `audio`, `seq`, `start`) |
| `POST /api/lessons/:id/finish` | Stop recording and write the summary |
| `POST /api/lessons/:id/resummarize` | Write the summary again from the saved transcript (after a failure, or if it is stuck) |
| `GET /api/lessons` | List sessions, newest first |
| `GET /api/lessons/:id` | One session: status, transcript lines, summary |
| `DELETE /api/lessons/:id` | Delete a finished session (409 while it is recording or processing) |

A session's `status` goes `recording` → `processing` → `done` (or `error`).

## Project layout

The repository has two folders and this README.

```
backend/                  Hono API (port 4000)
  src/app.ts              Hono app, CORS, routes
  src/index.ts            Server entry point
  src/db.ts               SQLite setup: lessons and segments tables
  src/routes/lessons.ts   Session routes and the job queue
  src/services/           transcribe.ts (ffmpeg + whisper.cpp), summarize.ts (Ollama)
  models/                 Whisper model file (git-ignored, you download it)
frontend/                 Next.js app (port 3000)
  src/app/                Pages: landing, login, dashboard, dashboard/demo
  src/components/         UI primitives (shadcn) and shared pieces
  src/hooks/              use-audio-recorder, use-lessons, use-local-auth
  src/lib/                api.ts (typed fetch client), types.ts
  src/design/             Original HTML mockups
  .claude/skills/         The design guide for AI coding assistants
  CLAUDE.md               Frontend conventions
```

Each folder has its own `.gitignore`.

## Look inside the database

```bash
cd backend
sqlite3 -header -column studysync.db
```
```sql
SELECT id, title, status, created_at FROM lessons ORDER BY id DESC;
SELECT lesson_id, seq, start_sec, text FROM segments ORDER BY lesson_id, seq;
```

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| "Could not run ffmpeg" or "Could not run whisper-cli" | The tool isn't installed or not on your `PATH`. Check `ffmpeg -version` and `whisper-cli --help` |
| Error about the model file | `backend/models/ggml-small.en.bin` is missing: redo the speech model download |
| "Ollama returned…" or "fetch failed" | Ollama isn't running: start `ollama serve` |
| Stuck on "Summarizing…" | Ollama is busy or stalled. After 90 s the summary fails; press **Summarize again** (or **Try again** if it is taking long) |
| "Couldn't reach the backend" | Backend isn't running on port 4000 |
| "No speech was detected" | Whisper heard nothing: check that the right microphone is selected |
| Phone shows "listening" | macOS picked your iPhone as the microphone (Continuity). Switch the input to your Mac in System Settings → Sound |

## Limits

- No real authentication yet: login is a `localStorage` flag, and all sessions are visible to anyone using the app.
- Long recordings: the summary only reads roughly the first 24,000 characters of the transcript.
- Words at the boundary between two audio pieces can be clipped, and the Whisper model still makes occasional mistakes.
- Audio itself is not stored, only the transcript and summary.
- No automated tests yet.
