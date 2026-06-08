import DOMPurify from "dompurify";

// HTML sanitization for untrusted content (email bodies, Markdown-rendered
// notes). DOMPurify needs a real DOM, and the only call sites are client-only
// render paths — but client components are still evaluated during SSR, so we
// guard on `window`. On the server we return "" (these paths render no content
// server-side anyway); the browser produces the sanitized markup on hydration.
const canSanitize = typeof window !== "undefined";

if (canSanitize) {
  // Links inside sanitized content (notably email bodies rendered in a
  // sandboxed iframe) should open in a new tab and never leak the opener.
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.getAttribute("href")) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

/**
 * Sanitize untrusted HTML for safe rendering. Strips <script>, inline event
 * handlers, javascript: URLs, and (since WHOLE_DOCUMENT defaults to false)
 * any <head>/<meta>/<base> wrapper — closing off script execution, meta-refresh
 * redirects, and <base>-tag hijacking. Returns "" on the server.
 */
export function sanitizeHtml(dirty: string): string {
  if (!canSanitize) return "";
  return DOMPurify.sanitize(dirty, { ADD_ATTR: ["target"] });
}
