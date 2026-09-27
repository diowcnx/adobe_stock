import { NextRequest, NextResponse } from "next/server";
import { generateSingleImage } from "@/lib/image-generator";
import { StockImageItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const { item } = await request.json();
    if (!item) {
      return NextResponse.json({ success: false, error: "Missing item parameter" }, { status: 400 });
    }

    const result = await generateSingleImage(item as StockImageItem);

    return NextResponse.json({
      success: Boolean(result.imageUrl),
      imageUrl: result.imageUrl,
      error: result.error,
    });
  } catch (error: any) {
    console.error("generate-item-image error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate image" },
      { status: 500 }
    );
  }
}
