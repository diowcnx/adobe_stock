import sharp from "sharp";
import { getErrorMessage, isRecord } from "./errors";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";
const DEFAULT_QA_MODEL = "google/gemini-3.1-flash-lite";
const MAX_INPUT_PIXELS = 40_000_000;

export interface ImageQualityResult {
  passed: boolean;
  issues: string[];
  source: "pixel_guard" | "vision_guard";
}

/** Detect the common AI failure where a portrait image is placed inside white side mats. */
export async function detectUnintendedLightBorder(inputBuffer: Buffer): Promise<boolean> {
  const { data, info } = await sharp(inputBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
    .resize({ width: 256, height: 256, fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const bandX = Math.max(5, Math.round(width * 0.07));
  const bandY = Math.max(5, Math.round(height * 0.07));

  const lightNeutralRatio = (x0: number, y0: number, x1: number, y1: number): number => {
    let matching = 0;
    let total = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const offset = (y * width + x) * channels;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const spread = Math.max(r, g, b) - Math.min(r, g, b);
        if ((r + g + b) / 3 >= 235 && spread <= 12) matching++;
        total++;
      }
    }
    return total > 0 ? matching / total : 0;
  };

  const left = lightNeutralRatio(0, 0, bandX, height);
  const right = lightNeutralRatio(width - bandX, 0, width, height);
  const top = lightNeutralRatio(0, 0, width, bandY);
  const bottom = lightNeutralRatio(0, height - bandY, width, height);
  const center = lightNeutralRatio(bandX * 2, bandY * 2, width - bandX * 2, height - bandY * 2);

  const verticalMat = left >= 0.9 && right >= 0.9 && center < 0.65;
  const horizontalMat = top >= 0.9 && bottom >= 0.9 && center < 0.65;
  return verticalMat || horizontalMat;
}

export async function assessGeneratedImageQuality(
  inputBuffer: Buffer,
  apiKey?: string,
): Promise<ImageQualityResult> {
  if (await detectUnintendedLightBorder(inputBuffer)) {
    return {
      passed: false,
      issues: ["unintended white border or mat around the image"],
      source: "pixel_guard",
    };
  }

  const key = apiKey || process.env.OPENROUTER_API_KEY;
  if (!key) {
    return { passed: false, issues: ["quality inspection is unavailable"], source: "vision_guard" };
  }

  const preview = await sharp(inputBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
    .resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 76 })
    .toBuffer();
  const dataUrl = `data:image/jpeg;base64,${preview.toString("base64")}`;

  try {
    const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://adobe-stock.vercel.app",
        "X-Title": "Adobe Stock Image Quality Guard",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.IMAGE_QA_MODEL || DEFAULT_QA_MODEL,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Inspect only the visible pixels of this generated commercial image. Reject it if ANY readable or pseudo-readable letters, words, numerals, captions, title, logo, signature or watermark appear anywhere. Also reject a poster/card/mockup layout, a blank header or footer panel, an outer frame, mat, border, canvas margin, or an image placed inside another rectangular page. Natural uncluttered copy space that remains part of the photographed physical background is allowed. Return pure JSON only: {"passed":true|false,"hasText":true|false,"hasArtificialBorder":true|false,"hasPosterLayout":true|false,"issues":["short factual issue"]}. If uncertain about text or framing, reject.`,
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        }],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) throw new Error(`quality inspection returned ${response.status}`);
    const payload = await response.json();
    const rawContent = payload?.choices?.[0]?.message?.content;
    if (typeof rawContent !== "string") throw new Error("quality inspection returned no result");
    const match = rawContent.match(/\{[\s\S]*\}/);
    const report: unknown = JSON.parse(match?.[0] || rawContent);
    if (!isRecord(report) || typeof report.passed !== "boolean" ||
      typeof report.hasText !== "boolean" || typeof report.hasArtificialBorder !== "boolean" ||
      typeof report.hasPosterLayout !== "boolean" || !Array.isArray(report.issues)) {
      throw new Error("quality inspection returned an invalid report");
    }
    const issues = report.issues.filter((issue): issue is string => typeof issue === "string").slice(0, 5);
    const passed = report.passed && !report.hasText && !report.hasArtificialBorder && !report.hasPosterLayout;
    return {
      passed,
      issues: passed ? [] : issues.length > 0 ? issues : ["text, border or poster-style layout detected"],
      source: "vision_guard",
    };
  } catch (error: unknown) {
    return {
      passed: false,
      issues: [`quality inspection failed: ${getErrorMessage(error, "unknown inspection error")}`],
      source: "vision_guard",
    };
  }
}
