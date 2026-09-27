import { NextRequest, NextResponse } from "next/server";
import { conductMarketResearchAndGeneratePrompts } from "@/lib/market-research";
import { getOpenRouterCredits } from "@/lib/openrouter";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    let mode: "transparent_png" | "regular_scene" | undefined;
    try {
      const body = await request.json();
      if (body?.mode === "transparent_png" || body?.mode === "regular_scene") {
        mode = body.mode;
      }
    } catch {
      // empty body is ok
    }

    const { trend, items, mode: resolvedMode } = await conductMarketResearchAndGeneratePrompts(undefined, mode);
    const credits = await getOpenRouterCredits();

    return NextResponse.json({
      success: true,
      trend,
      items,
      mode: resolvedMode,
      credits,
    });
  } catch (error: any) {
    console.error("prepare-batch error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to prepare batch" },
      { status: 500 }
    );
  }
}
