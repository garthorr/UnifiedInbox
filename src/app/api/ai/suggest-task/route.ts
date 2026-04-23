import { NextResponse } from "next/server";
import { ollamaUrl, ollamaGenerate, parseJsonResponse } from "@/lib/ai";

export async function POST(request: Request) {
  try { ollamaUrl(); } catch {
    return NextResponse.json({ error: "OLLAMA_BASE_URL not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.subject) {
    return NextResponse.json({ error: "subject is required" }, { status: 400 });
  }

  const { subject, snippet = "", from = "" } = body as {
    subject: string;
    snippet?: string;
    from?: string;
  };

  const prompt = `You are a task extractor. Given an email, output ONLY a JSON object with these fields:
- "title": a concise action-oriented task title (start with a verb, max 80 chars)
- "due_date": ISO date string if a deadline is mentioned (e.g. "2026-04-25"), otherwise null
- "description": one sentence summary of what needs to be done

Email:
From: ${from}
Subject: ${subject}
${snippet ? `Preview: ${snippet}` : ""}

Return ONLY valid JSON, no explanation, no markdown.`;

  try {
    const raw = await ollamaGenerate(prompt);
    const parsed = parseJsonResponse<{ title?: string; due_date?: string | null; description?: string }>(raw);
    return NextResponse.json({
      title: parsed.title ?? subject,
      dueDate: parsed.due_date ?? null,
      description: parsed.description ?? "",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Ollama request failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
