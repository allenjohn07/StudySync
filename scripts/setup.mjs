// `npm run setup`: one-time setup after cloning. Safe to run again; it only does what's missing.
//   1. checks Node and the command-line tools (ffmpeg, whisper-cli, ollama)
//   2. creates backend/.env and frontend/.env.local from their examples
//   3. downloads the Whisper speech model (~574 MB) into backend/models/
//   4. pulls the Ollama summary model (~2 GB)
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const WHISPER_MODEL = "ggml-large-v3-turbo-q5_0.bin";
const WHISPER_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${WHISPER_MODEL}`;
const OLLAMA_MODEL = "llama3.2:3b";

const ok = (m) => console.log(`  ✓ ${m}`);
const warn = (m) => console.log(`  ! ${m}`);
const step = (m) => console.log(`\n${m}`);
let problems = 0;

const has = (cmd, args = ["--version"]) => {
  const r = spawnSync(cmd, args, { stdio: "ignore" });
  return !r.error;
};

step("Checking tools");
const [major, minor] = process.versions.node.split(".").map(Number);
if (major > 22 || (major === 22 && minor >= 5)) ok(`Node.js ${process.versions.node}`);
else {
  warn(`Node.js ${process.versions.node} is too old: the backend needs node:sqlite (Node 22.5+, tested on 24).`);
  problems++;
}
for (const [cmd, args, brew] of [
  ["ffmpeg", ["-version"], "ffmpeg"],
  ["whisper-cli", ["--help"], "whisper-cpp"],
  ["ollama", ["--version"], "ollama"],
]) {
  if (has(cmd, args)) ok(cmd);
  else {
    warn(`${cmd} not found. Install it with: brew install ${brew}`);
    problems++;
  }
}

step("Settings files");
for (const [example, target] of [
  ["backend/.env.example", "backend/.env"],
  ["frontend/.env.example", "frontend/.env.local"],
]) {
  if (existsSync(join(root, target))) ok(`${target} already exists`);
  else {
    copyFileSync(join(root, example), join(root, target));
    ok(`created ${target}`);
  }
}

step("Speech model (Whisper)");
const modelPath = join(root, "backend", "models", WHISPER_MODEL);
if (existsSync(modelPath)) ok(`backend/models/${WHISPER_MODEL}`);
else {
  mkdirSync(dirname(modelPath), { recursive: true });
  console.log(`  Downloading ${WHISPER_MODEL} (about 574 MB)…`);
  const partial = `${modelPath}.part`;
  try {
    const res = await fetch(WHISPER_URL);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const total = Number(res.headers.get("content-length")) || 0;
    let received = 0;
    let shown = -1;
    const body = Readable.fromWeb(res.body);
    body.on("data", (chunk) => {
      received += chunk.length;
      const pct = total ? Math.floor((received / total) * 100) : 0;
      if (pct !== shown && pct % 5 === 0) {
        shown = pct;
        process.stdout.write(`\r  ${pct}%`);
      }
    });
    await pipeline(body, createWriteStream(partial));
    renameSync(partial, modelPath);
    process.stdout.write("\r");
    ok(`downloaded backend/models/${WHISPER_MODEL}`);
  } catch (err) {
    rmSync(partial, { force: true });
    warn(`Download failed (${err.message}). Run npm run setup again to retry.`);
    problems++;
  }
}

step("Summary model (Ollama)");
if (!has("ollama")) warn("Skipped: Ollama isn't installed.");
else {
  const list = () => spawnSync("ollama", ["list"], { encoding: "utf8" });
  let models = list();
  // `ollama list` and `ollama pull` need the server; start one for now if none is running
  let server = null;
  if (models.status !== 0) {
    server = spawn("ollama", ["serve"], { stdio: "ignore" });
    for (let i = 0; i < 20 && models.status !== 0; i++) {
      await new Promise((r) => setTimeout(r, 300));
      models = list();
    }
  }
  if (models.status === 0 && models.stdout.includes(OLLAMA_MODEL)) ok(OLLAMA_MODEL);
  else {
    console.log(`  Pulling ${OLLAMA_MODEL} (about 2 GB)…`);
    const pull = spawnSync("ollama", ["pull", OLLAMA_MODEL], { stdio: "inherit" });
    if (pull.status === 0) ok(`pulled ${OLLAMA_MODEL}`);
    else {
      warn(`Couldn't pull the model. Try: ollama pull ${OLLAMA_MODEL}`);
      problems++;
    }
  }
  server?.kill("SIGTERM");
}

console.log(
  problems
    ? `\nSetup finished with ${problems} problem${problems === 1 ? "" : "s"} (see above). Fix them, then run npm run setup again.`
    : "\nAll set. Start everything with: npm run dev",
);
process.exit(problems ? 1 : 0);
