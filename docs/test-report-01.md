# Test report 01: setup and first demo run

Tester: Abdulrahman Nasser (QA, Docs and Booth Manager)
Date: October 27, 2026
Commit I tested: `c2f6109` (Reorganise the repo into backend/ and frontend/)

## My computer

| Item | Value |
| --- | --- |
| Computer | MacBook Air M2 (2022) |
| Memory | 8 GB |
| macOS | Tahoe 26.6.2 |
| Node.js | 25.9.0 (README says tested on 24) |
| Homebrew | 6.0.17 |

## Result

Pass. I followed the README steps and the app works. The backend runs on port 4000,
the frontend runs on port 3000, and the live transcript and summary both work.

## Setup steps

| Step | Result | Notes |
| --- | --- | --- |
| `brew install ffmpeg whisper-cpp ollama` | Pass | |
| `ollama pull llama3.2:3b` | Pass | Only works after Ollama is running (see problem 1) |
| Download `ggml-small.en.bin` | Pass | 465 MB |
| `npm install` in backend | Pass | 0 vulnerabilities |
| `npm install` in frontend | Pass with warnings | eslint 9.39.5 deprecated, 3 low vulnerabilities |
| `npm run dev` in backend | Pass | Listening on http://localhost:4000 |
| `npm run dev` in frontend | Pass | Next.js 16.4.1, ready on http://localhost:3000 |
| Log in, open live demo, record, stop | Pass | Transcript and summary showed up |

## Problems I found

1. The README steps are in the wrong order. `ollama pull` only works when Ollama is
   running, but the README explains how to start Ollama later in "Run it". We can fix
   this by adding `brew services start ollama` before `ollama pull`.
2. The setup only works on Mac because it uses Homebrew. There are no steps for Windows.
   We should ask who on the team uses Windows.
3. The README says the app uses about 8 GB at peak and recommends 16 GB. It still ran
   on my 8 GB MacBook Air, but that is the minimum. We should close other apps before
   the booth demo.
4. It works on Node 25, but the README only talks about Node 24.
5. The frontend shows warnings: eslint is deprecated and npm reports 3 low
   vulnerabilities. Not urgent. Please don't run `npm audit fix --force`, it can
   break packages.
6. Our work plan (v5) says Express + Prisma + PostgreSQL + Claude API, but the code now
   uses Hono + SQLite + Whisper + Ollama. Everything runs locally and needs no API key.
   We need to agree as a team on which one is final.

## What I will test next

- Recording longer than 45 minutes
- Assignments with due dates in the summary
- Phone view
- Fresh setup on a Windows computer (if a teammate uses Windows)
