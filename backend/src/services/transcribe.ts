import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => reject(new Error(`Could not run ${cmd}: ${err.message}`)));
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} failed (exit ${code}): ${stderr.trim().split("\n").slice(-2).join(" ")}`))
    );
  });
}

/** Converts the recording to 16 kHz mono wav with ffmpeg, then transcribes it with whisper.cpp. */
export async function transcribe(audio: Buffer): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "studysync-"));
  try {
    const input = join(dir, "input");
    const wav = join(dir, "audio.wav");
    const outBase = join(dir, "transcript");
    await writeFile(input, audio);

    await run(process.env.FFMPEG_BIN ?? "ffmpeg", ["-y", "-i", input, "-ar", "16000", "-ac", "1", wav]);
    await run(process.env.WHISPER_BIN ?? "whisper-cli", [
      "-m",
      process.env.WHISPER_MODEL_PATH ?? "./models/ggml-large-v3-turbo-q5_0.bin",
      "-f",
      wav,
      "-otxt",
      "-of",
      outBase,
      "-np",
      // Greedy decoding (the default is beam search with 5 candidates): much faster, same text for speech this clear.
      "-bs",
      "1",
      "-bo",
      "1",
      "-nf",
    ]);

    return (await readFile(`${outBase}.txt`, "utf8")).trim();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
