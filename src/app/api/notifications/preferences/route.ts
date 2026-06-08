import { NextResponse } from "next/server";
import { getNotificationSettings, saveNotificationSettings } from "@/lib/notifications";

export async function GET() {
  const settings = await getNotificationSettings();
  return NextResponse.json(settings);
}

function asHour(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 23) {
    return null;
  }
  return value;
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { newMailEnabled, reminderEnabled, quietHoursStart, quietHoursEnd } = body as {
    newMailEnabled?: boolean;
    reminderEnabled?: boolean;
    quietHoursStart?: number | null;
    quietHoursEnd?: number | null;
  };

  const patch: Parameters<typeof saveNotificationSettings>[0] = {};
  if (typeof newMailEnabled === "boolean") patch.newMailEnabled = newMailEnabled;
  if (typeof reminderEnabled === "boolean") patch.reminderEnabled = reminderEnabled;
  if (quietHoursStart !== undefined) patch.quietHoursStart = asHour(quietHoursStart);
  if (quietHoursEnd !== undefined) patch.quietHoursEnd = asHour(quietHoursEnd);

  const settings = await saveNotificationSettings(patch);
  return NextResponse.json(settings);
}
