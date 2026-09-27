import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "ออกจากระบบเรียบร้อย",
  });

  response.cookies.delete(COOKIE_NAME);
  return response;
}
