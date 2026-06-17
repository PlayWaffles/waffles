import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { uploadFile, generateFileKey, isBucketConfigured } from "@/lib/storage";
import { trackServerEvent } from "@/lib/server-analytics";

// Allowed content types
const ALLOWED_CONTENT_TYPES = [
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
  "audio/webm",
  // Video
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * POST /api/upload
 * Upload a file to Cloudinary
 */
export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = Date.now();
  try {
    // 1. Authenticate
    const session = await getAdminSession();
    if (!session) {
      await trackServerEvent({
        name: "api_upload_failed",
        properties: { reason: "unauthorized" },
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Check bucket config
    if (!isBucketConfigured()) {
      await trackServerEvent({
        name: "api_upload_failed",
        properties: { reason: "storage_not_configured" },
      });
      return NextResponse.json(
        {
          error:
            "Storage not configured. Please set CLOUDINARY_* environment variables.",
        },
        { status: 500 }
      );
    }

    const contentType = request.headers.get("content-type") || "";
    await trackServerEvent({
      name: "api_upload_started",
      properties: {
        upload_type: contentType.includes("multipart/form-data") ? "multipart" : "unsupported",
      },
    });

    // Direct upload (multipart/form-data)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const folder = (formData.get("folder") as string) || "media";

      if (!file) {
        await trackServerEvent({
          name: "api_upload_failed",
          properties: { upload_type: "multipart", reason: "missing_file" },
        });
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        await trackServerEvent({
          name: "api_upload_failed",
          properties: {
            upload_type: "multipart",
            content_type: file.type,
            size_bytes: file.size,
            reason: "file_too_large",
          },
        });
        return NextResponse.json(
          {
            error: `File too large. Maximum size is ${
              MAX_FILE_SIZE / 1024 / 1024
            }MB`,
          },
          { status: 400 }
        );
      }

      if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
        await trackServerEvent({
          name: "api_upload_failed",
          properties: {
            upload_type: "multipart",
            content_type: file.type,
            size_bytes: file.size,
            reason: "content_type_not_allowed",
          },
        });
        return NextResponse.json(
          { error: `File type '${file.type}' not allowed` },
          { status: 400 }
        );
      }

      const key = generateFileKey(file.name, folder);
      const buffer = Buffer.from(await file.arrayBuffer());

      const result = await uploadFile({
        key,
        body: buffer,
        contentType: file.type,
      });

      console.log(
        `[Upload] File uploaded: ${result.url} by ${session.username}`
      );

      await trackServerEvent({
        name: "api_upload_succeeded",
        properties: {
          upload_type: "multipart",
          content_type: file.type,
          size_bytes: file.size,
          duration_ms: Date.now() - startedAt,
        },
      });

      return NextResponse.json({
        url: result.url,
        key: result.key,
        size: file.size,
        contentType: file.type,
      });
    }

    await trackServerEvent({
      name: "api_upload_failed",
      properties: {
        upload_type: "unsupported",
        reason: "invalid_content_type",
      },
    });
    return NextResponse.json(
      {
        error:
          "Invalid content type. Use multipart/form-data for file uploads.",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Upload] Error:", error);
    await trackServerEvent({
      name: "api_upload_failed",
      properties: {
        duration_ms: Date.now() - startedAt,
        reason: error instanceof Error ? error.name : "unknown",
      },
    });
    return NextResponse.json(
      { error: (error as Error).message || "Upload failed" },
      { status: 500 }
    );
  }
}
