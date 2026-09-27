import { NextRequest, NextResponse } from "next/server";
import { fetchAllowlistedImage } from "@/lib/remote-image";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  try {
    const { body, contentType } = await fetchAllowlistedImage(url);

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
        "Content-Disposition": "attachment",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {
    console.error("Proxy image error:", error);
    return new NextResponse("Image could not be fetched", { status: 400 });
  }
}
