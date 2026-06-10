// Shared Ollama client. All AI features check OLLAMA_BASE_URL first;
// if absent they throw so callers can return 503.

export function ollamaUrl(): string {
  const url = process.env.OLLAMA_BASE_URL;
  if (!url) throw new Error("OLLAMA_BASE_URL not configured");
  // Trim a trailing slash so `${ollamaUrl()}/api/generate` never doubles up.
  return url.replace(/\/+$/, "");
}

export function isAiConfigured(): boolean {
  return !!process.env.OLLAMA_BASE_URL;
}

export function ollamaModel(): string {
  return process.env.OLLAMA_MODEL ?? "llama3.2";
}

/**
 * Probe Ollama: is the server reachable and is the configured model pulled?
 * Surfaces the real connection error (the feature endpoints swallow it).
 */
export async function ollamaHealth(timeoutMs = 5_000): Promise<{
  reachable: boolean;
  model: string;
  modelAvailable: boolean;
  models: string[];
  error?: string;
}> {
  const model = ollamaModel();
  try {
    const res = await fetch(`${ollamaUrl()}/api/tags`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return { reachable: false, model, modelAvailable: false, models: [], error: `Ollama returned ${res.status}` };
    }
    const data = (await res.json()) as { models?: { name: string }[] };
    const models = (data.models ?? []).map((m) => m.name);
    // Ollama tags carry a ":tag" suffix (e.g. "llama3.2:latest"); match either form.
    const modelAvailable = models.some((m) => m === model || m.split(":")[0] === model.split(":")[0]);
    return { reachable: true, model, modelAvailable, models };
  } catch (err) {
    const error =
      err instanceof Error
        ? err.name === "TimeoutError"
          ? `No response within ${timeoutMs}ms`
          : err.message
        : "Connection failed";
    return { reachable: false, model, modelAvailable: false, models: [], error };
  }
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
