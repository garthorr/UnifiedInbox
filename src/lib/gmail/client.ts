import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import { createOAuth2Client } from "./oauth";
import { decrypt, encrypt } from "@/lib/encrypt";
import { prisma } from "@/lib/db";

/**
 * Build an authenticated Gmail client for a given account ID.
 * Automatically handles token refresh and persists new tokens to the database.
 */
export async function getGmailClient(
  accountId: string
): Promise<gmail_v1.Gmail> {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
  });

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: decrypt(account.accessToken),
    refresh_token: account.refreshToken ? decrypt(account.refreshToken) : undefined,
    expiry_date: account.tokenExpiresAt?.getTime(),
  });

  // Persist refreshed tokens automatically
  client.on("tokens", async (tokens) => {
    const updates: Parameters<typeof prisma.account.update>[0]["data"] = {
      updatedAt: new Date(),
    };
    if (tokens.access_token) {
      updates.accessToken = encrypt(tokens.access_token);
      updates.tokenExpiresAt = new Date(
        tokens.expiry_date ?? Date.now() + 3600 * 1000
      );
    }
    if (tokens.refresh_token) {
      updates.refreshToken = encrypt(tokens.refresh_token);
    }
    await prisma.account.update({ where: { id: accountId }, data: updates });
  });

  return google.gmail({ version: "v1", auth: client });
}
