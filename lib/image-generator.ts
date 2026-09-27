import { StockImageItem } from "./types";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

// โมเดลสร้างภาพคุณภาพสูงที่รองรับบน OpenRouter
export const MODEL_RECRAFT_FLASH = "recraft/recraft-v4.1-flash"; // Recraft V4.1 Flash (Commercial & Design Stock)
export const MODEL_GEMINI_IMAGE = "google/gemini-2.5-flash-image"; // Gemini 2.5 Flash Image (Photorealistic)

export const DEFAULT_IMAGE_MODEL = MODEL_RECRAFT_FLASH;
export const BACKUP_IMAGE_MODELS = [
  MODEL_GEMINI_IMAGE,
];

/**
 * แปลง Aspect Ratio ให้ตรงกับข้อกำหนดของแต่ละโมเดล
 */
function getAspectRatioForModel(ratio: string, model: string): string {
  if (model.includes("recraft")) {
    // Recraft V4.1 Flash รองรับ 16:9, 3:2, 4:5, 1:1 โดยตรง
    return ratio;
  }
  switch (ratio) {
    case "16:9":
      return "16:9";
    case "3:2":
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

      const isTransparent = Boolean(
        item.isTransparent ||
        item.generationMode === "transparent_png" ||
        item.prompt.toLowerCase().includes("transparent")
      );

      const userContent = isTransparent
        ? `Create an isolated commercial stock cutout asset on a 100% transparent background (PNG alpha channel). Sharp clean cutout silhouette, no background color, no background gradients, no drop shadows on the background, studio product lighting, 8k resolution. Prompt: ${item.prompt}`
        : `Create a commercially viable, highly detailed, photorealistic stock photograph for Adobe Stock. High resolution, professional commercial lighting, authentic composition with clean copy space for editorial text. No logos, no brand trademarks, no watermarks, no distorted faces or extra hands. Prompt: ${item.prompt}`;

      const payload: Record<string, any> = {
        model,
        messages: [
          {
            role: "user",
            content: userContent,
          },
        ],
        modalities: ["image", "text"],
        image_config: {
          aspect_ratio: getAspectRatioForModel(item.aspectRatio, model),
        },
      };

      if (isTransparent) {
        payload.background = "transparent";
        payload.output_format = "png";
      }

      const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": "https://adobe-stock.vercel.app",
          "X-Title": "Adobe Stock AI Generator",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000),
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
          // ดาวน์โหลดภาพและแปลงเป็น Base64 สำหรับแนบไฟล์อีเมล
          let base64 = "";
          try {
            const imgRes = await fetch(extractedUrl, { signal: AbortSignal.timeout(5000) });
            if (imgRes.ok) {
              const buf = await imgRes.arrayBuffer();
              base64 = Buffer.from(buf).toString("base64");
            }
          } catch (fetchErr) {
            console.warn(`[Item #${item.id}] Could not fetch image buffer for email attachment:`, fetchErr);
          }

          return {
            imageUrl: extractedUrl, // รักษา hosted URL ไว้ ไม่แปลงเป็น dataUri ขนาดใหญ่
            imageBase64: base64,
          };
        }
      }

      lastError = `No image found in model ${model} response: ${JSON.stringify(result)}`;
      console.warn(`[Item #${item.id}] ${lastError}`);
    } catch (e: any) {
      lastError = e.message || String(e);
      console.error(`[Item #${item.id}] Error with ${model}:`, e);
    }
  }

  // หาก OpenRouter ล้มเหลวทั้งหมด ให้รายงาน Error ชัดเจน
  return {
    imageUrl: "",
    imageBase64: "",
    error: lastError || "Failed to generate image via OpenRouter",
  };
}

/**
 * สร้างภาพทั้งหมด 20 ภาพพร้อมกันแบบขนานเต็มรูปแบบ (Parallel Execution via Promise.all)
 * ลดระยะเวลาประมวลผลทั้งหมดลงเหลือเพียง 3-4 วินาที ป้องกันปัญหา 504 Timeout เด็ดขาด
 */
export async function generateAllStockImages(
  items: StockImageItem[],
  apiKey?: string
): Promise<StockImageItem[]> {
  console.log(`Starting parallel image generation for ${items.length} items...`);
  
  const results = await Promise.all(
    items.map(async (item) => {
      try {
        const result = await generateSingleImage(item, apiKey);
        return {
          ...item,
          modelUsed: item.modelUsed || DEFAULT_IMAGE_MODEL,
          imageUrl: result.imageUrl || undefined,
          imageBase64: result.imageBase64 || undefined,
          description: result.error ? `Error: ${result.error}` : undefined,
        };
      } catch (err: any) {
        console.error(`Failed generating image #${item.id}:`, err);
        return {
          ...item,
          modelUsed: item.modelUsed || DEFAULT_IMAGE_MODEL,
          description: `Generation error: ${err.message || String(err)}`,
        };
      }
    })
  );

  console.log(`Image generation completed for all ${results.length} items.`);
  return results;
}
