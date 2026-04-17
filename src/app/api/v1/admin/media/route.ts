import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { listFilesWithUrls, isBucketConfigured } from "@/lib/storage";

export async function GET() {
  try {
    // Authenticate admin
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check bucket config
    if (!isBucketConfigured()) {
      return NextResponse.json(
        { error: "Storage not configured", files: [] },
        { status: 200 }
      );
    }

    // List all files from Cloudinary with public URLs
    const allFiles = await listFilesWithUrls();

    // listFilesWithUrls already includes Cloudinary-derived content types.
    // Using that data directly keeps the picker to a single Admin API request.
    const files = allFiles.map((file) => ({
      url: file.url,
      pathname: file.key,
      contentType: file.contentType || "application/octet-stream",
      size: file.size,
      uploadedAt: file.lastModified,
    }));

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Failed to list media files:", error);
    return NextResponse.json(
      { error: "Failed to fetch media files" },
      { status: 500 }
    );
  }
}
