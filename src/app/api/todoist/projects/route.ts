import { NextResponse } from "next/server";
import { listProjects, isConfigured } from "@/lib/todoist";

export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Todoist not configured" }, { status: 503 });
  }
  try {
    const projects = await listProjects();
    return NextResponse.json(projects);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch projects";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
