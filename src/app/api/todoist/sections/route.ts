import { NextResponse } from "next/server";
import { listSections, isConfigured } from "@/lib/todoist";

export async function GET(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Todoist not configured" }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  try {
    const sections = await listSections(projectId);
    return NextResponse.json(sections);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch sections";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
