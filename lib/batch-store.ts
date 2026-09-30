import fs from "node:fs";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";
import { fetchAllowlistedImage } from "./remote-image";
import { WorkflowResult } from "./types";
import { isWorkflowResult } from "./validation";

const TMP_BATCH_FILE = path.join("/tmp", "latest_adobe_stock_batch.json");
const BATCH_PREFIX = "adobe-stock-batches/";
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

interface StoredBatchManifest {
  id: string;
  result: WorkflowResult;
  imagePaths: Array<string | null>;
}

declare global {
  var __latestAdobeStockBatch: WorkflowResult | undefined;
}

function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1";
}

function createBatchId(timestamp: string): string {
  const id = timestamp.replace(/[^0-9A-Za-z]/g, "");
  if (!id || id.length > 64) throw new Error("Invalid batch timestamp");
  return id;
}

function getImagePath(batchId: string, itemId: number, mimeType: string): string {
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpeg";
  return `${BATCH_PREFIX}${batchId}/images/${itemId}.${extension}`;
}

function parseDataImage(value: string): { bytes: Buffer; contentType: string } | null {
  const match = /^data:(image\/(?:png|jpeg|webp|gif|avif));base64,([A-Za-z0-9+/=\s]+)$/i.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new Error("Generated image exceeds the 25 MB storage limit");
  }
  return { bytes, contentType: match[1].toLowerCase() };
}

function batchImageUrl(pathname: string): string {
  return `/api/batch-image?pathname=${encodeURIComponent(pathname)}`;
}

async function saveToLocalCache(result: WorkflowResult): Promise<WorkflowResult> {
  try {
    globalThis.__latestAdobeStockBatch = result;
    const lightweightResult = {
      ...result,
      images: result.images.map((image) => {
        const { imageBase64: _imageBase64, ...rest } = image;
        void _imageBase64;
        return rest;
      }),
    };
    fs.writeFileSync(TMP_BATCH_FILE, JSON.stringify(lightweightResult), "utf-8");
  } catch (err) {
    console.warn("Could not write latest batch to local /tmp:", err);
  }
  return result;
}

async function getFromLocalCache(): Promise<WorkflowResult | null> {
  if (globalThis.__latestAdobeStockBatch) return globalThis.__latestAdobeStockBatch;
  try {
    if (!fs.existsSync(TMP_BATCH_FILE)) return null;
    const parsed: unknown = JSON.parse(fs.readFileSync(TMP_BATCH_FILE, "utf-8"));
    if (!isWorkflowResult(parsed)) return null;
    globalThis.__latestAdobeStockBatch = parsed;
    return parsed;
  } catch (err) {
    console.warn("Could not read latest batch from local /tmp:", err);
    return null;
  }
}

async function readBlobText(pathname: string): Promise<string | null> {
  const blob = await get(pathname, { access: "private" });
  if (!blob || blob.statusCode !== 200) return null;
  return new Response(blob.stream).text();
}

async function readManifest(pathname: string): Promise<StoredBatchManifest | null> {
  try {
    const text = await readBlobText(pathname);
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    if (
      typeof parsed !== "object" || parsed === null ||
      !("id" in parsed) || typeof parsed.id !== "string" ||
      !("result" in parsed) || !isWorkflowResult(parsed.result) ||
      !("imagePaths" in parsed) || !Array.isArray(parsed.imagePaths) ||
      !parsed.imagePaths.every((item) => item === null || typeof item === "string")
    ) return null;
    return parsed as StoredBatchManifest;
  } catch (error) {
    console.error("Unable to read batch manifest:", error);
    return null;
  }
}

async function persistImageValue(
  batchId: string,
  itemId: number,
  value: string,
): Promise<string> {
  const dataImage = parseDataImage(value);
  let bytes: Buffer | ArrayBuffer;
  let contentType: string;

  if (dataImage) {
    bytes = dataImage.bytes;
    contentType = dataImage.contentType;
  } else if (/^https:\/\//i.test(value)) {
    const remote = await fetchAllowlistedImage(value);
    if (remote.body.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("Generated image exceeds the 25 MB storage limit");
    }
    bytes = remote.body;
    contentType = remote.contentType;
  } else {
    throw new Error(`Image ${itemId} has an unsupported image URL`);
  }

  const pathname = getImagePath(batchId, itemId, contentType);
  await put(pathname, bytes, {
    access: "private",
    contentType,
    allowOverwrite: true,
  });
  return pathname;
}

