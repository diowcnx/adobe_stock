import { NextResponse } from "next/server";
import { clearLatestBatch, getStoredBatches } from "@/lib/batch-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const batches = await getStoredBatches();
    const latest = batches[0];
    const batchHistory = batches.map((batch) => ({
      id: batch.timestamp,
      dateStr: new Date(batch.timestamp).toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        dateStyle: "medium",
        timeStyle: "short",
      }),
      theme: batch.trend.theme || "Commercial Stock Set",
      mode: batch.generationMode || "regular_scene",
      imageCount: batch.images.length,
      data: batch,
    }));

    if (latest && latest.images && latest.images.length > 0) {
      return NextResponse.json({ ...latest, batchHistory });
    }

    return NextResponse.json({
      success: false,
      message: "No batch currently cached",
      images: [],
      batchHistory,
    });
  } catch (error: unknown) {
    console.error("Unable to load persisted batches:", error);
    return NextResponse.json(
      { success: false, error: "Unable to load saved batches", images: [] },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timestamp = searchParams.get("timestamp") || undefined;
    await clearLatestBatch(timestamp);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Unable to delete latest batch:", error);
    return NextResponse.json(
      { success: false, error: "Unable to delete batch" },
      { status: 500 },
    );
  }
}
