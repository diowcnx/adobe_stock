import sharp from "sharp";
import { StockImageItem } from "./types";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

// โมเดลสำหรับภาพทั่วไป (Commercial Regular Scene with 50-60% Negative Copy Space)
export const MODEL_RECRAFT_FLASH = "recraft/recraft-v4.1-flash";
export const MODEL_GEMINI_IMAGE = "google/gemini-2.5-flash-image";

// โมเดลสำหรับภาพพื้นหลังโปร่งใสจริง (True Alpha PNG with native background: "transparent")
export const MODEL_TRANSPARENT_PRIMARY = "openai/gpt-image-1-mini";
export const MODEL_TRANSPARENT_BACKUP_1 = "sourceful/riverflow-v2.5-fast";
export const MODEL_TRANSPARENT_BACKUP_2 = "openai/gpt-image-2.5-sunburst";

export const DEFAULT_IMAGE_MODEL = MODEL_RECRAFT_FLASH;

/**
 * แปลง Aspect Ratio ให้ตรงกับข้อกำหนดของแต่ละโมเดล
 */
function getAspectRatioForModel(ratio: string, model: string): string {
  if (model.includes("recraft") || model.includes("gpt-image") || model.includes("riverflow")) {
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
 * ฟังก์ชันรับประกันความโปร่งใสจริง (Guaranteed True Alpha PNG Transparency)
 * ตรวจสอบพิกเซลจริง และลบลายตารางหมากรุก (Checkerboard) หรือพื้นหลังสีขาว/เทาอ่อนออกทั้งหมด 100%
 * ให้กลายเป็นช่อง Alpha = 0 สำหรับ Adobe Stock Cutout PNG
 */
export async function ensureGenuineAlphaTransparency(inputBuffer: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(inputBuffer).metadata();

    // 1. ตรวจสอบว่ามี Alpha Channel อยู่แล้ว และมีพิกเซลโปร่งใสจริงหรือไม่
    if (meta.hasAlpha) {
      const { data } = await sharp(inputBuffer).raw().toBuffer({ resolveWithObject: true });
      let transparentPixels = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 25) transparentPixels++;
      }
      // ถ้ามีพิกเซลโปร่งใสมากกว่า 5% ของภาพ แสดงว่าเป็นภาพโปร่งใสแท้จริงแล้ว
      if (transparentPixels > ((meta.width || 1024) * (meta.height || 1024) * 0.05)) {
        return await sharp(inputBuffer).png().toBuffer();
      }
    }

    // 2. หากไม่มี Alpha หรือเป็นภาพที่ติดลายตารางหมากรุก/พื้นขาว
    // ดำเนินการลบลายตารางหมากรุกและพื้นหลังด้วย BFS Flood-Fill ร่วมกับ Internal Cavity Cleaning
    const { data, info } = await sharp(inputBuffer)
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
      // ลายตารางหมากรุกจะมีค่าเฉลี่ยสว่าง > 215 และมีความเป็นสีเทา/ขาวสม่ำเสมอ (diff < 20)
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
      .png()
      .toBuffer();
  } catch (err) {
    console.error("Error ensuring alpha transparency with sharp:", err);
    return inputBuffer;
  }
}

