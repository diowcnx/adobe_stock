import { createHash } from "node:crypto";
import { isRecord } from "./errors";
import { GENERATION_BRIEF_VERSION, NO_VISIBLE_FACE_RULE } from "./generation-policy";
import type { MarketTrend, SaleReferenceStructure, StockImageItem } from "./types";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_REFERENCE_BYTES = 2_500_000;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ASPECT_RATIOS = new Set(["16:9", "3:2", "4:5", "1:1"]);

export interface SoldReferenceAnalysis {
  subject: string;
  visualStrengths: string;
  likelyBuyerUses: string[];
  expansionStrategy: string;
  sourceFingerprint: string;
}

export interface SaleReferencePlan {
  analysis: SoldReferenceAnalysis;
  trend: MarketTrend;
  items: StockImageItem[];
}

interface RawConcept {
  title?: unknown;
  category?: unknown;
  aspectRatio?: unknown;
  newConcept?: unknown;
  targetBuyer?: unknown;
  intendedUse?: unknown;
  purchaseReason?: unknown;
  subjectTreatment?: unknown;
  compositionAndCamera?: unknown;
  settingAndProps?: unknown;
  lightingAndMood?: unknown;
  colorPalette?: unknown;
  keywords?: unknown;
}

function bounded(value: unknown, fallback: string, max = 600): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : fallback;
}

function parseReferenceDataUrl(dataUrl: unknown): { dataUrl: string; buffer: Buffer; fingerprint: string } {
  if (typeof dataUrl !== "string") throw new Error("Reference image is required");
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || !ALLOWED_MIME_TYPES.has(match[1])) throw new Error("Reference must be a JPEG, PNG, or WebP image");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length < 128 || buffer.length > MAX_REFERENCE_BYTES) throw new Error("Reference image must be between 128 bytes and 2.5 MB");
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp = buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if ((match[1] === "image/jpeg" && !isJpeg) || (match[1] === "image/png" && !isPng) || (match[1] === "image/webp" && !isWebp)) {
    throw new Error("Reference image content does not match its file type");
  }
  return { dataUrl, buffer, fingerprint: createHash("sha256").update(buffer).digest("hex").slice(0, 16) };
}

function keywords(value: unknown, title: string): string[] {
  const candidates = Array.isArray(value) ? value : [];
  const words = [...candidates, ...title.split(/\s+/), "commercial", "advertising", "creative", "photography", "design", "campaign", "marketing", "editorial", "concept", "copyspace", "premium", "modern", "visual", "stock", "jpeg"]
    .flatMap((entry) => typeof entry === "string" ? entry.toLowerCase().split(/[^a-z0-9]+/) : [])
    .filter((word) => word.length >= 2 && word.length <= 30 && !/^\d+$/.test(word));
  return [...new Set(words)].slice(0, 25);
}

function safeFilename(title: string, id: number): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 54) || `sale_reference_${id}`;
  return `stock_sale_reference_${String(id).padStart(2, "0")}_${slug}.jpeg`;
}

function parseModelJson(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string") throw new Error("Image analysis returned no content");
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed: unknown = JSON.parse(match?.[0] || raw);
  if (!isRecord(parsed)) throw new Error("Image analysis returned invalid JSON");
  return parsed;
}

