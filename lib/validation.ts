import { isRecord } from "./errors";
import type { StockImageItem, WorkflowResult } from "./types";
import { summarizeConceptPlan, THAI_EDITORIAL_STILL_LIFE_FIELDS, THAI_EDITORIAL_STILL_LIFE_TYPE } from "./structured-concepts";

const IMAGE_MODES = new Set(["transparent_png", "regular_scene"]);
const CONCEPT_MODES = new Set(["existing", "structured_concept"]);
const PLANNING_SOURCES = new Set(["ai", "curated_fallback"]);
const ASPECT_RATIOS = new Set(["16:9", "3:2", "4:5", "1:1"]);
const IMAGE_QUALITY_STATUSES = new Set(["passed", "passed_after_retries", "accepted_after_retry_limit"]);

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
  if (value.conceptStructure !== undefined) {
    if (!isRecord(value.conceptStructure) || value.conceptStructure.type !== THAI_EDITORIAL_STILL_LIFE_TYPE || !isRecord(value.conceptStructure.fields)) return false;
    const fields = value.conceptStructure.fields;
    if (!THAI_EDITORIAL_STILL_LIFE_FIELDS.every((field) => isBoundedString(fields[field], 700))) return false;
  }
  if (value.commercialIntent !== undefined) {
    if (!isRecord(value.commercialIntent)) return false;
    if (!isBoundedString(value.commercialIntent.targetBuyer, 1400) ||
      !isBoundedString(value.commercialIntent.intendedUse, 1400) ||
      !isBoundedString(value.commercialIntent.purchaseReason, 1400)) return false;
    if (/guaranteed|will sell|low competition|high demand|best.?seller/i.test(value.commercialIntent.purchaseReason)) return false;
  }
  if (value.conceptMode === "structured_concept" && value.conceptStructure === undefined) return false;
  if (value.conceptMode === "structured_concept" && value.commercialIntent === undefined) return false;
  if (value.conceptMode === "structured_concept" && (
    value.generationMode !== "regular_scene" || value.isTransparent === true ||
    value.composition !== "advertising"
  )) return false;
  if (value.filename !== undefined && !isBoundedString(value.filename, 240)) return false;
  if (value.imageUrl !== undefined && !isBoundedString(value.imageUrl, 35_000_000)) return false;
  if (value.imageBase64 !== undefined && !isBoundedString(value.imageBase64, 35_000_000)) return false;
  if (value.description !== undefined && !isBoundedString(value.description, 4_000)) return false;
  if (value.qualityReview !== undefined) {
    if (!isRecord(value.qualityReview)) return false;
    if (!IMAGE_QUALITY_STATUSES.has(String(value.qualityReview.status))) return false;
    if (!Number.isInteger(value.qualityReview.attempts) || Number(value.qualityReview.attempts) < 1 || Number(value.qualityReview.attempts) > 4) return false;
    if (!Number.isInteger(value.qualityReview.rejectionCount) || Number(value.qualityReview.rejectionCount) < 0 || Number(value.qualityReview.rejectionCount) > 4) return false;
    if (!Array.isArray(value.qualityReview.rejectionReasons) || value.qualityReview.rejectionReasons.length > 12) return false;
    if (!value.qualityReview.rejectionReasons.every((reason) => isBoundedString(reason, 500))) return false;
    if (Number(value.qualityReview.rejectionCount) !== value.qualityReview.rejectionReasons.length) return false;
    if (value.qualityReview.status === "passed" && (value.qualityReview.attempts !== 1 || value.qualityReview.rejectionCount !== 0)) return false;
    if (value.qualityReview.status === "passed_after_retries" && Number(value.qualityReview.rejectionCount) < 1) return false;
    if (value.qualityReview.status === "accepted_after_retry_limit" && (value.qualityReview.attempts !== 4 || value.qualityReview.rejectionCount !== 4)) return false;
  }
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
  if (value.conceptPlan !== undefined) {
    if (!isRecord(value.conceptPlan)) return false;
    const conceptPlan = value.conceptPlan;
    const countFields = ["structuredCount", "legacyCount", "transparentPngCount", "regularSceneCount"];
    if (typeof conceptPlan.enabled !== "boolean") return false;
    if (!countFields.every((field) => Number.isInteger(conceptPlan[field]) && Number(conceptPlan[field]) >= 0)) return false;
    if (conceptPlan.structureType !== null && conceptPlan.structureType !== THAI_EDITORIAL_STILL_LIFE_TYPE) return false;
    if (Number(conceptPlan.structuredCount) + Number(conceptPlan.legacyCount) !== value.images.length) return false;
    if (Number(conceptPlan.transparentPngCount) + Number(conceptPlan.regularSceneCount) !== value.images.length) return false;
    const actual = summarizeConceptPlan(value.images, parseGenerationMode(value.generationMode) || "regular_scene");
    if (conceptPlan.enabled !== actual.enabled || conceptPlan.structureType !== actual.structureType ||
      countFields.some((field) => Number(conceptPlan[field]) !== actual[field as keyof typeof actual])) return false;
  }
  return typeof value.success === "boolean" && Number.isFinite(value.durationMs);
}
