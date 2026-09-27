import { NextRequest, NextResponse } from "next/server";
import { executeDailyStockWorkflow } from "@/lib/workflow";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // รองรับระยะเวลาประมวลผลสูงสุดสำหรับ Vercel Serverless

export async function GET(request: NextRequest) {
  // ตรวจสอบความปลอดภัยด้วย Authorization Bearer CRON_SECRET ถ้ามีการตั้งไว้
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await executeDailyStockWorkflow();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Cron workflow execution error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error during cron execution",
      },
      { status: 500 }
    );
  }
}
