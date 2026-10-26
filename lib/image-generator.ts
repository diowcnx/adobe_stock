import sharp from "sharp";
import { ImageQualityReview, StockImageItem } from "./types";
import { getErrorMessage } from "./errors";
import { fetchAllowlistedImage, validateRemoteImageUrl } from "./remote-image";
import { assessGeneratedImageQuality } from "./image-quality";
import { AERIAL_NO_VISIBLE_FACE_RULE, getGenerationBlockReason, NO_VISIBLE_FACE_RULE } from "./generation-policy";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

interface OpenRouterImageResponse {
  choices?: Array<{
    message?: {
      images?: Array<{ image_url?: { url?: string }; url?: string; b64_json?: string }>;
      content?: string | Array<{
        type?: string;
        image_url?: { url?: string };
        b64_json?: string;
      }>;
      parts?: Array<{ inline_data?: { data?: string } }>;
    };
  }>;
}

// โมเดลสร้างภาพที่เปิดให้บริการจริงและเสถียรที่สุดบน OpenRouter
export const MODEL_GEMINI_IMAGE = "google/gemini-3.1-flash-lite-image";

export const DEFAULT_IMAGE_MODEL = MODEL_GEMINI_IMAGE;
export const MODEL_TRANSPARENT_PRIMARY = MODEL_GEMINI_IMAGE;
export const MAX_QUALITY_RETRIES = 3;

interface GeneratedImageResult {
  imageUrl: string;
  error?: string;
  qualityReview?: ImageQualityReview;
}

function compactQualityIssue(issues: string[]): string {
  const issue = issues.join("; ").replace(/\s+/g, " ").trim();
  return (issue || "The image did not satisfy the no-text, full-bleed quality rules").slice(0, 500);
}

export function buildQualityRetryDirection(attempt: number, issues: string[]): string {
  const rejectedFor = compactQualityIssue(issues);
  const variation = [
    "Re-stage the real scene around one unmistakable person-or-product action and move the focal subject to a new position.",
    "Use a different camera angle, crop, lighting direction and authentic setting while keeping the action literal and obvious.",
    "Replace the scene with the simplest believable real-world moment that communicates the same buyer need without symbols.",
  ][Math.min(Math.max(attempt - 1, 0), 2)];

  return `QUALITY REPLACEMENT ${attempt}/${MAX_QUALITY_RETRIES}: The previous rendering was rejected because: ${rejectedFor}. Do not reproduce or merely retouch the rejected composition. ${variation} Replace symbolic or abstract storytelling with one literal real-world subject performing one familiar action in an identifiable setting. A viewer must understand who or what is shown, what is happening, and why a buyer would use the image within two seconds. Remove every rejected defect. Keep the physical scene full-bleed to all four edges, with no frame, border, mat, card, poster, header, footer, sign-like alignment, typography, symbols, pseudo-text, watermark, or logo. Generate a genuinely new alternative while preserving only the commercial subject and buyer use.`;
}

export function buildTransparentQualityRetryDirection(attempt: number, issues: string[]): string {
  const rejectedFor = compactQualityIssue(issues);
  return `QUALITY REPLACEMENT ${attempt}/${MAX_QUALITY_RETRIES}: The previous PNG was rejected because: ${rejectedFor}. Generate a completely new, simpler version of the named subject. Show exactly one familiar solid opaque object, recognizable within two seconds, in a straightforward product view on uniform pure white. Use broad solid shapes, very few parts, minimal internal openings, clean continuous edges and generous padding. Do not add a hand, prop, cluster, assemblage, metaphor, decoration, translucent material, fine strand, shadow or background. The subject itself must visibly explain its practical function.`;
}

function sanitizeImagePrompt(prompt: string): string {
  return prompt
    .replace(/adobe\s+stock/gi, "commercial image marketplace")
    .replace(/\bstock\s+(photograph|photo|image)\b/gi, "commercial advertising $1")
    .trim();
}

/**
 * แปลง Aspect Ratio ให้ตรงกับข้อกำหนด
 */
function getAspectRatioForModel(ratio: string): string {
  switch (ratio) {
    case "16:9":
      return "16:9";
    case "3:2":
      return "3:2";
    case "4:5":
      return "4:5";
    case "1:1":
    default:
      return "1:1";
  }
}

/**
 * ฟังก์ชันรับประกันความโปร่งใสจริง (Guaranteed True Alpha PNG Transparency)
 * ตรวจสอบพิกเซลจริง และลบเฉพาะพื้นหลังสีขาว/เทาอ่อนที่เชื่อมต่อกับขอบภาพ
 * ให้กลายเป็นช่อง Alpha = 0 สำหรับ Adobe Stock Cutout PNG
 */
