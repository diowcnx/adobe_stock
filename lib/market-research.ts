import type { ConceptPlanSummary, MarketTrend, StockImageItem } from "./types";
import { BATCH_SIZE, getBangkokDate, type GenerationMode } from "./production-plan";
import { summarizeConceptPlan } from "./structured-concepts";
import { buildFoodFusionBatch } from "./food-fusion";
import { buildExhibitionBoothBatch } from "./exhibition-booth";
import { randomInt } from "node:crypto";
import { generateUniqueStockFilename } from "./csv";

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
  const items = [
    ...buildFoodFusionBatch(date, BATCH_SIZE / 2),
    ...buildExhibitionBoothBatch(date, BATCH_SIZE / 2),
  ];
  for (let index = items.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [items[index], items[other]] = [items[other], items[index]];
  }
  items.forEach((item, index) => {
    item.id = index + 1;
    item.filename = generateUniqueStockFilename(item.seoTitle, item.id, date, "regular_scene");
  });
  const mode = "regular_scene" as const;
  return {
    mode, items, conceptPlan: summarizeConceptPlan(items, mode),
    trend: {
      theme: "Food Fusion + Thai Craft Exhibition Booths — randomized JPEG concepts",
      targetMarket: "food advertising buyers, exhibition designers and community-craft marketers",
      commercialReasoning: "Five food-hardware concepts and five exhibition-booth designs, randomly selected without duplicate concepts within each structure and shuffled together. Each includes its own USER_INPUT structure, target buyer and intended use. No verified sales claims or paid planning calls.",
      seasonalRelevance: "Bangkok production date " + productionDate + ". Thai ingredients where relevant; minimalist studio background.",
      buyerDemandRating: "Research Candidate",
    },
  };
}
