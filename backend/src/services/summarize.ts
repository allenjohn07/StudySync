import { z } from "zod";
import { resolveDueDate } from "./dates.js";
import { addMissedDeadlines } from "./deadlines.js";

export const summarySchema = z.object({
  topics: z.array(z.string()),
  keyPoints: z.array(z.string()),
  // dueText: the speaker's own words for the deadline ("next Wednesday"); dueDate is worked out from it in code
  // (see services/dates.ts), falling back to the model's own guess only when the words can't be read as a date.
  assignments: z.array(z.object({ title: z.string(), dueText: z.string().nullable(), dueDate: z.string().nullable() })),
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
  if (words < 25) return "It is very short: keep topics and key points to 1 or 2 each, only restating what was said (this limit does not apply to assignments and tasks, which you must still list if they are stated).";
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
    ...ex("Hello, can everyone hear me? Okay. So Paris has been the capital of France since the year 987.", {
      topics: ["Capital of France"],
      keyPoints: ["Paris has been the capital of France since 987."],
      assignments: [],
      tasks: [],
      studyTip: "",
    }),
    ...ex("Your essay is due this Friday, and please read chapter 8 before the quiz.", {
      topics: ["Essay deadline", "Chapter 8"],
      keyPoints: ["Essay due this Friday.", "Read chapter 8 before the quiz."],
      assignments: [{ title: "Essay", dueText: "this Friday", dueDate: friday }],
      tasks: ["Read chapter 8 before the quiz"],
      studyTip: "",
    }),
    ...ex("Problem set three is due next Wednesday.", {
      topics: ["Problem set 3"],
      keyPoints: ["Problem set 3 due next Wednesday."],
      assignments: [{ title: "Problem set 3", dueText: "next Wednesday", dueDate: resolveDueDate("next Wednesday") }],
      tasks: [],
      studyTip: "",
    }),
    ...ex(
      "So the light reactions happen in the thylakoid membrane, that's where water gets split and oxygen comes out. " +
        "Then the Calvin cycle uses the ATP and NADPH from that to build sugar, and that part happens in the stroma.",
      {
        topics: ["Light reactions", "Calvin cycle"],
        keyPoints: [
          "Light reactions take place in the thylakoid membrane: water is split and oxygen is released.",
          "The Calvin cycle uses the ATP and NADPH from the light reactions to build sugar.",
          "The Calvin cycle takes place in the stroma.",
        ],
        assignments: [],
        tasks: [],
        studyTip: "",
      },
    ),
    ...ex("The mitochondria is the powerhouse of the cell. A good way to study this is to draw the cell and label it.", {
      topics: ["Mitochondria"],
      keyPoints: ["The mitochondria is the powerhouse of the cell."],
      assignments: [],
      tasks: [],
      studyTip: "Draw the cell and label each part.",
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
      // num_predict caps the answer, so a model stuck repeating itself fails fast instead of running until the timeout.
      options: { temperature: 0.1, num_ctx: 8192, num_predict: 1200 },
      messages: [
        {
          role: "system",
          content:
            `You turn a spoken lecture transcript into concise study notes, the way a good student writes them. Today is ${calendar[0]}. ` +
            `Dates for the next two weeks: ${calendar.join(", ")}. ` +
            "Write each key point as a short, self-contained note of the content itself: the fact, idea, definition, step, " +
            "date or instruction, in plain words and the present tense, one idea per point, ideally under 20 words. " +
            "Never describe the talking: do not write \"the speaker\", \"the lecturer\", \"they mention\", \"is discussed\" or similar. " +
            "Skip small talk such as greetings, sound checks and questions to the room, and never answer a question yourself. " +
            "Each note says something different: never repeat a note or write two notes about the same thing. " +
            `The transcript is ${wordCount(transcript)} words long. ${sizeGuidance(wordCount(transcript))} ` +
            "Every note must come from the transcript: never add facts, explanations, examples or background of your own, " +
            "and never address the reader. A topic is a short name (a few words). " +
            "Stay consistent: if a note says something is due, it must also be listed in assignments; if a note tells the listeners " +
            "to do something, it must also be listed in tasks. " +
            "Return assignments that were mentioned: title as it was named; dueText as the exact words used " +
            "for the deadline (e.g. \"next Wednesday\", \"tomorrow\", \"December 3rd\"), or null if no deadline was given; " +
            "dueDate as YYYY-MM-DD from the date list above, or null if unclear. Also return tasks: things the listeners were explicitly told to do, " +
            "written as short instructions, only if the transcript actually says them; otherwise an empty array. " +
            "Give a studyTip only if advice on how to study or prepare was actually given, written as a short instruction " +
            "(never repeat a task or assignment as a tip); otherwise an empty string.",
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

// "The speaker explains that X" → "X", in case the model slips back into narrating the talk.
const NARRATION =
  /^(?:the |our )?(?:speaker|lecturer|teacher|professor|instructor)\s+(?:also\s+)?(?:says|said|states|explains|mentions|notes|describes|points out|discusses|talks about|reminds (?:the )?(?:listeners|students|class|everyone)|asks (?:the )?(?:listeners|students|class|everyone)(?: to)?|suggests|adds)(?:\s+that)?[\s:,]*/i;

function asNote(text: string) {
  const stripped = text.replace(NARRATION, "").trim();
  if (!stripped || stripped === text) return text;
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

/** Drops exact repeats (a small model can loop on one phrasing) and keeps the list to a readable length. */
function distinct(items: string[], max: number) {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      const key = item.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
}

function asNotes(summary: Summary): Summary {
  return {
    ...summary,
    topics: distinct(summary.topics, 6),
    keyPoints: distinct(summary.keyPoints.map(asNote), 8),
    tasks: distinct(summary.tasks.map(asNote), 8),
    studyTip: summary.studyTip ? asNote(summary.studyTip) : summary.studyTip,
  };
}

/** Replaces each due date with the one computed from the speaker's words, when they can be read as a date. */
function withResolvedDates(summary: Summary): Summary {
  return {
    ...summary,
    assignments: summary.assignments.map((a) => ({ ...a, dueDate: resolveDueDate(a.dueText) ?? a.dueDate })),
  };
}

/** `signal` lets the caller cancel a summary that is no longer wanted (e.g. the user pressed "Try again"). */
export async function summarize(transcript: string, signal?: AbortSignal): Promise<Summary> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const summary = addMissedDeadlines(asNotes(withResolvedDates(summarySchema.parse(await callOllama(transcript, signal)))), transcript);
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
