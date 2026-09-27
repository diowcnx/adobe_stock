import { cookies } from "next/headers";

export const COOKIE_NAME = "adobe_stock_admin_session";
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
const MAX_CLOCK_SKEW_MS = 60_000;

function getSessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

/**
 * สร้าง HMAC-SHA256 Signature ด้วย Web Crypto API
 */
async function signMessage(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function secureCompare(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode("adobe-stock-constant-time-comparison"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(left));
  return crypto.subtle.verify("HMAC", key, signature, encoder.encode(right));
}

/**
 * สร้าง Session Token ที่ลงลายมือชื่อดิจิทัล (Signed Token)
 */
export async function createSessionToken(username: string = "diowcnx"): Promise<string> {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters");
  }
  const timestamp = Date.now();
  const payload = `${username}:${timestamp}`;
  const signature = await signMessage(payload, secret);
  return `${payload}:${signature}`;
}

/**
 * ตรวจสอบความถูกต้องของ Session Token
 */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const parts = token.split(":");
  if (parts.length !== 3) return false;

  const [username, timestampStr, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);

  if (isNaN(timestamp)) return false;

  const now = Date.now();
  const maxAgeMs = SESSION_MAX_AGE_SECONDS * 1000;
  if (timestamp > now + MAX_CLOCK_SKEW_MS || now - timestamp > maxAgeMs) return false;

  const secret = getSessionSecret();
  if (!secret) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  const signatureBytes = Uint8Array.from(
    signature.match(/.{2}/g) ?? [],
    (byte) => Number.parseInt(byte, 16),
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(`${username}:${timestampStr}`),
  );
}

/**
 * ตรวจสอบรหัสผ่าน Admin
 */
export async function checkAdminPassword(password: string): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 12 || password.length > 256) return false;
  return secureCompare(password, adminPassword);
}

/**
 * ตรวจสอบสถานะการ Login ของ Request ฝั่ง Server
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
