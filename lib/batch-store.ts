import fs from "fs";
import path from "path";
import { WorkflowResult } from "./types";

const TMP_BATCH_FILE = path.join("/tmp", "latest_adobe_stock_batch.json");

declare global {
  var __latestAdobeStockBatch: WorkflowResult | undefined;
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
      images: result.images.map((image) => {
        const { imageBase64: _imageBase64, ...rest } = image;
        void _imageBase64;
        return rest;
      }),
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

/**
 * ลบชุดล่าสุดหลังผู้ใช้ยืนยันว่าดาวน์โหลดเรียบร้อยแล้ว
 */
export async function clearLatestBatch(): Promise<void> {
  globalThis.__latestAdobeStockBatch = undefined;
  if (fs.existsSync(TMP_BATCH_FILE)) {
    fs.unlinkSync(TMP_BATCH_FILE);
  }
}
