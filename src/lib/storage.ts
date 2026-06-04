import { v2 as cloudinary } from "cloudinary";
import { env } from "./env";
import { normalizeQuestionMediaUrl } from "./game/question-media";

// Configure Cloudinary
cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
  secure: true,
});

// ==========================================
// UPLOAD
// ==========================================

export interface UploadOptions {
  key: string; // File path/name (becomes public_id)
  body: Buffer | Uint8Array | string;
  contentType: string;
}

export async function uploadFile({
  key,
  body,
  contentType,
}: UploadOptions): Promise<{ url: string; key: string }> {
  // Determine resource type from content type
  let resourceType: "image" | "video" | "raw" = "raw";
  if (contentType.startsWith("image/")) {
    resourceType = "image";
  } else if (contentType.startsWith("video/")) {
    resourceType = "video";
  } else if (contentType.startsWith("audio/")) {
    resourceType = "video"; // Cloudinary handles audio as video
  }

  // Convert body to base64 data URI for upload
  let dataUri: string;
  if (typeof body === "string") {
    dataUri = body;
  } else {
    const base64 = Buffer.from(body).toString("base64");
    dataUri = `data:${contentType};base64,${base64}`;
  }

  // Remove file extension from key for public_id
  const publicId = key.replace(/\.[^/.]+$/, "");

  const result = await cloudinary.uploader.upload(dataUri, {
    public_id: publicId,
    resource_type: resourceType,
    folder: "waffles", // All uploads go to waffles folder
    overwrite: true,
  });

  const isQuestionImage =
    resourceType === "image" &&
    contentType !== "image/svg+xml" &&
    result.public_id.startsWith("waffles/questions/");

  return {
    url: isQuestionImage
      ? (normalizeQuestionMediaUrl(result.secure_url) ?? result.secure_url)
      : result.secure_url,
    key: result.public_id,
  };
}

// ==========================================
// LIST FILES
// ==========================================

export interface FileInfo {
  key: string;
  url: string;
  size: number;
  lastModified: Date;
  contentType?: string;
}

export async function listFiles(prefix = ""): Promise<FileInfo[]> {
  try {
    const folderPrefix = prefix ? `waffles/${prefix}` : "waffles";

    // Note: Cloudinary doesn't support resource_type "all" via Admin API
    // We query images only since that's our primary use case
    const result = await cloudinary.api.resources({
      type: "upload",
      prefix: folderPrefix,
      max_results: 100,
      resource_type: "image",
    });

    return result.resources.map(
      (resource: {
        public_id: string;
        secure_url: string;
        bytes: number;
        created_at: string;
        format: string;
        resource_type: "image" | "video" | "raw"; // Add resource_type
      }) => {
        let contentType: string | undefined;
        if (
          resource.resource_type === "image" ||
          resource.resource_type === "video"
        ) {
          contentType = `${resource.resource_type}/${resource.format}`;
        } else if (resource.resource_type === "raw") {
          // Cloudinary's 'format' for raw files is just the extension (e.g., 'pdf', 'txt')
          // We can try to map common ones or default to application/octet-stream
          const formatMap: { [key: string]: string } = {
            pdf: "application/pdf",
            txt: "text/plain",
            csv: "text/csv",
            xml: "application/xml",
            json: "application/json",
            zip: "application/zip",
            // Add more as needed
          };
          contentType =
            formatMap[resource.format] || "application/octet-stream";
        }

        return {
          key: resource.public_id,
          url:
            resource.resource_type === "image" &&
            resource.format !== "svg" &&
            resource.public_id.startsWith("waffles/questions/")
              ? (normalizeQuestionMediaUrl(resource.secure_url) ??
                resource.secure_url)
              : resource.secure_url,
          size: resource.bytes || 0,
          lastModified: new Date(resource.created_at),
          contentType: contentType,
        };
      }
    );
  } catch (error) {
    console.error("[Storage] List files error:", error);
    return [];
  }
}

/**
 * List files with URLs for viewing (same as listFiles for Cloudinary since URLs are public)
 */
export async function listFilesWithUrls(prefix = ""): Promise<FileInfo[]> {
  return listFiles(prefix);
}

// ==========================================
// GET FILE METADATA
// ==========================================

export async function getFileMetadata(key: string): Promise<{
  contentType: string;
  size: number;
  lastModified: Date;
} | null> {
  try {
    const result = await cloudinary.api.resource(key);
    let contentType: string;
    if (result.resource_type === "image" || result.resource_type === "video") {
      contentType = `${result.resource_type}/${result.format}`;
    } else if (result.resource_type === "raw") {
      const formatMap: { [key: string]: string } = {
        pdf: "application/pdf",
        txt: "text/plain",
        csv: "text/csv",
        xml: "application/xml",
        json: "application/json",
        zip: "application/zip",
      };
      contentType = formatMap[result.format] || "application/octet-stream";
    } else {
      contentType = "application/octet-stream"; // Default fallback
    }

    return {
      contentType: contentType,
      size: result.bytes || 0,
      lastModified: new Date(result.created_at),
    };
  } catch {
    return null;
  }
}

// ==========================================
// DELETE FILE
// ==========================================

export async function deleteFile(key: string): Promise<boolean> {
  try {
    await cloudinary.uploader.destroy(key);
    return true;
  } catch (error) {
    console.error("[Storage] Delete error:", error);
    return false;
  }
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Generate a unique file key with timestamp and random string
 */
export function generateFileKey(
  originalName: string,
  folder = "media"
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = originalName.split(".").pop() || "";
  const baseName = originalName.replace(/\.[^/.]+$/, "").slice(0, 50);
  const safeName = baseName.replace(/[^a-zA-Z0-9-_]/g, "_");

  return `${folder}/${timestamp}-${random}-${safeName}.${ext}`;
}

/**
 * Check if Cloudinary is configured
 */
export function isBucketConfigured(): boolean {
  return Boolean(
    env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret
  );
}

/**
 * Get cloud name (for debugging)
 */
export function getBucketName(): string {
  return env.cloudinaryCloudName || "";
}

// Legacy exports for backwards compatibility
export { cloudinary as s3Client };