export async function ensureGenuineAlphaTransparency(inputBuffer: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(inputBuffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();

    // 1. ตรวจสอบว่ามี Alpha Channel อยู่แล้ว และมีพิกเซลโปร่งใสจริงหรือไม่
    if (meta.hasAlpha) {
      const { data } = await sharp(inputBuffer, { limitInputPixels: MAX_INPUT_PIXELS }).raw().toBuffer({ resolveWithObject: true });
      let transparentPixels = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 25) transparentPixels++;
      }
      // ถ้ามีพิกเซลโปร่งใสมากกว่า 5% ของภาพ แสดงว่าเป็นภาพโปร่งใสแท้จริงแล้ว
      if (transparentPixels > ((meta.width || 1024) * (meta.height || 1024) * 0.05)) {
        return await sharp(inputBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
          .png({ compressionLevel: 9, adaptiveFiltering: true })
          .toBuffer();
      }
    }

    // 2. หากไม่มี Alpha หรือยังเป็นภาพพื้นขาว ให้ flood-fill จากขอบภาพเท่านั้น
    // ห้ามลบพิกเซลสีอ่อนที่ถูกล้อมอยู่ภายในวัตถุ เพราะอาจเป็นส่วนจริงของสินค้า
    const { data, info } = await sharp(inputBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height } = info;
    const totalPixels = width * height;
    const visited = new Uint8Array(totalPixels);
    const queue: number[] = [];

    // ตรวจสอบว่าพิกเซลนั้นเป็นพื้นหลัง (สีขาว หรือ สีเทาอ่อนของตารางหมากรุก) หรือไม่
    function isBackgroundPixel(idx: number): boolean {
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const diff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
      const brightness = (r + g + b) / 3;
      return brightness > 215 && diff < 20;
    }

    // เริ่มต้นจากขอบภาพ 4 ด้าน
    for (let x = 0; x < width; x++) {
      const top = x * 4;
      if (isBackgroundPixel(top)) {
        visited[x] = 1;
        queue.push(x);
      }
      const btm = ((height - 1) * width + x) * 4;
      if (isBackgroundPixel(btm)) {
        visited[(height - 1) * width + x] = 1;
        queue.push((height - 1) * width + x);
      }
    }
    for (let y = 0; y < height; y++) {
      const l = (y * width) * 4;
      if (isBackgroundPixel(l)) {
        visited[y * width] = 1;
        queue.push(y * width);
      }
      const r = (y * width + width - 1) * 4;
      if (isBackgroundPixel(r)) {
        visited[y * width + width - 1] = 1;
        queue.push(y * width + width - 1);
      }
    }

    // BFS Flood Fill ลบพื้นหลังรอบนอกทั้งหมดให้โปร่งใส 100%
    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];
      const cx = curr % width;
      const cy = Math.floor(curr / width);
      data[curr * 4 + 3] = 0; // ตั้งค่า Alpha = 0

      const neighbors = [curr - 1, curr + 1, curr - width, curr + width];
      for (const n of neighbors) {
        if (n >= 0 && n < totalPixels && !visited[n]) {
          const nx = n % width;
          const ny = Math.floor(n / width);
          if (Math.abs(nx - cx) <= 1 && Math.abs(ny - cy) <= 1) {
            if (isBackgroundPixel(n * 4)) {
              visited[n] = 1;
              queue.push(n);
            }
          }
        }
      }
    }

    return await sharp(data, { raw: { width, height, channels: 4 } })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
  } catch (err) {
    console.error("Error ensuring alpha transparency with sharp:", err);
    return inputBuffer;
  }
}

/**
 * เรียก OpenRouter สร้างภาพสมจริง (ตรงไปที่ chat/completions โดยไม่เสียเวลาลอง endpoint ที่ไม่รองรับ)
 */
