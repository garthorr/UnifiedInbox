import { NextResponse } from "next/server";
import { ollamaUrl, ollamaGenerate, parseJsonResponse } from "@/lib/ai";

export async function POST(request: Request) {
  try { ollamaUrl(); } catch {
    return NextResponse.json({ error: "OLLAMA_BASE_URL not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.subject || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: "subject and messages are required" }, { status: 400 });
  }

  const { subject, messages, instruction } = body as {
    subject: string;
    messages: { from: string; text: string }[];
    instruction?: string;
  };

  const conversation = messages
    .map((m) => `From: ${m.from}\n${m.text}`)
    .join("\n\n---\n\n");

  const prompt = `You are an email assistant. Draft a professional reply to this email thread.
Subject: ${subject}
${instruction ? `\nInstruction: ${instruction}\n` : ""}
Keep the reply concise and professional. Do not include a subject line.
Do not add signatures or formal closings.

Output ONLY a JSON object: { "draft": "..." }

Thread:
${conversation}`;

  try {
    const raw = await ollamaGenerate(prompt, 45_000);
    const parsed = parseJsonResponse<{ draft?: string }>(raw);
    return NextResponse.json({ draft: parsed.draft ?? "" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Ollama request failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
