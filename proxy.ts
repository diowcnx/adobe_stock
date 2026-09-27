import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "./lib/auth";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isSameOriginMutation(request: NextRequest): boolean {
  if (!MUTATING_METHODS.has(request.method)) return true;
  if (request.nextUrl.pathname.startsWith("/api/cron/")) return true;

  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isSameOriginMutation(request)) {
    return NextResponse.json(
      { success: false, error: "Cross-origin request rejected" },
      { status: 403 },
    );
  }

  if (pathname === "/login" || pathname === "/api/auth/login") {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const isAuthed = await verifySessionToken(token);
    if (isAuthed && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // The cron route performs its own fail-closed Bearer-token validation.
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const isAuthed = await verifySessionToken(token);
  if (!isAuthed) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
