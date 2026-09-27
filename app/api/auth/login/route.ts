import { NextRequest, NextResponse } from "next/server";
import { checkAdminPassword, createSessionToken, COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || !checkAdminPassword(password)) {
      return NextResponse.json(
        { success: false, error: "รหัสผ่านไม่ถูกต้อง (Invalid password)" },
        { status: 401 }
      );
    }

    const token = await createSessionToken("diowcnx");

    const response = NextResponse.json({
      success: true,
      message: "เข้าสู่ระบบสำเร็จ",
    });

    // ตั้งค่า Cookie HttpOnly ปลอดภัยสูง ป้องกัน XSS
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 วัน
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" },
      { status: 500 }
    );
  }
}
