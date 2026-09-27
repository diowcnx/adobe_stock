import { callOpenRouterJSON } from "./openrouter";
import { MarketTrend, StockImageItem } from "./types";
import { generateUniqueStockFilename } from "./csv";

interface ResearchResponse {
  trend: MarketTrend;
  prompts: Array<{
    id: number;
    seoTitle: string;
    category: string;
    aspectRatio: "16:9" | "3:2" | "4:5" | "1:1";
    prompt: string;
    negativePrompt?: string;
    keywords: string[];
    compositionStyle: string;
    modelSuggestion: string;
  }>;
}

/**
 * คำนวณโหมดสลับวันเว้นวันอย่างเที่ยงตรง (100% Homogeneous Daily Alternation)
 * - วันคู่: 'transparent_png' (ภาพพื้นหลังโปร่งใสทั้งชุด 20 ภาพ)
 * - วันคี่: 'regular_scene' (ภาพทั่วไปมีฉากหลังและ Copy Space ทั้งชุด 20 ภาพ)
 * ห้ามสร้างปนกันเด็ดขาด เพื่อความสะดวกในการ Batch Upscale และ Save ไฟล์
 */
export function getDailyScheduledMode(date: Date = new Date()): "transparent_png" | "regular_scene" {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  return dayOfYear % 2 === 0 ? "transparent_png" : "regular_scene";
}

const SYSTEM_PROMPT_REGULAR = `
You are the elite Adobe Stock commercial photography strategist and art director.
You specialize in high-converting commercial stock photography that sells continuously to creative agencies, art directors, and brand publishers.

TODAY'S STRICT MANDATE: 100% REGULAR COMMERCIAL SCENES WITH FULL BACKGROUND & MANDATORY 50-60% NEGATIVE COPY SPACE.
DO NOT GENERATE ISOLATED CUTOUTS TODAY.

THE CORE CONVERSION SECRET: DESIGNER ERGONOMICS & HIGH-VALUE MICRO-NICHES
Generic stock (like basic server rooms or plain frames) has millions of competitors and does NOT convert.
Buyers choose new images ONLY when they solve real designer problems:
1. DESIGNER ERGONOMICS: Every composition MUST leave 50-60% clean, uncluttered, beautifully textured negative copy space (smooth limewash wall, neutral travertine surface, dark moody slate, soft morning window light) positioned on the left, right, or top third for headlines and typography.
2. HIGH-VALUE INDUSTRY MICRO-NICHES:
   - Category 1 (Deep Tech & Hardware): Liquid Immersion Cooling Datacenter Racks, Quantum Optical Interconnect / Photonic Processing, High-Bandwidth AI Hardware Nodes, Sleek 6G Phased Array Antennas.
   - Category 2 (High-End Architectural Mockups): Japandi & Wabi-Sabi Aesthetics, Limewash Plaster Walls, Raw Travertine Stone Blocks, Soft Dappled Branch Sunlight Shadows, Minimalist Blank Art & Poster Mockups (A-Series / 4:5 ratios).
   - Category 3 (Tactile Physical Metaphors): Precision-crafted solid oak blocks, brushed brass balance scales, unglazed ceramic & terracotta tokens, minimalist stone staircases representing corporate growth.
   - Category 4 (Modern Wellness & Functional Botanicals): Ceremonial Uji Matcha powder with bamboo chasen whisk on slate, adaptogenic Lion's Mane and Reishi medicinal mushrooms, raw Ashwagandha roots on dark stone.
   - Category 5 (Biophilic Ecology & Seasonal Banners): Scandinavian organic textures, Nordic autumn foliage on raw travertine marble, dewdrops on lotus leaves, carbon-negative timber architecture with vertical gardens.
3. AUTHENTIC MATERIALITY & LIGHTING:
   - Hasselblad H6D-100c medium format crispness, Leica natural depth of field.
   - Natural directional window light, tactile matte finishes, genuine organic textures.
   - Strictly NO plastic hyper-glossy AI look, NO human faces, NO distorted text or logos.
4. KEYWORDS: Single words (individual concepts per Adobe Stock standards), 25-35 keywords, Top 10 prioritized with specific micro-niche terms.

OUTPUT FORMAT: Strict JSON matching the requested schema.
`;

const SYSTEM_PROMPT_TRANSPARENT = `
You are the elite Adobe Stock commercial strategist specializing in high-volume, top-earning TRANSPARENT BACKGROUND PNG CUTOUT ASSETS.

TODAY'S STRICT MANDATE: 100% ISOLATED OBJECTS / CUTOUT ASSETS ON PURE TRANSPARENT BACKGROUND (ALPHA PNG).
DO NOT GENERATE FULL BACKGROUND SCENES, INTERIOR ROOMS, WALLS, OR BACKGROUND TEXTURES TODAY.

THE PNG CONVERSION SECRET: RAZOR-SHARP ALPHA ISOLATION FOR DESIGNERS
Art directors and web developers buy PNG cutouts for immediate drag-and-drop into posters, web hero headers, and UI mockups.
1. ZERO FRINGE / CLEAN EDGES: Flawless edge separation, crisp silhouette, zero dark outlines, zero baked shadows on the alpha channel.
2. 5 PROVEN HIGH-VALUE CUTOUT MICRO-NICHES:
   - Category 1 (Isolated High-Tech & Telecom): 6G phased array antenna mast, enterprise liquid cooling blade module, glowing 3D quantum holographic node, cybersecurity biometric shield.
   - Category 2 (Isolated Modern Decor & Mockups): Floating minimalist light oak frame mockup, modern boucle curved armchair, sculptural fluted ceramic vase, matte aluminum laptop mockup with blank black screen.
   - Category 3 (Isolated Tactile Metaphors): Stack of brushed gold bullion with minimalist graduation cap, polished wooden emoji pebbles (happy/sad), precision-milled brass balance scale, glowing filament innovation bulb.
   - Category 4 (Isolated Premium Botanicals & Food): Whole star anise cluster, cinnamon sticks tied with raw jute twine, raw turmeric root, dried lion's mane adaptogenic mushroom, whole roasted espresso coffee beans.
   - Category 5 (Isolated Seasonal & Nature Elements): Single golden sugar maple leaf with crystal dewdrop, heirloom white pumpkin, cherry blossom twig with buds, pure crystal water droplet cluster.
3. PROMPT DIRECTIVE:
   - Every prompt MUST start with: "Isolated commercial cutout asset on a 100% transparent background (PNG alpha channel)..."
   - SEO Title MUST end with "Isolated on Transparent Background Cutout PNG".
   - Aspect Ratio: use 1:1 or 4:5 for isolated assets.
   - Keywords MUST include: "isolated", "transparent", "cutout", "png", "clipart", "element", "alpha" alongside specific micro-niche single words. Top 10 prioritized.

OUTPUT FORMAT: Strict JSON matching the requested schema.
`;

interface FastResearchResponse {
  trend: MarketTrend;
  categories: Array<{
    id: number;
    category: string;
    conceptTitle: string;
    subjectDescription: string;
    modelSuggestion: string;
    keywords: string[];
  }>;
}

