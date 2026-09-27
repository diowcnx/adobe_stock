import { NextResponse } from "next/server";
import { executeDailyStockWorkflow } from "@/lib/workflow";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const result = await executeDailyStockWorkflow();
    return NextResponse.json(result);
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
