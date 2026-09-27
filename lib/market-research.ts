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
2. Exactly 20 distinct, high-quality image prompts tailored to this account's proven download patterns with aspect ratios (16:9, 3:2, 4:5, 1:1), SEO titles, categories, and 25-35 keywords each.
   - Distribute the 20 items evenly across the top 5 proven categories:
     * 4 items: Cloud Computing, AI, Cybersecurity & Data Infrastructure (IDs 1-4)
     * 4 items: Modern Interior Architecture & Blank Frame Mockups (IDs 5-8)
     * 4 items: Conceptual Metaphors & Business Symbolism (IDs 9-12)
     * 4 items: Culinary Spices & Food Flat Lays (IDs 13-16)
     * 4 items: Seasonal Banners, Nature & Telecom (IDs 17-20)
   - Keywords MUST be formatted as single words (individual concepts), with universal compounds only where standard (e.g. "copy space", "cloud computing").
   - The Top 10 most critical, search-relevant keywords MUST be placed first.
   - Balance models: 'recraft/recraft-v4.1-flash' for mockups, flat lays, metaphors; 'google/gemini-2.5-flash-image' for glowing data centers, servers, high-tech infrastructure.

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
      "modelSuggestion": "google/gemini-2.5-flash-image"
    }
    ... total 20 items (ids 1 to 20)
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

  return {
    trend,
    items: rawItems.map((item) => ({
      ...item,
      filename: generateUniqueStockFilename(item.seoTitle, item.id),
    })),
  };
}
