import { NextRequest, NextResponse } from "next/server";
import { sendDailyStockEmail } from "@/lib/smtp2go";
import { WorkflowResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const batch: WorkflowResult = await request.json();
    if (!batch || !batch.images || batch.images.length === 0) {
      return NextResponse.json({ success: false, error: "Missing batch or images" }, { status: 400 });
    }

    const emailResult = await sendDailyStockEmail({
      trend: batch.trend,
      images: batch.images,
      credits: batch.credits,
      mode: batch.generationMode,
    });

    return NextResponse.json(emailResult);
  } catch (error: any) {
    console.error("dispatch-email error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