export async function generateSingleImage(
  item: StockImageItem,
  apiKey?: string
): Promise<GeneratedImageResult> {
  const blocked = getGenerationBlockReason(item);
  if (blocked) return { imageUrl: "", error: blocked };
  const key = apiKey || process.env.OPENROUTER_API_KEY;

  if (!key) {
    const errorMsg = "OPENROUTER_API_KEY is missing in environment variables.";
    console.error(`[Item #${item.id}] ${errorMsg}`);
    return {
      imageUrl: "",
      error: errorMsg,
    };
  }

  const isTransparent = item.generationMode
    ? item.generationMode === "transparent_png"
    : item.isTransparent === true;

  let lastError = "";
  const rejectionReasons: string[] = [];
  const model = DEFAULT_IMAGE_MODEL;

  // Only an explicit QA rejection triggers another billed image request. A
  // timeout/provider error can still have been billed, so it is never retried.
  for (let attemptIndex = 0; attemptIndex <= MAX_QUALITY_RETRIES; attemptIndex++) {
    try {
      const attemptNumber = attemptIndex + 1;
      console.log(`[Item #${item.id}] Calling OpenRouter model ${model} (mode: ${isTransparent ? "transparent_png" : "regular_scene"}, attempt: ${attemptNumber})...`);

      const basePrompt = sanitizeImagePrompt(item.prompt);
      const sanitizedPrompt = isTransparent
        ? basePrompt
            .replace(/isolated commercial cutout asset on a 100% transparent background \(png alpha channel\) of/gi, "Commercial studio product shot of floating")
            .replace(/on a 100% transparent background \(png alpha channel\)/gi, "completely floating, clean backdrop")
            .replace(/transparent background/gi, "pure solid white backdrop")
            .replace(/png alpha transparency/gi, "clean silhouette edges")
            .replace(/\b(soft realistic self-shadow only|self-shadow|with shadow|soft shadow|subtle shadow|drop shadow|contact shadow|ground shadow|floor shadow|cast shadow|shadows?)\b/gi, "zero shadows")
        : basePrompt;

      const mandatoryExclusions = [
        item.saleReferenceStructure
          ? "Render the NEW_CONCEPT as an original full-bleed commercial JPEG for the named target buyer and use. The uploaded sold image is evidence for a subject opportunity only: do not reproduce its composition, crop, distinctive arrangement, screenshot interface, watermark, text or branded details. Preserve literal clarity and use only the specified new subject treatment, camera, setting, props, light and palette. No people with visible faces, lettering, pseudo-text, logos, labels, frames or borders."
        : item.thaiNaturePosterStructure
          ? "Render one full-bleed hand-painted poster-color landscape of Thai nature and flower fields from a gently elevated scenic viewpoint. Preserve the named Thai flower species, terrain bands, winding route, single grounded landmark, vintage paper grain, palette, season and light. No top-down plan, map, masterplan, site plan, diagram, satellite view, poster page, border, text, pseudo-text, flags, temples, costumes, large people, portraits or visible faces."
        : item.symmetricalStorefrontStructure
          ? "Render one complete standalone small storefront in a centered straight-on eye-level architectural photograph. Preserve the named façade, doors, windows, visible business interior, balanced props, flanking elements, background horizon, sky, foreground pavement, pastel palette and daylight. No second shop, neighboring storefront row, people, hands, faces, signage, menus, labels, lettering, pseudo-text, dollhouse, illustration, poster or cropped building."
        : item.editorialPenSketchStructure
          ? "Render one full-bleed editorial colored-pen sketch on continuous drawing paper. Keep the named main subject complete, dominant and immediately recognizable inside its specified practical location, with only the requested scene elements. Use controlled directional hatching and cross-hatching with visible paper between strokes. No people, hands, portraits, photorealism, paint wash, abstract symbolism, labels, handwriting, lettering or visible paper edge."
        : item.aerialLandscapeStructure
          ? "Render one full-bleed painterly aerial landscape from a high bird's-eye view: broad connected terrain ribbons, the specified winding path with only tiny faceless overhead scale cues, and one physically grounded focal landmark with a coherent directional shadow. Preserve the named gouache, chalk-pastel and stippled texture. No map, masterplan, satellite view, diagram, legend, compass, pin, icon, labels, lettering, large people, portraits or visible faces."
        : item.culinaryEditorialStructure
          ? "Render the specified complete hero dish in the foreground with exactly one utensil-held bite above it and only the named raw accompaniments at lower right. Preserve the physical dimensional backdrop and blank natural copy zones. No chef, people, hands, packages, labels or rendered text; continuous full-bleed physical set."
        : item.beverageCampaignStructure
          ? `Render only the finished drinks named by DRINK_COUNT_AND_SELECTION, using the exact COMPOSITION_AND_CAMERA and STAGING_SURFACE. Preserve the named vessels, recipes and matching ingredient props. Never default to a centered three-glass pyramid. No extra or missing drink, people, hands, labels or lettering; continuous full-bleed physical background.`
        : item.dualMaterialStructure
          ? "Render exactly the specified recognizable sculpture made from the named primary and secondary materials, joined as one intact subject. No extra construction materials, props, people or lettering; continuous studio background and specified shadows."
        : item.materialArtStructure
          ? "Render the specified single Editorial Still Life arrangement: a clear hero product or material-built artwork with restrained conceptual staging. Use only named objects/materials and minimal requested background detail; photographic surfaces and natural contact shadows. No people or rendered text."
        : item.boothStructure
          ? "Render only the complete exhibition booth and specified merchandise. Strict frontal orthographic view on continuous pure white studio background. Preserve the canopy, platform, shelves, access and blank signage. No people, lettering or surrounding event hall."
          : "Use only the single food-hardware hybrid described in the brief; no people, scenery or extra cultural props.",
        item.aerialLandscapeStructure || item.thaiNaturePosterStructure ? AERIAL_NO_VISIBLE_FACE_RULE : NO_VISIBLE_FACE_RULE,
        "The final pixels must contain no letters, words, typography, captions, signatures, watermarks, repeated watermark patterns, logos, trademarks, interface elements, or attribution marks.",
        "Do not imitate a marketplace preview, proof image, contact sheet, or licensed-media overlay.",
        isTransparent
          ? "Render exactly one immediately recognizable, solid opaque subject on uniform pure white for alpha extraction. It must have a broad simple silhouette and no collage, assemblage, bundle, visual metaphor, extra prop, hand holding it, transparent or translucent area, glass, liquid, smoke, mesh, lace, loose fiber, thin wire, detached fragment, environment, floor, wall, horizon, frame, border, poster, card, mockup, cast shadow, contact shadow or cropped edge."
          : "The scene or physical background must extend fully to all four image edges. No outer border, mat, frame, canvas margin, poster, card, blank header, blank footer, title panel, inset image, mockup, or page-within-the-image.",
        isTransparent
          ? "Do not create advertising copy space or a layout; preserve clear padding around the isolated asset."
          : "Any copy space must remain a natural uninterrupted part of the photographed physical background inside the full-bleed scene; never turn copy space into a white rectangle or graphic panel.",
        item.negativePrompt ? `Also exclude: ${item.negativePrompt}.` : "",
      ].filter(Boolean).join(" ");

      const absoluteTextBan = "ABSOLUTE NO-TEXT OUTPUT RULE — THE FINAL IMAGE MUST CONTAIN ZERO TEXT. Do not draw, print, engrave, emboss, stitch, label, sign, caption or imply any letter, word, numeral, glyph, pseudo-letter, logo, watermark or typographic mark on any object, surface or background. Use plain unmarked surfaces only. This rule overrides every field name, metadata value, product detail and stylistic instruction below.";

      const visualDirection = isTransparent
        ? `Create a simple isolated commercial design element on a pure solid white studio background. Show exactly one familiar opaque subject that a buyer can identify at a glance. Centered floating subject, broad continuous silhouette, minimal internal gaps, razor-sharp clean cutout edges, absolutely zero cast shadows, zero drop shadow, zero contact shadow, zero ground shadow, zero floor shadow, zero ambient shadow, uniform bright omnidirectional studio lighting with high-key illumination from all angles, authentic solid physical material, no floor, no table, no surface, no shadows, no dark gradient, no checkerboard grid. Subject: ${sanitizedPrompt}. Clarity and practical reuse are more important than conceptual cleverness. ${mandatoryExclusions}`
        : item.saleReferenceStructure
          ? `Create one original buyer-ready commercial photograph derived from a confirmed single-asset sale signal without copying the reference image. Make the NEW_CONCEPT and TARGET_BUYER_AND_USE immediately understandable, with a genuinely different story, composition, camera, setting, lighting and palette from the uploaded source. Honor the ten-field SOLD-REFERENCE structure: ${sanitizedPrompt}. ${mandatoryExclusions}`
        : item.thaiNaturePosterStructure
          ? `Create one original full-bleed hand-painted poster-color illustration of a real Thai natural landscape and flower field. Use a gently elevated panoramic scenic view with natural overlapping hills, meadow, water and flower bands, not a top-down map. Make the specified flower species, Thai geography, season, winding path, landmark, vintage paper fibers and matte opaque brushwork immediately readable. Honor the eight-field USER_INPUT while treating TYPOGRAPHY_OVERLAY only as a strict non-visual no-text control: ${sanitizedPrompt}. ${mandatoryExclusions}`
        : item.symmetricalStorefrontStructure
          ? `Create one original high-end architectural editorial photograph of a single standalone minimal storefront. Use a strict centered straight-on eye-level camera, disciplined bilateral symmetry, realistic building scale, crisp pastel production design and bright clean daylight. The complete building, named business interior and foreground pavement must be immediately understandable and fill a continuous full-bleed exterior scene. Do not copy any named director, film, franchise or real shop. Honor the eight-field USER_INPUT: ${sanitizedPrompt}. ${mandatoryExclusions}`
        : item.editorialPenSketchStructure
          ? `Create one original full-bleed editorial colored-pen illustration, not a photograph, watercolor painting, poster or technical diagram. Make the named main subject and its practical purpose understandable within two seconds, preserve the specified location and supporting scene elements, and use coherent perspective, colored ink linework, directional hatching and visible paper tooth. Honor only the nine supplied visual fields; the omitted control requires a completely text-free image: ${sanitizedPrompt}. ${mandatoryExclusions}`
        : item.aerialLandscapeStructure
          ? `Create one original painterly aerial landscape illustration, not a map or architectural plan. Use a high bird's-eye viewpoint bordering on top-down, broad connected terrain ribbons, one winding route, tiny featureless faceless scale subjects and one clear grounded landmark with its coherent shadow. The artwork must fill all four edges. Honor the eight-field USER_INPUT while treating TYPOGRAPHY_OVERLAY only as a strict non-visual no-text control: ${sanitizedPrompt}. ${mandatoryExclusions}`
        : item.culinaryEditorialStructure
          ? `Create one premium editorial culinary advertising photograph. Keep the complete named hero dish dominant in the foreground, one clear appetizing bite held by the specified utensil above it, and only the exact raw accompaniments grouped at lower right. Use physical dimensional set pieces and unobstructed natural background areas. Follow the visual input: ${sanitizedPrompt}. ${mandatoryExclusions}`
        : item.beverageCampaignStructure
          ? `Create one premium commercial beverage-advertising still life. Obey the specified count of one, two or three drinks, selected recipes, camera, composition and staging surface literally. Make HERO_DRINK the visual priority without inventing a tiered triangular display. Use only the specified recipe ingredients and vessels, with photorealistic liquid, ice, foam, bubbles, glass reflections and condensation. Honor the nine-field USER_INPUT: ${sanitizedPrompt}. ${mandatoryExclusions}`
        : item.dualMaterialStructure
          ? `Create one sculptural art object from two contrasting materials. The named subject silhouette must be familiar and intact, with realistic primary-material volume and a restrained secondary-material accent. Honor the six-field USER_INPUT: ${sanitizedPrompt}. ${mandatoryExclusions}`
        : item.materialArtStructure
          ? `Create an original Editorial Still Life studio photograph. Use the named hero product or raw materials in one clearly readable conceptual arrangement, with realistic textures and natural contact shadows on a continuous studio surface. Adapt composition to the requested aspect ratio, keeping the hero complete with an unobstructed natural background area. Follow the visual input: ${sanitizedPrompt}. ${mandatoryExclusions}`
        : item.boothStructure
          ? `Create a full-size premium exhibition-booth architectural visualization on a seamless pure white studio background, strictly frontal orthographic elevation, all architecture visible. Balanced white negative space is studio backdrop, not a frame. Follow the booth USER_INPUT structure: ${sanitizedPrompt}. ${mandatoryExclusions}`
        : item.fusionStructure
          ? `Create one minimalist surrealist still-life photograph: exactly one seamless organic-food/mechanical-hardware hybrid on a matte studio surface, with generous natural copy space and a soft contact shadow. The physical background fills every edge. Preserve recognizable food and hardware textures and the specified clean fusion joint. ${sanitizedPrompt}. ${mandatoryExclusions}`
        : item.composition === "artwork"
          ? `Create the original full-bleed artwork itself, not a photograph of a print, room, frame or mockup. Follow the specified artistic medium and composition with detailed print-friendly texture. Do not reserve advertising copy space. ${sanitizedPrompt}. ${mandatoryExclusions}`
          : `Create a single full-bleed art-directed commercial scene whose photographed background reaches every edge of the final image. Authentic materials, tactile textures, natural lighting and believable geometry. Leave useful natural negative space within the physical scene when requested, but never add a layout panel or margin. No plastic AI glossiness. Follow the intended medium and visual details: ${sanitizedPrompt}. ${mandatoryExclusions}`;
      const originalUserContent = `${absoluteTextBan}\n${visualDirection}`;
      const userContent = attemptIndex > 0
        ? `${originalUserContent} ${isTransparent
            ? buildTransparentQualityRetryDirection(attemptIndex, rejectionReasons)
            : item.thaiNaturePosterStructure
              ? `QUALITY REPLACEMENT ${attemptIndex}/${MAX_QUALITY_RETRIES}: Previous defects: ${compactQualityIssue(rejectionReasons)}. Repaint the SAME Thai landscape, flower species, terrain bands, winding route, tiny faceless scale cues, focal landmark, poster-color medium, vintage paper texture, palette, season, lighting and shadow direction. Use a gently elevated scenic panorama with clear depth, plausible geography and a single grounded landmark. Keep any people minuscule and featureless. Fill every edge with painted scenery. No top-down plan, map, masterplan, satellite image, diagram, title panel, border, blank margin, letters, pseudo-text, logo, temple, flag, costume, large person or visible face.`
            : item.symmetricalStorefrontStructure
              ? `QUALITY REPLACEMENT ${attemptIndex}/${MAX_QUALITY_RETRIES}: Previous defects: ${compactQualityIssue(rejectionReasons)}. Rebuild the SAME single storefront with the SAME scene theme, façade, doors, windows, visible interior merchandise, balanced storefront props, flanking elements, background horizon, sky, pavement, pastel palette and lighting. Fix the camera to centered straight-on eye level; show the complete uncropped building with plausible connected architecture, supported objects and clean bilateral symmetry. Keep every surface plain and unmarked. No second shop, storefront row, people, hands, faces, lettering, signage, menu, price, logo, pseudo-text, vehicle obstruction, dollhouse, miniature, illustration, collage, poster, border or frame.`
            : item.editorialPenSketchStructure
              ? `QUALITY REPLACEMENT ${attemptIndex}/${MAX_QUALITY_RETRIES}: Previous defects: ${compactQualityIssue(rejectionReasons)}. Redraw the SAME project theme, location, main subject, supporting scene elements, composition, pen palette, hatching, paper and mood. Make the main subject complete and immediately recognizable; correct perspective, scale, joins, support and line direction. Keep colored-pen strokes and natural paper visible across a full-bleed canvas. No people, hands, portraits, photorealism, paint wash, new symbolic props, labels, handwriting, lettering, border, mat, poster or visible paper edge.`
            : item.aerialLandscapeStructure
              ? `QUALITY REPLACEMENT ${attemptIndex}/${MAX_QUALITY_RETRIES}: Previous defects: ${compactQualityIssue(rejectionReasons)}. Repaint the SAME aerial landscape theme with the SAME terrain ribbons, winding path, tiny faceless overhead scale subjects, focal landmark, artistic medium, palette, lighting and shadow direction. Correct terrain continuity, route geometry, landmark support and shadow coherence. Keep people minuscule and featureless with no face or anatomy detail. Fill every edge. No map, masterplan, satellite image, diagram, legend, compass, pin, icon, label, lettering, border, poster or large person.`
            : item.culinaryEditorialStructure
              ? `QUALITY REPLACEMENT ${attemptIndex}/${MAX_QUALITY_RETRIES}: Previous defects: ${compactQualityIssue(rejectionReasons)}. Rebuild the SAME named dish, SAME utensil-held bite, SAME recipe ingredients, dimensional set and palette. Keep the full dish physically supported and immediately recognizable, with one realistic utensil entering from an edge and no visible hand. Correct food anatomy, utensil geometry, gravity, scale and texture. Preserve natural blank copy zones without panels. No chef, people, hands, package, label, lettering, badge, outer frame, unrelated garnish or clutter.`
            : item.beverageCampaignStructure
              ? `QUALITY REPLACEMENT ${attemptIndex}/${MAX_QUALITY_RETRIES}: Previous defects: ${compactQualityIssue(rejectionReasons)}. Re-stage the SAME selected drink or drinks with the SAME recipes, vessels, composition, camera, staging surface and ingredient props. Obey DRINK_COUNT_AND_SELECTION exactly and do not revert to a three-glass pyramid. Correct liquid, ice, foam, condensation, reflections, vessel geometry and physical support. Remove extra drinks, unrelated props and clutter. No duplicate vessel, people, hands, lettering, labels, menu layout or poster panel.`
            : item.dualMaterialStructure
              ? `QUALITY REPLACEMENT ${attemptIndex}/${MAX_QUALITY_RETRIES}: Previous defects: ${compactQualityIssue(rejectionReasons)}. Rebuild the SAME subject using the SAME two named materials. Simplify the silhouette until instantly recognizable, keep the primary material dominant, and attach the secondary accent coherently. Fix texture, support and specified shadow. No third material, props, lettering, people, hardware substitution, architecture or diagram.`
            : item.materialArtStructure
              ? `QUALITY REPLACEMENT ${attemptIndex}/${MAX_QUALITY_RETRIES}: Previous defects: ${compactQualityIssue(rejectionReasons)}. Re-stage the SAME material-art motif using the SAME raw materials and named hero products, retaining their recognizable normal shapes. Simplify the arrangement, remove unnecessary accents, fix scale and physical support, preserve clear negative space and credible texture. Adapt spacing to the actual canvas without cropping the hero. Keep one readable Editorial Still Life arrangement on a continuous studio background, no lettering, people, hardware fusion, architecture or poster layout.`
            : item.boothStructure
              ? `QUALITY REPLACEMENT ${attemptIndex}/${MAX_QUALITY_RETRIES}: Previous defects: ${compactQualityIssue(rejectionReasons)}. Rebuild the SAME exhibition-booth design, retaining its architectural structure, merchandise and palette. Fix camera to strict frontal orthographic, show the full canopy and platform, use plausible connected supports and organized shelving, keep pure white studio background and soft contact shadows. No people, text, logo, surrounding hall or food-hardware hybrid. Blank signs are intentional.`
            : item.fusionStructure
              ? `QUALITY REPLACEMENT ${attemptIndex}/${MAX_QUALITY_RETRIES}: Previous defects: ${compactQualityIssue(rejectionReasons)}. Rebuild exactly the same specified food-hardware pair as ONE seamless hybrid. Correct the joint and recognizable material textures; simplify the silhouette. Preserve the minimalist matte background, soft contact shadow, no people, no text and no additional props. Do not replace it with a literal lifestyle scene.`
              : buildQualityRetryDirection(attemptIndex, rejectionReasons)}`
        : originalUserContent;

      const payload: Record<string, unknown> = {
        model,
        messages: [
          {
            role: "user",
            content: userContent,
          },
        ],
        modalities: ["image", "text"],
        image_config: {
          aspect_ratio: getAspectRatioForModel(item.aspectRatio),
        },
      };

      const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": "https://adobe-stock.vercel.app",
          "X-Title": "Adobe Stock AI Generator",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45_000),
      });

      if (!response.ok) {
        lastError = `OpenRouter API returned ${response.status}`;
        console.error(`[Item #${item.id}] ${lastError}`);
        break;
      }

      const result = (await response.json()) as OpenRouterImageResponse;
      const message = result.choices?.[0]?.message;

      let directUrl: string | undefined;
      let extractedBuffer: Buffer | null = null;

      // ดึง URL / Base64 จาก message.images
      if (message?.images && Array.isArray(message.images) && message.images.length > 0) {
        const imgObj = message.images[0];
        directUrl = imgObj?.image_url?.url || imgObj?.url;
        if (!directUrl && imgObj?.b64_json) {
          extractedBuffer = Buffer.from(imgObj.b64_json, "base64");
        }
      }

      // ดึงจาก message.content ถ้าเป็น Array
      if (!directUrl && !extractedBuffer && Array.isArray(message?.content)) {
        for (const part of message.content) {
          if (part?.type === "image_url" && part.image_url?.url) {
            directUrl = part.image_url.url;
            break;
          }
          if (part?.type === "image" && part.b64_json) {
            extractedBuffer = Buffer.from(part.b64_json, "base64");
            break;
          }
        }
      }

      // ดึงจาก message.content ถ้าเป็น String
      if (!directUrl && !extractedBuffer && typeof message?.content === "string") {
        const match = message.content.match(/\((https?:\/\/[^\s)]+|data:image\/[^;]+;base64,[^\s)]+)\)/) ||
                      message.content.match(/data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+/) ||
                      message.content.match(/https?:\/\/[^\s"']+/);
        if (match) {
          directUrl = match[1] || match[0];
        }
      }

      // ดึงจาก message.parts
      if (!directUrl && !extractedBuffer && Array.isArray(message?.parts)) {
        for (const part of message.parts) {
          if (part?.inline_data?.data) {
            extractedBuffer = Buffer.from(part.inline_data.data, "base64");
            break;
          }
        }
      }

      if (directUrl && directUrl.startsWith("data:image")) {
        extractedBuffer = Buffer.from(directUrl.split(",")[1], "base64");
        directUrl = undefined;
      }

      if (directUrl) {
        try {
          directUrl = validateRemoteImageUrl(directUrl).toString();
        } catch {
          lastError = "Generated image URL is not from an allowlisted host";
          break;
        }
      }

      if (extractedBuffer && extractedBuffer.byteLength > MAX_IMAGE_BYTES) {
        lastError = "Generated image exceeds the size limit";
        break;
      }

      // ถ้าเป็นโหมดโปร่งใสและได้เป็น hosted URL ให้ดึง Buffer มาทำ True Alpha
      if (directUrl && !extractedBuffer) {
        const remoteImage = await fetchAllowlistedImage(directUrl, 6_000);
        extractedBuffer = Buffer.from(remoteImage.body);
      }

      // ประมวลผลภาพ
      if (extractedBuffer) {
        if (isTransparent) {
          console.log(`[Item #${item.id}] Ensuring genuine alpha transparency with sharp...`);
          const transparentPngBuffer = await ensureGenuineAlphaTransparency(extractedBuffer);
          {
            const quality = await assessGeneratedImageQuality(transparentPngBuffer, key, {
              mode: "transparent_png",
              expectedTitle: item.seoTitle,
              intendedUse: item.commercialIntent?.intendedUse,
              isFoodFusion: Boolean(item.fusionStructure),
            });
            if (!quality.passed) {
              const reason = compactQualityIssue(quality.issues);
              rejectionReasons.push(reason);
              lastError = `Quality gate rejected transparent PNG (${quality.source}): ${reason}`;
              console.warn(`[Item #${item.id}] ${lastError}`);
              if (attemptIndex < MAX_QUALITY_RETRIES) continue;
              return {
                imageUrl: `data:image/png;base64,${transparentPngBuffer.toString("base64")}`,
                qualityReview: {
                  status: "accepted_after_retry_limit",
                  attempts: attemptNumber,
                  rejectionCount: rejectionReasons.length,
                  rejectionReasons,
                },
              };
            }
          }
          const base64 = transparentPngBuffer.toString("base64");
          return {
            imageUrl: `data:image/png;base64,${base64}`,
            qualityReview: {
              status: rejectionReasons.length > 0 ? "passed_after_retries" : "passed",
              attempts: attemptNumber,
              rejectionCount: rejectionReasons.length,
              rejectionReasons,
            },
          };
        } else {
          {
            const quality = await assessGeneratedImageQuality(extractedBuffer, key, {
              mode: "regular_scene",
              expectedTitle: item.seoTitle,
              intendedUse: item.commercialIntent?.intendedUse,
              isFoodFusion: Boolean(item.fusionStructure),
              isExhibitionBooth: Boolean(item.boothStructure),
              isMaterialArt: Boolean(item.materialArtStructure),
              isDualMaterial: Boolean(item.dualMaterialStructure),
              isBeverageCampaign: Boolean(item.beverageCampaignStructure),
              beverageBrief: item.beverageCampaignStructure
                ? `${item.beverageCampaignStructure.DRINK_COUNT_AND_SELECTION}. ${item.beverageCampaignStructure.COMPOSITION_AND_CAMERA}. Hero: ${item.beverageCampaignStructure.HERO_DRINK}. Supporting: ${item.beverageCampaignStructure.SUPPORTING_DRINKS}`
                : undefined,
              isCulinaryEditorial: Boolean(item.culinaryEditorialStructure),
              isAerialLandscape: Boolean(item.aerialLandscapeStructure),
              isThaiNaturePoster: Boolean(item.thaiNaturePosterStructure),
              isEditorialPenSketch: Boolean(item.editorialPenSketchStructure),
              isSymmetricalStorefront: Boolean(item.symmetricalStorefrontStructure),
              isSaleReference: Boolean(item.saleReferenceStructure),
            });
            if (!quality.passed) {
              const reason = compactQualityIssue(quality.issues);
              rejectionReasons.push(reason);
              lastError = `Quality gate rejected image (${quality.source}): ${reason}`;
              console.warn(`[Item #${item.id}] ${lastError}`);
              if (attemptIndex < MAX_QUALITY_RETRIES) continue;

              if (quality.hasVisibleHumanFace || quality.hasText || !quality.faceCheckCompleted) {
                return {
                  imageUrl: "",
                  error: quality.hasVisibleHumanFace
                    ? "Image withheld: visible human face remains after the replacement limit."
                    : quality.hasText
                      ? "Image withheld: rendered text or pseudo-text remains after the replacement limit."
                    : "Image withheld: the required no-visible-face inspection could not be completed.",
                };
              }

              const compressedRejectedBuffer = await sharp(extractedBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
                .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
                .toBuffer();
              return {
                imageUrl: `data:image/jpeg;base64,${compressedRejectedBuffer.toString("base64")}`,
                qualityReview: {
                  status: "accepted_after_retry_limit",
                  attempts: attemptNumber,
                  rejectionCount: rejectionReasons.length,
                  rejectionReasons,
                },
              };
            }
          }
          const compressedBuffer = await sharp(extractedBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
            .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
            .toBuffer();
          const base64 = compressedBuffer.toString("base64");
          return {
            imageUrl: `data:image/jpeg;base64,${base64}`,
            qualityReview: {
              status: rejectionReasons.length > 0 ? "passed_after_retries" : "passed",
              attempts: attemptNumber,
              rejectionCount: rejectionReasons.length,
              rejectionReasons,
            },
          };
        }
      }

      if (directUrl) {
        return {
          imageUrl: directUrl,
        };
      }

      lastError = `No image data in response from ${model}`;
      break;
    } catch (error: unknown) {
      lastError = getErrorMessage(error, "Image generation failed");
      console.warn(`[Item #${item.id}] Error with ${model}:`, lastError);
      break;
    }
  }

  return {
    imageUrl: "",
    error: lastError || "Failed to generate image via OpenRouter",
  };
}

