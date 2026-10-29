import { readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeStockKeywords, generateUniqueStockFilename } from "./csv";
import { GENERATION_BRIEF_VERSION } from "./generation-policy";
import type { StockImageItem } from "./types";

const KEYWORDS = [
  "privacy phone microphone train commuter mobile technology security communication travel screen smartphone protection personal digital",
  "webcam cover privacy laptop camera hands security protection computer office home technology digital safety screen shutter",
  "documents privacy drawer folder office security workplace records protection storage desk laptop personal information confidential",
  "privacy screen laptop filter cafe computer hands security browsing protection information work technology digital personal",
  "smart home lighting control apartment lamp automation interior technology switch energy household comfort living room",
  "thermostat climate home cooling energy temperature tropical control automation interior electricity comfort household efficiency air conditioner wall",
  "accessibility wheelchair switch curtain home automation accessible independent mobility assistive technology interior inclusion living person sunlight",
  "light pollution city night sky glow urban stars residential landscape environment horizon darkness atmosphere neighborhood",
  "streetlight night darkness lighting shielded path conservation stars environment urban safety ecology landscape illumination pedestrian trees",
  "moth insect lamp night wildlife ecology conservation light pollution nature wings garden habitat environment nocturnal butterfly",
];

export async function prepareManualResearchItems(date = new Date()): Promise<StockImageItem[]> {
  const source = await readFile(path.join(process.cwd(), "research/manual-prompts-2026-10-28.md"), "utf8");
  const matches = [...source.matchAll(/^(\d+)\. \*\*(.+?)\*\* — Buyer: (.+?)\. ([^\n]+)$/gm)];
  if (matches.length !== 10 || matches.some((match, index) => Number(match[1]) !== index + 1)) throw new Error("Research prompt file must contain exactly ten ordered briefs");
  return matches.map((match, index) => ({
    id: index + 1, seoTitle: match[2], category: index < 4 ? "Online privacy" : index < 7 ? "Smart home" : "Light pollution",
    aspectRatio: "3:2", composition: "advertising", prompt: match[4],
    keywords: normalizeStockKeywords(KEYWORDS[index].split(" ")), modelUsed: "google/gemini-3.1-flash-lite-image",
    filename: generateUniqueStockFilename(match[2], index + 1, date, "regular_scene"), isTransparent: false,
    generationMode: "regular_scene", conceptMode: "existing", generationBriefVersion: GENERATION_BRIEF_VERSION,
    manualResearch: true, commercialIntent: { targetBuyer: match[3], intendedUse: match[3], purchaseReason: "Specific practical scene with natural copy space for commercial communication" },
  }));
}
