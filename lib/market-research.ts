import type { ConceptPlanSummary, MarketTrend, StockImageItem } from "./types";
import { BATCH_SIZE, getBangkokDate, type GenerationMode } from "./production-plan";
import { summarizeConceptPlan } from "./structured-concepts";
import { buildFoodFusionBatch } from "./food-fusion";

export { getDailyScheduledMode } from "./production-plan";

/** The retired 18-field planner remains disabled. The new fusion schema has seven fields. */
export function isStructuredConceptsEnabled(_value?: string): boolean {
  void _value;
  return false;
}

export async function conductMarketResearchAndGeneratePrompts(
  currentDate: string = new Date().toISOString(),
  forcedMode?: GenerationMode,
): Promise<{ trend: MarketTrend; items: StockImageItem[]; mode: GenerationMode; conceptPlan: ConceptPlanSummary }> {
  if (forcedMode === "transparent_png") throw new Error("PNG generation has been disabled. Prepare a new JPEG batch.");
  const date = new Date(currentDate);
  const productionDate = getBangkokDate(date);
  const items = buildFoodFusionBatch(date, BATCH_SIZE);
  const mode = "regular_scene" as const;
  return {
    mode, items, conceptPlan: summarizeConceptPlan(items, mode),
    trend: {
      theme: "Food × Hardware Fusion — randomized single-hero JPEG concepts",
      targetMarket: "food, beverage, restaurant and creative advertising buyers",
      commercialReasoning: "Random selection without duplicate pairs within a batch from matched food-hardware concepts. Each includes a concrete buyer and campaign use. Inspired by the user-provided seven-field structure and Adobe's Surreal Silliness trend; no verified sales claims or paid planning calls.",
      seasonalRelevance: "Bangkok production date " + productionDate + ". Thai ingredients where relevant; minimalist studio background.",
      buyerDemandRating: "Research Candidate",
    },
  };
}
