// SPDX-License-Identifier: MIT

export const EVENT_CODES = [
  "parsed",
  "cache_hit",
  "chunk",
  "progress",
  "done",
  "error",
] as const;

export type EventCode = (typeof EVENT_CODES)[number];

// dev-only registry drift detection
export async function assertEventRegistryMatches(apiBase: string): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  try {
    const resp = await fetch(`${apiBase}/health/events`);
    if (!resp.ok) return;
    const data = (await resp.json()) as { registered: string[] };
    const server = new Set(data.registered);
    const client = new Set(EVENT_CODES);
    const missingClient = [...server].filter((c) => !client.has(c as EventCode));
    const missingServer = [...client].filter((c) => !server.has(c));
    if (missingClient.length || missingServer.length) {
      console.warn(
        "[events] registry drift — client missing:",
        missingClient,
        "server missing:",
        missingServer,
      );
    }
  } catch {
    /* dev-only diagnostic */
  }
}
