import { MarketTrend, OpenRouterCreditInfo, StockImageItem } from "./types";
import { generateMetadataCsv, generateUniqueStockFilename } from "./csv";

interface Smtp2goSendResponse {
  data?: {
    succeeded?: number;
    failed?: number;
    email_id?: string;
    failures?: string[];
  };
  errors?: string[];
}

export async function sendDailyStockEmail({
  trend,
  images,
  credits,
  mode = "regular_scene",
  recipientEmail,
  senderEmail,
  apiKey,
}: {
  trend: MarketTrend;
  images: StockImageItem[];
  credits: OpenRouterCreditInfo;
  mode?: "transparent_png" | "regular_scene";
  recipientEmail?: string;
  senderEmail?: string;
  apiKey?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const toEmail = recipientEmail || process.env.RECIPIENT_EMAIL || "hs5ckt@gmail.com";
  const fromEmail = senderEmail || process.env.SENDER_EMAIL || "fms@ptis.ac.th";
  const key = apiKey || process.env.SMTP2GO_API_KEY;

  const now = new Date();
  const todayStr = now.toLocaleDateString("en-US", {
    timeZone: "Asia/Bangkok",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ใช้รูปแบบวันที่ตามเวลาประเทศไทย (Asia/Bangkok) สำหรับชื่อไฟล์ CSV
  const bangkokDateParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const yyyy = bangkokDateParts.find((p) => p.type === "year")?.value || String(now.getFullYear());
  const mm = bangkokDateParts.find((p) => p.type === "month")?.value || String(now.getMonth() + 1).padStart(2, "0");
  const dd = bangkokDateParts.find((p) => p.type === "day")?.value || String(now.getDate()).padStart(2, "0");
  const dateSlug = `${yyyy}${mm}${dd}`;
  const csvFilename = `adobe_stock_metadata_${dateSlug}.csv`;

  // ตรวจสอบให้ทุกภาพมีชื่อไฟล์เฉพาะตัวที่ไม่ซ้ำกัน
  images.forEach((img) => {
    if (!img.filename) {
      img.filename = generateUniqueStockFilename(img.seoTitle, img.id, now, mode);
    }
  });

  // อ้างอิงชุดล่าสุดบนเซิร์ฟเวอร์ โดยไม่ฝังข้อมูลภาพลงใน URL
  const appUrl = process.env.APP_URL || "https://adobe-stock-lovat.vercel.app";
  const downloadUrl = `${appUrl}/?tab=images`;

  // สร้างเนื้อหาอีเมลแบบแจ้งเตือนสั้นกระชับ (ตัดรายละเอียด Title และ Keywords ออกตามคำขอของผู้ใช้)
  const htmlBody = generateNotificationEmailHtml(todayStr, trend, images.length, credits, csvFilename, mode, downloadUrl);
  const textBody = generateNotificationEmailPlainText(todayStr, trend, images.length, credits, csvFilename, mode, downloadUrl);

  // แนบไฟล์ CSV ข้อมูล Metadata (Filename, Title, Keywords)
  const csvContent = generateMetadataCsv(images);
  const csvBase64 = Buffer.from(csvContent, "utf-8").toString("base64");
  const attachments: Array<{ filename: string; fileblob: string; mimetype: string }> = [
    {
      filename: csvFilename,
      fileblob: csvBase64,
      mimetype: "text/csv",
    },
  ];

  if (!key) {
    console.warn("SMTP2GO_API_KEY not configured in environment variables.");
    return {
      success: false,
      messageId: `simulated-smtp2go-${Date.now()}`,
      error: "SMTP2GO_API_KEY is not configured in Vercel environment variables.",
    };
  }

  try {
    const isLowCredit = credits.remainingCredits <= 0.05;
    const subjectPrefix = isLowCredit
      ? `🚨 [แจ้งเตือน: เครดิตเหลือ $${credits.remainingCredits.toFixed(4)}] `
      : "";

    const modeTag = mode === "transparent_png" ? "[🔲 Transparent PNG Set]" : "[🏞️ Regular Scene Set]";
    const payload = {
      api_key: key,
      to: [toEmail],
      sender: fromEmail,
      subject: `${subjectPrefix}📸 ${modeTag} ชุดภาพใหม่ ${images.length} ภาพพร้อมดาวน์โหลดแล้ว (${todayStr})`,
      html_body: htmlBody,
      text_body: textBody,
      attachments,
    };

    const res = await fetch("https://api.smtp2go.com/v3/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    });

    const data: Smtp2goSendResponse = await res.json().catch(() => ({}));

    if (res.ok && data?.data && (data.data.succeeded ?? 0) > 0) {
      return {
        success: true,
        messageId: data.data.email_id || `sent-${Date.now()}`,
      };
    } else {
      const errMsg =
        data?.errors?.join(", ") ||
        data?.data?.failures?.join(", ") ||
        `SMTP2GO API returned status ${res.status}`;
      console.error("SMTP2GO dispatch failed:", errMsg);
      return {
        success: false,
        error: errMsg,
      };
    }
  } catch (error: unknown) {
    console.error("Failed to send email via SMTP2GO:", error);
    return {
      success: false,
      error: "Unknown error sending email via SMTP2GO",
    };
  }
}

/**
 * สร้าง HTML สำหรับอีเมลแจ้งเตือนสั้นกระชับ เน้นปุ่มและ URL ดาวน์โหลด (ไม่มีรายละเอียด Title/Keywords ที่รกตา)
 */
function generateNotificationEmailHtml(
  todayStr: string,
  trend: MarketTrend,
  imageCount: number,
  credits: OpenRouterCreditInfo,
  csvFilename: string,
  mode: "transparent_png" | "regular_scene",
  downloadUrl: string
): string {
  const isTransparent = mode === "transparent_png";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Adobe Stock Daily Production Notification</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
  <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
    
    <!-- Top Header Card -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); color: #ffffff; padding: 28px 24px; text-align: center;">
      <div style="display: inline-block; background-color: rgba(56, 189, 248, 0.2); color: #38bdf8; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; border: 1px solid rgba(56, 189, 248, 0.3);">
        Daily Production Ready
      </div>
      <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">
        📸 ภาพชุดใหม่ ${imageCount} ภาพสร้างเสร็จแล้ว!
      </h1>
      <p style="margin: 0; color: #94a3b8; font-size: 13px;">
        ${todayStr} &bull; ระบบสร้างภาพและเตรียมไฟล์เรียบร้อยแล้ว
      </p>
    </div>

    <!-- Main Action: Download Button -->
    <div style="padding: 28px 24px; text-align: center; border-bottom: 1px solid #f1f5f9;">
      <p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.5;">
        สามารถกดปุ่มด้านล่างเพื่อเปิดหน้าเว็บและ <strong>ดาวน์โหลดทั้ง ${imageCount} ภาพ (ZIP Archive + CSV)</strong> ได้ทันที
      </p>

      <a href="${downloadUrl}" style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; padding: 15px 32px; border-radius: 12px; font-size: 15px; font-weight: 800; text-decoration: none; display: inline-block; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.35); letter-spacing: 0.2px;">
        🚀 ดาวน์โหลดภาพทั้งชุดบนหน้าเว็บ &rarr;
      </a>

      <div style="margin-top: 18px; font-size: 12px; color: #64748b;">
        หรือคัดลอกลิงก์ตรงไปยังเบราว์เซอร์:
        <div style="margin-top: 6px; padding: 8px 12px; background-color: #f1f5f9; border-radius: 8px; font-family: monospace; font-size: 11px; word-break: break-all; color: #2563eb;">
          <a href="${downloadUrl}" style="color: #2563eb; text-decoration: underline;">${downloadUrl}</a>
        </div>
      </div>
    </div>

    <!-- Details Summary Grid -->
    <div style="padding: 24px; background-color: #f8fafc;">
      <!-- Mode & Upscale Recommendation -->
      <div style="background-color: #ffffff; border: 1.5px solid ${isTransparent ? "#38bdf8" : "#10b981"}; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
        <div style="color: ${isTransparent ? "#0284c7" : "#059669"}; font-size: 14px; font-weight: 800; margin-bottom: 4px;">
          ${isTransparent ? "🔲 โหมดวันนี้: ชุดภาพ PNG พื้นหลังโปร่งใส (100% Alpha Cutout)" : "🏞️ โหมดวันนี้: ชุดภาพทั่วไปมีฉากหลัง (พร้อม Copy Space 50-60%)"}
        </div>
        <div style="color: #475569; font-size: 13px; line-height: 1.4;">
          ${isTransparent
            ? "ชุดนี้เป็นภาพ Isolated Cutout ทั้งหมด กรุณาเลือกบันทึกผลลัพธ์เป็น <strong>.PNG</strong> เพื่อรักษาความโปร่งใส"
            : "ชุดนี้เป็นภาพ Commercial Scene สามารถบันทึกเป็น <strong>.JPG หรือ .PNG</strong> ได้ตามสะดวก"}
        </div>
      </div>

      <!-- Balance & Attached CSV Info -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="48%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; vertical-align: top;">
            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px;">เครดิต OpenRouter</div>
            <div style="font-size: 18px; font-weight: 800; color: ${credits.remainingCredits <= 0.05 ? "#ef4444" : "#0284c7"}; font-family: monospace;">
              $${credits.remainingCredits.toFixed(4)}
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
              ${credits.remainingCredits <= 0.05 ? "⚠️ กรุณาเติมเครดิต" : "สถานะพร้อมใช้งาน"}
            </div>
          </td>
          <td width="4%"></td>
          <td width="48%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; vertical-align: top;">
            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px;">ไฟล์แนบ Metadata</div>
            <div style="font-size: 12px; font-weight: 700; color: #15803d; font-family: monospace; word-break: break-all;">
              📎 ${escapeHtml(csvFilename)}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
              (Filename, Title, Keywords)
            </div>
          </td>
        </tr>
      </table>

      <!-- Topic / Winning Niche -->
      <div style="margin-top: 16px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px;">
        <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px;">ธีมและตลาดเป้าหมายวันนี้</div>
        <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
          ${escapeHtml(trend.theme)}
        </div>
        <div style="font-size: 12px; color: #64748b; line-height: 1.4;">
          ${escapeHtml(trend.commercialReasoning)}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; color: #94a3b8; font-size: 12px; padding: 20px 24px; border-top: 1px solid #f1f5f9;">
      <p style="margin: 0 0 4px 0;">ระบบอัตโนมัติ Adobe Stock Daily Dispatcher บน Vercel</p>
      <p style="margin: 0;">hs5ckt@gmail.com &bull; github.com/diowcnx/adobe_stock</p>
    </div>

  </div>
</body>
</html>
  `;
}

/**
 * สร้าง Plain Text สำหรับอีเมลแจ้งเตือนสั้นกระชับ
 */
function generateNotificationEmailPlainText(
  todayStr: string,
  trend: MarketTrend,
  imageCount: number,
  credits: OpenRouterCreditInfo,
  csvFilename: string,
  mode: "transparent_png" | "regular_scene",
  downloadUrl: string
): string {
  const modeLabel = mode === "transparent_png"
    ? "🔲 ชุดภาพ PNG พื้นหลังโปร่งใส (แนะนำ Save เป็น .PNG)"
    : "🏞️ ชุดภาพทั่วไปมีฉากหลังและ Copy Space (แนะนำ Save เป็น .JPG หรือ .PNG)";

  let text = `📸 Adobe Stock Daily Dispatch - ${todayStr}\n\n`;
  text += `ภาพชุดใหม่ ${imageCount} ภาพสร้างเสร็จสมบูรณ์แล้ว!\n\n`;
  text += `🔗 ลิงก์ดาวน์โหลดทั้งชุดบนหน้าเว็บ (ZIP + CSV):\n`;
  text += `${downloadUrl}\n\n`;
  text += `🎯 โหมดวันนี้: ${modeLabel}\n`;
  text += `💰 เครดิต OpenRouter คงเหลือ: $${credits.remainingCredits.toFixed(4)}\n`;
  text += `📎 ไฟล์แนบ: ${csvFilename} (สำหรับอัปโหลดข้อมูล Title/Keywords ขึ้น Adobe Stock)\n\n`;
  text += `ธีมวันนี้: ${trend.theme}\n`;
  text += `${trend.commercialReasoning}\n\n`;
  text += `เปิดหน้าเว็บด้านบนเพื่อเริ่มดาวน์โหลดภาพทั้งหมดทันทีครับ`;

  return text;
}

/**
 * แจ้งเตือนฉุกเฉินเมื่อเครดิต OpenRouter หมด
 */
export async function sendCreditDepletedEmergencyAlert({
  credits,
  recipientEmail,
  senderEmail,
  apiKey,
}: {
  credits: OpenRouterCreditInfo;
  recipientEmail?: string;
  senderEmail?: string;
  apiKey?: string;
}): Promise<boolean> {
  const toEmail = recipientEmail || process.env.RECIPIENT_EMAIL || "hs5ckt@gmail.com";
  const fromEmail = senderEmail || process.env.SENDER_EMAIL || "fms@ptis.ac.th";
  const key = apiKey || process.env.SMTP2GO_API_KEY;

  if (!key) return false;

  const html = `
    <div style="font-family: sans-serif; padding: 20px; max-width: 500px; margin: 0 auto; border: 2px solid #ef4444; border-radius: 12px; background: #fff5f5;">
      <h2 style="color: #dc2626; margin-top: 0;">🚨 แจ้งเตือนด่วน: เครดิต OpenRouter หมดแล้ว</h2>
      <p style="color: #374151;">ยอดเงินคงเหลือของคุณคือ <strong>$${credits.remainingCredits.toFixed(4)}</strong> ซึ่งไม่เพียงพอต่อการสร้างภาพในรอบถัดไป</p>
      <div style="margin: 20px 0;">
        <a href="https://openrouter.ai/credits" style="background: #dc2626; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">เติมเครดิต OpenRouter ทันที &rarr;</a>
      </div>
      <p style="font-size: 12px; color: #6b7280;">อีเมลนี้ส่งอัตโนมัติจากระบบ adobe_stock บน Vercel</p>
    </div>
  `;

  try {
    const response = await fetch("https://api.smtp2go.com/v3/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        to: [toEmail],
        sender: fromEmail,
        subject: `🚨 [ด่วน] เครดิต OpenRouter หมดแล้ว ($${credits.remainingCredits.toFixed(4)}) - กรุณาเติมเงิน`,
        html_body: html,
        text_body: `แจ้งเตือนด่วน: เครดิต OpenRouter ของคุณหมดแล้ว ($${credits.remainingCredits.toFixed(4)}) กรุณาเติมเงินที่: https://openrouter.ai/credits`,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
