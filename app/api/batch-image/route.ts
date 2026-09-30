import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getPrivateBatchImage } from "@/lib/batch-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const pathname = request.nextUrl.searchParams.get("pathname");
  if (!pathname) {
    return new NextResponse("Missing pathname", { status: 400 });
  }

  try {
    const blob = await getPrivateBatchImage(pathname);
    if (!blob || blob.statusCode !== 200) {
      return new NextResponse("Image not found", { status: 404 });
    }

    return new NextResponse(blob.stream, {
      headers: {
        "Content-Type": blob.blob.contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Unable to retrieve stored batch image:", error);
    return new NextResponse("Image could not be retrieved", { status: 502 });
  }
}
