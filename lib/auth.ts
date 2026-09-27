import { cookies } from "next/headers";

export const COOKIE_NAME = "adobe_stock_admin_session";
const DEFAULT_SECRET = "adobe_stock_secure_key_2026";

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

/**
 * สร้าง Session Token ที่ลงลายมือชื่อดิจิทัล (Signed Token)
 */
export async function createSessionToken(username: string = "diowcnx"): Promise<string> {
  const secret = process.env.ADMIN_PASSWORD || process.env.SESSION_SECRET || DEFAULT_SECRET;
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

  // อายุ Session: 7 วัน (7 * 24 * 60 * 60 * 1000)
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - timestamp > maxAgeMs) {
    return false; // หมดอายุ
  }

  const secret = process.env.ADMIN_PASSWORD || process.env.SESSION_SECRET || DEFAULT_SECRET;
  const expectedSignature = await signMessage(`${username}:${timestampStr}`, secret);

  return signature === expectedSignature;
}

/**
 * ตรวจสอบรหัสผ่าน Admin
 */
export function checkAdminPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD || "diowcnx1234";
  return password.trim() === adminPassword.trim();
}

/**
 * ตรวจสอบสถานะการ Login ของ Request ฝั่ง Server
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
