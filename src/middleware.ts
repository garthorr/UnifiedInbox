import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, validateSessionToken } from "@/lib/auth";

// Paths that don't require authentication
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  // /api/auth/connect is intentionally NOT public: only an authenticated
  // session may initiate the Gmail OAuth flow. The callback must stay public
  // (Google redirects the browser there); the state cookie set by connect
  // gates it.
  "/api/auth/callback",
  "/api/health",
  "/manifest.webmanifest",
  "/sw.js",
];

// Static file extensions — bypass auth entirely
const STATIC_EXT = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|map|webp)$/;

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // Skip Next.js internals and static assets
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || STATIC_EXT.test(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value ?? "";
  if (!(await validateSessionToken(token))) {
    // API routes return 401 JSON; page routes redirect to login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
  // Node runtime (stable since Next 15.5) so session validation can query
  // the database via Prisma — required for real, revocable sessions.
  runtime: "nodejs",
};
