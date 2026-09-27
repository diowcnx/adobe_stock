import { NextResponse } from "next/server";
import { clearLatestBatch, getLatestBatch } from "@/lib/batch-store";

export const dynamic = "force-dynamic";

export async function GET() {
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

export async function DELETE() {
  try {
    await clearLatestBatch();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Unable to delete latest batch:", error);
    return NextResponse.json(
      { success: false, error: "Unable to delete batch" },
      { status: 500 },
    );
  }
}
