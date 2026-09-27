import { NextRequest, NextResponse } from "next/server";
import { saveLatestBatch } from "@/lib/batch-store";
import { WorkflowResult } from "@/lib/types";
import { readJsonBody, validationErrorResponse } from "@/lib/request";
import { isWorkflowResult } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const parsed = await readJsonBody(request, 40_000_000);
    if (!isWorkflowResult(parsed)) {
      return NextResponse.json({ success: false, error: "Invalid batch" }, { status: 400 });
    }
    const body: WorkflowResult = parsed;
    await saveLatestBatch(body);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    console.error("save-batch error:", error);
    return NextResponse.json({ success: false, error: "Unable to save batch" }, { status: 500 });
  }
}
