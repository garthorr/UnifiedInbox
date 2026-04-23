import { NextResponse } from "next/server";
import { isConfigured, syncTodoistLinks } from "@/lib/todoist";

export async function POST() {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Todoist is not configured" }, { status: 503 });
  }

  const result = await syncTodoistLinks();
  return NextResponse.json(result);
}
