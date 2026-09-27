import { NextRequest, NextResponse } from "next/server";
import { checkAdminPassword, createSessionToken, COOKIE_NAME } from "@/lib/auth";
import { readJsonBody, validationErrorResponse } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request, 2_048);
    const { password } = body;

    if (typeof password !== "string" || !(await checkAdminPassword(password))) {
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
      sameSite: "strict",
      path: "/",
      maxAge: 12 * 60 * 60,
    });

    return response;
  } catch (error: unknown) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    console.error("Login failed:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" },
      { status: 500 }
    );
  }
}
