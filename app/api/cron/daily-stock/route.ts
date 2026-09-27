import { NextRequest, NextResponse } from "next/server";
import { executeDailyStockWorkflow } from "@/lib/workflow";
import { secureCompare } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // รองรับระยะเวลาประมวลผลสูงสุดสำหรับ Vercel Serverless

export async function GET(request: NextRequest) {
  // ตรวจสอบความปลอดภัยด้วย Authorization Bearer CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret.length < 32) {
    console.error("CRON_SECRET is missing or too short");
    return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
  }
  const suppliedSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!(await secureCompare(suppliedSecret, cronSecret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await executeDailyStockWorkflow();
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
    console.error("Cron workflow execution error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Cron workflow failed",
      },
      { status: 500 }
    );
  }
}
