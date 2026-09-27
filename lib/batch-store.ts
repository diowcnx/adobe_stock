import zlib from "zlib";
import fs from "fs";
import path from "path";
import { StockImageItem, WorkflowResult } from "./types";

const TMP_BATCH_FILE = path.join("/tmp", "latest_adobe_stock_batch.json");

declare global {
  // eslint-disable-next-line no-var
  var __latestAdobeStockBatch: WorkflowResult | undefined;
}

/**
 * บีบอัดรายการภาพ 20 ภาพให้อยู่ในรูปแบบ base64url สั้น เพื่อส่งผ่าน URL Query ได้อย่างปลอดภัย
 */
export function compressBatch(items: StockImageItem[]): string {
  const minimal = items.map((img) => ({
    id: img.id,
    t: img.seoTitle,
    r: img.aspectRatio,
    u: img.imageUrl,
    f: img.filename,
    k: img.keywords,
    c: img.category,
    m: img.generationMode || "stock",
  }));
  return zlib.deflateSync(JSON.stringify(minimal)).toString("base64url");
}

/**
 * ถอดรหัสชุดภาพจาก base64url query parameter กลับมาเป็นรายการภาพพร้อมดาวน์โหลด
 */
export function decompressBatch(str: string): StockImageItem[] {
  try {
    const buf = Buffer.from(str, "base64url");
    const json = JSON.parse(zlib.inflateSync(buf).toString("utf-8"));
    return json.map((item: any) => ({
      id: item.id,
      seoTitle: item.t,
      aspectRatio: item.r,
      imageUrl: item.u,
      filename: item.f,
      keywords: item.k,
      category: item.c,
      generationMode: item.m,
      isTransparent: item.m === "transparent_png",
    }));
  } catch (e) {
    console.error("Failed to decompress batch string:", e);
    return [];
  }
}

/**
 * บันทึกชุดภาพล่าสุดลงทั้งใน Memory Cache และ /tmp เพื่อให้ดึงดูและดาวน์โหลดได้ตลอดเวลา
 */
export async function saveLatestBatch(result: WorkflowResult): Promise<void> {
  try {
    globalThis.__latestAdobeStockBatch = result;
    // บันทึกเฉพาะข้อมูลที่จำเป็นโดยตัด base64 หนักๆ ออก เพื่อประหยัดพื้นที่และเร็วสูงสุด
    const lightweightResult = {
      ...result,
      images: result.images.map(({ imageBase64, ...rest }) => rest),
    };
    fs.writeFileSync(TMP_BATCH_FILE, JSON.stringify(lightweightResult), "utf-8");
  } catch (err) {
    console.warn("Could not write latest batch to /tmp:", err);
  }
}

/**
 * ดึงชุดภาพล่าสุดที่สร้างเสร็จแล้ว
 */
export async function getLatestBatch(): Promise<WorkflowResult | null> {
  if (globalThis.__latestAdobeStockBatch) {
    return globalThis.__latestAdobeStockBatch;
  }
  try {
    if (fs.existsSync(TMP_BATCH_FILE)) {
      const content = fs.readFileSync(TMP_BATCH_FILE, "utf-8");
      const parsed = JSON.parse(content);
      globalThis.__latestAdobeStockBatch = parsed;
      return parsed;
    }
  } catch (err) {
    console.warn("Could not read latest batch from /tmp:", err);
  }
  return null;
}
