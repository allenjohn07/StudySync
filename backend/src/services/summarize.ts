import { z } from "zod";

export const summarySchema = z.object({
  topics: z.array(z.string()),
  keyPoints: z.array(z.string()),
  assignments: z.array(z.object({ title: z.string(), dueDate: z.string().nullable() })),
  tasks: z.array(z.string()),
  studyTip: z.string(),
});

export type Summary = z.infer<typeof summarySchema>;

// Keeps a long lecture inside the 3B model's context window (roughly 6k tokens).
const MAX_TRANSCRIPT_CHARS = 24_000;

// Small models are unreliable at date math, so hand them a weekday-labelled list to copy from.
function upcomingDays() {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" });
  return Array.from({ length: 15 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return `${weekday.format(d)} ${iso}`;
  });
}

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** How much to write, scaled to how much was said, so a one-liner is not padded into a lecture summary. */
function sizeGuidance(words: number) {
  if (words < 25) return "It is very short: keep topics and key points to 1 or 2 each, only restating what was said (this limit does not apply to assignments and tasks, which you must still list if the speaker states them).";
  if (words < 120) return "It is short: return 1 to 3 topics and 2 to 4 key points.";
  if (words < 600) return "Return 2 to 4 topics and 3 to 6 key points.";
  return "It is long: cover all of it with 3 to 6 topics and 4 to 8 key points, not just the opening.";
}

/** Worked examples: a small model copies the style of these far more reliably than it follows rules. */
function exampleMessages(friday: string) {
  const ex = (transcript: string, summary: Summary) => [
    { role: "user", content: transcript },
    { role: "assistant", content: JSON.stringify(summary) },
  ];
  return [
    ...ex("What is the capital of France?", {
      topics: ["Capital of France"],
      keyPoints: ["The speaker asks what the capital of France is."],
      assignments: [],
      tasks: [],
      studyTip: "",
    }),
    ...ex("Your essay is due this Friday, and please read chapter 8 before the quiz.", {
      topics: ["Essay deadline", "Chapter 8"],
      keyPoints: [
        "The speaker says the essay is due this Friday.",
        "The speaker asks the listeners to read chapter 8 before the quiz.",
      ],
      assignments: [{ title: "Essay", dueDate: friday }],
      tasks: ["Read chapter 8 before the quiz"],
      studyTip: "",
    }),
    ...ex("The mitochondria is the powerhouse of the cell. A good way to study this is to draw the cell and label it.", {
      topics: ["Mitochondria"],
      keyPoints: [
        "The speaker states that the mitochondria is the powerhouse of the cell.",
        "The speaker suggests drawing the cell and labelling it as a way to study.",
      ],
      assignments: [],
      tasks: [],
      studyTip: "The speaker suggests drawing the cell and labelling it.",
    }),
  ];
}

// Without a limit, one stalled call would block every later job (the queue runs one at a time).
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS ?? 90_000);

async function callOllama(transcript: string, signal?: AbortSignal): Promise<unknown> {
  const calendar = upcomingDays();
  const friday = calendar.slice(1).find((d) => d.startsWith("Friday"))?.split(" ")[1] ?? null;
  const res = await fetch(`${process.env.OLLAMA_URL ?? "http://localhost:11434"}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.any([AbortSignal.timeout(OLLAMA_TIMEOUT_MS), ...(signal ? [signal] : [])]),
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL ?? "llama3.2:3b",
      stream: false,
      format: z.toJSONSchema(summarySchema),
      // num_ctx: Ollama's default window is small and would silently cut a long transcript; 8192 fits ~25 min.
      options: { temperature: 0.1, num_ctx: 8192 },
      messages: [
        {
          role: "system",
          content:
            `You write a short, neutral report of what a speaker said, based on a spoken transcript. Today is ${calendar[0]}. ` +
            `Dates for the next two weeks: ${calendar.join(", ")}. ` +
            "Report what was said in the third person, e.g. \"The speaker explains that...\", \"The speaker mentions...\", " +
            "\"The speaker asks whether...\". You are a reporter, not an assistant: never answer a question the speaker asks, " +
            "never explain or add facts of your own, and never address the reader. " +
            `The transcript is ${wordCount(transcript)} words long. ${sizeGuidance(wordCount(transcript))} ` +
            "Every key point must be something the speaker actually said; if the speaker only said a greeting or an opinion, " +
            "report just that. A topic is a short name (a few words). " +
            "Stay consistent: if a key point says something is due, it must also be listed in assignments; if a key point asks the listeners " +
            "to do something, it must also be listed in tasks. " +
            "Return assignments the speaker mentioned (title as the speaker named it; dueDate as YYYY-MM-DD copied from the date " +
            "list above, or null if unclear), and tasks, meaning things the speaker explicitly told the listeners to do, " +
            "but only if the transcript actually says them. Otherwise use an empty array. " +
            "Give a studyTip only if the speaker themself gave advice on how to study or prepare, reported in the third person " +
            "(never repeat a task or assignment as a tip); otherwise an empty string. Do not invent anything that is not in the transcript: no examples, no background, no extra detail.",
        },
        ...exampleMessages(friday ?? calendar[1].split(" ")[1]),
        { role: "user", content: transcript.slice(0, MAX_TRANSCRIPT_CHARS) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { message?: { content?: string } };
  return JSON.parse(body.message?.content ?? "");
}

/** `signal` lets the caller cancel a summary that is no longer wanted (e.g. the user pressed "Try again"). */
export async function summarize(transcript: string, signal?: AbortSignal): Promise<Summary> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const summary = summarySchema.parse(await callOllama(transcript, signal));
      // A real sentence should always yield something; an all-empty answer is the model giving up, so retry.
      if (wordCount(transcript) >= 3 && !summary.topics.length && !summary.keyPoints.length) {
        throw new Error("The model returned no topics or key points");
      }
      return summary;
    } catch (err) {
      if (signal?.aborted) throw err; // cancelled on purpose: do not retry
      lastError = err;
      // A timeout means Ollama is stuck or overloaded; asking again straight away rarely helps.
      if (err instanceof Error && err.name === "TimeoutError") break;
    }
  }
  if (lastError instanceof Error && lastError.name === "TimeoutError") {
    throw new Error(`Ollama took longer than ${Math.round(OLLAMA_TIMEOUT_MS / 1000)} seconds to answer. It may be busy or stuck.`);
  }
  throw new Error(`Could not get a valid summary from Ollama: ${lastError instanceof Error ? lastError.message : lastError}`);
}