/** Persist a manually generated image as soon as it is returned to the browser. */
export async function persistGeneratedImage(
  timestamp: string,
  itemId: number,
  imageValue: string,
): Promise<string> {
  if (!isVercelRuntime()) return imageValue;
  if (!process.env.BLOB_STORE_ID) {
    throw new Error("Connect a private Vercel Blob store to this project before saving images");
  }
  const batchId = createBatchId(timestamp);
  const existingPath = imageValue.startsWith("/api/batch-image?pathname=")
    ? new URL(imageValue, "https://internal.invalid").searchParams.get("pathname")
    : null;
  if (existingPath?.startsWith(`${BATCH_PREFIX}${batchId}/images/`)) {
    return batchImageUrl(existingPath);
  }
  return batchImageUrl(await persistImageValue(batchId, itemId, imageValue));
}

/**
 * Persist images and their metadata in private Vercel Blob storage.
 * Local development keeps the previous /tmp fallback; deployed Vercel functions
 * must use shared, durable storage instead of per-instance memory or /tmp.
 */
export async function saveLatestBatch(result: WorkflowResult): Promise<WorkflowResult> {
  if (!isVercelRuntime()) return saveToLocalCache(result);
  if (!process.env.BLOB_STORE_ID) {
    throw new Error("Connect a private Vercel Blob store to this project before saving batches");
  }

  const batchId = createBatchId(result.timestamp);
  const manifestPath = `${BATCH_PREFIX}${batchId}/manifest.json`;
  const imagePaths: Array<string | null> = [];
  const uploadedPaths: string[] = [];
  const storedImages = [];

  try {
    for (const image of result.images) {
      let pathname: string | null = null;
      if (image.imageUrl?.startsWith("/api/batch-image?pathname=")) {
        const existingPath = new URL(image.imageUrl, "https://internal.invalid").searchParams.get("pathname");
        if (existingPath?.startsWith(`${BATCH_PREFIX}${batchId}/images/`)) pathname = existingPath;
      }

      const imageValue = image.imageUrl || image.imageBase64;
      if (!pathname && imageValue) {
        pathname = await persistImageValue(batchId, image.id, imageValue);
        uploadedPaths.push(pathname);
      }

      imagePaths.push(pathname);
      const { imageBase64: _imageBase64, ...metadata } = image;
      void _imageBase64;
      storedImages.push({
        ...metadata,
        imageUrl: pathname ? batchImageUrl(pathname) : undefined,
      });
    }

    const persistedResult: WorkflowResult = { ...result, images: storedImages };
    const manifest: StoredBatchManifest = { id: batchId, result: persistedResult, imagePaths };
    await put(manifestPath, JSON.stringify(manifest), {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
    });

    // Keep a warm cache for repeat requests handled by the same function instance.
    globalThis.__latestAdobeStockBatch = persistedResult;
    return persistedResult;
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await del(uploadedPaths).catch((cleanupError) => {
        console.warn("Could not clean up an incomplete batch upload:", cleanupError);
      });
    }
    throw error;
  }
}

/** Return all persisted batches, newest first, so missed downloads remain available. */
export async function getStoredBatches(): Promise<WorkflowResult[]> {
  if (!isVercelRuntime()) {
    const local = await getFromLocalCache();
    return local ? [local] : [];
  }

  const paths: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: BATCH_PREFIX, limit: 1000, cursor, mode: "expanded" });
    paths.push(...page.blobs.filter((blob) => blob.pathname.endsWith("/manifest.json")).map((blob) => blob.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const manifests = await Promise.all(paths.map(readManifest));
  return manifests
    .filter((manifest): manifest is StoredBatchManifest => manifest !== null)
    .map((manifest) => manifest.result)
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

export async function getLatestBatch(): Promise<WorkflowResult | null> {
  const batches = await getStoredBatches();
  return batches[0] ?? null;
}

/** Remove only the specifically confirmed batch, never unrelated batches. */
export async function clearLatestBatch(timestamp?: string): Promise<void> {
  if (!isVercelRuntime()) {
    const local = await getFromLocalCache();
    if (timestamp && local?.timestamp !== timestamp) return;
    globalThis.__latestAdobeStockBatch = undefined;
    if (fs.existsSync(TMP_BATCH_FILE)) fs.unlinkSync(TMP_BATCH_FILE);
    return;
  }

  const batches = await getStoredBatches();
  const target = timestamp ? batches.find((batch) => batch.timestamp === timestamp) : batches[0];
  if (!target) return;

  const batchId = createBatchId(target.timestamp);
  const manifestPath = `${BATCH_PREFIX}${batchId}/manifest.json`;
  const manifest = await readManifest(manifestPath);
  const pathsToDelete = [manifestPath, ...(manifest?.imagePaths.filter((item): item is string => item !== null) ?? [])];
  await del(pathsToDelete);
  globalThis.__latestAdobeStockBatch = undefined;
}

export async function getPrivateBatchImage(pathname: string) {
  if (!pathname.startsWith(BATCH_PREFIX) || !/^adobe-stock-batches\/[0-9A-Za-z]+\/images\/[0-9]+\.(?:png|jpe?g|webp|gif|avif)$/.test(pathname)) {
    return null;
  }
  return get(pathname, { access: "private" });
}
