export const DEFAULT_TITLE = "Untitled lecture";

// Names a session after what was talked about, so the sidebar list is readable.
export function titleFromSummary(topics: string[] | undefined) {
  const title = (topics ?? []).slice(0, 2).join(" · ");
  return title ? title.slice(0, 60) : DEFAULT_TITLE;
}
