import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";
import { exchangeCodeForTokens, getUserInfo } from "@/lib/gmail/oauth";
import { encrypt } from "@/lib/encrypt";
import { prisma } from "@/lib/db";
import { enqueueSyncJob } from "@/lib/sync-queue";

const STATE_COOKIE = "oauth_state";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.APP_URL || new URL(request.url).origin;

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(error)}`, appUrl)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings?error=missing_params", appUrl)
    );
  }

  // Validate state to prevent CSRF (constant-time — a plain !== leaks
  // matching-prefix timing).
  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE)?.value;
  const stateMatches =
    !!storedState &&
    storedState.length === state.length &&
    timingSafeEqual(Buffer.from(storedState), Buffer.from(state));
  if (!stateMatches) {
    return NextResponse.redirect(
      new URL("/settings?error=invalid_state", appUrl)
    );
  }

  try {
    const { accessToken, refreshToken, expiryDate } =
      await exchangeCodeForTokens(code);
    const { email, displayName } = await getUserInfo(accessToken);

    await prisma.account.upsert({
      where: { email },
      create: {
        email,
        displayName,
        accessToken: encrypt(accessToken),
        refreshToken: encrypt(refreshToken),
        tokenExpiresAt: expiryDate,
        isActive: true,
      },
      update: {
        displayName,
        accessToken: encrypt(accessToken),
        refreshToken: encrypt(refreshToken),
        tokenExpiresAt: expiryDate,
        isActive: true,
        // Reset historyId so a fresh initial sync runs
        historyId: null,
        lastSyncAt: null,
      },
    });

    const account = await prisma.account.findUniqueOrThrow({
      where: { email },
    });

    await prisma.activityLog.create({
      data: {
        eventType: "ACCOUNT_CONNECTED",
        accountId: account.id,
        description: `Account connected: ${email}`,
      },
    });

    // Kick off an immediate sync so the worker picks it up within 30 seconds
    // rather than waiting for the next 15-minute cron cycle.
    await enqueueSyncJob(account.id).catch(() => {});

    const response = NextResponse.redirect(
      new URL("/settings?connected=1", appUrl)
    );
    // Clear the state cookie
    response.cookies.set(STATE_COOKIE, "", { maxAge: 0, path: "/" });
    return response;
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/settings?error=oauth_failed", appUrl)
    );
  }
}
