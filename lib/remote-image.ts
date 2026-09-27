import { isIP } from "node:net";

const MAX_REMOTE_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const SAFE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);

function configuredHosts(): Set<string> {
  return new Set(
    (process.env.REMOTE_IMAGE_ALLOWED_HOSTS || "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function validateRemoteImageUrl(value: string): URL {
  if (value.length > 2_048) {
    throw new Error("Remote image URL is too long");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Remote image URL is invalid");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    throw new Error("Remote image URL must use HTTPS without credentials or a custom port");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    isIP(hostname) !== 0 ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Remote image hostname is not permitted");
  }

  const allowedHosts = configuredHosts();
  if (!allowedHosts.has(hostname)) {
    throw new Error("Remote image host is not allowlisted");
  }

  return url;
}

async function readResponseBody(response: Response): Promise<ArrayBuffer> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REMOTE_IMAGE_BYTES) {
    throw new Error("Remote image exceeds the size limit");
  }

  if (!response.body) throw new Error("Remote image response is empty");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REMOTE_IMAGE_BYTES) {
        await reader.cancel();
        throw new Error("Remote image exceeds the size limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined.buffer;
}

export async function fetchAllowlistedImage(
  value: string,
  timeoutMs = 10_000,
): Promise<{ body: ArrayBuffer; contentType: string }> {
  let url = validateRemoteImageUrl(value);
  const signal = AbortSignal.timeout(timeoutMs);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal,
      headers: { Accept: "image/*" },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirectCount === MAX_REDIRECTS) {
        throw new Error("Remote image redirected too many times");
      }
      url = validateRemoteImageUrl(new URL(location, url).toString());
      continue;
    }

    if (!response.ok) {
      throw new Error(`Remote image request failed with status ${response.status}`);
    }

    const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() || "";
    if (!SAFE_IMAGE_TYPES.has(contentType)) {
      throw new Error("Remote response is not a supported raster image");
    }

    return { body: await readResponseBody(response), contentType };
  }

  throw new Error("Remote image request failed");
}
