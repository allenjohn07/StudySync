// Wipes every subject and session, then fills the database with demo data for trying the UI.
// Run with `npm run seed` (safe while the server is running; refresh the page afterwards).
import "dotenv/config";
import db from "./db.js";

type Summary = {
  topics: string[];
  keyPoints: string[];
  assignments: { title: string; dueDate: string | null }[];
  tasks: string[];
  studyTip: string;
};

interface DemoSession {
  title?: string;
  daysAgo: number;
  hour: number;
  lines: string[];
  summary: Summary;
}

const isoDay = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// SQLite's CURRENT_TIMESTAMP format, in UTC.
const sqlTime = (daysAgo: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 10 + ((daysAgo * 7) % 40), 0, 0);
  return d.toISOString().slice(0, 19).replace("T", " ");
};

const DEMO: { name: string; color: string; sessions: DemoSession[] }[] = [
  {
    name: "Biology 101",
    color: "green",
    sessions: [
      {
        daysAgo: 0,
        hour: 9,
        lines: [
          "Today we're looking at photosynthesis, which happens in two stages.",
          "The light reactions happen in the thylakoid membrane. That is where water gets split.",
          "The Calvin cycle then uses that ATP and NADPH to build sugar in the stroma.",
          "Quick reminder: the lab report is due next Friday, and chapter 8 is on the quiz.",
        ],
        summary: {
          topics: ["Photosynthesis", "Light reactions", "Calvin cycle"],
          keyPoints: [
            "Photosynthesis happens in two stages inside the chloroplast.",
            "Light reactions split water in the thylakoid membrane and make ATP and NADPH.",
            "The Calvin cycle uses ATP and NADPH to build sugar in the stroma.",
          ],
          assignments: [{ title: "Lab report", dueDate: isoDay(5) }],
          tasks: ["Review chapter 8 before the quiz"],
          studyTip: "Sketch the two stages side by side and label what goes in and what comes out of each.",
        },
      },
      {
        daysAgo: 2,
        hour: 9,
        lines: [
          "Cells get energy from glucose through cellular respiration.",
          "Glycolysis happens in the cytoplasm and splits glucose into two pyruvate molecules.",
          "Most of the ATP is made in the mitochondria during the electron transport chain.",
        ],
        summary: {
          topics: ["Cellular respiration", "Glycolysis"],
          keyPoints: [
            "Cellular respiration releases energy stored in glucose.",
            "Glycolysis in the cytoplasm turns one glucose into two pyruvate.",
            "The electron transport chain in the mitochondria makes most of the ATP.",
          ],
          assignments: [],
          tasks: ["Read pages 112 to 120"],
          studyTip: "Compare respiration with photosynthesis: the inputs of one are the outputs of the other.",
        },
      },
    ],
  },
  {
    name: "Calculus II",
    color: "blue",
    sessions: [
      {
        title: "Integration by parts",
        daysAgo: 1,
        hour: 11,
        lines: [
          "Integration by parts comes from the product rule for derivatives.",
          "The formula is the integral of u dv equals u v minus the integral of v du.",
          "Pick u as the part that gets simpler when you differentiate it, like a polynomial.",
          "Problem set four is due Wednesday, problems one through twelve.",
        ],
        summary: {
          topics: ["Integration by parts"],
          keyPoints: [
            "Integration by parts is the product rule run backwards.",
            "∫u dv = uv − ∫v du.",
            "Choose u so that it gets simpler when differentiated (LIATE helps).",
          ],
          assignments: [{ title: "Problem set 4, problems 1–12", dueDate: isoDay(3) }],
          tasks: [],
          studyTip: "Do three problems where you deliberately pick the wrong u, to see why the choice matters.",
        },
      },
      {
        daysAgo: 4,
        hour: 11,
        lines: [
          "A series converges if its partial sums approach a finite limit.",
          "The ratio test compares each term with the one before it.",
          "If the limit of the ratio is less than one, the series converges absolutely.",
        ],
        summary: {
          topics: ["Series convergence", "Ratio test"],
          keyPoints: [
            "A series converges when its partial sums approach a finite limit.",
            "The ratio test looks at the limit of a(n+1) / a(n).",
            "A limit below 1 means absolute convergence; above 1 means divergence; exactly 1 is inconclusive.",
          ],
          assignments: [],
          tasks: ["Try the practice exam questions on series"],
          studyTip: "Make a one-page flowchart of which convergence test to try first.",
        },
      },
    ],
  },
  {
    name: "World History",
    color: "amber",
    sessions: [
      {
        daysAgo: 3,
        hour: 14,
        lines: [
          "The industrial revolution started in Britain in the late seventeen hundreds.",
          "Steam power and the textile industry changed how and where people worked.",
          "Cities grew very quickly, and working conditions were often dangerous.",
          "Your essay on the causes of industrialisation is due in two weeks.",
        ],
        summary: {
          topics: ["Industrial Revolution", "Urbanisation"],
          keyPoints: [
            "The industrial revolution began in Britain in the late 1700s.",
            "Steam power and textile mills moved work from homes to factories.",
            "Cities grew rapidly and working conditions were often unsafe.",
          ],
          assignments: [{ title: "Essay: causes of industrialisation", dueDate: isoDay(12) }],
          tasks: [],
          studyTip: "Build a timeline with one invention and one social change for each decade.",
        },
      },
    ],
  },
  {
    name: "Intro to Computer Science",
    color: "violet",
    sessions: [
      {
        daysAgo: 6,
        hour: 16,
        lines: [
          "Big O notation describes how the running time grows as the input gets bigger.",
          "Binary search is logarithmic because it halves the search space every step.",
          "Bubble sort is quadratic, which is why we almost never use it on large inputs.",
        ],
        summary: {
          topics: ["Big O notation", "Binary search", "Sorting"],
          keyPoints: [
            "Big O describes how running time grows with input size.",
            "Binary search is O(log n) because it halves the range each step.",
            "Bubble sort is O(n²), too slow for large inputs.",
          ],
          assignments: [],
          tasks: ["Implement binary search in Python", "Watch the sorting visualisation video"],
          studyTip: "Time your own binary search on lists of 1,000 and 1,000,000 items to feel the difference.",
        },
      },
    ],
  },
];

