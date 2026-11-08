import { createHash } from "node:crypto";
import { isRecord } from "./errors";
import { GENERATION_BRIEF_VERSION, NO_VISIBLE_FACE_RULE } from "./generation-policy";
import { DEFAULT_VECTOR_MODEL } from "./vector-generator";
import type { MarketTrend, SaleReferenceLayout, SaleReferenceStructure, StockImageItem } from "./types";

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
  /** "isolated_white" for a cutout element and "solid_backdrop" for a subject on a plain colour backdrop, so the expansion keeps the layout that sold. */
  layout: SaleReferenceLayout;
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
  backdropColor?: unknown;
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

/** Used when the analyzer omits or repeats a backdrop colour, so the ten images still differ. */
export const FALLBACK_BACKDROP_COLORS = ["pastel pink", "pale mint green", "baby blue", "soft lavender", "soft peach", "butter yellow", "powder blue", "sage green", "warm coral", "light lilac"];
const ANALYZER_LAYOUT: Record<SaleReferenceLayout, string> = { full_scene: "full_scene", isolated_white: "isolated_cutout", solid_backdrop: "solid_backdrop" };

const ISOLATED_KEYWORDS = ["isolated", "white", "background", "cutout", "element"];
const VECTOR_KEYWORDS = ["vector", "illustration", "flat"];

function keywords(value: unknown, title: string, isolated = false, vector = false): string[] {
  const candidates = Array.isArray(value) ? value : [];
  const words = [...(vector ? VECTOR_KEYWORDS : []), ...(isolated ? ISOLATED_KEYWORDS : []), ...candidates, ...title.split(/\s+/), "commercial", "advertising", "creative", vector ? "graphic" : "photography", "design", "campaign", "marketing", "editorial", "concept", "copyspace", "premium", "modern", "visual", "stock", vector ? "clipart" : "jpeg"]
    .flatMap((entry) => typeof entry === "string" ? entry.toLowerCase().split(/[^a-z0-9]+/) : [])
    .filter((word) => word.length >= 2 && word.length <= 30 && !/^\d+$/.test(word) && !(isolated && word === "copyspace"));
  return [...new Set(words)].slice(0, 25);
}

function safeFilename(title: string, id: number, vector = false): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 54) || `sale_reference_${id}`;
  return `stock_sale_reference_${vector ? "vector_" : ""}${String(id).padStart(2, "0")}_${slug}.${vector ? "svg" : "jpeg"}`;
}

export interface SoldReferenceOptions {
  /** Plan flat vector illustrations generated as SVG instead of photographic JPEGs. */
  vector?: boolean;
}

function parseModelJson(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string") throw new Error("Image analysis returned no content");
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed: unknown = JSON.parse(match?.[0] || raw);
  if (!isRecord(parsed)) throw new Error("Image analysis returned invalid JSON");
  return parsed;
}

