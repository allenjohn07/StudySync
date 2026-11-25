import type { ChunkResult, Lesson, Subject, SubjectColor, User } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message = (body && typeof body === "object" && "error" in body && String(body.error)) || res.statusText;
    throw new ApiError(res.status, message, body);
  }

  return body as T;
}

const post = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined });

export const authApi = {
  login: (data: { email: string; password: string }) => post<{ user: User }>("/auth/login", data),
};

export const lessonsApi = {
  // Without a title, the session is named after its topics once it is summarized.
  create: (data: { subjectId: number | null; title?: string }) => post<{ id: number }>("/lessons", data),
  // Keep recording into a finished session: the new part is added after its transcript.
  resume: (id: number) => post<{ id: number }>(`/lessons/${id}/resume`),
  update: (id: number, data: { subjectId?: number | null; title?: string }) =>
    request<Lesson>(`/lessons/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  // `final` false = a growing preview of the piece still being recorded; true = the finished piece.
  addChunk: (id: number, audio: Blob, seq: number, start: number, final: boolean) => {
    const form = new FormData();
    form.append("audio", audio, "chunk");
    form.append("seq", String(seq));
    form.append("start", String(start));
    form.append("final", final ? "1" : "0");
    return request<ChunkResult>(`/lessons/${id}/chunks`, { method: "POST", body: form });
  },
  finish: (id: number) => post<{ ok: true }>(`/lessons/${id}/finish`),
  // Write the summary again from the saved transcript (after a failure, or when it seems stuck).
  resummarize: (id: number) => post<{ ok: true }>(`/lessons/${id}/resummarize`),
  get: (id: number) => request<Lesson>(`/lessons/${id}`),
  list: () => request<Lesson[]>("/lessons"),
  clear: () => request<{ deleted: number }>("/lessons", { method: "DELETE" }),
  remove: (id: number) => request<void>(`/lessons/${id}`, { method: "DELETE" }),
};

export const subjectsApi = {
  list: () => request<Subject[]>("/subjects"),
  create: (data: { name: string; color?: SubjectColor }) => post<Subject>("/subjects", data),
  remove: (id: number) => request<void>(`/subjects/${id}`, { method: "DELETE" }),
};
