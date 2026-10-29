import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeStockKeywords, generateUniqueStockFilename } from "./csv";
import { GENERATION_BRIEF_VERSION } from "./generation-policy";
import type { StockImageItem } from "./types";

const RESEARCH_DIR = path.join(process.cwd(), "research");
const RESEARCH_FILE_PATTERN = /^manual-prompts-(\d{4}-\d{2}-\d{2})\.md$/;
const BRIEF_PATTERN = /^(\d+)\. \*\*(.+?)\*\* — Buyer: (.+?)\. ([^\n]+)$/;
const FIELD_PATTERN = /^\s+- (Category|Keywords|Fallback): (.+)$/;
const MIN_KEYWORDS = 15;

export interface ManualResearchBatch {
  researchDate: string;
  sourceFile: string;
  items: StockImageItem[];
}

/** The newest research/manual-prompts-YYYY-MM-DD.md, chosen by the date in its filename. */
export async function findLatestResearchFile(dir = RESEARCH_DIR): Promise<{ file: string; researchDate: string }> {
  const candidates = (await readdir(dir))
    .map(file => ({ file, researchDate: RESEARCH_FILE_PATTERN.exec(file)?.[1] }))
    .filter((entry): entry is { file: string; researchDate: string } => Boolean(entry.researchDate))
    .sort((a, b) => b.researchDate.localeCompare(a.researchDate));
  if (!candidates.length) throw new Error("No research/manual-prompts-YYYY-MM-DD.md file found");
  return candidates[0];
}

export function parseManualResearch(source: string, date: Date): StockImageItem[] {
  const briefs: { title: string; buyer: string; prompt: string; category?: string; keywords?: string; fallback?: string }[] = [];
  for (const line of source.split(/\r?\n/)) {
    const brief = BRIEF_PATTERN.exec(line);
    if (brief) {
      if (Number(brief[1]) !== briefs.length + 1) throw new Error(`Research brief ${brief[1]} is out of order`);
      briefs.push({ title: brief[2], buyer: brief[3], prompt: brief[4] });
      continue;
    }
    const field = FIELD_PATTERN.exec(line);
    const current = briefs.at(-1);
    if (!field || !current) continue;
    if (field[1] === "Category") current.category = field[2].trim();
    else if (field[1] === "Keywords") current.keywords = field[2];
    else current.fallback = field[2].trim();
  }
  if (briefs.length !== 10) throw new Error(`Research prompt file must contain exactly ten ordered briefs (found ${briefs.length})`);
  return briefs.map((brief, index) => {
    if (!brief.category) throw new Error(`Research brief ${index + 1} is missing "- Category:"`);
    const keywords = normalizeStockKeywords((brief.keywords || "").split(/[,\s]+/));
    if (keywords.length < MIN_KEYWORDS) throw new Error(`Research brief ${index + 1} needs at least ${MIN_KEYWORDS} distinct keywords (found ${keywords.length})`);
    return {
      id: index + 1, seoTitle: brief.title, category: brief.category,
      aspectRatio: "3:2", composition: "advertising", prompt: brief.prompt,
      keywords, modelUsed: "google/gemini-3.1-flash-lite-image",
      filename: generateUniqueStockFilename(brief.title, index + 1, date, "regular_scene"), isTransparent: false,
      generationMode: "regular_scene", conceptMode: "existing", generationBriefVersion: GENERATION_BRIEF_VERSION,
      manualResearch: true, commercialIntent: { targetBuyer: brief.buyer, intendedUse: brief.buyer, purchaseReason: "Specific practical scene with natural copy space for commercial communication" },
      ...(brief.fallback ? { manualFallbackPrompt: brief.fallback } : {}),
    };
  });
}

export async function prepareManualResearchItems(date = new Date(), dir = RESEARCH_DIR): Promise<ManualResearchBatch> {
  const { file, researchDate } = await findLatestResearchFile(dir);
  const source = await readFile(path.join(dir, file), "utf8");
  return { researchDate, sourceFile: `research/${file}`, items: parseManualResearch(source, date) };
}
