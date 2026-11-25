import { Hono } from "hono";
import { cors } from "hono/cors";
import lessons from "./routes/lessons.js";
import subjects from "./routes/subjects.js";

const app = new Hono();

app.use(
  "*",
  cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000", credentials: true })
);

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/api/lessons", lessons);
app.route("/api/subjects", subjects);

export default app; 
