import { NextRequest, NextResponse } from "next/server";
import { saveLatestBatch } from "@/lib/batch-store";
import { WorkflowResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body: WorkflowResult = await request.json();
    await saveLatestBatch(body);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
