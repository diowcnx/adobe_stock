import { NextResponse } from "next/server";
import { getOpenRouterCredits } from "@/lib/openrouter";
import { prepareManualResearchItems } from "@/lib/manual-research";
import { summarizeConceptPlan } from "@/lib/structured-concepts";

export const dynamic = "force-dynamic";
export async function POST() {
  try {
    if (!process.env.OPENROUTER_API_KEY) throw new Error("OpenRouter API key is not configured");
    const credits = await getOpenRouterCredits();
    if (credits.label === "Connection Error" || credits.label === "Unable to retrieve credits" || credits.remainingCredits <= 0.01) throw new Error("Unable to confirm sufficient OpenRouter credit");
    const items = await prepareManualResearchItems();
    return NextResponse.json({ success: true, mode: "regular_scene", items, credits, conceptPlan: summarizeConceptPlan(items, "regular_scene"), trend: { theme: "Manual research: privacy, smart home and light pollution", targetMarket: "Technology, home and environmental communications", commercialReasoning: "Ten distinct manually researched visual stories based on observed stock search results, not verified sales rankings.", seasonalRelevance: "News and stock research conducted 28 October 2026", buyerDemandRating: "Research Candidate" } });
  } catch (error) {
    console.error("prepare-research-batch:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ success: false, error: "ไม่สามารถเตรียมชุดภาพได้ กรุณาตรวจเครดิต OpenRouter และการตั้งค่า" }, { status: 503 });
  }
}
