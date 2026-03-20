import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function relativeTime(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "MMM d, h:mm a");
}

/** Build a Gmail deep link for a given thread ID. */
export function gmailThreadUrl(gmailThreadId: string): string {
  return `https://mail.google.com/mail/u/0/#inbox/${gmailThreadId}`;
}

/** Extract display name from an email address like "Foo Bar <foo@bar.com>" */
export function parseEmailDisplay(address: string): {
  name: string;
  email: string;
} {
  const match = address.match(/^"?([^"<]+?)"?\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: address, email: address };
}

/** Return the first participant address that is not from the account email */
export function primarySender(
  participants: string[],
  accountEmail: string
): string {
  const external = participants.find(
    (p) => !p.toLowerCase().includes(accountEmail.toLowerCase())
  );
  return external ?? participants[0] ?? "";
}
