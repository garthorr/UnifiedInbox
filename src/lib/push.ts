import webpush from "web-push";
import { prisma } from "./db";

// ─── VAPID configuration ────────────────────────────────────────────────────
//
// Web Push requires a VAPID key pair shared by every process that sends a push
// (the Next.js server *and* the worker). Generate one once with:
//   npx web-push generate-vapid-keys
// then set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in .env. The public key is also
// handed to the browser so it can create a subscription bound to these keys.

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
// Subject must be a mailto: or https: URL identifying the sender.
const SUBJECT =
  process.env.VAPID_SUBJECT ||
  (process.env.APP_URL?.startsWith("http") ? process.env.APP_URL : "mailto:admin@localhost");

let configured = false;
if (PUBLIC_KEY && PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
    configured = true;
  } catch (err) {
    console.error("[push] Invalid VAPID configuration:", err);
  }
}

/** True when VAPID keys are present and valid — push can be sent. */
export function isPushConfigured(): boolean {
  return configured;
}

/** The VAPID public key the browser needs to create a subscription. */
export function getVapidPublicKey(): string {
  return PUBLIC_KEY;
}

// ─── Subscription storage ─────────────────────────────────────────────────────

export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Store (or refresh) a browser push subscription. */
export async function saveSubscription(
  sub: BrowserSubscription,
  userAgent?: string
): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: userAgent ?? null,
    },
    update: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: userAgent ?? null,
      lastUsedAt: new Date(),
    },
  });
}

/** Remove a subscription by endpoint (e.g. user disabled notifications). */
export async function removeSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

// ─── Sending ──────────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  /** Relative URL to open when the notification is clicked (default "/"). */
  url?: string;
  /** Collapses notifications sharing a tag so they replace rather than stack. */
  tag?: string;
}

/** Send a push to every registered subscription. Expired subscriptions
 *  (HTTP 404/410 from the push service) are pruned automatically.
 *  Returns the number of notifications successfully delivered. */
export async function sendPushToAll(payload: PushPayload): Promise<number> {
  if (!configured) return 0;

  const subs = await prisma.pushSubscription.findMany();
  if (subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let delivered = 0;
  const expired: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        delivered++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          expired.push(sub.endpoint);
        } else {
          console.error("[push] send failed:", status ?? err);
        }
      }
    })
  );

  if (expired.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: expired } } });
  }

  return delivered;
}
