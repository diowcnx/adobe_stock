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
  if ([value.fusionStructure, value.boothStructure, value.masterplanStructure, value.materialArtStructure, value.dualMaterialStructure, value.beverageCampaignStructure, value.culinaryEditorialStructure, value.aerialLandscapeStructure].filter(field => field !== undefined).length > 1) return false;
  if (value.aerialLandscapeStructure !== undefined) {
    if (!isRecord(value.aerialLandscapeStructure)) return false;
    const fields = ["SCENE_THEME", "AERIAL_TERRAIN_RIBBONS", "WINDING_PATH_AND_SUBJECTS", "FOCAL_LANDMARK_ELEMENT", "ARTISTIC_MEDIUM_AND_TEXTURE", "COLOR_HARMONY_AND_PALETTE", "TYPOGRAPHY_OVERLAY", "LIGHTING_AND_MOOD"];
    if (Object.keys(value.aerialLandscapeStructure).length !== fields.length ||
        !fields.every(field => isBoundedString((value.aerialLandscapeStructure as Record<string, unknown>)[field], 700)) ||
        value.aerialLandscapeStructure.TYPOGRAPHY_OVERLAY !== "None (Text-free)") return false;
  }
  if (value.culinaryEditorialStructure !== undefined) {
    if (!isRecord(value.culinaryEditorialStructure)) return false;
    const fields = ["PROJECT_CONTEXT", "BRAND_TITLE_UPPER_LEFT", "BRAND_SUBLINE_UPPER_LEFT", "EDITORIAL_HEADLINE_LOWER_LEFT", "EDITORIAL_TAGLINE_LOWER_LEFT", "FOOTER_NOTICE_LOWER_RIGHT", "FOREGROUND_HERO_CULINARY_ITEM", "SUSPENDED_HERO_ACTION_AND_UTENSIL", "DISH_SPECIFIC_RAW_ACCOMPANIMENTS", "GRAPHIC_BACKDROP_AND_FRAME", "COLOR_PALETTE"];
    if (Object.keys(value.culinaryEditorialStructure).length !== fields.length ||
        !fields.every(field => isBoundedString((value.culinaryEditorialStructure as Record<string, unknown>)[field], 700))) return false;
  }
  if (value.beverageCampaignStructure !== undefined) {
    if (!isRecord(value.beverageCampaignStructure)) return false;
    const fields = ["CAMPAIGN_THEME", "HERO_DRINK_CENTER_ELEVATED", "SUPPORTING_DRINK_LEFT", "SUPPORTING_DRINK_RIGHT", "STAGING_PLINTHS", "RELEVANT_INGREDIENT_PROPS", "BACKGROUND_ENVIRONMENT", "LIGHTING_MOOD", "COLOR_PALETTE"];
    if (Object.keys(value.beverageCampaignStructure).length !== fields.length ||
        !fields.every(field => isBoundedString((value.beverageCampaignStructure as Record<string, unknown>)[field], 700))) return false;
  }
  if (value.dualMaterialStructure !== undefined) {
    if (!isRecord(value.dualMaterialStructure)) return false;
    const fields = ["SUBJECT", "PRIMARY_MATERIAL", "SECONDARY_MATERIAL", "BACKGROUND", "SHADOW_STYLE", "VISUAL_STYLE"];
    if (Object.keys(value.dualMaterialStructure).length !== fields.length ||
        !fields.every(field => isBoundedString((value.dualMaterialStructure as Record<string, unknown>)[field], 700))) return false;
  }
  if (value.materialArtStructure !== undefined) {
    if (!isRecord(value.materialArtStructure) ||
        Object.keys(value.materialArtStructure).length !== THAI_EDITORIAL_STILL_LIFE_FIELDS.length ||
        !THAI_EDITORIAL_STILL_LIFE_FIELDS.every(field => isBoundedString((value.materialArtStructure as Record<string, unknown>)[field], 700)) ||
        value.materialArtStructure.TEXT_ELEMENTS !== "No text") return false;
  }
  if (value.masterplanStructure !== undefined) {
    if (!isRecord(value.masterplanStructure)) return false;
    const fields = ["PROJECT_THEME", "PROJECT_TITLE", "VIEW_AND_PERSPECTIVE", "LINEWORK_AND_TINT_STYLE", "WATERPARK_AND_AMENITY_ZONE", "ACCOMMODATION_AND_STRUCTURES", "LANDSCAPE_AND_TERRAIN", "COLOR_PALETTE"];
    if (Object.keys(value.masterplanStructure).length !== fields.length ||
        !fields.every(field => isBoundedString((value.masterplanStructure as Record<string, unknown>)[field], 700))) return false;
  }
  if (value.boothStructure !== undefined) {
    if (!isRecord(value.boothStructure)) return false;
    const fields = ["BOOTH_CONCEPT", "VIEW_ANGLE", "BACKGROUND_STYLE", "BOOTH_STRUCTURE", "PRIMARY_SIGNAGE", "GRAPHIC_BACKDROP", "DECORATIVE_MARKS", "LEFT_FEATURE_ELEMENT", "RIGHT_FEATURE_ELEMENT", "DISPLAY_FIXTURES", "PRODUCT_DISPLAY", "MATERIAL_PALETTE", "SIDE_DECORATION", "FLOOR_TREATMENT", "LIGHTING_STYLE", "DESIGN_FOCUS", "VISUAL_STYLE"];
    if (Object.keys(value.boothStructure).length !== fields.length ||
        !fields.every(field => isBoundedString((value.boothStructure as Record<string, unknown>)[field], 700))) return false;
  }
  if (value.fusionStructure !== undefined) {
    if (!isRecord(value.fusionStructure)) return false;
    const fields = ["CONCEPT_THEME", "ORGANIC_FOOD_PART", "MECHANICAL_HARDWARE_PART", "PLACEMENT_AND_ANGLE", "BACKGROUND_SURFACE", "LIGHTING_AND_MOOD", "COLOR_PALETTE"];
    if (Object.keys(value.fusionStructure).length !== fields.length ||
        !fields.every(field => isBoundedString((value.fusionStructure as Record<string, unknown>)[field], 700))) return false;
  }
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
  if (value.conceptMode === "structured_concept") {
    const isStructuredPng = value.generationMode === "transparent_png" && value.isTransparent === true && value.composition === "asset";
    const isStructuredJpeg = value.generationMode === "regular_scene" && value.isTransparent !== true && value.composition === "advertising";
    if (!isStructuredPng && !isStructuredJpeg) return false;
  }
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
