import { google } from "googleapis";
import { randomBytes } from "crypto";
import type { OAuth2Client } from "google-auth-library";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export function createOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function generateAuthUrl(stateToken: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force refresh_token on every connect
    scope: GMAIL_SCOPES,
    state: stateToken,
  });
}

export function generateStateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiryDate: Date;
}> {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error(
      "OAuth exchange did not return access_token and refresh_token. " +
        "Ensure the app is authorized with prompt=consent."
    );
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000),
  };
}

export async function getUserInfo(
  accessToken: string
): Promise<{ email: string; displayName: string }> {
  const client = createOAuth2Client();
  client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  return {
    email: data.email ?? "",
    displayName: data.name ?? data.email ?? "Unknown",
  };
}
