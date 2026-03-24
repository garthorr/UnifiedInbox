export type GmailPart = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailPart[] | null;
};

export function findBody(part: GmailPart, mimeType: string): string | null {
  if (part.mimeType === mimeType && part.body?.data) {
    return Buffer.from(
      part.body.data.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf-8");
  }
  if (part.parts) {
    for (const p of part.parts) {
      const result = findBody(p, mimeType);
      if (result) return result;
    }
  }
  return null;
}
