import { NextRequest, NextResponse } from "next/server";
import { executeDailyStockWorkflow } from "@/lib/workflow";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    let mode: "transparent_png" | "regular_scene" | undefined;
    try {
      const body = await request.json();
      if (body?.mode === "transparent_png" || body?.mode === "regular_scene") {
        mode = body.mode;
      }
    } catch {
      // Body may be empty, which is totally normal
    }

    const result = await executeDailyStockWorkflow(mode);
    // ตัด imageBase64 ออกจาก JSON Response เพื่อลดขนาดข้อมูลจาก 30MB เหลือ ~25KB ป้องกัน 4.5MB Vercel Limit
    const clientSafeResult = {
      ...result,
      images: result.images.map(({ imageBase64, ...rest }) => rest),
    };
    return NextResponse.json(clientSafeResult);
  } catch (error: any) {
    console.error("Manual workflow trigger error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Manual trigger failed",
      },
      { status: 500 }
    );
  }
}
