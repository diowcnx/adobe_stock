import { NextRequest, NextResponse } from "next/server";
import { generateSingleImage } from "@/lib/image-generator";
import { StockImageItem } from "@/lib/types";
import { readJsonBody, validationErrorResponse } from "@/lib/request";
import { isStockImageItem } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { item } = await readJsonBody(request, 32_768);
    if (!isStockImageItem(item)) {
      return NextResponse.json({ success: false, error: "Invalid item parameter" }, { status: 400 });
    }

    const result = await generateSingleImage(item as StockImageItem);

    return NextResponse.json({
      success: Boolean(result.imageUrl),
      imageUrl: result.imageUrl,
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
