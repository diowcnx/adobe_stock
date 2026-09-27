import { StockImageItem } from "./types";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

// โมเดลสร้างภาพคุณภาพสูงและราคาถูกที่สุดบน OpenRouter
export const DEFAULT_IMAGE_MODEL = "google/gemini-2.5-flash-image";
export const BACKUP_IMAGE_MODELS = [
  "google/gemini-3.1-flash-image",
  "openai/gpt-5-image-mini",
];

/**
 * แปลง Aspect Ratio ให้ตรงกับข้อกำหนดของ OpenRouter Image Models
 */
function normalizeAspectRatio(ratio: string): "16:9" | "4:3" | "3:4" | "1:1" | "9:16" {
  switch (ratio) {
    case "16:9":
      return "16:9";
    case "3:2":
      // โมเดลมาตรฐานรองรับ 4:3 และ 16:9 ได้อย่างสวยงาม
      return "4:3";
    case "4:5":
      return "3:4";
    case "1:1":
    default:
      return "1:1";
  }
}

/**
 * เรียก OpenRouter สร้างภาพสมจริงผ่าน Chat Completions (Modalities: ["image", "text"])
 */
export async function generateSingleImage(
  item: StockImageItem,
  apiKey?: string
): Promise<{ imageUrl: string; imageBase64: string; error?: string }> {
  const key = apiKey || process.env.OPENROUTER_API_KEY;

  if (!key) {
    const errorMsg = "OPENROUTER_API_KEY is missing in environment variables.";
    console.error(`[Item #${item.id}] ${errorMsg}`);
    return {
      imageUrl: "",
      imageBase64: "",
      error: errorMsg,
    };
  }

  // เลือกรุ่นโมเดลสร้างภาพที่ถูกต้องบน OpenRouter
  const modelsToTry = [
    item.modelUsed && !item.modelUsed.includes("flux") ? item.modelUsed : DEFAULT_IMAGE_MODEL,
    ...BACKUP_IMAGE_MODELS,
  ];

  let lastError = "";

  for (const model of modelsToTry) {
    try {
      console.log(`[Item #${item.id}] Calling OpenRouter model ${model} (ratio: ${item.aspectRatio})...`);

      const payload = {
        model,
        messages: [
          {
            role: "user",
            content: `Create a commercially viable, highly detailed, photorealistic stock photograph for Adobe Stock. High resolution, professional commercial lighting, authentic composition with clean copy space for editorial text. No logos, no brand trademarks, no watermarks, no distorted faces or extra hands. Prompt: ${item.prompt}`,
          },
        ],
        modalities: ["image", "text"],
        image_config: {
          aspect_ratio: normalizeAspectRatio(item.aspectRatio),
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
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = `OpenRouter API returned ${response.status}: ${errorText}`;
        console.error(`[Item #${item.id}] ${lastError}`);
        continue;
      }

      const result = await response.json();
      const message = result.choices?.[0]?.message;

      // ดึง URL / Base64 จาก choices[0].message.images
      let extractedUrl: string | undefined;

      if (message?.images && Array.isArray(message.images) && message.images.length > 0) {
        extractedUrl = message.images[0]?.image_url?.url || message.images[0]?.url;
      }

      // ตรวจสอบใน message.content (กรณีส่ง Data URI หรือ Markdown URL มา)
      if (!extractedUrl && typeof message?.content === "string") {
        const match = message.content.match(/\((https?:\/\/[^\s)]+|data:image\/[^;]+;base64,[^\s)]+)\)/) ||
                      message.content.match(/https?:\/\/[^\s"']+/);
        if (match) {
          extractedUrl = match[1] || match[0];
        }
      }

      if (extractedUrl) {
        console.log(`[Item #${item.id}] Successfully generated image with ${model}!`);
        if (extractedUrl.startsWith("data:image")) {
          const base64 = extractedUrl.split(",")[1];
          return {
            imageUrl: extractedUrl,
            imageBase64: base64,
          };
        } else {
          // ดาวน์โหลดภาพและแปลงเป็น Base64
          const imgRes = await fetch(extractedUrl);
          if (imgRes.ok) {
            const buf = await imgRes.arrayBuffer();
            const base64 = Buffer.from(buf).toString("base64");
            const dataUri = `data:image/png;base64,${base64}`;
            return {
              imageUrl: dataUri,
              imageBase64: base64,
            };
          }
        }
      }

      lastError = `No image found in model ${model} response: ${JSON.stringify(result)}`;
      console.warn(`[Item #${item.id}] ${lastError}`);
    } catch (e: any) {
      lastError = e.message || String(e);
      console.error(`[Item #${item.id}] Error with ${model}:`, e);
    }
  }

  // หาก OpenRouter ล้มเหลวทั้งหมด ให้รายงาน Error ชัดเจน แทนที่จะสร้างสีพื้นหลอกตา
  return {
    imageUrl: "",
    imageBase64: "",
    error: lastError || "Failed to generate image via OpenRouter",
  };
}

/**
 * สร้างภาพทั้งหมด 5 ภาพ
 */
export async function generateAllStockImages(
  items: StockImageItem[],
  apiKey?: string
): Promise<StockImageItem[]> {
  const updatedItems: StockImageItem[] = [];

  for (const item of items) {
    const result = await generateSingleImage(item, apiKey);
    updatedItems.push({
      ...item,
      modelUsed: DEFAULT_IMAGE_MODEL,
      imageUrl: result.imageUrl || undefined,
      imageBase64: result.imageBase64 || undefined,
      description: result.error ? `Error: ${result.error}` : undefined,
    });
  }

  return updatedItems;
}
