import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForTokens, getUserInfo } from "@/lib/gmail/oauth";
import { encrypt } from "@/lib/encrypt";
import { prisma } from "@/lib/db";

const STATE_COOKIE = "oauth_state";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings?error=missing_params", request.url)
    );
  }

  // Validate state to prevent CSRF
  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE)?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL("/settings?error=invalid_state", request.url)
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

    const response = NextResponse.redirect(
      new URL("/settings?connected=1", request.url)
    );
    // Clear the state cookie
    response.cookies.set(STATE_COOKIE, "", { maxAge: 0, path: "/" });
    return response;
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/settings?error=oauth_failed", request.url)
    );
  }
}
