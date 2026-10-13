import { isRecord } from "./errors";
import type { StockImageItem, WorkflowResult } from "./types";
import { summarizeConceptMix } from "./concept-mix";

const IMAGE_MODES = new Set(["transparent_png", "regular_scene"]);
const CONCEPT_MODES = new Set(["existing", "material_concept"]);
const PLANNING_SOURCES = new Set(["ai", "curated_fallback"]);
const ASPECT_RATIOS = new Set(["16:9", "3:2", "4:5", "1:1"]);
const MATERIAL_FIELDS = ["SUBJECT", "PRIMARY_MATERIAL", "SECONDARY_MATERIAL", "BACKGROUND", "SHADOW_STYLE", "VISUAL_STYLE", "COMMERCIAL_CONCEPT"];

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

export function parseGenerationMode(
  value: unknown,
): "transparent_png" | "regular_scene" | undefined {
  return typeof value === "string" && IMAGE_MODES.has(value)
    ? (value as "transparent_png" | "regular_scene")
    : undefined;
}

export function isStockImageItem(value: unknown): value is StockImageItem {
  if (!isRecord(value)) return false;
  if (!Number.isInteger(value.id) || Number(value.id) < 0 || Number(value.id) > 10_000) return false;
  if (!isBoundedString(value.seoTitle, 300)) return false;
  if (!isBoundedString(value.category, 120)) return false;
  if (typeof value.aspectRatio !== "string" || !ASPECT_RATIOS.has(value.aspectRatio)) return false;
  if (!isBoundedString(value.prompt, 8_000)) return false;
  if (!isBoundedString(value.modelUsed, 200)) return false;
  if (value.isTransparent !== undefined && typeof value.isTransparent !== "boolean") return false;
  if (value.composition !== undefined && !["artwork", "advertising", "asset"].includes(String(value.composition))) return false;
  if (value.negativePrompt !== undefined && !isBoundedString(value.negativePrompt, 2000)) return false;
  if (!Array.isArray(value.keywords) || value.keywords.length > 60) return false;
  if (!value.keywords.every((keyword) => isBoundedString(keyword, 100))) return false;
  if (value.conceptMode !== undefined && !CONCEPT_MODES.has(String(value.conceptMode))) return false;
  if (value.planningSource !== undefined && !PLANNING_SOURCES.has(String(value.planningSource))) return false;
  if (value.conceptMode !== undefined && (value.keywords.length < 15 || value.keywords.length > 25)) return false;
  if (value.materialStructure !== undefined) {
    if (!isRecord(value.materialStructure)) return false;
    const materialStructure = value.materialStructure;
    if (!MATERIAL_FIELDS.every((field) => isBoundedString(materialStructure[field], 500))) return false;
  }
  if (value.conceptMode === "material_concept" && value.materialStructure === undefined) return false;
  if (value.conceptMode === "material_concept" && (
    value.generationMode !== "regular_scene" || value.isTransparent === true ||
    value.composition !== "advertising" || value.aspectRatio !== "16:9"
  )) return false;
  if (value.filename !== undefined && !isBoundedString(value.filename, 240)) return false;
  if (value.imageUrl !== undefined && !isBoundedString(value.imageUrl, 35_000_000)) return false;
  if (value.imageBase64 !== undefined && !isBoundedString(value.imageBase64, 35_000_000)) return false;
  if (value.generationMode !== undefined && parseGenerationMode(value.generationMode) === undefined) return false;
  return true;
}

export function isWorkflowResult(value: unknown): value is WorkflowResult {
  if (!isRecord(value) || !Array.isArray(value.images)) return false;
  if (value.images.length === 0 || value.images.length > 20) return false;
  if (!value.images.every(isStockImageItem)) return false;
  if (!isRecord(value.trend) || !isRecord(value.credits) || !isRecord(value.emailDelivery)) return false;
  if (!isBoundedString(value.timestamp, 100)) return false;
  if (value.generationMode !== undefined && parseGenerationMode(value.generationMode) === undefined) return false;
  if (value.conceptMix !== undefined) {
    if (!isRecord(value.conceptMix)) return false;
    const conceptMix = value.conceptMix;
    const countFields = ["existingCount", "materialConceptCount", "transparentPngCount", "regularSceneCount"];
    if (typeof conceptMix.enabled !== "boolean") return false;
    if (!countFields.every((field) => Number.isInteger(conceptMix[field]) && Number(conceptMix[field]) >= 0)) return false;
    if (Number(conceptMix.existingCount) + Number(conceptMix.materialConceptCount) !== value.images.length) return false;
    if (Number(conceptMix.transparentPngCount) + Number(conceptMix.regularSceneCount) !== value.images.length) return false;
    const actual = summarizeConceptMix(value.images, parseGenerationMode(value.generationMode) || "regular_scene");
    if (conceptMix.enabled !== actual.enabled || countFields.some((field) => Number(conceptMix[field]) !== actual[field as keyof typeof actual])) return false;
  }
  return typeof value.success === "boolean" && Number.isFinite(value.durationMs);
}
