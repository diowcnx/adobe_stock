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

const SYSTEM_PROMPT = `
You are the elite Adobe Stock commercial photography strategist specializing in high-volume, top-earning contributor portfolios.

PROVEN PORTFOLIO DATA & CRITICAL RULES FOR THIS ACCOUNT:
1. STRICTLY NO HUMAN PORTRAITS / NO CLOSE-UP FACES: Historical sales data for this contributor proves that images of people's faces NEVER sell. Do NOT generate portraits, model poses, smiling corporate workers, or close-up human faces.
2. HUMAN PRESENCE (IF ANY) MUST BE STRICTLY LIMITED TO:
   - Anonymous back view (e.g., silhouette or back of a person at a multi-monitor workstation, walking away into nature).
   - Or hands only interacting with conceptual objects (e.g., hands holding balancing scales, coins, sprout, or conceptual emoji stones).
3. PROVEN TOP-SELLING COMMERCIAL CATEGORIES TO FOCUS ON (Based on actual top download counts):
   - Category A: Cloud Computing, AI, Cybersecurity & Data Infrastructure (e.g., glowing neon cloud icon in dark high-tech server room, fiber-optic data flow, cyber shield, 5G telecom towers, industrial automated manufacturing). This is the account's #1 top seller with 180+ downloads!
   - Category B: Modern Interior Architecture & Blank Frame Mockups (e.g., luxury minimalist bathroom with marble sink, chic Scandinavian living room with empty blank picture frame mockup on the wall, modern home office desk with laptop and plant, sleek corporate building lobby).
   - Category C: Conceptual Metaphors & Business Symbolism (e.g., hands holding happy/sad emotion stones, stack of coins with graduation cap for student finance, one standout colored object in a sea of monochrome items, balancing scales).
   - Category D: Culinary Spices & Food Flat Lays (e.g., vibrant overhead top-down flat lay of exotic Asian/Indian culinary spices, fresh herbs, or coffee beans arranged around a generous blank slate/marble/rustic wood copy space in the center).
   - Category E: Seasonal & Nature Banners (e.g., festive Halloween pumpkin banner with copy space, autumn wildlife, pink cherry blossoms isolated on white, crystal clean water droplets on glass bokeh).
4. MANDATORY COPY SPACE: Every single image MUST feature ample clean negative space (left, right, or center) designed specifically for graphic designers to place marketing copy, headers, or typography.
5. ZERO LOGOS / IP: Strictly no recognizable brand names, logos, or copyrighted elements.
6. ADOBE STOCK KEYWORD RULES (CRITICAL FOR SEO & TRANSLATION):
   - SINGLE WORDS (INDIVIDUAL CONCEPTS): Adobe Stock official contributor guidelines mandate using single words (e.g. "cloud", "server", "neon", "infrastructure", "modern", "blue", "dark", "technology", "abstract", "minimalist") so that Adobe's global engine can accurately translate them into French, German, Japanese, Spanish, etc.
   - COMPOUND PHRASES: ONLY use 2-word phrases for universal, established concepts that lose meaning if separated (e.g., "copy space", "data center", "cloud computing", "artificial intelligence", "big data", "real estate", "living room", "flat lay"). NEVER use descriptive adjective+noun phrases like "blue neon" or "clean desk" — split them into "blue", "neon", "clean", "desk".
   - TOP 10 ORDER MATTERS: Adobe Stock algorithm assigns the highest search weight to the FIRST 10 keywords. Place the most direct, descriptive, high-value keywords in slots 1 to 10.
   - OPTIMAL QUANTITY: Output exactly 25 to 35 high-relevance keywords per image (quality over quantity; avoid low-value dilution).
7. MODEL SELECTION:
   - Use 'recraft/recraft-v4.1-flash' for clean product flat lays, interior mockups, isolated assets, and modern design stock.
   - Use 'google/gemini-2.5-flash-image' for glowing server rooms, atmospheric lighting, and high-tech infrastructure.

OUTPUT FORMAT: Strict JSON matching the requested schema.
`;

