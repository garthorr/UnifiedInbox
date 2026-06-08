import { prisma } from "./db";
import { isPushConfigured, sendPushToAll } from "./push";

export interface NotificationSettings {
  newMailEnabled: boolean;
  reminderEnabled: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
}

const DEFAULTS: NotificationSettings = {
  newMailEnabled: true,
  reminderEnabled: true,
  quietHoursStart: null,
  quietHoursEnd: null,
};

/** Read the singleton notification settings, falling back to defaults. */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  const row = await prisma.notificationSetting.findUnique({ where: { id: "singleton" } });
  if (!row) return { ...DEFAULTS };
  return {
    newMailEnabled: row.newMailEnabled,
    reminderEnabled: row.reminderEnabled,
    quietHoursStart: row.quietHoursStart,
    quietHoursEnd: row.quietHoursEnd,
  };
}

/** Persist (upsert) the singleton notification settings. */
export async function saveNotificationSettings(
  patch: Partial<NotificationSettings>
): Promise<NotificationSettings> {
  const row = await prisma.notificationSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...DEFAULTS, ...patch },
    update: patch,
  });
  return {
    newMailEnabled: row.newMailEnabled,
    reminderEnabled: row.reminderEnabled,
    quietHoursStart: row.quietHoursStart,
    quietHoursEnd: row.quietHoursEnd,
  };
}

/** True if `hour` (0–23) falls inside the configured quiet-hours window.
 *  Handles windows that wrap past midnight (e.g. 22 → 7). */
export function isQuietHour(
  hour: number,
  start: number | null,
  end: number | null
): boolean {
  if (start === null || end === null) return false;
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  // Wraps midnight
  return hour >= start || hour < end;
}

/** Fire a "new mail" push for an account, honouring settings + quiet hours.
 *  Safe to call unconditionally — no-ops when push isn't configured or the
 *  user has new-mail notifications disabled or quiet hours are active. */
export async function notifyNewMail(
  accountEmail: string,
  newUnreadCount: number,
  sampleSubject?: string
): Promise<void> {
  if (newUnreadCount <= 0 || !isPushConfigured()) return;

  const settings = await getNotificationSettings();
  if (!settings.newMailEnabled) return;
  if (isQuietHour(new Date().getHours(), settings.quietHoursStart, settings.quietHoursEnd)) return;

  const title =
    newUnreadCount === 1
      ? `New message — ${accountEmail}`
      : `${newUnreadCount} new messages — ${accountEmail}`;
  const body = sampleSubject ? sampleSubject : "Open the inbox to read.";

  await sendPushToAll({ title, body, url: "/", tag: `mail-${accountEmail}` });
}

/** Scan for work-item reminders that are now due and deliver them.
 *  Marks each as sent so it fires exactly once. Returns count delivered.
 *  Quiet hours intentionally do NOT suppress reminders — the user set them. */
export async function deliverDueReminders(now: Date = new Date()): Promise<number> {
  if (!isPushConfigured()) return 0;

  const settings = await getNotificationSettings();
  if (!settings.reminderEnabled) return 0;

  const due = await prisma.workItem.findMany({
    where: {
      remindAt: { lte: now },
      reminderSentAt: null,
      status: { not: "DONE" },
    },
    select: { id: true, title: true },
    take: 50,
  });
  if (due.length === 0) return 0;

  let sent = 0;
  for (const item of due) {
    await sendPushToAll({
      title: "Reminder",
      body: item.title,
      url: `/work-items/${item.id}`,
      tag: `reminder-${item.id}`,
    });
    await prisma.workItem.update({
      where: { id: item.id },
      data: { reminderSentAt: now },
    });
    sent++;
  }
  return sent;
}
