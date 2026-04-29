/**
 * API client — handles communication with the FastAPI backend.
 * Auth via Bearer token (localStorage) — cookies unreliable cross-origin.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "pawacloud_token";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private browsing */
  }
}

function authHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  const token = getStoredToken();
  if (token) return { ...extra, Authorization: `Bearer ${token}` };
  return extra;
}

// ─── Documents ────────────────────────────────────────────────────────

export interface ArtifactWarning {
  code: "scanned_no_ocr" | "truncated" | "large_file" | "ocr_no_text";
  message: string;
}

export interface ArtifactSummary {
  id: string;
  filename: string;
  mime: string;
  byte_size: number;
  page_count: number;
  char_count: number;
  source_lang: string | null;
  parsed_preview: string;
  parse_method: "docx" | "pdf-text" | "pdf-ocr" | "pdf-empty" | "image-ocr" | "image-empty";
  warnings: ArtifactWarning[];
  created_at: string;
}

export type ProcessAction = "summarize" | "translate";

export type ProcessEvent =
  | { type: "parsed"; tokens: number; chunks: number }
  | { type: "cache_hit"; content: string }
  | { type: "chunk"; text: string }
  | { type: "progress"; phase: "map" | "reduce"; step: number; of: number }
  | { type: "done"; tokens_used: number | null; model: string }
  | { type: "error"; code: string; message: string };

export interface ChatResponse {
  id: string;
  query: string;
  response: string;
  model: string;
  tokens_used: number | null;
  created_at: string;
}

export interface HistoryItem {
  id: string;
  kind?: "chat" | "document";
  query: string;
  response: string;
  model: string;
  created_at: string;
  artifact?: ArtifactSummary | null;
}

export interface HistoryResponse {
  items: HistoryItem[];
  total: number;
}

export interface UserInfo {
  email: string;
  name: string;
  picture?: string;
  authenticated: boolean;
}

export async function sendQuery(query: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/v1/chat`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }
  return res.json();
}

export async function streamQuery(
  query: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
): Promise<void> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/chat/stream?q=${encodeURIComponent(query)}`,
      { headers: authHeaders({ Accept: "text/event-stream" }) },
    );

    if (!res.ok) throw new Error(`Stream error: ${res.status}`);

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            onDone();
            return;
          }
          // chunks are JSON-encoded to preserve newlines through SSE
          try {
            onChunk(JSON.parse(data));
          } catch {
            onChunk(data);
          }
        }
      }
    }

    onDone();
  } catch (err) {
    onError(err instanceof Error ? err.message : "Stream failed");
  }
}

export async function getHistory(
  limit = 20,
  offset = 0,
): Promise<HistoryResponse> {
  const res = await fetch(
    `${API_BASE}/api/v1/chat/history?limit=${limit}&offset=${offset}`,
    { headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`History fetch failed: ${res.status}`);
  return res.json();
}

export async function deleteHistoryItem(itemId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/chat/history/${itemId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

export async function clearHistory(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/chat/history`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`History clear failed: ${res.status}`);
}

export async function getCurrentUser(): Promise<UserInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function getLoginUrl(): string {
  return `${API_BASE}/auth/login`;
}

export async function exchangeOAuthToken(
  token: string,
): Promise<UserInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // backend returns a session_token for Bearer auth
    if (data.session_token) storeToken(data.session_token);
    return data;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: authHeaders(),
  });
  storeToken(null);
  document.cookie = "pawacloud_auth=; path=/; max-age=0";
}

export interface AuthResponse {
  message: string;
  user: { email: string; name: string; picture: string };
  session_token?: string;
}

export async function signupWithEmail(
  email: string,
  name: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Signup failed" }));
    throw new Error(err.detail || `Signup error: ${res.status}`);
  }
  const data = await res.json();
  if (data.session_token) storeToken(data.session_token);
  return data;
}

export async function activateGuestPass(
  email: string,
): Promise<AuthResponse & { ttl_minutes: number }> {
  const res = await fetch(`${API_BASE}/auth/guest-pass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Guest pass failed" }));
    throw new Error(err.detail || `Guest pass error: ${res.status}`);
  }
  const data = await res.json();
  if (data.session_token) storeToken(data.session_token);
  return data;
}

export async function loginWithEmail(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(err.detail || `Login error: ${res.status}`);
  }
  const data = await res.json();
  if (data.session_token) storeToken(data.session_token);
  return data;
}

export async function uploadDocument(file: File): Promise<ArtifactSummary> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/v1/documents/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || `Upload error: ${res.status}`);
  }
  return res.json();
}

export async function streamDocumentProcess(
  artifactId: string,
  action: ProcessAction,
  targetLang: string,
  onEvent: (ev: ProcessEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const url = new URL(`${API_BASE}/api/v1/documents/${artifactId}/process`);
  url.searchParams.set("action", action);
  url.searchParams.set("lang", targetLang);

  const res = await fetch(url.toString(), {
    headers: authHeaders({ Accept: "text/event-stream" }),
    signal,
  });
  if (!res.ok) {
    onEvent({
      type: "error",
      code: "http_error",
      message: "Couldn't reach the server. Try again.",
    });
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onEvent({ type: "error", code: "no_body", message: "No response body." });
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6);
      try {
        onEvent(JSON.parse(payload) as ProcessEvent);
      } catch {
        /* ignore malformed event */
      }
    }
  }
}