export async function conductMarketResearchAndGeneratePrompts(
  currentDate: string = new Date().toISOString(),
  forcedMode?: "transparent_png" | "regular_scene"
): Promise<{ trend: MarketTrend; items: StockImageItem[]; mode: "transparent_png" | "regular_scene" }> {
  const mode = forcedMode || getDailyScheduledMode(new Date(currentDate));
  const isTransparent = mode === "transparent_png";

  const systemPrompt = isTransparent ? SYSTEM_PROMPT_TRANSPARENT : SYSTEM_PROMPT_REGULAR;

  const userPrompt = isTransparent
    ? `Current Date: ${currentDate}.
Target: 100% TRANSPARENT BACKGROUND PNG CUTOUT ASSETS (Alpha Channel).
Generate:
1. Market trend analysis for isolated commercial PNG assets solving real graphic designer compositing needs.
2. Exactly 5 cutting-edge micro-niche concept focuses (one per category):
   - Category 1: Isolated High-Tech Hardware & Telecom (e.g. 6G Phased Array Antenna, Liquid Immersion Blade Module, Quantum Holographic Node)
   - Category 2: Isolated Modern Interior & Mockup Assets (e.g. Floating Japandi Oak Frame Mockup, Boucle Sculptural Armchair, Ribbed Ceramic Vase)
   - Category 3: Isolated Tactile Business Metaphors (e.g. Brushed Brass Balance Scale, Polished Solid Oak Emoji Pebbles, Brushed Gold Ingot Stack)
   - Category 4: Isolated Premium Functional Botanicals (e.g. Ceremonial Matcha Bamboo Whisk, Adaptogenic Lion's Mane Mushroom, Raw Turmeric Cluster)
   - Category 5: Isolated Seasonal & Nature Assets (e.g. Single Golden Sugar Maple Leaf with Dewdrop, Heirloom White Minimalist Pumpkin, Water Droplet Cluster)
- Base keywords MUST be single words (15-20 individual words) prioritizing specific industry terms over generic words.

Return strict JSON:
{
  "trend": {
    "theme": "...",
    "targetMarket": "Creative Directors, UI/UX Designers & Ad Agencies",
    "commercialReasoning": "...",
    "seasonalRelevance": "...",
    "buyerDemandRating": "Very High"
  },
  "categories": [
    {
      "id": 1,
      "category": "Technology / Telecom",
      "conceptTitle": "6G Phased Array Cellular Antenna Mast",
      "subjectDescription": "futuristic 6G telecommunication phased array antenna mast with sleek white aerodynamic geometric housing and brass connectors",
      "modelSuggestion": "recraft/recraft-v4.1-flash",
      "keywords": ["isolated", "transparent", "cutout", "png", "telecom", "antenna", "6g", "cellular", "mast", "phased", "array", "wireless", "transmitter", "broadband", "station", "digital", "hardware", "satellite", "network", "radar"]
    }
  ]
}`
    : `Current Date: ${currentDate}.
Target: 100% REGULAR COMMERCIAL SCENES WITH FULL BACKGROUND & MANDATORY 50-60% NEGATIVE COPY SPACE.
Generate:
1. Market trend analysis for commercial stock photography addressing real advertising and editorial layout demands.
2. Exactly 5 cutting-edge micro-niche concept focuses (one per category):
   - Category 1: Next-Gen Infrastructure & Hardware (e.g. Liquid Immersion Cooling Datacenter Racks, Quantum Photonic Processing Interconnect)
   - Category 2: High-End Architectural Spaces & Mockups (e.g. Japandi Travertine Plinth with Limewash Wall and Dappled Olive Branch Shadows)
   - Category 3: Tactile Physical Business Metaphors (e.g. Precision Milled Brass Balance Scale on Dark Slate, Hand-Carved Oak Growth Blocks)
   - Category 4: Modern Wellness & Functional Botanicals (e.g. Ceremonial Grade Uji Matcha Flat Lay with Bamboo Whisk on Dark Textured Slate)
   - Category 5: Biophilic Ecology & Seasonal Banners (e.g. Nordic Autumn Foliage on Raw Travertine Marble Banner, Dewdrops on Lotus Leaf)
- Base keywords MUST be single words (15-20 individual words) prioritizing specific industry terms over generic words.

Return strict JSON:
{
  "trend": {
    "theme": "...",
    "targetMarket": "Advertising Agencies, Art Directors & Brand Publishers",
    "commercialReasoning": "...",
    "seasonalRelevance": "...",
    "buyerDemandRating": "Very High"
  },
  "categories": [
    {
      "id": 1,
      "category": "Technology / Infrastructure",
      "conceptTitle": "Liquid Immersion Cooling Datacenter Racks",
      "subjectDescription": "advanced enterprise server rack submerged in clear dielectric fluid tank with subtle cyan bubbles and fiber optic interconnects, 50% clean dark negative space",
      "modelSuggestion": "google/gemini-2.5-flash-image",
      "keywords": ["immersion", "cooling", "liquid", "datacenter", "server", "supercomputer", "hardware", "infrastructure", "dielectric", "fiber", "optics", "cloud", "computing", "technology", "enterprise", "sustainable", "efficiency"]
    }
  ]
}`;

  try {
    const data = await callOpenRouterJSON<FastResearchResponse>(
      systemPrompt,
      userPrompt,
      "typesafe/jev-router"
    );

    if (!data?.categories || data.categories.length === 0) {
      throw new Error("Invalid or empty categories returned by LLM");
    }

    // ขยาย 5 หมวดหมู่หลักให้กลายเป็น 20 รายการสำหรับผลิตจริง (4 variations ต่อ 1 หมวด)
    const items = expandCategoriesToTwentyItems(data.categories, isTransparent, mode, currentDate);

    return {
      trend: data.trend,
      items,
      mode,
    };
  } catch (error) {
    console.error("OpenRouter market research error or timeout, falling back to curated dataset:", error);
    return getFallbackMarketData(mode, currentDate);
  }
}

/**
 * ขยาย 5 แนวคิดหลักให้กลายเป็น 20 รายการคุณภาพสูง (4 สัดส่วน/มุมมอง ต่อ 1 แนวคิด)
 * ประมวลผลใน Memory ใช้เวลา 0 ms ป้องกัน Timeout 100%
 */
