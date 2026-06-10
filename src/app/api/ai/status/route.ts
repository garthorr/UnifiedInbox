import { NextResponse } from "next/server";
import { isAiConfigured, ollamaHealth, ollamaModel } from "@/lib/ai";

export const dynamic = "force-dynamic";

/**
 * Diagnostics for the AI integration. The feature endpoints hide their errors
 * (the UI degrades silently when AI is off), so this surfaces the real reason
 * AI isn't working: not configured, server unreachable, or model not pulled.
 */
export async function GET() {
  if (!isAiConfigured()) {
    return NextResponse.json({
      configured: false,
      reachable: false,
      model: ollamaModel(),
      modelAvailable: false,
      hint: "Set OLLAMA_BASE_URL in .env to enable AI features.",
    });
  }

  const health = await ollamaHealth();
  let hint: string | undefined;
  if (!health.reachable) {
    hint =
      "Ollama is configured but unreachable. If it runs on the Docker host, " +
      "the container resolves it as http://host.docker.internal:11434 — make " +
      "sure compose maps host.docker.internal (extra_hosts) and Ollama listens " +
      "on 0.0.0.0 (OLLAMA_HOST=0.0.0.0).";
  } else if (!health.modelAvailable) {
    hint = `Ollama is reachable but the model "${health.model}" isn't pulled. Run: ollama pull ${health.model}`;
  }

  return NextResponse.json({ configured: true, ...health, hint });
}