export async function analyzeSoldReference(dataUrlInput: unknown, apiKey?: string, forcedLayout?: SaleReferenceLayout, options: SoldReferenceOptions = {}): Promise<SaleReferencePlan> {
  const vector = options.vector === true;
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

Plan exactly 10 NEW commercial ${vector ? "vector illustration" : "JPEG"} concepts inspired by the buyer-use signal, not copies or near-duplicates. Preserve only the useful subject category or buyer problem. Each concept must differ materially in story, buyer/use, setting, camera/composition, lighting and palette. Do not use trivial color swaps. Do not recreate the source composition, distinctive arrangement, branded elements or protected characters. Every concept must be understandable in two seconds and explain why a buyer would license it. No visible human faces, text, letters, numerals, logos, labels, signatures, watermarks, interface elements, frames or borders. Never ask for binary code, 0s and 1s, digits, program code, hex or matrix rain, dashboards, charts with labels, or screens, monitors or holograms showing content, because every such image is rejected as text; show data, networks and security as plain light trails, glowing cables, light pulses, blank glowing panels or physical hardware instead. ${NO_VISIBLE_FACE_RULE}${vector ? `
The sold asset is a VECTOR illustration and all 10 concepts will be rendered as flat vector illustrations (SVG): clean closed shapes, solid flat colour fills, smooth curves and simple shading, no photographic texture, camera blur or realistic lighting. Choose subjects that read clearly as vector clip art for the same buyers and season: new characters, objects or motifs, or the same kind of subject in a genuinely different pose, action, outfit and palette, never the source character with small changes. Write compositionAndCamera as the illustration's viewpoint and framing, and lightingAndMood as the flat-colour style and mood.` : ""}

First decide referenceLayout. Use "isolated_cutout" only when the sold asset is a single isolated element or group (object, plant, rock, landscape piece, etc.) truly cut out on a flat white or transparent background, with no visible surface, horizon, directional light pattern or cast shadow; buyers license such assets to composite into their own designs, renderings and mockups. A studio still life standing on a white tabletop or backdrop, with cast shadows, light falloff or reserved copy space, is "full_scene" even when the background is mostly white. Use "solid_backdrop" when the subject is photographed against a seamless plain coloured (not white) studio backdrop, such as a pastel paper sweep, with no room, furniture or location; buyers license these for ads, banners and social posts because the flat colour leaves clean copy space. Otherwise use "full_scene".${forcedLayout ? ` The owner has confirmed the correct value is "${ANALYZER_LAYOUT[forcedLayout]}"; use it.` : ""}
If referenceLayout is "isolated_cutout", ALL 10 concepts must also be complete isolated, composite-ready elements in the same buyer category (new subjects or materially different arrangements, not copies), each fully visible and centered on a seamless pure white (#FFFFFF) background with even padding on all sides, no ground plane, no horizon, no scenery, no copy space, and at most a faint soft contact shadow directly beneath. In that case compositionAndCamera must describe the viewing angle of the isolated element and settingAndProps must say "Seamless pure white background only".
If referenceLayout is "solid_backdrop", ALL 10 concepts must keep a seamless plain studio backdrop with no room, furniture, window or location, and vary the subject, action, props and camera instead. Give each concept a different backdropColor (a single named colour such as "pastel pink" or "sage green", never white), place the subject off-center and leave a wide area of plain backdrop as copy space; settingAndProps lists only the few props touching the subject. The main subject must be whole and fully inside the frame, never cropped to paws, legs, a tail or another detail; an animal faces or looks toward the camera with its face clearly visible, and any human hands enter from the frame edge while the subject stays the hero.

Return pure JSON with this schema:
{"referenceLayout":"isolated_cutout|solid_backdrop|full_scene","subject":"literal source subject","visualStrengths":"why the sold image may have been useful","likelyBuyerUses":["use"],"expansionStrategy":"how the 10 concepts expand without copying","concepts":[{"title":"SEO title without brands","category":"stock category","aspectRatio":"16:9|3:2|4:5|1:1","newConcept":"clear distinct concept","targetBuyer":"specific buyer","intendedUse":"specific design use","purchaseReason":"practical licensing reason without sales guarantee","subjectTreatment":"literal subject and action","compositionAndCamera":"camera and layout","settingAndProps":"physical setting and minimal props","lightingAndMood":"lighting","colorPalette":"colors","backdropColor":"solid_backdrop only: one named colour","keywords":["15 to 25 single English words"]}]}` },
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
  const layout: SaleReferenceLayout = forcedLayout
    ?? (parsed.referenceLayout === "isolated_cutout" ? "isolated_white" : parsed.referenceLayout === "solid_backdrop" ? "solid_backdrop" : "full_scene");
  const isolated = layout === "isolated_white";
  const backdrop = layout === "solid_backdrop";
  const seen = new Set<string>();
  const usedBackdrops = new Set<string>();
  const pickBackdrop = (value: unknown): string => {
    const named = bounded(value, "", 40).toLowerCase().replace(/[^a-z ]+/g, "").trim();
    const choice = named && !/\bwhite\b/.test(named) && !usedBackdrops.has(named)
      ? named
      : FALLBACK_BACKDROP_COLORS.find(color => !usedBackdrops.has(color)) ?? "pastel pink";
    usedBackdrops.add(choice);
    return choice;
  };
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
    const backdropColor = backdrop ? pickBackdrop(concept.backdropColor) : "";
    const structure: SaleReferenceStructure = {
      REFERENCE_SUBJECT: subject,
      OBSERVED_SALE_SIGNAL: "The uploaded asset received at least one confirmed sale; this is a single-asset signal, not proof of market-wide demand.",
      NEW_CONCEPT: newConcept,
      TARGET_BUYER_AND_USE: `${targetBuyer}; ${intendedUse}`,
      SUBJECT_TREATMENT: bounded(concept.subjectTreatment, subject),
      COMPOSITION_AND_CAMERA: backdrop
        ? `${bounded(concept.compositionAndCamera, "Eye-level studio shot", 400)}; subject placed off-center, leaving a wide plain ${backdropColor} area as copy space`
        : bounded(concept.compositionAndCamera, isolated ? "Complete element centered at a slightly elevated three-quarter view with even white padding" : "Commercial eye-level composition with useful natural copy space"),
      SETTING_AND_PROPS: isolated
        ? "Seamless pure white background only"
        : backdrop
        ? `Seamless solid ${backdropColor} studio backdrop and matching floor sweep, no room, furniture or window; props: ${bounded(concept.settingAndProps, "only the items the subject touches", 300)}`
        : bounded(concept.settingAndProps, "A coherent physical setting with only relevant unbranded props"),
      LIGHTING_AND_MOOD: bounded(concept.lightingAndMood, "Natural premium commercial lighting"),
      COLOR_PALETTE: bounded(concept.colorPalette, "Balanced contemporary commercial palette"),
      TEXT_ELEMENTS: "No text",
    };
    const prompt = `[SOLD-REFERENCE EXPANSION — CREATE A NEW WORK, DO NOT COPY THE UPLOADED IMAGE]\n${Object.entries(structure).map(([key, field]) => `${key}: ${field}`).join("\n")}\n${vector
      ? `Create one original flat vector illustration with clean closed shapes, solid flat colour fills, smooth curves and simple flat shading, no photographic texture, gradient mesh or realistic lighting. ${isolated
        ? "Show the complete element centered on a plain pure white background with even padding, floating with no ground, floor ellipse, cast shadow or scenery beneath or around it."
        : backdrop
        ? `Fill the whole frame with a plain flat ${backdropColor} background, the main subject whole and off-center with a wide empty area as copy space; an animal faces the viewer with its face clearly visible.`
        : "Fill the whole frame edge to edge with one simple illustrated scene."}`
      : isolated
      ? "Create one original, immediately readable isolated element photographed on a seamless pure white (#FFFFFF) background for compositing: the complete element fully inside the frame with even white padding, no ground plane, horizon or scenery, and at most a faint soft contact shadow directly beneath."
      : backdrop
      ? `Create one original, immediately readable, full-bleed commercial studio JPEG on a seamless plain ${backdropColor} backdrop that fills the whole frame edge to edge, with soft even light and generous empty backdrop for copy space. Show the main subject whole and fully inside the frame, not cropped to paws, legs or a detail; if it is an animal, it faces the camera with its face clearly visible, and human hands, if any, enter only from the frame edge.`
      : "Create one original, immediately readable, full-bleed commercial JPEG."} Preserve the named buyer problem, but use the NEW_CONCEPT, composition, setting, light and palette as a genuinely different work. No source screenshot UI or source layout. No text, letters, numerals, pseudo-text, logos, brands, watermarks, labels, borders, frames or visible human faces.`;
    const itemKeywords = keywords(concept.keywords, title, isolated, vector);
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
      modelUsed: vector ? process.env.VECTOR_IMAGE_MODEL || DEFAULT_VECTOR_MODEL : process.env.IMAGE_GENERATION_MODEL || "google/gemini-3.1-flash-lite-image",
      filename: safeFilename(title, index + 1, vector),
      isTransparent: false,
      generationMode: "regular_scene",
      conceptMode: "existing",
      commercialIntent: { targetBuyer, intendedUse, purchaseReason },
      planningSource: "ai",
      generationBriefVersion: GENERATION_BRIEF_VERSION,
      saleReferenceStructure: structure,
      ...(isolated || backdrop ? { saleReferenceLayout: layout } : {}),
      ...(vector ? { outputFormat: "svg" as const } : {}),
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
    layout,
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