export async function analyzeSoldReference(dataUrlInput: unknown, apiKey?: string): Promise<SaleReferencePlan> {
  const reference = parseReferenceDataUrl(dataUrlInput);
  const key = apiKey || process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not configured");

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://adobe-stock.vercel.app",
      "X-Title": "Adobe Stock Sold Reference Analyzer",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.REFERENCE_ANALYSIS_MODEL || "google/gemini-3.1-flash-lite",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: `Analyze the underlying stock image in this user-supplied sales-notification screenshot. Ignore email UI, marketplace UI, text, logos, watermarks, overlays and borders; none may be reproduced. One sale proves only that this exact asset found at least one buyer, not broad demand or keyword volume.

Plan exactly 10 NEW commercial JPEG concepts inspired by the buyer-use signal, not copies or near-duplicates. Preserve only the useful subject category or buyer problem. Each concept must differ materially in story, buyer/use, setting, camera/composition, lighting and palette. Do not use trivial color swaps. Do not recreate the source composition, distinctive arrangement, branded elements or protected characters. Every concept must be understandable in two seconds and explain why a buyer would license it. No visible human faces, text, letters, numerals, logos, labels, signatures, watermarks, interface elements, frames or borders. ${NO_VISIBLE_FACE_RULE}

Return pure JSON with this schema:
{"subject":"literal source subject","visualStrengths":"why the sold image may have been useful","likelyBuyerUses":["use"],"expansionStrategy":"how the 10 concepts expand without copying","concepts":[{"title":"SEO title without brands","category":"stock category","aspectRatio":"16:9|3:2|4:5|1:1","newConcept":"clear distinct concept","targetBuyer":"specific buyer","intendedUse":"specific design use","purchaseReason":"practical licensing reason without sales guarantee","subjectTreatment":"literal subject and action","compositionAndCamera":"camera and layout","settingAndProps":"physical setting and minimal props","lightingAndMood":"lighting","colorPalette":"colors","keywords":["15 to 25 single English words"]}]}` },
          { type: "image_url", image_url: { url: reference.dataUrl } },
        ],
      }],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 7_000,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Image analysis provider returned ${response.status}`);
  const payload = await response.json();
  const parsed = parseModelJson(payload?.choices?.[0]?.message?.content);
  if (!Array.isArray(parsed.concepts) || parsed.concepts.length !== 10) throw new Error("Image analysis must return exactly 10 concepts");

  const subject = bounded(parsed.subject, "commercial stock subject", 180);
  const seen = new Set<string>();
  const items = parsed.concepts.map((value, index): StockImageItem => {
    if (!isRecord(value)) throw new Error(`Concept ${index + 1} is invalid`);
    const concept = value as RawConcept;
    const title = bounded(concept.title, `${subject} commercial concept ${index + 1}`, 160);
    const newConcept = bounded(concept.newConcept, `A distinct commercial interpretation of ${subject}`, 500);
    const uniquenessKey = `${title} ${newConcept}`.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(uniquenessKey)) throw new Error("Image analysis returned duplicate concepts");
    seen.add(uniquenessKey);
    const targetBuyer = bounded(concept.targetBuyer, "commercial designers", 240);
    const intendedUse = bounded(concept.intendedUse, "advertising and editorial layouts", 300);
    const purchaseReason = bounded(concept.purchaseReason, "Clear subject, practical layout flexibility, and a distinct campaign story", 400);
    const structure: SaleReferenceStructure = {
      REFERENCE_SUBJECT: subject,
      OBSERVED_SALE_SIGNAL: "The uploaded asset received at least one confirmed sale; this is a single-asset signal, not proof of market-wide demand.",
      NEW_CONCEPT: newConcept,
      TARGET_BUYER_AND_USE: `${targetBuyer}; ${intendedUse}`,
      SUBJECT_TREATMENT: bounded(concept.subjectTreatment, subject),
      COMPOSITION_AND_CAMERA: bounded(concept.compositionAndCamera, "Commercial eye-level composition with useful natural copy space"),
      SETTING_AND_PROPS: bounded(concept.settingAndProps, "A coherent physical setting with only relevant unbranded props"),
      LIGHTING_AND_MOOD: bounded(concept.lightingAndMood, "Natural premium commercial lighting"),
      COLOR_PALETTE: bounded(concept.colorPalette, "Balanced contemporary commercial palette"),
      TEXT_ELEMENTS: "No text",
    };
    const prompt = `[SOLD-REFERENCE EXPANSION — CREATE A NEW WORK, DO NOT COPY THE UPLOADED IMAGE]\n${Object.entries(structure).map(([key, field]) => `${key}: ${field}`).join("\n")}\nCreate one original, immediately readable, full-bleed commercial JPEG. Preserve the named buyer problem, but use the NEW_CONCEPT, composition, setting, light and palette as a genuinely different work. No source screenshot UI or source layout. No text, letters, numerals, pseudo-text, logos, brands, watermarks, labels, borders, frames or visible human faces.`;
    const itemKeywords = keywords(concept.keywords, title);
    if (itemKeywords.length < 15) throw new Error(`Concept ${index + 1} has insufficient keywords`);
    return {
      id: index + 1,
      seoTitle: title,
      category: bounded(concept.category, "Commercial concepts", 100),
      aspectRatio: typeof concept.aspectRatio === "string" && ASPECT_RATIOS.has(concept.aspectRatio) ? concept.aspectRatio as StockImageItem["aspectRatio"] : "3:2",
      composition: "advertising",
      prompt,
      negativePrompt: "text, letters, numerals, logo, watermark, label, signature, visible face, portrait, border, frame, screenshot, interface, copied composition",
      keywords: itemKeywords,
      modelUsed: process.env.IMAGE_GENERATION_MODEL || "google/gemini-3.1-flash-lite-image",
      filename: safeFilename(title, index + 1),
      isTransparent: false,
      generationMode: "regular_scene",
      conceptMode: "existing",
      commercialIntent: { targetBuyer, intendedUse, purchaseReason },
      planningSource: "ai",
      generationBriefVersion: GENERATION_BRIEF_VERSION,
      saleReferenceStructure: structure,
    };
  });

  const likelyBuyerUses = Array.isArray(parsed.likelyBuyerUses)
    ? parsed.likelyBuyerUses.filter((value): value is string => typeof value === "string").map(value => value.slice(0, 200)).slice(0, 6)
    : [];
  const analysis: SoldReferenceAnalysis = {
    subject,
    visualStrengths: bounded(parsed.visualStrengths, "Clear commercial subject and practical visual communication", 700),
    likelyBuyerUses,
    expansionStrategy: bounded(parsed.expansionStrategy, "Expand the validated subject signal into ten distinct buyer-led visual stories without copying the source", 700),
    sourceFingerprint: reference.fingerprint,
  };
  return {
    analysis,
    trend: {
      theme: `ต่อยอดจากภาพขายได้: ${subject}`,
      targetMarket: likelyBuyerUses.join(", ") || "Commercial designers and content teams",
      commercialReasoning: `${analysis.visualStrengths} สร้างใหม่เป็น 10 แนวคิดที่เปลี่ยนผู้ซื้อ การใช้งาน ฉาก มุมกล้อง แสง และโทนสี โดยไม่คัดลอกภาพต้นฉบับ`,
      seasonalRelevance: "Based on a confirmed sale of the uploaded asset; not a market-wide demand claim.",
      buyerDemandRating: "Research Candidate",
    },
    items,
  };
}

export const saleReferenceLimits = { maxBytes: MAX_REFERENCE_BYTES };
