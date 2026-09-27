import { StockImageItem } from "./types";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

/**
 * แปลง Aspect Ratio เป็น Dimensions ที่เหมาะสมสำหรับ Adobe Stock
 */
export function getDimensionsForAspectRatio(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case "16:9":
      return { width: 1344, height: 768 }; // 16:9 standard generation
    case "3:2":
      return { width: 1216, height: 832 }; // 3:2 landscape
    case "4:5":
      return { width: 896, height: 1152 }; // 4:5 portrait
    case "1:1":
    default:
      return { width: 1024, height: 1024 }; // 1:1 square
  }
}

/**
 * เรียก OpenRouter เพื่อสร้างภาพ 1 ภาพ
 */
export async function generateSingleImage(
  item: StockImageItem,
  apiKey?: string
): Promise<{ imageUrl?: string; imageBase64?: string }> {
  const key = apiKey || process.env.OPENROUTER_API_KEY;

  if (!key) {
    console.warn(`OPENROUTER_API_KEY not found. Using fallback placeholder for item ${item.id}`);
    return generateFallbackImage(item);
  }

  const model = item.modelUsed || "black-forest-labs/flux-1-schnell";

  try {
    // 1. ลองเรียก chat completions สำหรับ OpenRouter image models
    const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://adobe-stock.vercel.app",
        "X-Title": "Adobe Stock Image Generator",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: `Generate a high quality, commercial stock photograph. Aspect ratio: ${item.aspectRatio}. Prompt: ${item.prompt}`,
          },
        ],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const message = data.choices?.[0]?.message;

      // ตรวจสอบ images array หรือ message.content
      let extractedUrl: string | undefined;

      if (message?.images && Array.isArray(message.images) && message.images.length > 0) {
        extractedUrl = message.images[0]?.image_url?.url || message.images[0]?.url;
      } else if (typeof message?.content === "string") {
        // ตรวจสอบ Markdown ![image](url) หรือ data:image url
        const mdMatch = message.content.match(/\((https?:\/\/[^\s)]+|data:image\/[^;]+;base64,[^\s)]+)\)/);
        const urlMatch = message.content.match(/https?:\/\/[^\s"']+/);
        if (mdMatch) {
          extractedUrl = mdMatch[1];
        } else if (urlMatch) {
          extractedUrl = urlMatch[0];
        }
      }

      if (extractedUrl) {
        if (extractedUrl.startsWith("data:image")) {
          const base64Data = extractedUrl.split(",")[1];
          return { imageUrl: extractedUrl, imageBase64: base64Data };
        } else {
          // ดาวน์โหลดภาพและแปลงเป็น Base64 สำหรับแนบในอีเมล
          const imgRes = await fetch(extractedUrl);
          if (imgRes.ok) {
            const buffer = await imgRes.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            return { imageUrl: extractedUrl, imageBase64: base64 };
          }
          return { imageUrl: extractedUrl };
        }
      }
    }

    console.warn(`Direct OpenRouter image generation did not return image URL (${response.status}). Using high-fidelity placeholder.`);
    return generateFallbackImage(item);
  } catch (error) {
    console.error(`Error generating image for item ${item.id}:`, error);
    return generateFallbackImage(item);
  }
}

/**
 * สร้างภาพทั้งหมด 5 ภาพพร้อมกัน
 */
export async function generateAllStockImages(
  items: StockImageItem[],
  apiKey?: string
): Promise<StockImageItem[]> {
  const updatedItems: StockImageItem[] = [];

  for (const item of items) {
    try {
      const result = await generateSingleImage(item, apiKey);
      updatedItems.push({
        ...item,
        imageUrl: result.imageUrl,
        imageBase64: result.imageBase64,
      });
    } catch (err) {
      console.error(`Failed on item ${item.id}`, err);
      const fallback = generateFallbackImage(item);
      updatedItems.push({
        ...item,
        imageUrl: fallback.imageUrl,
        imageBase64: fallback.imageBase64,
      });
    }
  }

  return updatedItems;
}

/**
 * สร้างภาพจำลอง SVG Vector Base64 สำหรับการทดสอบที่รวดเร็วและไม่ error
 */
function generateFallbackImage(item: StockImageItem): { imageUrl: string; imageBase64: string } {
  const { width, height } = getDimensionsForAspectRatio(item.aspectRatio);
  
  // สุ่มโทนสีให้แตกต่างตามธีม
  const palettes = [
    { bg: "#0f172a", card: "#1e293b", accent: "#38bdf8", text: "#f8fafc" },
    { bg: "#064e3b", card: "#065f46", accent: "#34d399", text: "#f0fdf4" },
    { bg: "#312e81", card: "#3730a3", accent: "#818cf8", text: "#eef2ff" },
    { bg: "#701a75", card: "#86198f", accent: "#f472b6", text: "#fdf2f8" },
    { bg: "#78350f", card: "#92400e", accent: "#fbbf24", text: "#fffbeb" },
  ];
  const p = palettes[(item.id - 1) % palettes.length];

  const cleanTitle = escapeXml(item.seoTitle);
  const cleanCategory = escapeXml(item.category);
  const cleanPrompt = escapeXml(item.prompt.slice(0, 140) + "...");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="grad${item.id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${p.bg}" />
        <stop offset="100%" stop-color="${p.card}" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#grad${item.id})" />
    <rect x="40" y="40" width="${width - 80}" height="${height - 80}" rx="24" fill="none" stroke="${p.accent}" stroke-width="2" stroke-opacity="0.3" stroke-dasharray="8 8" />
    
    <!-- Header Badge -->
    <rect x="60" y="60" width="180" height="36" rx="18" fill="${p.accent}" fill-opacity="0.2" />
    <text x="150" y="83" fill="${p.accent}" font-family="system-ui, sans-serif" font-size="14" font-weight="700" text-anchor="middle">ADOBE STOCK #${item.id}</text>
    
    <text x="60" y="140" fill="${p.accent}" font-family="system-ui, sans-serif" font-size="16" font-weight="600" letter-spacing="2">RATIO ${item.aspectRatio} | ${width}x${height}px</text>
    <text x="60" y="180" fill="${p.text}" font-family="system-ui, sans-serif" font-size="28" font-weight="bold">${cleanTitle}</text>
    <text x="60" y="215" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="18">Category: ${cleanCategory}</text>
    
    <!-- Center Graphic -->
    <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) * 0.18}" fill="${p.accent}" fill-opacity="0.1" stroke="${p.accent}" stroke-width="3" />
    <text x="${width / 2}" y="${height / 2 + 10}" fill="${p.text}" font-family="system-ui, sans-serif" font-size="24" font-weight="bold" text-anchor="middle">PHOTOREALISTIC AI</text>
    <text x="${width / 2}" y="${height / 2 + 38}" fill="${p.accent}" font-family="system-ui, sans-serif" font-size="14" text-anchor="middle">Commercial Ready</text>
    
    <!-- Footer Prompt Preview -->
    <rect x="60" y="${height - 130}" width="${width - 120}" height="70" rx="12" fill="#000000" fill-opacity="0.4" />
    <text x="80" y="${height - 98}" fill="#cbd5e1" font-family="system-ui, sans-serif" font-size="13">${cleanPrompt}</text>
    <text x="80" y="${height - 76}" fill="${p.accent}" font-family="system-ui, sans-serif" font-size="12">Model: ${item.modelUsed || "FLUX.1 Schnell"}</text>
  </svg>`;

  const base64 = Buffer.from(svg).toString("base64");
  const dataUrl = `data:image/svg+xml;base64,${base64}`;

  return {
    imageUrl: dataUrl,
    imageBase64: base64,
  };
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
