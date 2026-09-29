import { NextRequest, NextResponse } from "next/server";
import { conductMarketResearchAndGeneratePrompts } from "@/lib/market-research";
import { getOpenRouterCredits } from "@/lib/openrouter";
import { readJsonBody, validationErrorResponse } from "@/lib/request";
import { parseGenerationMode } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request, 1_024);
    const mode = parseGenerationMode(body.mode);

    const { trend, items, mode: resolvedMode } = await conductMarketResearchAndGeneratePrompts(undefined, mode);
    const credits = await getOpenRouterCredits();

    return NextResponse.json({
      success: true,
      trend,
      items,
      mode: resolvedMode,
      credits,
    });
  } catch (error: unknown) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    console.error("prepare-batch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to prepare batch" },
      { status: 500 }
    );
  }
}
