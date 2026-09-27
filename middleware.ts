import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "./lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ข้าม Static files และ Favicon
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes("favicon.ico")
  ) {
    return NextResponse.next();
  }

  // เส้นทางที่ไม่ต้อง Login
  if (
    pathname === "/login" ||
    pathname === "/api/auth/login"
  ) {
    // ถ้า Login อยู่แล้วแล้วเข้า /login ให้ Redirect ไป Dashboard ทันที
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const isAuthed = await verifySessionToken(token);
    if (isAuthed && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // เส้นทาง Cron Job (ยืนยันสิทธิ์ด้วย CRON_SECRET)
  if (pathname.startsWith("/api/cron/")) {
    return NextResponse.next();
  }

  // ตรวจสอบ Session Cookie สำหรับหน้า Dashboard และ API สำคัญ
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const isAuthed = await verifySessionToken(token);

  if (!isAuthed) {
    // กรณีเรียก API ให้ตอบ 401 Unauthorized
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: กรุณาเข้าสู่ระบบก่อนใช้งาน API" },
        { status: 401 }
      );
    }

    // กรณีเปิดหน้าเว็บ ให้ Redirect ไปหน้า Login
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
