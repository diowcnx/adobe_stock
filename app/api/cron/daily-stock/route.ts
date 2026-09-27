import { NextRequest, NextResponse } from "next/server";
import { executeDailyStockWorkflow } from "@/lib/workflow";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // รองรับระยะเวลาประมวลผลสูงสุดสำหรับ Vercel Serverless

export async function GET(request: NextRequest) {
  // ตรวจสอบความปลอดภัยด้วย Authorization Bearer CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // หากมีการตั้ง CRON_SECRET ต้องตรงกันเท่านั้น
  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized: Invalid CRON_SECRET" }, { status: 401 });
    }
  }

  try {
    const result = await executeDailyStockWorkflow();
    const clientSafeResult = {
      ...result,
      images: result.images.map(({ imageBase64, ...rest }) => rest),
    };
    return NextResponse.json(clientSafeResult);
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
