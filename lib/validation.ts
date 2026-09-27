import { isRecord } from "./errors";
import type { StockImageItem, WorkflowResult } from "./types";

const IMAGE_MODES = new Set(["transparent_png", "regular_scene"]);
const ASPECT_RATIOS = new Set(["16:9", "3:2", "4:5", "1:1"]);

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
  if (!Array.isArray(value.keywords) || value.keywords.length > 60) return false;
  if (!value.keywords.every((keyword) => isBoundedString(keyword, 100))) return false;
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
  return typeof value.success === "boolean" && Number.isFinite(value.durationMs);
}
