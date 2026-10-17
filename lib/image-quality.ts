import sharp from "sharp";
import { getErrorMessage, isRecord } from "./errors";
import { NO_VISIBLE_FACE_RULE } from "./generation-policy";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";
const DEFAULT_QA_MODEL = "google/gemini-3.1-flash-lite";
const MAX_INPUT_PIXELS = 40_000_000;

export interface ImageQualityResult {
  passed: boolean;
  issues: string[];
  source: "pixel_guard" | "vision_guard";
  hasVisibleHumanFace?: boolean;
  hasText?: boolean;
  faceCheckCompleted?: boolean;
}

export interface ImageQualityContext {
  mode: "transparent_png" | "regular_scene";
  expectedTitle: string;
  intendedUse?: string;
  isFoodFusion?: boolean;
  isExhibitionBooth?: boolean;
  isResortMasterplan?: boolean;
  isMaterialArt?: boolean;
  isDualMaterial?: boolean;
  isBeverageCampaign?: boolean;
  isCulinaryEditorial?: boolean;
  isAerialLandscape?: boolean;
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
  context: ImageQualityContext = {
    mode: "regular_scene",
    expectedTitle: "commercial image",
  },
): Promise<ImageQualityResult> {
  if (context.mode === "regular_scene" && !context.isExhibitionBooth && !context.isResortMasterplan && !context.isMaterialArt && !context.isDualMaterial && !context.isBeverageCampaign && !context.isCulinaryEditorial && await detectUnintendedLightBorder(inputBuffer)) {
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

  const previewPipeline = sharp(inputBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
    .resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true })
    .flatten({ background: context.mode === "transparent_png" ? "#29323a" : "#ffffff" });
  const preview = await previewPipeline.jpeg({ quality: 76 })
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
              text: `Inspect only the visible pixels of this generated commercial image. Expected title: ${context.expectedTitle}. Intended buyer use: ${context.intendedUse || "general commercial design"}. Mode: ${context.mode}.
Reject it if ANY readable or pseudo-readable letters, words, numerals, captions, title, logo, signature or watermark appear anywhere. Also reject a poster/card/mockup layout, blank header/footer panel, outer frame, mat, border, canvas margin, or image placed inside another page.
${context.isAerialLandscape
  ? "This is an INTENTIONAL PAINTERLY AERIAL LANDSCAPE ILLUSTRATION. Require a high bird's-eye or near-top-down view with broad geographically connected terrain ribbons, one coherent winding path, one clearly grounded focal landmark and one directional landmark shadow matching the lighting. Tiny vehicles and people are scale cues only: people must be minuscule, featureless overhead silhouettes or color marks with no face, profile, limbs, clothing or portrait anatomy. Require visible gouache, chalk-pastel and stippled-grain character, coherent color harmony and a full-bleed image. Reject a map, masterplan, satellite photograph, infographic, collage, legend, compass, pin, route label, symbol, icon, scale bar, text, border, floating landmark, conflicting shadows, large person or visible face. Set hasClearLiteralStory=true when the landscape type, route and landmark make the buyer use understandable at a glance."
  : context.isCulinaryEditorial
  ? "This is an INTENTIONAL EDITORIAL CULINARY ADVERTISING PHOTOGRAPH. Require one complete, immediately recognizable hero dish dominating the foreground, exactly one readable bite lifted above it by the named utensil, and a restrained lower-right group containing only recipe-specific raw accompaniments. The utensil may enter from an image edge with support outside frame, but no hand, arm, chef, person or face may appear. Require appetizing realistic food anatomy and texture, coherent scale and gravity, an intact utensil, a physically supported dish, and freestanding dimensional backdrop pieces. Natural blank copy zones are intentional. Reject distorted or ambiguous food, an unsupported or cropped dish, broken utensil, multiple lifted bites, unrelated garnish, ingredient clutter, packaging, labels, people, hands, text, badges, outer frame, poster page or fake typography panels. Set hasClearLiteralStory=true when the dish, lifted bite and authentic ingredients communicate a specific culinary campaign at a glance."
  : context.isBeverageCampaign
  ? "This is an INTENTIONAL THREE-DRINK BEVERAGE CAMPAIGN PHOTOGRAPH. Require exactly three separate, complete and recognizable beverage vessels in a clear triangular hierarchy: the center hero drink is visibly highest, the left supporting drink is lower on the left, and the right supporting drink is lower on the right. Require plausible plinth support, recipe-matched fresh ingredient props that remain secondary, accurate liquid color and viscosity, intact glass geometry, realistic ice, bubbles or foam when specified, clean rims, refraction, reflections and natural condensation. The continuous physical set and natural copy space are intentional. Reject a missing, duplicate, merged or fourth drink; swapped or unclear hierarchy; floating or unsupported vessels; deformed rims or handles; impossible liquid; unrelated ingredients; clutter; packages; labels; text; people or hands. Set hasClearLiteralStory=true when the three-drink collection and flavor family are immediately understandable and commercially usable."
  : context.isDualMaterial
  ? "This is an INTENTIONAL DUAL-MATERIAL SCULPTURE. Require exactly one intact, immediately recognizable subject made from two distinct construction materials. The primary material should define the main volume and the secondary material a connected accent. Accept unexpected material combinations and deliberate sculptural anatomy while requiring convincing textures, coherent joins and support, a readable silhouette and natural studio shadows. Animal faces and recognizable stylized organ shapes are allowed; human faces are not. Reject extra objects, multiple disconnected subjects, random patchwork, unnecessary third materials, illegible shapes, melted textures, lettering, people or portrait busts. A neutral studio background and breathing room are intentional, not artificial borders. Set hasClearLiteralStory=true when the subject and material contrast are clear."
  : context.isMaterialArt
  ? "This is an INTENTIONAL MATERIAL-ART STILL-LIFE PHOTOGRAPH or Editorial Still Life brand image. Accept a dominant raw-material artwork OR a recognizable hero product in restrained conceptual staging for fashion, beauty, advertising or lifestyle. A normal product need not transform into a sculpture. Accept visual metaphor when named products/materials, arrangement and buyer use are clear. Require photographic texture, realistic scale, intact product geometry, coherent physical support, natural contact shadows and continuous studio background. Supporting objects must contribute to the same concept and stay secondary. Require framing and breathing room suited to the canvas, with no cropped hero or letterboxing. Reject clutter, unrelated piles, illegible elaborate symbolism, multiple competing motifs, hardware fusion, architecture, flat sketch rendering, text or people. Natural background and copy space are intentional, not artificial mats. Set hasClearLiteralStory=true when the campaign concept is readable."
  : context.isResortMasterplan
  ? "This is an ARCHITECTURAL PROJECT MASTERPLAN SKETCH, not a photograph. Require a coherent elevated bird's-eye oblique view showing the complete project, category-appropriate amenities, buildings, landscape/terrain and connected circulation at consistent scale. Use the expected title and intended use to determine the project category: schools, community parks, workplaces and housing do not require pools, waterparks or villas. Reject irrelevant amenities that contradict the category. Require fine ink/graphite linework, plentiful unpainted warm-white paper and sparse pastel tints at any specified water, roofs and planting. White paper and quiet title-free negative space are intentional, NOT artificial borders or blank poster panels. Reject actual drawn frames or inset sheets, cropped site, frontal booth views, saturated photorealistic renders, disconnected paths, floating buildings or incomprehensible zoning. Set hasClearLiteralStory=true when the site program and planning relationships are understandable. No title, lettering, labels, scale bars, legends, people or visible faces."
  : context.isExhibitionBooth
  ? "This is a FULL-SIZE EXHIBITION-BOOTH ARCHITECTURAL VISUALIZATION. Accept a centered complete booth on a seamless pure WHITE studio background with balanced white breathing room: white negative space is intentional and is NOT an artificial border or mat. Set hasArtificialBorder=false for a continuous white backdrop; reject only an actual drawn frame or inset page. Require strict straight-on frontal orthographic elevation, eye-level centered camera, complete canopy, platform and features visible, plausible joined structure, supported shelves, organized merchandise, open accessible front and realistic material/light detail. Blank sign surfaces and architectural display panels are intentional; they are not poster layouts. No people or lettering. Set hasClearLiteralStory=true when the exhibition architecture and retail-display use are clear. Reject cropped parts, cluttered real-world event halls, disconnected supports, dollhouse miniatures or wrong camera angle."
  : context.isFoodFusion
  ? "This is an INTENTIONAL SURREAL FOOD-HARDWARE FUSION, not a literal scene. Accept the impossible hybrid when one recognizable food component joins one recognizable mechanical component into exactly ONE connected hero with a clean seamless joint, credible food and industrial textures, matte studio backdrop, generous negative space and a soft contact shadow. Set hasClearLiteralStory=true when the two ingredients and their intended metaphor are visually readable; do not require an everyday action, person, room or location. Reject separate props, unrelated piles, multiple heroes, broken joints, indistinguishable food or hardware, or a flat pasted collage. Do not reject simply because the fusion is surreal."
  : "Apply a strict two-second clarity test: an ordinary viewer must immediately name the main subject and understand the literal action or practical purpose without reading metadata or guessing a symbolic metaphor. Reject abstract assemblages, surreal hybrids, unrelated object piles, ambiguous sculptures, decorative material metaphors, or scenes whose buyer use is not visually clear."}
Mandatory face rule: ${NO_VISIBLE_FACE_RULE} Set hasVisibleHumanFace=true if any human face or part of a face is visible, however small, blurred or obscured. Human backs, hands and bodies with all faces outside the frame are allowed. Animal faces are allowed.
For transparent_png, the dark gray shown around the subject represents transparency. Require exactly one intact, familiar, opaque subject with a simple readable silhouette. Its normal practical function must be obvious, but it does not need to show an action; set hasClearLiteralStory=true when the single object and its normal use are immediately clear. Reject missing chunks, accidental transparent holes through solid areas, ragged/dirty/haloed edges, fragmented pieces, multiple unrelated objects, or a result that does not visibly match the expected title.
${context.isAerialLandscape
  ? "The painted terrain ribbons, winding route, tiny faceless overhead scale cues and single landmark ARE the correct final landscape artwork. Do not demand photographic realism, a lifestyle close-up, architectural zoning or technical map symbols. Reject actual labels, legends, text, page margins or poster framing."
  : context.isCulinaryEditorial
  ? "The hero dish, edge-entering utensil-held bite, recipe ingredients and freestanding dimensional backdrop ARE the correct final advertising scene. Do not demand a visible chef, hand, retail package or rendered headline. Copy placement fields represent natural empty background only; reject any actual or pseudo-text."
  : context.isBeverageCampaign
  ? "The three finished drinks, tiered plinths and matching fresh ingredients ARE the correct final advertising scene. Do not demand a single hybrid object, material sculpture, building or everyday human action. A premium studio product arrangement is a clear literal commercial use when all three recipes and their hierarchy are readable."
  : context.isDualMaterial
  ? "The single two-material sculpture on the requested background IS the final artwork. Do not demand a food-hardware pairing, an advertising product with props, a building or an everyday action. Preserve its non-human-face subject and material contrast."
  : context.isMaterialArt
  ? "The photographed material artwork on its physical surface IS the correct setting. Do not require a real-world lifestyle action, a food-hardware joint, booth structure or project plan. Reject genuine frames or inset page layouts, while accepting natural negative space on the same surface."
  : context.isResortMasterplan
  ? "The paper drawing itself is the final artwork, with no visible page edge or mockup. Accept linework and pale watercolor as the requested medium; do not demand food/hardware textures, architectural photorealism or a lifestyle setting."
  : context.isExhibitionBooth
  ? "The white studio backdrop and floor ARE the requested setting; do not require a room or real event hall. This is an architectural design proposal, not a food fusion or lifestyle photograph."
  : context.isFoodFusion
  ? "The minimalist studio surface IS the correct setting. Photorealistic material rendering is required, while impossible construction is intentional. The single hybrid should support the stated campaign concept."
  : "For regular_scene, require one coherent recognizable real-world subject and setting with an obvious commercial application. A stationary meal, interior, animal or landscape is valid without an action; set hasClearLiteralStory=true when its literal subject and purpose are clear. Natural copy space is allowed only when it remains part of the photographed setting."}
Return pure JSON only: {"passed":true|false,"hasVisibleHumanFace":true|false,"hasText":true|false,"hasArtificialBorder":true|false,"hasPosterLayout":true|false,"isImmediatelyRecognizable":true|false,"hasClearLiteralStory":true|false,"hasClearCommercialUse":true|false,"hasCutoutDamage":true|false,"hasMultipleConfusingSubjects":true|false,"issues":["short factual issue"]}. If uncertain, reject.`,
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
    if (!isRecord(report) || typeof report.passed !== "boolean" || typeof report.hasVisibleHumanFace !== "boolean" ||
      typeof report.hasText !== "boolean" || typeof report.hasArtificialBorder !== "boolean" ||
      typeof report.hasPosterLayout !== "boolean" || typeof report.isImmediatelyRecognizable !== "boolean" ||
      typeof report.hasClearLiteralStory !== "boolean" || typeof report.hasClearCommercialUse !== "boolean" ||
      typeof report.hasCutoutDamage !== "boolean" || typeof report.hasMultipleConfusingSubjects !== "boolean" ||
      !Array.isArray(report.issues)) {
      throw new Error("quality inspection returned an invalid report");
    }
    const issues = report.issues.filter((issue): issue is string => typeof issue === "string").slice(0, 5);
    if (report.hasVisibleHumanFace) issues.unshift("visible human face detected; reframe from behind or below the neck");
    const passed = report.passed && !report.hasVisibleHumanFace && !report.hasText && !report.hasArtificialBorder && !report.hasPosterLayout &&
      report.isImmediatelyRecognizable && report.hasClearLiteralStory && report.hasClearCommercialUse &&
      !report.hasMultipleConfusingSubjects && (context.mode !== "transparent_png" || !report.hasCutoutDamage);
    return {
      passed,
      issues: passed ? [] : issues.length > 0 ? issues : ["image failed the recognizability, literal-story, commercial-use or technical-quality checks"],
      source: "vision_guard",
      faceCheckCompleted: true,
      hasVisibleHumanFace: report.hasVisibleHumanFace,
      hasText: report.hasText,
    };
  } catch (error: unknown) {
    return {
      passed: false,
      issues: [`quality inspection failed: ${getErrorMessage(error, "unknown inspection error")}`],
      source: "vision_guard",
    };
  }
}