const UNSORTED: DemoSession = {
  title: "Study group: exam planning",
  daysAgo: 5,
  hour: 18,
  lines: [
    "Let's split the revision so everyone covers one subject and shares notes.",
    "We meet again on Sunday to quiz each other.",
  ],
  summary: {
    topics: ["Exam planning"],
    keyPoints: ["Each person revises one subject and shares notes.", "The group meets again on Sunday."],
    assignments: [],
    tasks: ["Share your notes in the group chat before Sunday"],
    studyTip: "Explaining a topic to the group is the fastest way to find the gaps in what you know.",
  },
};

const insertSubject = db.prepare("INSERT INTO subjects (name, color, created_at) VALUES (?, ?, ?)");
const insertLesson = db.prepare(
  "INSERT INTO lessons (title, status, transcript, summary, subject_id, created_at) VALUES (?, 'done', ?, ?, ?, ?)"
);
const insertSegment = db.prepare("INSERT INTO segments (lesson_id, seq, start_sec, text) VALUES (?, ?, ?, ?)");

function addSession(session: DemoSession, subjectId: number | null) {
  const { lastInsertRowid } = insertLesson.run(
    session.title ?? "Untitled lecture",
    session.lines.join(" "),
    JSON.stringify(session.summary),
    subjectId,
    sqlTime(session.daysAgo, session.hour)
  );
  session.lines.forEach((text, i) => insertSegment.run(Number(lastInsertRowid), i, i * 4, text));
}

db.exec("BEGIN");
try {
  db.exec("DELETE FROM segments; DELETE FROM lessons; DELETE FROM subjects;");
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('segments', 'lessons', 'subjects')");
  for (const subject of DEMO) {
    const { lastInsertRowid } = insertSubject.run(subject.name, subject.color, sqlTime(10, 8));
    for (const session of subject.sessions) addSession(session, Number(lastInsertRowid));
  }
  addSession(UNSORTED, null);
  db.exec("COMMIT");
} catch (err) {
  db.exec("ROLLBACK");
  throw err;
}

const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
console.log(`Seeded ${count("subjects")} subjects and ${count("lessons")} sessions.`);