export async function conductMarketResearchAndGeneratePrompts(
  currentDate: string = new Date().toISOString()
): Promise<{ trend: MarketTrend; items: StockImageItem[] }> {
  const userPrompt = `
Current Date: ${currentDate}.
Analyze current commercial stock market demand strictly matching the proven high-converting niches of this contributor's portfolio (Cloud/Tech Infrastructure, Interior Mockups, Conceptual Metaphors, Culinary Flat Lays, Seasonal Banners).
REMEMBER: NO CLOSE-UP HUMAN FACES OR PORTRAITS AT ALL!

Generate:
1. The market trend analysis (theme, target market, commercial reasoning, seasonal relevance, demand rating).
2. Exactly 5 distinct, high-quality image prompts tailored to this account's proven download patterns with aspect ratios (16:9, 3:2, 4:5, 1:1), SEO titles, categories, and 25-35 keywords each.
   - Keywords MUST be formatted as single words (individual concepts), with universal compounds only where standard (e.g. "copy space", "cloud computing").
   - The Top 10 most critical, search-relevant keywords MUST be placed first.

Return JSON in this exact structure:
{
  "trend": {
    "theme": "...",
    "targetMarket": "...",
    "commercialReasoning": "...",
    "seasonalRelevance": "...",
    "buyerDemandRating": "Very High"
  },
  "prompts": [
    {
      "id": 1,
      "seoTitle": "...",
      "category": "...",
      "aspectRatio": "16:9",
      "prompt": "Full detailed prompt with lighting, camera angle, clean copy space, no human faces...",
      "negativePrompt": "human face, portrait, blurry, distorted, logos, watermark, text",
      "keywords": ["keyword1", "keyword2", ... 25-35 keywords with top 10 prioritized],
      "compositionStyle": "Wide Landscape Banner / Flat Lay / High-Tech Infrastructure",
      "modelSuggestion": "recraft/recraft-v4.1-flash"
    }
    ... total 5 items
  ]
}
`;

  try {
    const data = await callOpenRouterJSON<ResearchResponse>(
      SYSTEM_PROMPT,
      userPrompt,
      "typesafe/jev-router"
    );

    const items: StockImageItem[] = data.prompts.map((p) => {
      const isRecraft = p.modelSuggestion && p.modelSuggestion.includes("recraft");
      return {
        id: p.id,
        seoTitle: p.seoTitle,
        category: p.category,
        aspectRatio: p.aspectRatio,
        prompt: p.prompt,
        negativePrompt: p.negativePrompt,
        keywords: p.keywords,
        modelUsed: p.modelSuggestion || "recraft/recraft-v4.1-flash",
        filename: generateUniqueStockFilename(p.seoTitle, p.id),
        costEstimate: isRecraft ? "~$0.007 / image" : "~$0.00003 / image",
      };
    });

    return {
      trend: data.trend,
      items,
    };
  } catch (error) {
    console.error("OpenRouter market research error, falling back to account's top-seller dataset:", error);
    return getFallbackMarketData();
  }
}

/**
 * Fallback dataset curated strictly from this account's proven top sellers
 */
function getFallbackMarketData(): { trend: MarketTrend; items: StockImageItem[] } {
  const trend: MarketTrend = {
    theme: "Cloud Computing, Cyber Security & Modern Interior Mockups",
    targetMarket: "Global Enterprise IT, FinTech, Modern Architecture & Commercial Advertising",
    commercialReasoning: "Matches the account's historical top earners: High-demand tech infrastructure, data server rooms, interior frame mockups, and conceptual business metaphors with proven 180+ downloads.",
    seasonalRelevance: "Year-Round Evergreen Commercial Demand + Q4 Enterprise Budget Planning",
    buyerDemandRating: "Very High",
  };

  const rawItems: Array<Omit<StockImageItem, "filename">> = [
    {
      id: 1,
      seoTitle: "Cloud Computing Data Center with Glowing Blue Neon Server Racks",
      category: "Technology / Business",
      aspectRatio: "16:9",
      prompt: "Ultra-wide 16:9 commercial shot of an enterprise cloud data center corridor with rows of sleek dark server racks, vibrant glowing neon blue and orange fiber optic light trails flowing into a central holographic cloud icon, cinematic symmetry, vast dark negative copy space on the right side for tech banner headlines, 8k resolution, shot on Sony A7R IV, clean photorealistic focus, no people.",
      negativePrompt: "people, human face, blurry, text, watermark, logo",
      keywords: [
        // Top 10 most critical keywords
        "cloud computing", "datacenter", "server", "cybersecurity", "infrastructure",
        "database", "network", "technology", "hosting", "storage",
        // Supporting single words & essential concepts
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
        // Top 10 most critical keywords
        "mockup", "frame", "interior", "poster", "wall",
        "minimalist", "scandinavian", "living room", "blank", "canvas",
        // Supporting single words & essential concepts
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
        // Top 10 most critical keywords
        "spice", "culinary", "seasoning", "flat lay", "slate",
        "herb", "ingredient", "organic", "anise", "cinnamon",
        // Supporting single words & essential concepts
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
        // Top 10 most critical keywords
        "feedback", "satisfaction", "rating", "review", "emotion",
        "hand", "customer", "choice", "psychology", "experience",
        // Supporting single words & essential concepts
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
        // Top 10 most critical keywords
        "telecom", "antenna", "cellular", "tower", "transmitter",
        "network", "wireless", "mast", "isolated", "telecommunication",
        // Supporting single words & essential concepts
        "copy space", "mobile", "broadband", "station", "receiver",
        "technology", "communication", "dish", "signal", "broadcast",
        "digital", "cutout", "white", "radio", "equipment",
        "infrastructure", "connectivity", "pole", "hardware", "satellite"
      ],
      modelUsed: "recraft/recraft-v4.1-flash",
      costEstimate: "~$0.007 / image",
    }
  ];

  return {
    trend,
    items: rawItems.map((item) => ({
      ...item,
      filename: generateUniqueStockFilename(item.seoTitle, item.id),
    })),
  };
}
