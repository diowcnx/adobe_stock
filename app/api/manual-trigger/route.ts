import { NextRequest, NextResponse } from "next/server";
import { executeDailyStockWorkflow } from "@/lib/workflow";
import { readJsonBody, validationErrorResponse } from "@/lib/request";
import { parseGenerationMode } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request, 1_024);
    const mode = parseGenerationMode(body.mode);

    const result = await executeDailyStockWorkflow(mode);
    // ตัด imageBase64 ออกจาก JSON Response เพื่อลดขนาดข้อมูลจาก 30MB เหลือ ~25KB ป้องกัน 4.5MB Vercel Limit
    const clientSafeResult = {
      ...result,
      images: result.images.map((image) => {
        const { imageBase64: _imageBase64, ...rest } = image;
        void _imageBase64;
        return rest;
      }),
    };
    return NextResponse.json(clientSafeResult);
  } catch (error: unknown) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    console.error("Manual workflow trigger error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Manual trigger failed",
      },
      { status: 500 }
    );
  }
}
