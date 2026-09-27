import { NextResponse } from "next/server";
import { getOpenRouterCredits } from "@/lib/openrouter";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const credits = await getOpenRouterCredits();
    return NextResponse.json({
      success: true,
      data: credits,
    });
  } catch (error: unknown) {
    console.error("Credit lookup failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Unable to retrieve credits",
      },
      { status: 500 }
    );
  }
}
