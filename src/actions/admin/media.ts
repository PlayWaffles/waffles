"use server";

import {
  listFilesWithUrls,
  deleteFile,
  isBucketConfigured,
} from "@/lib/storage";
import { requireAdminSession } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";

export interface MediaFile {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: Date;
  contentType: string;
}

export type MediaActionResult =
  | { success: true; files?: MediaFile[] }
  | { success: false; error: string };

/**
 * List all uploaded media files from Cloudinary
 */
export async function listMediaAction(): Promise<MediaActionResult> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated || !authResult.session) {
    return { success: false, error: "Unauthorized" };
  }

  if (!isBucketConfigured()) {
    return { success: false, error: "Storage not configured" };
  }

  try {
    const allFiles = await listFilesWithUrls();

    // listFilesWithUrls already returns Cloudinary-derived content types.
    // Avoid per-file metadata lookups here because large libraries can hit the
    // Cloudinary Admin API rate limit and make the media library appear empty.
    const files: MediaFile[] = allFiles.map((file) => ({
      url: file.url,
      pathname: file.key,
      size: file.size,
      uploadedAt: file.lastModified,
      contentType: file.contentType || "application/octet-stream",
    }));

    return { success: true, files };
  } catch (error) {
    console.error("List media error:", error);
    return { success: false, error: "Failed to list media files" };
  }
}

/**
 * Delete a media file from Cloudinary
 */
export async function deleteMediaAction(
  pathname: string
): Promise<{ success: boolean; error?: string }> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated || !authResult.session) {
    return { success: false, error: "Unauthorized" };
  }

  if (!isBucketConfigured()) {
    return { success: false, error: "Storage not configured" };
  }

  try {
    if (!pathname) {
      return { success: false, error: "Invalid file path" };
    }

    const deleted = await deleteFile(pathname);
    if (!deleted) {
      return { success: false, error: "Failed to delete file" };
    }

    revalidatePath("/admin/media");
    return { success: true };
  } catch (error) {
    console.error("Delete media error:", error);
    return { success: false, error: "Failed to delete media file" };
  }
}

/**
 * Get a URL for a specific file
 * Cloudinary URLs are already public, no presigning needed
 */
export async function getMediaUrlAction(
  pathname: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated || !authResult.session) {
    return { success: false, error: "Unauthorized" };
  }

  if (!isBucketConfigured()) {
    return { success: false, error: "Storage not configured" };
  }

  try {
    const files = await listFilesWithUrls();
    const file = files.find((f) => f.key === pathname);

    if (!file) {
      return { success: false, error: "File not found" };
    }

    return { success: true, url: file.url };
  } catch (error) {
    console.error("Get media URL error:", error);
    return { success: false, error: "Failed to get media URL" };
  }
}
