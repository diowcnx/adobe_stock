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
    const { items, researchDate, sourceFile } = await prepareManualResearchItems();
    const categories = [...new Set(items.map(item => item.category))];
    return NextResponse.json({ success: true, mode: "regular_scene", items, credits, conceptPlan: summarizeConceptPlan(items, "regular_scene"), trend: { theme: `Manual research: ${categories.join(", ")}`, targetMarket: [...new Set(items.map(item => item.commercialIntent?.targetBuyer).filter(Boolean))].slice(0, 3).join("; "), commercialReasoning: "Ten distinct manually researched visual stories based on observed stock search results, not verified sales rankings.", seasonalRelevance: `Stock research conducted ${researchDate} (${sourceFile})`, buyerDemandRating: "Research Candidate" } });
  } catch (error) {
    console.error("prepare-research-batch:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ success: false, error: "ไม่สามารถเตรียมชุดภาพได้ กรุณาตรวจเครดิต OpenRouter และการตั้งค่า" }, { status: 503 });
  }
}
