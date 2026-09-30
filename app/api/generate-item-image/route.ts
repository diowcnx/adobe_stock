import { NextRequest, NextResponse } from "next/server";
import { generateSingleImage } from "@/lib/image-generator";
import { StockImageItem } from "@/lib/types";
import { readJsonBody, validationErrorResponse } from "@/lib/request";
import { isStockImageItem } from "@/lib/validation";
import { persistGeneratedImage } from "@/lib/batch-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { item, timestamp } = await readJsonBody(request, 32_768);
    if (!isStockImageItem(item)) {
      return NextResponse.json({ success: false, error: "Invalid item parameter" }, { status: 400 });
    }
    if (process.env.VERCEL === "1" && (typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp)))) {
      return NextResponse.json({ success: false, error: "A valid batch timestamp is required" }, { status: 400 });
    }

    const result = await generateSingleImage(item as StockImageItem);
    const imageUrl = result.imageUrl && typeof timestamp === "string"
      ? await persistGeneratedImage(timestamp, item.id, result.imageUrl)
      : result.imageUrl;

    return NextResponse.json({
      success: Boolean(imageUrl),
      imageUrl,
      error: result.error,
    });
  } catch (error: unknown) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    console.error("generate-item-image error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate image" },
      { status: 500 }
    );
  }
}
