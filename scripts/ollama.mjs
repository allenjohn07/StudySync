// Part of `npm run dev`: makes sure Ollama is serving.
// - Already running (the menu-bar app, `brew services`, another terminal): leave it alone and exit.
// - Not running: start `ollama serve` and keep it in the foreground, so Ctrl+C stops it with everything else.
import { spawn } from "node:child_process";

const URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "llama3.2:3b";

// `npm run dev` already prefixes this process's lines with [ollama]
const log = (message) => console.log(message);

async function version() {
  try {
    const res = await fetch(`${URL}/api/version`, { signal: AbortSignal.timeout(1500) });
    return res.ok ? (await res.json()).version : null;
  } catch {
    return null;
  }
}

async function checkModel() {
  try {
    const { models = [] } = await (await fetch(`${URL}/api/tags`)).json();
    if (!models.some((m) => m.name === MODEL || m.name === `${MODEL}:latest`)) {
      log(`Model "${MODEL}" isn't downloaded yet, so summaries will fail. Run: ollama pull ${MODEL}`);
    }
  } catch {
    // not fatal: the backend reports Ollama problems on its own
  }
}

const running = await version();
if (running) {
  log(`Already running (v${running}), using it.`);
  await checkModel();
  process.exit(0);
}

log("Starting ollama serve…");
const child = spawn("ollama", ["serve"], { stdio: ["ignore", "ignore", "pipe"] });

child.on("error", (err) => {
  if (err.code === "ENOENT") {
    log("Ollama isn't installed, so summaries won't work. Install it with: brew install ollama");
  } else {
    log(`Couldn't start Ollama: ${err.message}`);
  }
  // keep the rest of the app running: recording and transcription work without it
  process.exit(0);
});

// Ollama logs every request to stderr; only pass on real errors.
child.stderr.on("data", (chunk) => {
  for (const line of chunk.toString().split("\n")) {
    if (/level=(ERROR|WARN)|Error:/.test(line)) console.error(line.trim());
  }
});

for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 250));
  const v = await version();
  if (v) {
    log(`Ready (v${v}).`);
    await checkModel();
    break;
  }
}

const stop = () => child.kill("SIGTERM");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => process.exit(code ?? 0));