/**
 * สร้างภาพทั้งหมดเป็นกลุ่ม (Concurrency Chunks = 4) ป้องกัน Rate Limit และ 504 Timeout
 */
export async function generateAllStockImages(
  items: StockImageItem[],
  apiKey?: string
): Promise<StockImageItem[]> {
  console.log(`Starting batched image generation for ${items.length} items (concurrency: 4)...`);
  const results: StockImageItem[] = [];
  const chunkSize = 4;

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map(async (item) => {
        try {
          const result = await generateSingleImage(item, apiKey);
          return {
            ...item,
            modelUsed: item.modelUsed || (item.isTransparent ? MODEL_TRANSPARENT_PRIMARY : DEFAULT_IMAGE_MODEL),
            imageUrl: result.imageUrl || undefined,
            qualityReview: result.qualityReview,
            description: result.qualityReview?.status === "accepted_after_retry_limit"
              ? `QA warning: ${result.qualityReview.rejectionReasons.join("; ")}`
              : result.error ? `Error: ${result.error}` : undefined,
          };
        } catch (error: unknown) {
          console.error(`Failed generating image #${item.id}:`, error);
          return {
            ...item,
            modelUsed: item.modelUsed || (item.isTransparent ? MODEL_TRANSPARENT_PRIMARY : DEFAULT_IMAGE_MODEL),
            description: `Generation error: ${getErrorMessage(error, "Unknown error")}`,
          };
        }
      })
    );
    results.push(...chunkResults);
  }

  console.log(`Image generation completed for all ${results.length} items.`);
  return results;
}
