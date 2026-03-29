export type GmailPart = {
  mimeType?: string | null;
  filename?: string | null;
  body?: { data?: string | null; attachmentId?: string | null; size?: number | null } | null;
  parts?: GmailPart[] | null;
};

export type AttachmentMeta = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
};

export function findAttachments(part: GmailPart): AttachmentMeta[] {
  const results: AttachmentMeta[] = [];
  if (part.filename && part.body?.attachmentId) {
    results.push({
      id: part.body.attachmentId,
      filename: part.filename,
      mimeType: part.mimeType ?? "application/octet-stream",
      size: part.body.size ?? 0,
    });
  }
  for (const child of part.parts ?? []) {
    results.push(...findAttachments(child));
  }
  return results;
}

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
