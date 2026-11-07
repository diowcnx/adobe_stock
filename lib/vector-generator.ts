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
/** Adobe's vector design guide caps characters, icons and illustrations at 4800 px a side. */
export const MAX_ARTBOARD_SIDE = 4800;
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

/**
 * Set the artboard to about 20 MP (Adobe's technical page asks 15–65 MP) without a side over 4800 px
 * (Adobe's newer design page). A 16:9 artboard cannot meet both, so it stops at 4800 px wide.
 */
export function sizeArtboardForAdobe(svg: string): { svg: string; width: number; height: number } {
  const box = viewBoxSize(svg);
  const scale = Math.min(Math.sqrt(TARGET_ARTBOARD_PIXELS / (box.width * box.height)), MAX_ARTBOARD_SIDE / Math.max(box.width, box.height));
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

const SHAPE = /^\s*<(path|rect|polygon|circle|ellipse|polyline)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/i;

function coversArtboard(shape: string, box: { width: number; height: number }): boolean {
  const near = (value: string | undefined, target: number) => Math.abs(Number(value) - target) <= Math.max(2, target * 0.002);
  const rect = /^<rect\b/i.test(shape.trim());
  if (rect) {
    const attr = (name: string) => new RegExp(`\\s${name}\\s*=\\s*["']([\\d.]+)`, "i").exec(shape)?.[1];
    return near(attr("x") ?? "0", 0) && near(attr("y") ?? "0", 0) && near(attr("width"), box.width) && near(attr("height"), box.height);
  }
  const d = /\sd\s*=\s*["']([^"']*)["']/i.exec(shape)?.[1] ?? "";
  const numbers = d.match(/-?[\d.]+/g) ?? [];
  if (!/^\s*M/i.test(d) || /[CQSATcqsat]/.test(d) || numbers.length < 8 || numbers.length > 10) return false;
  const points = numbers.map(Number);
  const xs = points.filter((_, i) => i % 2 === 0);
  const ys = points.filter((_, i) => i % 2 === 1);
  return near(String(Math.min(...xs)), 0) && near(String(Math.min(...ys)), 0) && near(String(Math.max(...xs)), box.width) && near(String(Math.max(...ys)), box.height);
}

/**
 * Adobe asks for labelled layers instead of a flat design. Put a full-artboard background shape in a
 * "background" layer and every other shape in an "artwork" layer; Illustrator reads each top-level
 * group id as a layer name. Files that already have groups are left alone.
 */
export function groupIntoLayers(svg: string): string {
  if (/<g\b/i.test(svg)) return svg;
  const open = /<svg\b[^>]*>/i.exec(svg);
  const close = svg.lastIndexOf("</svg>");
  if (!open || close < 0) return svg;
  const head = svg.slice(0, open.index + open[0].length);
  let body = svg.slice(open.index + open[0].length, close);
  const kept: string[] = [];
  body = body.replace(/<(metadata|defs|title|desc)\b[\s\S]*?<\/\1>/gi, block => { kept.push(block); return ""; });
  const first = SHAPE.exec(body);
  let background = "";
  if (first && coversArtboard(first[0], viewBoxSize(svg))) {
    background = first[0].trim();
    body = body.slice(first.index + first[0].length);
  }
  const layers = `${background ? `\n<g id="background">\n${background}\n</g>` : ""}\n<g id="artwork">\n${body.trim()}\n</g>\n`;
  return `${head}${kept.length ? `\n${kept.join("\n")}` : ""}${layers}${svg.slice(close)}`;
}

/** Make a generated SVG ready for Adobe: labelled layers and a correctly sized artboard. */
export function prepareSvgForAdobe(svg: string): { svg: string; width: number; height: number } {
  return sizeArtboardForAdobe(groupIntoLayers(svg));
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
    const sized = prepareSvgForAdobe(svg);
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