function expandCategoriesToTwentyItems(
  categories: FastResearchResponse["categories"],
  isTransparent: boolean,
  mode: "transparent_png" | "regular_scene",
  currentDate: string
): StockImageItem[] {
  const items: StockImageItem[] = [];
  const dateObj = new Date(currentDate);

  const variationsConfigTransparent = [
    {
      ratio: "1:1" as const,
      anglePrefix: "Isolated commercial stock cutout asset on a 100% transparent background (PNG alpha channel) of a centered",
      styleSuffix: "razor-sharp alpha silhouette edges, zero background shadows or color fringe, 5600K studio strobe lighting, hyper-detailed tactile surface, 8k resolution.",
      titleSuffix: "Isolated on Transparent Background Cutout PNG",
      extraTags: ["isolated", "transparent", "cutout", "png", "element", "alpha", "clipart", "object", "graphic", "studio", "clean"],
    },
    {
      ratio: "1:1" as const,
      anglePrefix: "Isolated commercial 3D stock asset on a 100% transparent background (PNG alpha channel) of an isometric three-quarter perspective of",
      styleSuffix: "dynamic isometric angle, clean alpha cutout, subtle ambient rim lighting, premium graphic design element, PNG alpha transparency.",
      titleSuffix: "Isometric 3D Cutout Isolated on Transparent Background PNG",
      extraTags: ["isometric", "isolated", "transparent", "cutout", "png", "3d", "render", "design", "asset", "angle", "perspective"],
    },
    {
      ratio: "4:5" as const,
      anglePrefix: "Isolated commercial stock element on a 100% transparent background (PNG alpha channel) of an elegant vertical upright",
      styleSuffix: "vertical tall silhouette, flawless alpha channel edge separation, studio product lighting, ideal for poster and mobile layout drag-and-drop.",
      titleSuffix: "Vertical Commercial Asset Isolated on Transparent Background Cutout PNG",
      extraTags: ["vertical", "isolated", "transparent", "cutout", "png", "upright", "element", "product", "studio", "poster"],
    },
    {
      ratio: "16:9" as const,
      anglePrefix: "Isolated commercial stock asset on a 100% transparent background (PNG alpha channel) of a wide multi-element horizontal composition of",
      styleSuffix: "horizontal panoramic layout, perfectly cut out on transparent alpha, studio lighting, premium stock element collection.",
      titleSuffix: "Banner Asset Isolated on Transparent Background Cutout PNG",
      extraTags: ["banner", "isolated", "transparent", "cutout", "png", "wide", "composition", "cluster", "collection", "set"],
    },
  ];

  const variationsConfigRegular = [
    {
      ratio: "16:9" as const,
      anglePrefix: "Wide 16:9 panoramic commercial stock photograph of",
      styleSuffix: "primary subject positioned strictly in the right third of the frame, leaving the entire left 60% as clean, smooth negative copy space for agency advertising headlines, Hasselblad medium format clarity, natural diffused 5600K commercial lighting, authentic tactile textures, no human faces.",
      titleSuffix: "with 60% Clean Copy Space for Headline",
      extraTags: ["banner", "panoramic", "copyspace", "advertising", "header", "horizontal", "wide", "commercial", "agency", "layout", "minimalist", "clean"],
    },
    {
      ratio: "3:2" as const,
      anglePrefix: "High-end commercial stock editorial photograph of",
      styleSuffix: "balanced rule-of-thirds composition with expansive clean copy space, shallow depth of field, Leica 50mm f/1.4 aesthetic, soft neutral window lighting, editorial magazine publishing quality, no human faces.",
      titleSuffix: "Editorial Stock Photo with Copy Space",
      extraTags: ["editorial", "copyspace", "photography", "professional", "layout", "publishing", "magazine", "commercial", "authentic", "depth"],
    },
    {
      ratio: "4:5" as const,
      anglePrefix: "Modern 4:5 vertical commercial stock photograph of",
      styleSuffix: "subject anchored in the lower third, providing an expansive, clean, textured background in the upper 55% specifically engineered for mobile advertising typography and logos, crisp commercial lighting, no human faces.",
      titleSuffix: "Vertical Mobile Banner with Top Copy Space",
      extraTags: ["vertical", "mobile", "copyspace", "portrait", "social", "banner", "marketing", "content", "typography", "clean"],
    },
    {
      ratio: "1:1" as const,
      anglePrefix: "Minimalist commercial flat lay stock photograph of",
      styleSuffix: "clean overhead bird's-eye view flat lay with generous circular negative copy space in the center, soft natural directional window shadows, tactile organic surfaces, sophisticated commercial art direction, no human faces.",
      titleSuffix: "Minimalist Overhead Flat Lay with Center Copy Space",
      extraTags: ["flatlay", "overhead", "minimalist", "copyspace", "square", "clean", "surface", "table", "aesthetic", "tactile"],
    },
  ];

  const configs = isTransparent ? variationsConfigTransparent : variationsConfigRegular;

  // วนลูป 5 หมวดหมู่ -> สร้างหมวดละ 4 รายการ = 20 รายการ
  for (let cIdx = 0; cIdx < categories.length && cIdx < 5; cIdx++) {
    const cat = categories[cIdx];
    const modelUsed = cat.modelSuggestion || (isTransparent ? "recraft/recraft-v4.1-flash" : "recraft/recraft-v4.1-flash");
    const isRecraft = modelUsed.includes("recraft");

    for (let vIdx = 0; vIdx < configs.length; vIdx++) {
      const v = configs[vIdx];
      const id = cIdx * 4 + vIdx + 1; // ID 1 ถึง 20

      const seoTitle = `${cat.conceptTitle} ${v.titleSuffix}`.trim();
      const prompt = `${v.anglePrefix} ${cat.subjectDescription}, ${v.styleSuffix}`;
      const negativePrompt = isTransparent
        ? "solid background, color background, human face, portrait, shadows on background, blurry, watermark"
        : "human face, portrait, blurry, distorted, logos, watermark, text, crowded center without copy space";

      // รวบรวมคำสำคัญให้เป็น single words 25-35 คำ
      const combinedKeywords = Array.from(
        new Set([
          ...v.extraTags,
          ...(cat.keywords || []).flatMap((k) => k.toLowerCase().replace(/[^a-z0-9\s-]/g, "").split(/\s+/)),
        ])
      )
        .filter((k) => k.length > 2 && !k.includes(" "))
        .slice(0, 35);

      items.push({
        id,
        seoTitle,
        category: cat.category || "Commercial Stock",
        aspectRatio: v.ratio,
        prompt,
        negativePrompt,
        keywords: combinedKeywords,
        isTransparent,
        generationMode: mode,
        modelUsed,
        filename: generateUniqueStockFilename(seoTitle, id, dateObj, mode),
        costEstimate: isRecraft ? "~$0.007 / image" : "~$0.00003 / image",
      });
    }
  }

  return items;
}

/**
 * Fallback dataset curated strictly from this account's proven top sellers
 */
