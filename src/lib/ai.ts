// Shared Ollama client. All AI features check OLLAMA_BASE_URL first;
// if absent they throw so callers can return 503.

export function ollamaUrl(): string {
  const url = process.env.OLLAMA_BASE_URL;
  if (!url) throw new Error("OLLAMA_BASE_URL not configured");
  return url;
}

export function ollamaModel(): string {
  return process.env.OLLAMA_MODEL ?? "llama3.2";
}

interface OllamaResponse { response: string }

export async function ollamaGenerate(prompt: string, timeoutMs = 30_000): Promise<string> {
  const res = await fetch(`${ollamaUrl()}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: ollamaModel(), prompt, stream: false, format: "json" }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
  const data = await res.json() as OllamaResponse;
  return data.response ?? "";
}

export function parseJsonResponse<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("Could not parse JSON from Ollama response");
  }
}
