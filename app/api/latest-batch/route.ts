import { NextRequest, NextResponse } from "next/server";
import { getLatestBatch, decompressBatch } from "@/lib/batch-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const compressed = searchParams.get("batch");

  // 1. ถ้าส่ง batch string ผ่าน URL Query ให้ถอดรหัสแล้วส่งกลับทันที
  if (compressed) {
    const items = decompressBatch(compressed);
    if (items && items.length > 0) {
      const mode = items[0].generationMode || (items[0].isTransparent ? "transparent_png" : "regular_scene");
      return NextResponse.json({
        success: true,
        generationMode: mode,
        images: items,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 2. ถ้าไม่มี query string ให้ดึงชุดภาพล่าสุดที่เซฟไว้บนระบบ
  const latest = await getLatestBatch();
  if (latest && latest.images && latest.images.length > 0) {
    return NextResponse.json(latest);
  }

  return NextResponse.json({
    success: false,
    message: "No batch currently cached",
    images: [],
  });
}