function getFallbackMarketData(
  mode: "transparent_png" | "regular_scene" = "regular_scene",
  currentDate: string = new Date().toISOString()
): { trend: MarketTrend; items: StockImageItem[]; mode: "transparent_png" | "regular_scene" } {
  const isTransparent = mode === "transparent_png";

  if (isTransparent) {
    const trend: MarketTrend = {
      theme: "Isolated Commercial Cutouts & 3D Design Assets on Transparent Background (Alpha PNG)",
      targetMarket: "Graphic Designers, App Developers, Digital Marketers & Advertising Agencies",
      commercialReasoning: "Matches top-selling PNG download pattern: 100% isolated objects on transparent backgrounds ready for drag-and-drop into posters, web layouts, and commercial collages.",
      seasonalRelevance: "Year-Round Universal Design Demand",
      buyerDemandRating: "Very High",
    };

    const rawTransparentItems: Array<Omit<StockImageItem, "filename" | "isTransparent" | "generationMode">> = [
      {
        id: 1,
        seoTitle: "Modern Telecom 5G Cellular Tower Antenna Isolated on Transparent Background Cutout PNG",
        category: "Technology / Telecom",
        aspectRatio: "1:1",
        prompt: "Isolated commercial stock cutout asset on a 100% transparent background (PNG alpha channel) of a modern telecommunication cellular antenna mast tower with high-tech transmitters, perfectly cut out, sharp crisp edges, zero background shadows, studio lighting, 8k resolution.",
        negativePrompt: "solid background, color background, sky, wires mess, blurry, text, logos",
        keywords: ["isolated", "transparent", "cutout", "png", "telecom", "antenna", "5g", "cellular", "tower", "network", "wireless", "mast", "transmitter", "mobile", "broadband", "station", "receiver", "technology", "communication", "broadcast", "digital", "equipment", "hardware", "satellite"],
        modelUsed: "google/gemini-2.5-flash-image",
        costEstimate: "~$0.00003 / image",
      },
      {
        id: 2,
        seoTitle: "Enterprise Cloud Computing Server Rack Unit Isolated on Transparent Background Cutout PNG",
        category: "Technology / Hardware",
        aspectRatio: "1:1",
        prompt: "Isolated commercial stock cutout asset on a 100% transparent background (PNG alpha channel) of an enterprise dark server rack unit with subtle glowing cyan LED indicator lights, sharp clean cutout silhouette, no background color, studio product lighting.",
        negativePrompt: "solid background, color background, room, floor, blurry, logos, text",
        keywords: ["isolated", "transparent", "cutout", "png", "server", "rack", "datacenter", "cloud", "hardware", "computer", "hosting", "storage", "technology", "network", "cyber", "internet", "enterprise", "telecom", "database", "digital", "chassis", "equipment"],
        modelUsed: "google/gemini-2.5-flash-image",
        costEstimate: "~$0.00003 / image",
      },
      {
        id: 3,
        seoTitle: "Glowing Holographic Cyber Security Shield Icon Isolated on Transparent Background Cutout PNG",
        category: "Technology / Cybersecurity",
        aspectRatio: "1:1",
        prompt: "Isolated commercial 3D graphic asset on a 100% transparent background (PNG alpha channel) of a futuristic glowing blue cyber security shield icon with subtle binary digital circuitry, clean alpha edges, no dark background.",
        negativePrompt: "solid background, black background, blurry, distorted, watermark",
        keywords: ["isolated", "transparent", "cutout", "png", "cybersecurity", "shield", "security", "firewall", "protection", "icon", "data", "safety", "network", "encryption", "digital", "cyber", "defense", "privacy", "virtual", "futuristic", "symbol"],
        modelUsed: "google/gemini-2.5-flash-image",
        costEstimate: "~$0.00003 / image",
      },
      {
        id: 4,
        seoTitle: "Artificial Intelligence Glowing Brain Neural Node Icon Isolated on Transparent Background Cutout PNG",
        category: "Technology / AI",
        aspectRatio: "1:1",
        prompt: "Isolated commercial 3D icon on a 100% transparent background (PNG alpha channel) of a digital neural network brain silhouette made of interconnected glowing cyan dots and lines, clean cutout, no background.",
        negativePrompt: "solid background, dark background, blurry, watermark",
        keywords: ["isolated", "transparent", "cutout", "png", "artificial intelligence", "brain", "neural", "network", "icon", "technology", "smart", "digital", "data", "algorithm", "deep", "learning", "machine", "science", "future", "mind", "concept"],
        modelUsed: "google/gemini-2.5-flash-image",
        costEstimate: "~$0.00003 / image",
      },
      {
        id: 5,
        seoTitle: "Floating Modern Minimalist Blank Wooden Picture Frame Mockup Isolated on Transparent Background Cutout PNG",
        category: "Interiors / Mockups",
        aspectRatio: "1:1",
        prompt: "Isolated commercial stock mockup on a 100% transparent background (PNG alpha channel) of a contemporary light oak vertical poster frame mockup with pure white blank inner mat board, clean sharp cutout edges, soft realistic self-shadow only.",
        negativePrompt: "solid background, wall, room, text in frame, picture in frame, logos",
        keywords: ["isolated", "transparent", "cutout", "png", "mockup", "frame", "poster", "blank", "wood", "picture", "canvas", "border", "minimalist", "display", "template", "empty", "oak", "photo", "art", "modern", "design", "clean"],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      },
      {
        id: 6,
        seoTitle: "Designer Brown Leather Armchair Furniture Isolated on Transparent Background Cutout PNG",
        category: "Interiors / Furniture",
        aspectRatio: "1:1",
        prompt: "Isolated commercial furniture stock photo on a 100% transparent background (PNG alpha channel) of a luxury mid-century modern brown leather armchair with slim black metal legs, sharp cutout silhouette, crisp studio lighting.",
        negativePrompt: "solid background, floor, living room, wall, blurry, distorted",
        keywords: ["isolated", "transparent", "cutout", "png", "armchair", "chair", "leather", "furniture", "interior", "brown", "modern", "luxury", "seat", "design", "living room", "decor", "home", "studio", "comfort", "relax", "nordic"],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      },
      {
        id: 7,
        seoTitle: "Elegant Ceramic Ribbed Vase with Dried Pampas Grass Isolated on Transparent Background Cutout PNG",
        category: "Interiors / Decor",
        aspectRatio: "1:1",
        prompt: "Isolated aesthetic home decor cutout on a 100% transparent background (PNG alpha channel) of a beige fluted ceramic vase holding fluffy dried pampas grass stems, sharp clean alpha edges, soft neutral studio lighting.",
        negativePrompt: "solid background, table, room, wall, blurry",
        keywords: ["isolated", "transparent", "cutout", "png", "vase", "pampas", "grass", "ceramic", "decor", "interior", "fluffy", "dried", "beige", "neutral", "home", "aesthetic", "minimalist", "boho", "decoration", "plant", "floral"],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      },
      {
        id: 8,
        seoTitle: "Modern Slim Aluminum Laptop with Blank Dark Screen Mockup Isolated on Transparent Background Cutout PNG",
        category: "Technology / Devices",
        aspectRatio: "1:1",
        prompt: "Isolated commercial device photo on a 100% transparent background (PNG alpha channel) of a sleek open aluminum laptop seen at a three-quarter angle with a completely blank dark display screen mockup, perfectly clean cutout edges.",
        negativePrompt: "solid background, desk, hands, brand logos, keyboard text distortion",
        keywords: ["isolated", "transparent", "cutout", "png", "laptop", "mockup", "screen", "computer", "notebook", "aluminum", "display", "blank", "device", "technology", "office", "work", "business", "modern", "portable", "tech"],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      },
      {
        id: 9,
        seoTitle: "Two Wooden Pebble Tokens with Smiling Happy and Frowning Sad Emoji Faces Isolated on Transparent Background Cutout PNG",
        category: "Concepts / Feedback",
        aspectRatio: "1:1",
        prompt: "Isolated commercial 3D concept photo on a 100% transparent background (PNG alpha channel) of two rounded smooth natural wood pebble tokens side-by-side, one engraved with a happy smiling face and one with a sad frowning face, clean alpha cutout.",
        negativePrompt: "solid background, hands, table, blurry, logos",
        keywords: ["isolated", "transparent", "cutout", "png", "feedback", "rating", "emoji", "token", "wood", "happy", "sad", "review", "satisfaction", "customer", "sentiment", "choice", "emotion", "service", "score", "survey", "opinion"],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      },
      {
        id: 10,
        seoTitle: "Stack of Shiny Gold Coins with Miniature Graduation Cap Isolated on Transparent Background Cutout PNG",
        category: "Concepts / Finance",
        aspectRatio: "1:1",
        prompt: "Isolated commercial 3D conceptual photo on a 100% transparent background (PNG alpha channel) of a neat rising stack of shiny gold coins topped with a small black academic graduation mortarboard cap, clean cutout silhouette.",
        negativePrompt: "solid background, surface, shadow, blurry, text",
        keywords: ["isolated", "transparent", "cutout", "png", "coins", "gold", "graduation", "cap", "finance", "education", "scholarship", "loan", "investment", "money", "student", "savings", "wealth", "tuition", "success", "future"],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      },
      {
        id: 11,
        seoTitle: "Vintage Brass Justice Balance Scale in Equilibrium Isolated on Transparent Background Cutout PNG",
        category: "Concepts / Law",
        aspectRatio: "1:1",
        prompt: "Isolated commercial stock object on a 100% transparent background (PNG alpha channel) of an antique polished brass justice balance scale hanging perfectly level in equilibrium, sharp clean cutout edges, studio lighting.",
        negativePrompt: "solid background, table, wall, distorted chains",
        keywords: ["isolated", "transparent", "cutout", "png", "justice", "scale", "balance", "brass", "law", "legal", "court", "equality", "equity", "ethics", "judgment", "lawyer", "attorney", "judge", "fairness", "weight", "symbol"],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      },
      {
        id: 12,
        seoTitle: "Single Glowing Warm Yellow Light Bulb Isolated on Transparent Background Cutout PNG",
        category: "Concepts / Ideas",
        aspectRatio: "1:1",
        prompt: "Isolated commercial concept image on a 100% transparent background (PNG alpha channel) of an upright traditional glass incandescent light bulb with glowing golden-yellow filament, sharp glass cutout edges, no solid background.",
        negativePrompt: "solid background, black background, socket, wires, blurry",
        keywords: ["isolated", "transparent", "cutout", "png", "light bulb", "bulb", "idea", "innovation", "creativity", "glow", "energy", "bright", "inspiration", "thinking", "solution", "genius", "brainstorm", "concept", "electricity", "invention"],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      },
      {
        id: 13,
        seoTitle: "Small Green Plant Sprout Growing from Dark Organic Soil Clump Isolated on Transparent Background Cutout PNG",
        category: "Concepts / Environment",
        aspectRatio: "1:1",
        prompt: "Isolated commercial nature cutout on a 100% transparent background (PNG alpha channel) of a vibrant green young sprout seedling growing out of a compact rounded clump of rich dark fertile soil, crisp alpha edges, fresh dewy leaf texture.",
        negativePrompt: "solid background, pot, garden, blurry, watermark",
        keywords: ["isolated", "transparent", "cutout", "png", "sprout", "plant", "seedling", "growth", "soil", "green", "nature", "sustainability", "environment", "esg", "earth", "organic", "eco", "agriculture", "spring", "life", "invest"],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      },
      {
        id: 14,
        seoTitle: "Whole Exotic Star Anise Spice Pods Cluster Isolated on Transparent Background Cutout PNG",
        category: "Food & Beverage / Spices",
        aspectRatio: "1:1",
        prompt: "Isolated commercial food photography asset on a 100% transparent background (PNG alpha channel) of a cluster of dry natural star anise pods, rich textured brown woody petals, sharp studio focus, zero background shadows.",
        negativePrompt: "solid background, table, bowl, blurry, watermark",
        keywords: ["isolated", "transparent", "cutout", "png", "star anise", "anise", "spice", "culinary", "ingredient", "seasoning", "herb", "organic", "cooking", "aromatic", "kitchen", "asian", "dry", "flavor", "gourmet", "natural", "seed"],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      },
      {
        id: 15,
        seoTitle: "Cinnamon Sticks Bundle Tied with Natural Twine Isolated on Transparent Background Cutout PNG",
        category: "Food & Beverage / Spices",
        aspectRatio: "1:1",
        prompt: "Isolated commercial culinary asset on a 100% transparent background (PNG alpha channel) of five real Ceylon cinnamon bark quills bundled together and neatly tied with rustic natural jute string, sharp cutout silhouette.",
        negativePrompt: "solid background, wood surface, cloth, blurry",
        keywords: ["isolated", "transparent", "cutout", "png", "cinnamon", "stick", "twine", "spice", "culinary", "baking", "aromatic", "ingredient", "bark", "flavor", "organic", "natural", "cooking", "gourmet", "kitchen", "seasoning"],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      },
      {
        id: 16,
        seoTitle: "Fresh Vibrant Green Rosemary Herb Sprig Isolated on Transparent Background Cutout PNG",
        category: "Food & Beverage / Herbs",
        aspectRatio: "1:1",
        prompt: "Isolated commercial culinary photograph on a 100% transparent background (PNG alpha channel) of a single fresh culinary rosemary sprig with needle-like green leaves, clean alpha channel cutout, crisp detailed botanical texture.",
        negativePrompt: "solid background, chopping board, dish, blurry, watermark",
        keywords: ["isolated", "transparent", "cutout", "png", "rosemary", "herb", "sprig", "fresh", "green", "culinary", "leaf", "cooking", "seasoning", "organic", "ingredient", "aromatic", "kitchen", "natural", "healthy", "food", "gourmet"],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      },
      {
        id: 17,
        seoTitle: "Dark Roasted Arabica Coffee Beans Pile Isolated on Transparent Background Cutout PNG",
        category: "Food & Beverage / Coffee",
        aspectRatio: "1:1",
        prompt: "Isolated commercial product asset on a 100% transparent background (PNG alpha channel) of a neat small mound of glossy dark roasted Arabica coffee beans, rich brown color, detailed oily bean texture, sharp cutout boundary.",
        negativePrompt: "solid background, sack, cup, table, blurry",
        keywords: ["isolated", "transparent", "cutout", "png", "coffee", "bean", "roasted", "arabica", "espresso", "caffeine", "pile", "aroma", "grain", "brown", "beverage", "cafe", "kitchen", "ingredient", "food", "organic", "natural"],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      },
      {
        id: 18,
        seoTitle: "Fresh Golden Turmeric Root and Sliced Pieces Isolated on Transparent Background Cutout PNG",
        category: "Food & Beverage / Spices",
        aspectRatio: "1:1",
        prompt: "Isolated commercial botanical food photo on a 100% transparent background (PNG alpha channel) of a fresh knobby turmeric rhizome root alongside several cut circular orange slices, clean alpha cutout, vibrant golden color.",
        negativePrompt: "solid background, plate, soil, blurry, watermark",
        keywords: ["isolated", "transparent", "cutout", "png", "turmeric", "root", "spice", "orange", "sliced", "curry", "culinary", "healthy", "organic", "ingredient", "herb", "kitchen", "seasoning", "ayurveda", "fresh", "natural", "superfood"],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      },
      {
        id: 19,
        seoTitle: "Vibrant Autumn Golden Maple Leaf with Dew Drops Isolated on Transparent Background Cutout PNG",
        category: "Seasonal / Nature",
        aspectRatio: "1:1",
        prompt: "Isolated seasonal botanical element on a 100% transparent background (PNG alpha channel) of a single real Canadian maple leaf in rich golden-orange autumn colors with tiny crystal water dew drops on surface, crisp alpha edges.",
        negativePrompt: "solid background, tree, branch, blurry, fake leaf",
        keywords: ["isolated", "transparent", "cutout", "png", "leaf", "autumn", "fall", "maple", "orange", "gold", "seasonal", "october", "november", "nature", "thanksgiving", "foliage", "dew", "drop", "water", "botanical", "vibrant"],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      },
      {
        id: 20,
        seoTitle: "Decorative Carved Festive Halloween Pumpkin Isolated on Transparent Background Cutout PNG",
        category: "Seasonal / Holidays",
        aspectRatio: "1:1",
        prompt: "Isolated holiday commercial asset on a 100% transparent background (PNG alpha channel) of a vibrant round orange pumpkin with natural textured green stem, perfectly cut out, studio flash lighting, crisp clean silhouette edges.",
        negativePrompt: "solid background, field, porch, dirty, blurry, text",
        keywords: ["isolated", "transparent", "cutout", "png", "pumpkin", "halloween", "autumn", "fall", "orange", "seasonal", "october", "harvest", "thanksgiving", "vegetable", "gourd", "holiday", "celebration", "food", "farm", "clean"],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      },
    ];

    const cleanSingleWords = (tags: string[]) =>
      Array.from(new Set(tags.flatMap((t) => t.toLowerCase().replace(/[^a-z0-9\s-]/g, "").split(/\s+/))))
        .filter((t) => t.length > 2 && !t.includes(" "))
        .slice(0, 35);

    return {
      trend,
      items: rawTransparentItems.map((item) => ({
        ...item,
        keywords: cleanSingleWords(item.keywords),
        isTransparent: true,
        generationMode: "transparent_png",
        filename: generateUniqueStockFilename(item.seoTitle, item.id, new Date(currentDate), "transparent_png"),
      })),
      mode: "transparent_png",
    };
  }

  // Regular Commercial Scene Fallback
  const trend: MarketTrend = {
    theme: "Cloud Computing, Cyber Security & Modern Interior Mockups with Copy Space",
    targetMarket: "Global Enterprise IT, FinTech, Modern Architecture & Commercial Advertising",
    commercialReasoning: "Matches the account's historical top earners: High-demand tech infrastructure, data server rooms, interior frame mockups, and conceptual business metaphors with proven 180+ downloads.",
    seasonalRelevance: "Year-Round Evergreen Commercial Demand + Q4 Enterprise Budget Planning",
    buyerDemandRating: "Very High",
  };

  const rawItems: Array<Omit<StockImageItem, "filename" | "isTransparent" | "generationMode">> = [
    {
      id: 1,
      seoTitle: "Cloud Computing Data Center with Glowing Blue Neon Server Racks",
      category: "Technology / Business",
      aspectRatio: "16:9",
      prompt: "Ultra-wide 16:9 commercial shot of an enterprise cloud data center corridor with rows of sleek dark server racks, vibrant glowing neon blue and orange fiber optic light trails flowing into a central holographic cloud icon, cinematic symmetry, vast dark negative copy space on the right side for tech banner headlines, 8k resolution, shot on Sony A7R IV, clean photorealistic focus, no people.",
      negativePrompt: "people, human face, blurry, text, watermark, logo",
      keywords: [
        "cloud computing", "datacenter", "server", "cybersecurity", "infrastructure",
        "database", "network", "technology", "hosting", "storage",
        "copy space", "neon", "blue", "digital", "futuristic",
        "internet", "hardware", "rack", "connection", "information",
        "telecom", "cyber", "virtual", "speed", "fiber",
        "glow", "dark", "communication", "computing", "modern"
      ],
      modelUsed: "google/gemini-2.5-flash-image",
      costEstimate: "~$0.00003 / image",
    },
    {
      id: 2,
      seoTitle: "Minimalist Scandinavian Living Room with Blank Poster Frame Mockup",
      category: "Interiors / Architecture",
      aspectRatio: "3:2",
      prompt: "Clean commercial 3:2 interior photograph of a modern aesthetic living room with a large vertical blank wooden picture frame mockup hanging on a textured warm white wall, elegant brown leather armchair, minimalist ceramic vase with dried pampas grass, soft diffused morning window light casting gentle shadows, high-end architectural digest styling, ample copy space, no people.",
      negativePrompt: "people, human face, cluttered, messy, distorted, text in frame, logos",
      keywords: [
        "mockup", "frame", "interior", "poster", "wall",
        "minimalist", "scandinavian", "living room", "blank", "canvas",
        "copy space", "leather", "armchair", "furniture", "modern",
        "aesthetic", "home", "architecture", "design", "decor",
        "indoor", "wooden", "neutral", "daylight", "apartment",
        "clean", "styling", "cozy", "pampas", "vase"
      ],
      modelUsed: "recraft/recraft-v4.1-flash",
      costEstimate: "~$0.007 / image",
    },
    {
      id: 3,
      seoTitle: "Flat Lay Composition of Aromatic Culinary Spices on Dark Slate",
      category: "Food & Beverage / Backgrounds",
      aspectRatio: "1:1",
      prompt: "Overhead 1:1 top-down flat lay photograph of colorful exotic culinary spices (star anise, cinnamon sticks, golden turmeric, crushed red chili, cardamom pods, black peppercorns) arranged in bowls in an organic circle around a large empty black slate stone copy space in the center, professional food photography lighting, rich textures, no people.",
      negativePrompt: "people, human face, hand, blurry, watermark, text, dirty slate",
      keywords: [
        "spice", "culinary", "seasoning", "flat lay", "slate",
        "herb", "ingredient", "organic", "anise", "cinnamon",
        "copy space", "turmeric", "peppercorn", "cardamom", "cooking",
        "flavor", "kitchen", "aromatic", "gourmet", "overhead",
        "healthy", "natural", "seed", "powder", "table",
        "dark", "mortar", "bowl", "texture", "recipe"
      ],
      modelUsed: "recraft/recraft-v4.1-flash",
      costEstimate: "~$0.007 / image",
    },
    {
      id: 4,
      seoTitle: "Hands Holding Wooden Cubes with Happy and Sad Face Icons",
      category: "Concepts / Business & Lifestyle",
      aspectRatio: "4:5",
      prompt: "Conceptual 4:5 portrait composition focusing exclusively on two hands holding two rounded smooth wooden pebble tokens, one carved with a smiling happy emoji face and the other with a frowning sad face, clean blurred warm neutral studio background, symbol of customer satisfaction, mental health, feedback rating and emotion choice, soft daylight, no visible human face.",
      negativePrompt: "human face, full body, distorted fingers, extra hands, logos, watermark",
      keywords: [
        "feedback", "satisfaction", "rating", "review", "emotion",
        "hand", "customer", "choice", "psychology", "experience",
        "copy space", "cube", "wooden", "happy", "sad",
        "sentiment", "service", "evaluation", "score", "survey",
        "opinion", "client", "concept", "balance", "decision",
        "gesture", "holding", "token", "feeling", "business"
      ],
      modelUsed: "recraft/recraft-v4.1-flash",
      costEstimate: "~$0.007 / image",
    },
    {
      id: 5,
      seoTitle: "Modern Telecom 5G Cellular Tower Antenna Isolated on White Background",
      category: "Technology / Telecom",
      aspectRatio: "3:2",
      prompt: "Commercial 3:2 stock photograph of a modern telecommunication cellular antenna mast tower with high-tech transmitters and microwave dish receivers, perfectly isolated on a pure clean white studio background with abundant copy space, sharp focus, 8k resolution, photorealistic, clean technological cutout asset, no people.",
      negativePrompt: "people, human face, cluttered sky, wires mess, watermark, blurry",
      keywords: [
        "telecom", "antenna", "cellular", "tower", "transmitter",
        "network", "wireless", "mast", "isolated", "telecommunication",
        "copy space", "mobile", "broadband", "station", "receiver",
        "technology", "communication", "dish", "signal", "broadcast",
        "digital", "cutout", "white", "radio", "equipment",
        "infrastructure", "connectivity", "pole", "hardware", "satellite"
      ],
      modelUsed: "google/gemini-2.5-flash-image",
      costEstimate: "~$0.00003 / image",
    },
    {
      id: 6,
      seoTitle: "Cyber Security Digital Shield with Glowing Fiber Optic Network Data Lines",
      category: "Technology / Cybersecurity",
      aspectRatio: "16:9",
      prompt: "Cinematic 16:9 commercial technology banner of a glowing holographic digital cyber security shield icon floating in a dark high-tech server room with flowing neon blue and orange fiber optic data streams, dark empty copy space on the right, 8k resolution, clean photorealistic render, no people.",
      negativePrompt: "people, human face, blurry, watermark, text, logos",
      keywords: [
        "cybersecurity", "security", "shield", "firewall", "protection",
        "data", "network", "cloud", "technology", "encryption",
        "copy space", "neon", "blue", "digital", "safety",
        "server", "cyber", "internet", "defense", "privacy",
        "code", "virtual", "futuristic", "datacenter", "infrastructure",
        "glow", "secure", "connection", "information", "computing"
      ],
      modelUsed: "google/gemini-2.5-flash-image",
      costEstimate: "~$0.00003 / image",
    },
    {
      id: 7,
      seoTitle: "High Tech Automated Data Center Corridor with Orange and Blue Laser Lighting",
      category: "Technology / Infrastructure",
      aspectRatio: "16:9",
      prompt: "Wide angle 16:9 shot of a vast futuristic enterprise data center aisle with rows of dark server racks, orange and cyan laser light accents running along the polished reflective floor, wide negative copy space on the left, professional corporate photography, 8k, no people.",
      negativePrompt: "people, human face, distorted, text, logos, watermark",
      keywords: [
        "datacenter", "server", "corridor", "cloud", "infrastructure",
        "hardware", "technology", "hosting", "storage", "aisle",
        "copy space", "laser", "orange", "blue", "reflection",
        "cyber", "rack", "internet", "modern", "computer",
        "digital", "network", "speed", "facility", "enterprise",
        "telecom", "processing", "futuristic", "database", "lights"
      ],
      modelUsed: "google/gemini-2.5-flash-image",
      costEstimate: "~$0.00003 / image",
    },
    {
      id: 8,
      seoTitle: "Abstract Big Data Analytics Neural Network Flow on Dark Slate Background",
      category: "Technology / Artificial Intelligence",
      aspectRatio: "16:9",
      prompt: "Ultra-wide 16:9 commercial background of glowing interconnected AI neural network nodes and data particles flowing organically against a deep midnight blue background, vast clean copy space for enterprise software headlines, 8k resolution, photorealistic, no text.",
      negativePrompt: "people, human face, blurry, text, logos, watermark",
      keywords: [
        "artificial intelligence", "big data", "neural", "network", "algorithm",
        "technology", "analytics", "abstract", "digital", "data",
        "copy space", "particle", "glow", "blue", "science",
        "connection", "flow", "future", "machine", "learning",
        "cyber", "computing", "mesh", "nodes", "intelligence",
        "deep", "smart", "wave", "infographic", "banner"
      ],
      modelUsed: "google/gemini-2.5-flash-image",
      costEstimate: "~$0.00003 / image",
    },
    {
      id: 9,
      seoTitle: "Luxury Minimalist Bathroom with Marble Countertop and Blank Wall Mirror Mockup",
      category: "Interiors / Architecture",
      aspectRatio: "3:2",
      prompt: "Clean 3:2 architectural photography of a luxury modern minimalist bathroom with a honed grey marble vanity countertop, matte black faucet, and an arched blank empty mirror mockup on a plaster wall, soft diffused natural morning light, ample copy space, no people.",
      negativePrompt: "people, human face, dirty, cluttered, distorted, logos",
      keywords: [
        "mockup", "bathroom", "interior", "mirror", "marble",
        "minimalist", "luxury", "vanity", "architecture", "faucet",
        "copy space", "countertop", "modern", "design", "clean",
        "plaster", "wall", "home", "spa", "neutral",
        "light", "decor", "aesthetic", "residential", "styling",
        "morning", "sink", "elegance", "indoor", "blank"
      ],
      modelUsed: "recraft/recraft-v4.1-flash",
      costEstimate: "~$0.007 / image",
    },
    {
      id: 10,
      seoTitle: "Aesthetic Home Office Workspace with Blank Laptop Screen Mockup and Plant",
      category: "Interiors / Work & Business",
      aspectRatio: "16:9",
      prompt: "Commercial 16:9 lifestyle interior photo of a sleek oak desk with a modern slim laptop featuring a clean blank empty black screen mockup, small ceramic plant pot, coffee mug, soft window sunlight, clean negative copy space on the right, no people.",
      negativePrompt: "people, human face, messy, dirty, cluttered, brand logos",
      keywords: [
        "mockup", "laptop", "workspace", "desk", "office",
        "screen", "interior", "minimalist", "technology", "remote",
        "copy space", "plant", "coffee", "oak", "wood",
        "clean", "home", "work", "aesthetic", "blank",
        "display", "modern", "freelance", "business", "neutral",
        "daylight", "decor", "productivity", "study", "table"
      ],
      modelUsed: "recraft/recraft-v4.1-flash",
      costEstimate: "~$0.007 / image",
    },
    {
      id: 11,
      seoTitle: "Contemporary Art Gallery Interior with Large Empty Canvas Mockup on Concrete Wall",
      category: "Interiors / Architecture",
      aspectRatio: "3:2",
      prompt: "High-end 3:2 architectural photograph of an empty modern art gallery exhibition space with polished concrete floors and a massive blank white rectangular canvas mockup hanging on a textured wall, track spotlighting, vast copy space, no people.",
      negativePrompt: "people, human face, paintings on canvas, cluttered, text, logos",
      keywords: [
        "mockup", "gallery", "canvas", "art", "interior",
        "exhibition", "concrete", "wall", "blank", "museum",
        "copy space", "spotlight", "modern", "contemporary", "minimalist",
        "architecture", "display", "studio", "hall", "floor",
        "clean", "frame", "poster", "light", "space",
        "poster", "showroom", "empty", "urban", "design"
      ],
      modelUsed: "recraft/recraft-v4.1-flash",
      costEstimate: "~$0.007 / image",
    },
    {
      id: 12,
      seoTitle: "Cozy Neutral Bedroom Interior with Blank Wooden Picture Frame Mockup Above Bed",
      category: "Interiors / Home Decor",
      aspectRatio: "4:5",
      prompt: "Serene 4:5 interior photograph of a warm minimalist bedroom with linen bedding, wooden headboard, and a vertical blank picture frame mockup hanging on a beige wall above the pillows, soft morning shadows, generous copy space, no people.",
      negativePrompt: "people, human face, messy bed, text on frame, logos, blurry",
      keywords: [
        "mockup", "frame", "bedroom", "interior", "bed",
        "poster", "linen", "minimalist", "wall", "blank",
        "copy space", "cozy", "pillow", "wood", "headboard",
        "neutral", "home", "decor", "aesthetic", "design",
        "daylight", "morning", "relax", "beige", "peaceful",
        "shadow", "furniture", "canvas", "room", "indoor"
      ],
      modelUsed: "recraft/recraft-v4.1-flash",
      costEstimate: "~$0.007 / image",
    },
    {
      id: 13,
      seoTitle: "Hands Stacking Gold Coins with Small Graduation Cap for Student Finance Concept",
      category: "Concepts / Finance & Education",
      aspectRatio: "4:5",
      prompt: "Conceptual 4:5 photograph showing hands carefully stacking shiny gold coins with a miniature black graduation cap resting on top of the highest stack, warm clean studio background with copy space, symbol of scholarship, student loan, and education investment, soft focus, no human face.",
      negativePrompt: "human face, full body, distorted fingers, extra fingers, logos, watermark",
      keywords: [
        "finance", "education", "graduation", "coins", "investment",
        "money", "scholarship", "savings", "stack", "growth",
        "copy space", "cap", "loan", "student", "college",
        "university", "hand", "gold", "future", "concept",
        "success", "budget", "wealth", "banking", "economy",
        "academic", "career", "study", "tuition", "holding"
      ],
      modelUsed: "recraft/recraft-v4.1-flash",
      costEstimate: "~$0.007 / image",
    },
    {
      id: 14,
      seoTitle: "Hand Holding Brass Balance Scale of Justice with Clean Neutral Studio Background",
      category: "Concepts / Law & Business",
      aspectRatio: "3:2",
      prompt: "Symbolic 3:2 commercial stock photo of a hand in professional attire holding a vintage brass balance scale in equilibrium, soft neutral beige studio background with abundant copy space on the right side, symbol of legal justice, ethics, equity, and fair trade, no face visible.",
      negativePrompt: "human face, full body, distorted fingers, extra fingers, logos, watermark",
      keywords: [
        "justice", "scale", "law", "balance", "legal",
        "court", "equity", "ethics", "equality", "judgment",
        "copy space", "brass", "hand", "lawyer", "attorney",
        "judge", "business", "fairness", "decision", "weight",
        "symbol", "neutral", "authority", "order", "truth",
        "honest", "measure", "professional", "holding", "concept"
      ],
      modelUsed: "recraft/recraft-v4.1-flash",
      costEstimate: "~$0.007 / image",
    },
    {
      id: 15,
      seoTitle: "Single Glowing Yellow Light Bulb Standing Out Among Dark Matte Light Bulbs",
      category: "Concepts / Leadership & Ideas",
      aspectRatio: "16:9",
      prompt: "Metaphorical 16:9 banner of one brightly illuminated warm yellow light bulb standing upright and glowing vividly in the center, surrounded by unlit dark matte grey light bulbs resting horizontally on a dark surface, vast negative copy space on the right, symbol of innovative thinking and leadership, no people.",
      negativePrompt: "people, human face, text, watermark, blurry, logos",
      keywords: [
        "idea", "leadership", "innovation", "creativity", "bulb",
        "inspiration", "unique", "solution", "glow", "concept",
        "copy space", "light", "bright", "standout", "thinking",
        "difference", "contrast", "genius", "brainstorm", "dark",
        "power", "energy", "yellow", "business", "vision",
        "talent", "individuality", "success", "bright", "invention"
      ],
      modelUsed: "recraft/recraft-v4.1-flash",
      costEstimate: "~$0.007 / image",
    },
    {
      id: 16,
      seoTitle: "Hands Holding Tender Green Sprout Growing in Rich Dark Soil with Soft Bokeh Light",
      category: "Concepts / Growth & Environment",
      aspectRatio: "4:5",
      prompt: "Close-up 4:5 conceptual photograph of two gentle hands cupping and nurturing a fresh green sprout seedling rooted in fertile dark soil, warm golden sunlight bokeh in background, ample copy space above, symbol of environmental sustainability, corporate ESG, and financial growth, no face visible.",
      negativePrompt: "human face, full body, distorted fingers, logos, watermark, text",
      keywords: [
        "growth", "seedling", "sprout", "plant", "sustainability",
        "environment", "nature", "soil", "care", "green",
        "copy space", "hand", "earth", "esg", "ecology",
        "future", "invest", "agriculture", "organic", "hope",
        "life", "nurture", "development", "eco", "spring",
        "symbol", "fresh", "holding", "seed", "concept"
      ],
      modelUsed: "recraft/recraft-v4.1-flash",
      costEstimate: "~$0.007 / image",
    },
    {
      id: 17,
      seoTitle: "Overhead Composition of Fresh Green Culinary Herbs and Olive Oil on Rustic Dark Wood",
      category: "Food & Beverage / Backgrounds",
      aspectRatio: "1:1",
      prompt: "Top-down 1:1 flat lay of fresh rosemary, thyme sprigs, whole garlic cloves, and clear glass cruet with golden extra virgin olive oil arranged around an empty central rustic dark cutting board copy space, soft commercial food photography lighting, rich texture, no people.",
      negativePrompt: "people, human face, hand, dirty wood, watermark, text",
      keywords: [
        "herb", "culinary", "oil", "flat lay", "rosemary",
        "garlic", "thyme", "food", "kitchen", "cooking",
        "copy space", "rustic", "wood", "organic", "ingredient",
        "overhead", "seasoning", "healthy", "gourmet", "fresh",
        "olive", "flavor", "recipe", "table", "board",
        "diet", "natural", "chef", "mediterranean", "texture"
      ],
      modelUsed: "recraft/recraft-v4.1-flash",
      costEstimate: "~$0.007 / image",
    },
    {
      id: 18,
      seoTitle: "Top View Roasted Aromatic Coffee Beans Arranged with Empty Round Center Copy Space",
      category: "Food & Beverage / Backgrounds",
      aspectRatio: "1:1",
      prompt: "Professional 1:1 overhead flat lay photograph of dark roasted Arabica coffee beans evenly encircling a clean circular empty dark background copy space in the middle, intense coffee texture, rich brown tones, crisp lighting, no people.",
      negativePrompt: "people, human face, hand, blurry, text, watermark, cup",
      keywords: [
        "coffee", "bean", "roasted", "flat lay", "arabica",
        "cafe", "aroma", "espresso", "caffeine", "background",
        "copy space", "circle", "dark", "brown", "grain",
        "texture", "beverage", "kitchen", "organic", "overhead",
        "morning", "roast", "food", "table", "natural",
        "fresh", "drink", "gourmet", "ingredient", "energy"
      ],
      modelUsed: "recraft/recraft-v4.1-flash",
      costEstimate: "~$0.007 / image",
    },
    {
      id: 19,
      seoTitle: "Flat Lay Composition of Asian Curry Seasonings and Golden Turmeric in Ceramic Bowls",
      category: "Food & Beverage / Backgrounds",
      aspectRatio: "1:1",
      prompt: "Vibrant 1:1 square flat lay of colorful Indian and Thai curry spices (bright yellow turmeric powder, red chili flakes, coriander seeds, cumin) in handmade ceramic pinch bowls on dark stone surface with wide center copy space, professional commercial studio lighting, no people.",
      negativePrompt: "people, human face, hand, messy, text, watermark, logos",
      keywords: [
        "spice", "turmeric", "curry", "flat lay", "seasoning",
        "culinary", "herb", "ingredient", "cooking", "powder",
        "copy space", "chili", "coriander", "asian", "bowl",
        "ceramic", "food", "yellow", "indian", "flavor",
        "organic", "healthy", "kitchen", "gourmet", "recipe",
        "overhead", "seed", "table", "aromatic", "stone"
      ],
      modelUsed: "recraft/recraft-v4.1-flash",
      costEstimate: "~$0.007 / image",
    },
    {
      id: 20,
      seoTitle: "Elegant Autumn Golden Maple Leaves Border Banner on White Marble with Center Copy Space",
      category: "Seasonal / Backgrounds",
      aspectRatio: "16:9",
      prompt: "Ultra-wide 16:9 commercial autumn banner photograph with crisp real golden, orange, and amber maple leaves framing the top and bottom borders on a luxurious clean white Carrara marble surface, generous empty center copy space for seasonal marketing campaigns, soft diffused daylight, no people.",
      negativePrompt: "people, human face, fake leaves, blurry, dirty marble, text, watermark",
      keywords: [
        "autumn", "leaf", "fall", "banner", "marble",
        "maple", "seasonal", "orange", "gold", "border",
        "copy space", "white", "frame", "nature", "thanksgiving",
        "october", "november", "clean", "luxury", "foliage",
        "texture", "flat lay", "elegant", "background", "season",
        "vibrant", "overhead", "surface", "celebration", "carrara"
      ],
      modelUsed: "recraft/recraft-v4.1-flash",
      costEstimate: "~$0.007 / image",
    }
  ];

  const cleanSingleWords = (tags: string[]) =>
    Array.from(new Set(tags.flatMap((t) => t.toLowerCase().replace(/[^a-z0-9\s-]/g, "").split(/\s+/))))
      .filter((t) => t.length > 2 && !t.includes(" "))
      .slice(0, 35);

  return {
    trend,
    items: rawItems.map((item) => ({
      ...item,
      keywords: cleanSingleWords(item.keywords),
      isTransparent: false,
      generationMode: "regular_scene",
      filename: generateUniqueStockFilename(item.seoTitle, item.id, new Date(currentDate), "regular_scene"),
    })),
    mode: "regular_scene",
  };
}
