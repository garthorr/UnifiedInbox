import { NextResponse } from "next/server";
import { ollamaUrl, ollamaGenerate, parseJsonResponse } from "@/lib/ai";

export async function POST(request: Request) {
  try { ollamaUrl(); } catch {
    return NextResponse.json({ error: "OLLAMA_BASE_URL not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.messages || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }

  const messages = body.messages as { from: string; text: string }[];
  const conversation = messages
    .map((m) => `From: ${m.from}\n${m.text}`)
    .join("\n\n---\n\n");

  const prompt = `You are an email assistant. Summarize this email thread in 2-3 sentences.
Focus on: what is being asked or discussed, any decisions or action items, and the current status.
Be concise and factual. Do not include pleasantries.

Output ONLY a JSON object: { "summary": "..." }

Thread:
${conversation}`;

  try {
    const raw = await ollamaGenerate(prompt);
    const parsed = parseJsonResponse<{ summary?: string }>(raw);
    return NextResponse.json({ summary: parsed.summary ?? "Could not generate summary." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Ollama request failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
