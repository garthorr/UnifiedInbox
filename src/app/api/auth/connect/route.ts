import { NextResponse } from "next/server";
import { generateAuthUrl, generateStateToken } from "@/lib/gmail/oauth";
import { cookies } from "next/headers";

const STATE_COOKIE = "oauth_state";

export async function GET() {
  const state = generateStateToken();
  const authUrl = generateAuthUrl(state);

  const response = NextResponse.redirect(authUrl);
  // Store state in a short-lived httpOnly cookie for CSRF validation
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });

  return response;
}
