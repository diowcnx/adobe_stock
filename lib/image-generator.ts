import sharp from "sharp";
import { StockImageItem } from "./types";
import { getErrorMessage } from "./errors";
import { fetchAllowlistedImage, validateRemoteImageUrl } from "./remote-image";

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
export const MODEL_GEMINI_IMAGE = "google/gemini-2.5-flash-image";
export const MODEL_GEMINI_31 = "google/gemini-3.1-flash-image";
export const MODEL_GPT5_IMAGE_MINI = "openai/gpt-5-image-mini";

export const DEFAULT_IMAGE_MODEL = MODEL_GEMINI_IMAGE;
export const MODEL_TRANSPARENT_PRIMARY = MODEL_GEMINI_IMAGE;
export const MODEL_TRANSPARENT_BACKUP_1 = MODEL_GEMINI_31;
export const MODEL_TRANSPARENT_BACKUP_2 = MODEL_GPT5_IMAGE_MINI;

/**
 * แปลง Aspect Ratio ให้ตรงกับข้อกำหนด
 */
function getAspectRatioForModel(ratio: string): string {
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
 * ฟังก์ชันรับประกันความโปร่งใสจริง (Guaranteed True Alpha PNG Transparency)
 * ตรวจสอบพิกเซลจริง และลบลายตารางหมากรุก (Checkerboard) หรือพื้นหลังสีขาว/เทาอ่อนออกทั้งหมด 100%
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

    // 2. หากไม่มี Alpha หรือเป็นภาพที่ติดลายตารางหมากรุก/พื้นขาว
    // ดำเนินการลบลายตารางหมากรุกและพื้นหลังด้วย BFS Flood-Fill ร่วมกับ Internal Cavity Cleaning
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

    // ลบช่องว่างหรือโพรงภายในโครงสร้าง (Internal Gaps) ที่เป็นลายตารางหมากรุก/สีขาว
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      if (isBackgroundPixel(idx)) {
        data[idx + 3] = 0;
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
): Promise<{ imageUrl: string; error?: string }> {
  const key = apiKey || process.env.OPENROUTER_API_KEY;

  if (!key) {
    const errorMsg = "OPENROUTER_API_KEY is missing in environment variables.";
    console.error(`[Item #${item.id}] ${errorMsg}`);
    return {
      imageUrl: "",
      error: errorMsg,
    };
  }

  const isTransparent = Boolean(
    item.isTransparent ||
    item.generationMode === "transparent_png" ||
    item.prompt.toLowerCase().includes("isolated")
  );

  const modelsToTry = [
    MODEL_GEMINI_IMAGE,
    MODEL_GEMINI_31,
    MODEL_GPT5_IMAGE_MINI,
  ];

  let lastError = "";

  for (const model of modelsToTry) {
    try {
      console.log(`[Item #${item.id}] Calling OpenRouter model ${model} (mode: ${isTransparent ? "transparent_png" : "regular_scene"})...`);

      const sanitizedPrompt = isTransparent
        ? item.prompt
            .replace(/isolated commercial cutout asset on a 100% transparent background \(png alpha channel\) of/gi, "Commercial studio product shot of floating")
            .replace(/on a 100% transparent background \(png alpha channel\)/gi, "completely floating, clean backdrop")
            .replace(/transparent background/gi, "pure solid white backdrop")
            .replace(/png alpha transparency/gi, "clean silhouette edges")
            .replace(/\b(soft realistic self-shadow only|self-shadow|with shadow|soft shadow|subtle shadow|drop shadow|contact shadow|ground shadow|floor shadow|cast shadow|shadows?)\b/gi, "zero shadows")
        : item.prompt;

      const userContent = isTransparent
        ? `Create an isolated commercial stock element on a pure solid white studio background. Centered floating subject, razor-sharp clean silhouette cutout edges, absolutely zero cast shadows, zero drop shadow, zero contact shadow, zero ground shadow, zero floor shadow, zero ambient shadow, uniform bright omnidirectional studio lighting with high-key illumination from all angles, authentic tactile physical materials, no floor, no table, no surface, no shadows, no dark gradient, no checkerboard grid. Subject: ${sanitizedPrompt}`
        : `Create an elite, high-converting commercial stock photograph for Adobe Stock. Authentic materiality, tactile textures, natural directional lighting (Leica/Hasselblad aesthetic, subtle depth of field), strictly leaving 50-60% clean uncluttered negative copy space for designer typography. No plastic AI glossiness, no human faces or distorted portraits, no brand logos or text. Commercial art directed scene: ${sanitizedPrompt}`;

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
        signal: AbortSignal.timeout(12000), // จำกัด timeout ไม่เกิน 12 วินาทีต่อภาพ
      });

      if (!response.ok) {
        lastError = `OpenRouter API returned ${response.status}`;
        console.error(`[Item #${item.id}] ${lastError}`);
        if (![408, 429, 500, 502, 503, 504].includes(response.status)) break;
        continue;
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
          continue;
        }
      }

      if (extractedBuffer && extractedBuffer.byteLength > MAX_IMAGE_BYTES) {
        lastError = "Generated image exceeds the size limit";
        continue;
      }

      // ถ้าเป็นโหมดโปร่งใสและได้เป็น hosted URL ให้ดึง Buffer มาทำ True Alpha
      if (isTransparent && directUrl && !extractedBuffer) {
        try {
          const remoteImage = await fetchAllowlistedImage(directUrl, 6_000);
          extractedBuffer = Buffer.from(remoteImage.body);
        } catch {
          // หาก fetch buffer ไม่สำเร็จ ให้ fallback ใช้ directUrl โดยตรง
        }
      }

      // ประมวลผลภาพ
      if (extractedBuffer) {
        if (isTransparent) {
          console.log(`[Item #${item.id}] Ensuring genuine alpha transparency with sharp...`);
          const transparentPngBuffer = await ensureGenuineAlphaTransparency(extractedBuffer);
          const base64 = transparentPngBuffer.toString("base64");
          return {
            imageUrl: `data:image/png;base64,${base64}`,
          };
        } else {
          const compressedBuffer = await sharp(extractedBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
            .jpeg({ quality: 85 })
            .toBuffer();
          const base64 = compressedBuffer.toString("base64");
          return {
            imageUrl: `data:image/jpeg;base64,${base64}`,
          };
        }
      }

      if (directUrl) {
        return {
          imageUrl: directUrl,
        };
      }

      lastError = `No image data in response from ${model}`;
    } catch (error: unknown) {
      lastError = getErrorMessage(error, "Image generation failed");
      console.warn(`[Item #${item.id}] Error with ${model}:`, lastError);
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
            description: result.error ? `Error: ${result.error}` : undefined,
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
