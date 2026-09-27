import { NextRequest, NextResponse } from "next/server";
import { sendDailyStockEmail } from "@/lib/smtp2go";
import { WorkflowResult } from "@/lib/types";
import { readJsonBody, validationErrorResponse } from "@/lib/request";
import { isWorkflowResult } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request, 40_000_000);
    if (!isWorkflowResult(body)) {
      return NextResponse.json({ success: false, error: "Invalid batch" }, { status: 400 });
    }
    const batch: WorkflowResult = body;

    const emailResult = await sendDailyStockEmail({
      trend: batch.trend,
      images: batch.images,
      credits: batch.credits,
      mode: batch.generationMode,
    });

    return NextResponse.json(emailResult);
  } catch (error: unknown) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    console.error("dispatch-email error:", error);
    return NextResponse.json({ success: false, error: "Email dispatch failed" }, { status: 500 });
  }
}
