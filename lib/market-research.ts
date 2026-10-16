import type { ConceptPlanSummary, MarketTrend, StockImageItem } from "./types";
import { BATCH_SIZE, getBangkokDate, type GenerationMode } from "./production-plan";
import { summarizeConceptPlan } from "./structured-concepts";
import { buildFoodFusionBatch } from "./food-fusion";
import { buildExhibitionBoothBatch } from "./exhibition-booth";
import { buildResortMasterplanBatch } from "./resort-masterplan";
import { buildMaterialArtBatch } from "./material-art";
import { buildDualMaterialBatch } from "./dual-material";
import { randomInt } from "node:crypto";
import { generateUniqueStockFilename } from "./csv";

export { getDailyScheduledMode } from "./production-plan";

/** The legacy automatic metaphor planner stays disabled; explicit structures have separate builders. */
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
  // Distribute slots evenly; five structures currently receive two each.
  const counts = [0, 0, 0, 0, 0];
  for (let index = 0; index < BATCH_SIZE; index++) {
    counts[(index + Number(productionDate.slice(-2)) % counts.length) % counts.length]++;
  }
  const items = [
    ...buildFoodFusionBatch(date, counts[0]),
    ...buildExhibitionBoothBatch(date, counts[1]),
    ...buildResortMasterplanBatch(date, counts[2]),
    ...buildMaterialArtBatch(date, counts[3]),
    ...buildDualMaterialBatch(date, counts[4]),
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
      theme: "Food Fusion + Booths + Masterplans + Editorial Still Life + Dual Material — randomized JPEG concepts",
      targetMarket: "food, beauty and craft advertisers, exhibition designers and architectural presentation teams",
      commercialReasoning: counts[0] + " food fusion, " + counts[1] + " booth, " + counts[2] + " masterplan, " + counts[3] + " editorial still-life and " + counts[4] + " dual-material briefs, selected without duplicate concepts within each structure and shuffled together. Each has its own USER_INPUT, buyer use and quality rules. No verified sales claims or paid planning calls.",
      seasonalRelevance: "Bangkok production date " + productionDate + ". Thai ingredients where relevant; minimalist studio background.",
      buyerDemandRating: "Research Candidate",
    },
  };
}
