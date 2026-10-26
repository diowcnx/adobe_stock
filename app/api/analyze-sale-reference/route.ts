import { NextRequest, NextResponse } from "next/server";
import { analyzeSoldReference } from "@/lib/sale-reference";
import { getOpenRouterCredits } from "@/lib/openrouter";
import { readJsonBody, validationErrorResponse } from "@/lib/request";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request, 3_500_000);
    const plan = await analyzeSoldReference(body.imageDataUrl);
    const credits = await getOpenRouterCredits();
    return NextResponse.json({ success: true, mode: "regular_scene", ...plan, credits });
  } catch (error: unknown) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    const message = error instanceof Error && /Reference image|Image analysis must|duplicate concepts|insufficient keywords|file type|2\.5 MB/.test(error.message)
      ? error.message
      : "Unable to analyze the sold reference image";
    console.error("analyze-sale-reference error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ success: false, error: message }, { status: message === "Unable to analyze the sold reference image" ? 502 : 400 });
  }
}