/**
 * เรียก OpenRouter สร้างภาพสมจริง
 * - โหมด transparent_png: ใช้โมเดลที่รองรับ background="transparent" + Image API โดยตรง + รับประกัน Alpha ผ่าน sharp
 * - โหมด regular_scene: ใช้ Recraft V4.1 Flash / Gemini Flash Image เว้น Copy Space 50-60%
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

  const isTransparent = Boolean(
    item.isTransparent ||
    item.generationMode === "transparent_png" ||
    item.prompt.toLowerCase().includes("isolated")
  );

  // เลือกรุ่นโมเดลสร้างภาพที่ถูกต้องตามโหมด
  const modelsToTry = isTransparent
    ? [
        item.modelUsed && !item.modelUsed.includes("recraft") && !item.modelUsed.includes("flux")
          ? item.modelUsed
          : MODEL_TRANSPARENT_PRIMARY,
        MODEL_TRANSPARENT_BACKUP_1,
        MODEL_TRANSPARENT_BACKUP_2,
        MODEL_RECRAFT_FLASH,
      ]
    : [
        item.modelUsed && !item.modelUsed.includes("flux") ? item.modelUsed : MODEL_RECRAFT_FLASH,
        MODEL_GEMINI_IMAGE,
      ];

  let lastError = "";

  for (const model of modelsToTry) {
    try {
      console.log(`[Item #${item.id}] Calling OpenRouter model ${model} (mode: ${isTransparent ? "transparent_png" : "regular_scene"})...`);

      // กำจัดคำที่เป็นสาเหตุให้ AI วาดลายตารางหมากรุก (Anti-Checkerboard Prompt Sanitization)
      const sanitizedPrompt = item.prompt
        .replace(/isolated commercial cutout asset on a 100% transparent background \(png alpha channel\) of/gi, "Commercial studio product shot of")
        .replace(/on a 100% transparent background \(png alpha channel\)/gi, "completely isolated, no background")
        .replace(/transparent background/gi, "clear backdrop")
        .replace(/png alpha transparency/gi, "clean silhouette edges");

      let extractedBuffer: Buffer | null = null;
      let directUrl: string | undefined;

      // 1. ถ้าเป็นโหมดภาพโปร่งใส ลองเรียก OpenRouter Dedicated Image API (POST /api/v1/images) ก่อน
      if (isTransparent && !model.includes("recraft")) {
        try {
          const imageApiPayload = {
            model,
            prompt: `Commercial studio product shot, centered, crisp clean silhouette edges, studio key and rim lighting, no shadow, no background. Subject: ${sanitizedPrompt}`,
            background: "transparent",
            output_format: "png",
            aspect_ratio: getAspectRatioForModel(item.aspectRatio, model),
          };

          const imgResponse = await fetch(`${OPENROUTER_API_BASE}/images`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "HTTP-Referer": "https://adobe-stock.vercel.app",
              "X-Title": "Adobe Stock AI Generator",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(imageApiPayload),
            signal: AbortSignal.timeout(15000),
          });

          if (imgResponse.ok) {
            const imgData = await imgResponse.json();
            const b64 = imgData.data?.[0]?.b64_json;
            const url = imgData.data?.[0]?.url;

            if (b64) {
              extractedBuffer = Buffer.from(b64, "base64");
            } else if (url) {
              const fetched = await fetch(url);
              if (fetched.ok) {
                extractedBuffer = Buffer.from(await fetched.arrayBuffer());
              } else {
                directUrl = url;
              }
            }
          } else {
            console.warn(`[Item #${item.id}] /images endpoint returned ${imgResponse.status}, falling back to chat/completions`);
          }
        } catch (e: any) {
          console.warn(`[Item #${item.id}] Dedicated /images call failed, trying chat completions:`, e.message);
        }
      }

      // 2. ถ้ายังไม่ได้ Buffer ให้เรียกผ่าน /chat/completions
      if (!extractedBuffer && !directUrl) {
        const userContent = isTransparent
          ? `Create an isolated commercial stock element. Centered subject, razor-sharp clean silhouette cutout edges, studio key lighting with soft rim accent, authentic tactile physical materials, no background colors, no floor, no shadows, no checkerboard grid. Subject: ${sanitizedPrompt}`
          : `Create an elite, high-converting commercial stock photograph for Adobe Stock. Authentic materiality, tactile textures, natural directional lighting (Leica/Hasselblad aesthetic, subtle depth of field), strictly leaving 50-60% clean uncluttered negative copy space for designer typography. No plastic AI glossiness, no human faces or distorted portraits, no brand logos or text. Commercial art directed scene: ${sanitizedPrompt}`;

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
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          const errorText = await response.text();
          lastError = `OpenRouter API returned ${response.status}: ${errorText}`;
          console.error(`[Item #${item.id}] ${lastError}`);
          continue;
        }

        const result = await response.json();
        const message = result.choices?.[0]?.message;

        // ดึง URL / Base64 จาก message
        if (message?.images && Array.isArray(message.images) && message.images.length > 0) {
          directUrl = message.images[0]?.image_url?.url || message.images[0]?.url;
        }

        if (!directUrl && typeof message?.content === "string") {
          const match = message.content.match(/\((https?:\/\/[^\s)]+|data:image\/[^;]+;base64,[^\s)]+)\)/) ||
                        message.content.match(/https?:\/\/[^\s"']+/);
          if (match) {
            directUrl = match[1] || match[0];
          }
        }

        if (directUrl) {
          if (directUrl.startsWith("data:image")) {
            extractedBuffer = Buffer.from(directUrl.split(",")[1], "base64");
          } else if (isTransparent) {
            // โหมดโปร่งใสจำเป็นต้องดึง Buffer มาทำ Background Clean
            try {
              const fetchRes = await fetch(directUrl);
              if (fetchRes.ok) {
                extractedBuffer = Buffer.from(await fetchRes.arrayBuffer());
              }
            } catch (err) {
              console.warn(`[Item #${item.id}] Could not fetch image URL for alpha processing:`, err);
            }
          }
        }
      }

      // 3. ตรวจสอบและประมวลผลความโปร่งใสจริง
      if (extractedBuffer) {
        if (isTransparent) {
          console.log(`[Item #${item.id}] Ensuring genuine alpha transparency (clearing any checkerboard/white pixels)...`);
          const transparentPngBuffer = await ensureGenuineAlphaTransparency(extractedBuffer);
          const base64 = transparentPngBuffer.toString("base64");
          const dataUri = `data:image/png;base64,${base64}`;

          return {
            imageUrl: dataUri,
            imageBase64: base64,
          };
        } else {
          const base64 = extractedBuffer.toString("base64");
          return {
            imageUrl: `data:image/png;base64,${base64}`,
            imageBase64: base64,
          };
        }
      }

      if (directUrl) {
        return {
          imageUrl: directUrl,
          imageBase64: "",
        };
      }

      lastError = `No image data received from model ${model}`;
      console.warn(`[Item #${item.id}] ${lastError}`);
    } catch (e: any) {
      lastError = e.message || String(e);
      console.error(`[Item #${item.id}] Error with ${model}:`, e);
    }
  }

  // หากล้มเหลวทั้งหมด
  return {
    imageUrl: "",
    imageBase64: "",
    error: lastError || "Failed to generate image via OpenRouter",
  };
}

/**
 * สร้างภาพทั้งหมด 20 ภาพพร้อมกันแบบขนานเต็มรูปแบบ (Parallel Execution via Promise.all)
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
          modelUsed: item.modelUsed || (item.isTransparent ? MODEL_TRANSPARENT_PRIMARY : DEFAULT_IMAGE_MODEL),
          imageUrl: result.imageUrl || undefined,
          imageBase64: result.imageBase64 || undefined,
          description: result.error ? `Error: ${result.error}` : undefined,
        };
      } catch (err: any) {
        console.error(`Failed generating image #${item.id}:`, err);
        return {
          ...item,
          modelUsed: item.modelUsed || (item.isTransparent ? MODEL_TRANSPARENT_PRIMARY : DEFAULT_IMAGE_MODEL),
          description: `Generation error: ${err.message || String(err)}`,
        };
      }
    })
  );

  console.log(`Image generation completed for all ${results.length} items.`);
  return results;
}
