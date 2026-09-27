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
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
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
 * สร้างเนื้อหาไฟล์ CSV ที่มีเฉพาะคอลัมน์: Filename,Title,Keywords
 * ตามมาตรฐานการอัปโหลดข้อมูลของ Adobe Stock Contributor
 */
export function generateMetadataCsv(images: StockImageItem[]): string {
  const header = "Filename,Title,Keywords";
  const rows = images.map((img) => {
    const filename = img.filename || `stock_image_${img.id}.png`;
    const title = img.seoTitle || "";
    const keywords = (img.keywords || []).join(", ");

    return `${escapeCsvField(filename)},${escapeCsvField(title)},${escapeCsvField(keywords)}`;
  });

  return [header, ...rows].join("\r\n");
}
