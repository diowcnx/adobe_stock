import sharp from "sharp";
import { getErrorMessage } from "./errors";
import { getGenerationBlockReason } from "./generation-policy";
import { assessGeneratedImageQuality } from "./image-quality";
import type { ImageQualityReview, StockImageItem } from "./types";

const OPENROUTER_IMAGES_URL = "https://openrouter.ai/api/v1/images";
/** Recraft's SVG model on OpenRouter, about $0.08 per image. */
export const DEFAULT_VECTOR_MODEL = "recraft/recraft-v4.1-vector";
export const MAX_VECTOR_RETRIES = 3;
/** Adobe Stock asks for a 15–65 MP artboard; aim between the two. */
export const TARGET_ARTBOARD_PIXELS = 20_000_000;
const MAX_SVG_BYTES = 45 * 1024 * 1024;
const RECRAFT_ASPECT: Record<StockImageItem["aspectRatio"], string> = { "16:9": "16:9", "3:2": "4:3", "4:5": "3:4", "1:1": "1:1" };

export interface VectorResult {
  svg?: string;
  error?: string;
  qualityReview?: ImageQualityReview;
}

/** Returns why an SVG is unusable for Adobe Stock or unsafe to open, or undefined when it is fine. */
export function svgProblem(svg: string): string | undefined {
  if (Buffer.byteLength(svg) > MAX_SVG_BYTES) return "SVG is larger than Adobe's 45 MB limit";
  if (!/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(svg)) return "response is not an SVG document";
  if (/<(image|script|foreignObject|iframe|object|embed)\b/i.test(svg)) return "SVG embeds a raster image or active content";
  if (/\son[a-z]+\s*=/i.test(svg) || /(?:xlink:)?href\s*=\s*["'](?!#)/i.test(svg)) return "SVG references external content";
  if (!/<(path|polygon|rect|circle|ellipse|polyline)\b/i.test(svg)) return "SVG contains no vector shapes";
  return undefined;
}

function viewBoxSize(svg: string): { width: number; height: number } {
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? "";
  const box = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(root);
  const width = Number(box?.[1] ?? /\swidth\s*=\s*["']([\d.]+)/i.exec(root)?.[1]);
  const height = Number(box?.[2] ?? /\sheight\s*=\s*["']([\d.]+)/i.exec(root)?.[1]);
  if (!(width > 0 && height > 0)) throw new Error("SVG has no usable size");
  return { width, height };
}

/** Set the artboard to about 20 MP so Adobe's 15 MP minimum is met; vectors scale without loss. */
export function sizeArtboardForAdobe(svg: string): { svg: string; width: number; height: number } {
  const box = viewBoxSize(svg);
  const scale = Math.sqrt(TARGET_ARTBOARD_PIXELS / (box.width * box.height));
  const width = Math.round(box.width * scale);
  const height = Math.round(box.height * scale);
  const hasViewBox = /<svg\b[^>]*\sviewBox\s*=/i.test(svg);
  const resized = svg.replace(/<svg\b[^>]*>/i, root => {
    const cleaned = root.replace(/\s(width|height)\s*=\s*(["'])[^"']*\2/gi, "");
    const extra = `${hasViewBox ? "" : ` viewBox="0 0 ${box.width} ${box.height}"`} width="${width}" height="${height}"`;
    return cleaned.replace(/^<svg\b/i, `<svg${extra}`);
  });
  return { svg: resized, width, height };
}

/** A small PNG of the SVG for the vision check. */
export async function rasterizeSvg(svg: string, longSide = 1024): Promise<Buffer> {
  return sharp(Buffer.from(svg), { density: 72 })
    .resize({ width: longSide, height: longSide, fit: "inside" })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
}

function vectorPrompt(item: StockImageItem, attempt: number, issues: string[]): string {
  const retry = attempt > 0
    ? ` QUALITY REPLACEMENT ${attempt}/${MAX_VECTOR_RETRIES}: the previous drawing was rejected because: ${issues.join("; ").slice(0, 400)}. Draw a new, simpler version with a clearer silhouette and fix every rejected defect.`
    : "";
  return `${item.prompt.replace(/adobe\s+stock/gi, "commercial image marketplace")}
Absolutely no text, letters, numerals, pseudo-text, logos, signatures or watermarks anywhere. No visible human faces.${retry}`.slice(0, 9_500);
}

async function requestSvg(item: StockImageItem, prompt: string, key: string): Promise<string> {
  const response = await fetch(OPENROUTER_IMAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://adobe-stock.vercel.app",
      "X-Title": "Adobe Stock Vector Generator",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: item.modelUsed || DEFAULT_VECTOR_MODEL,
      prompt,
      aspect_ratio: RECRAFT_ASPECT[item.aspectRatio] ?? "1:1",
      output_format: "svg",
      n: 1,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`vector provider returned ${response.status}`);
  const payload = await response.json();
  const image = payload?.data?.[0];
  if (typeof image?.b64_json !== "string") throw new Error("vector provider returned no image");
  return Buffer.from(image.b64_json, "base64").toString("utf8");
}

/** Generate one SVG, checking its structure and pixels before accepting it. */
export async function generateVectorImage(item: StockImageItem, apiKey?: string, maxRetries = MAX_VECTOR_RETRIES): Promise<VectorResult> {
  const blocked = getGenerationBlockReason(item);
  if (blocked) return { error: blocked };
  if (item.outputFormat !== "svg") return { error: "item is not planned as a vector" };
  const key = apiKey || process.env.OPENROUTER_API_KEY;
  if (!key) return { error: "OPENROUTER_API_KEY is missing" };

  const rejectionReasons: string[] = [];
  let lastSvg: string | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let svg: string;
    try {
      console.log(`[Item #${item.id}] Calling ${item.modelUsed} for SVG (attempt ${attempt + 1})...`);
      svg = await requestSvg(item, vectorPrompt(item, attempt, rejectionReasons), key);
    } catch (error: unknown) {
      // A timeout or provider error may still have been billed, so it is never retried.
      return { error: getErrorMessage(error, "vector request failed") };
    }
    const problem = svgProblem(svg);
    if (problem) {
      rejectionReasons.splice(0, rejectionReasons.length, problem);
      continue;
    }
    const sized = sizeArtboardForAdobe(svg);
    lastSvg = sized.svg;
    const quality = await assessGeneratedImageQuality(await rasterizeSvg(svg), key, {
      mode: "regular_scene",
      expectedTitle: item.seoTitle,
      intendedUse: item.commercialIntent?.intendedUse,
      isSaleReference: true,
      isSaleReferenceIsolated: item.saleReferenceLayout === "isolated_white",
      isSaleReferenceBackdrop: item.saleReferenceLayout === "solid_backdrop",
      isVector: true,
    });
    if (quality.passed) {
      return {
        svg: sized.svg,
        qualityReview: { status: attempt === 0 ? "passed" : "passed_after_retries", attempts: attempt + 1, rejectionCount: attempt, rejectionReasons: [...rejectionReasons] },
      };
    }
    rejectionReasons.splice(0, rejectionReasons.length, ...quality.issues);
  }
  if (!lastSvg) return { error: `no usable SVG: ${rejectionReasons.join("; ")}` };
  return {
    svg: lastSvg,
    qualityReview: { status: "accepted_after_retry_limit", attempts: maxRetries + 1, rejectionCount: maxRetries + 1, rejectionReasons },
  };
}
