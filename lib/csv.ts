import { StockImageItem } from "./types";

/**
 * แปลงข้อความเป็น URL/File-friendly slug
 */
function sanitizeSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

/**
 * สร้างชื่อไฟล์ที่ไม่ซ้ำกันแน่นอน 100% (Unique Filename)
 * รูปแบบ: stock_[transparent|regular]_YYYYMMDD_HHmmss_ID_slug_HEX.png
 */
export function generateUniqueStockFilename(
  title: string,
  id: number,
  date: Date = new Date(),
  mode?: "transparent_png" | "regular_scene"
): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const getPart = (type: string, fallback: string) => parts.find((p) => p.type === type)?.value || fallback;

  const yyyy = getPart("year", String(date.getFullYear()));
  const mm = getPart("month", String(date.getMonth() + 1).padStart(2, "0"));
  const dd = getPart("day", String(date.getDate()).padStart(2, "0"));
  const hh = getPart("hour", String(date.getHours()).padStart(2, "0"));
  const min = getPart("minute", String(date.getMinutes()).padStart(2, "0"));
  const ss = getPart("second", String(date.getSeconds()).padStart(2, "0"));

  const randomHex = Math.random().toString(16).substring(2, 6);
  const slug = sanitizeSlug(title) || `image_${id}`;
  const modePrefix = mode === "transparent_png" ? "stock_transparent" : mode === "regular_scene" ? "stock_regular" : "stock";

  return `${modePrefix}_${yyyy}${mm}${dd}_${hh}${min}${ss}_${id}_${slug}_${randomHex}.png`;
}

/**
 * Escape ข้อความสำหรับ CSV format
 */
function escapeCsvField(field: string): string {
  // หากมี quote หรือ comma หรือ newline ให้ครอบด้วย quote และ double quote ข้างใน
  const escaped = field.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * สร้างเนื้อหาไฟล์ CSV ตามมาตรฐานทางการของ Adobe Stock:
 * Header: Filename,Title,Keywords,Category,Releases
 * โดย 2 คอลัมน์หลัง (Category, Releases) ปล่อยว่างไว้ตามข้อกำหนด
 */
export function generateMetadataCsv(images: StockImageItem[]): string {
  const header = "Filename,Title,Keywords,Category,Releases";
  const rows = images.map((img) => {
    const filename = img.filename || `stock_image_${img.id}.png`;
    const title = img.seoTitle || "";
    const keywords = (img.keywords || []).join(", ");

    return `${escapeCsvField(filename)},${escapeCsvField(title)},${escapeCsvField(keywords)},,`;
  });

  return [header, ...rows].join("\r\n");
}
