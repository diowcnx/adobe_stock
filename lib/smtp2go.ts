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
  recipientEmail,
  senderEmail,
  apiKey,
}: {
  trend: MarketTrend;
  images: StockImageItem[];
  credits: OpenRouterCreditInfo;
  recipientEmail?: string;
  senderEmail?: string;
  apiKey?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const toEmail = recipientEmail || process.env.RECIPIENT_EMAIL || "hs5ckt@gmail.com";
  const fromEmail = senderEmail || process.env.SENDER_EMAIL || "stock-alerts@notify.diowcnx.com";
  const key = apiKey || process.env.SMTP2GO_API_KEY;

  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const now = new Date();
  const dateSlug = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const csvFilename = `adobe_stock_metadata_${dateSlug}.csv`;

  // ตรวจสอบให้ทุกภาพมีชื่อไฟล์เฉพาะตัวที่ไม่ซ้ำกัน
  images.forEach((img) => {
    if (!img.filename) {
      img.filename = generateUniqueStockFilename(img.seoTitle, img.id);
    }
  });

  const htmlBody = generateEmailHtml(todayStr, trend, images, credits, csvFilename);
  const textBody = generateEmailPlainText(todayStr, trend, images, credits, csvFilename);

  // เตรียม attachments สำหรับภาพ PNG ทั้งหมด
  const attachments: Array<{ filename: string; fileblob: string; mimetype: string }> = images
    .filter((img) => img.imageBase64 && img.filename)
    .map((img) => {
      return {
        filename: img.filename!,
        fileblob: img.imageBase64!,
        mimetype: "image/png",
      };
    });

  // แนบไฟล์ CSV ที่มีเฉพาะ Filename,Title,Keywords สำหรับนำไปอัปโหลดต่อได้ทันที
  const csvContent = generateMetadataCsv(images);
  attachments.push({
    filename: csvFilename,
    fileblob: Buffer.from(csvContent, "utf-8").toString("base64"),
    mimetype: "text/csv",
  });

  if (!key) {
    console.warn("SMTP2GO_API_KEY not configured. Simulating successful email dispatch.");
    return {
      success: true,
      messageId: `simulated-smtp2go-${Date.now()}`,
      error: "SMTP2GO_API_KEY is not set. Email was rendered successfully in simulation mode.",
    };
  }

  try {
    const isLowCredit = credits.remainingCredits <= 0.05;
    const subjectPrefix = isLowCredit
      ? `🚨 [แจ้งเตือนด่วน: เครดิต OpenRouter เหลือ $${credits.remainingCredits.toFixed(4)}] `
      : "";

    const payload = {
      api_key: key,
      to: [toEmail],
      sender: fromEmail,
      subject: `${subjectPrefix}📸 [Adobe Stock Daily] 5 New Commercial Images & SEO Keywords - ${todayStr}`,
      html_body: htmlBody,
      text_body: textBody,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    const res = await fetch("https://api.smtp2go.com/v3/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data: Smtp2goSendResponse = await res.json();

    if (res.ok && data.data && (data.data.succeeded ?? 0) > 0) {
      return {
        success: true,
        messageId: data.data.email_id || `sent-${Date.now()}`,
      };
    } else {
      const errMsg =
        data.errors?.join(", ") ||
        data.data?.failures?.join(", ") ||
        `SMTP2GO API returned status ${res.status}`;
      return {
        success: false,
        error: errMsg,
      };
    }
  } catch (error: any) {
    console.error("Failed to send email via SMTP2GO:", error);
    return {
      success: false,
      error: error.message || "Unknown error sending email via SMTP2GO",
    };
  }
}

function generateEmailHtml(
  todayStr: string,
  trend: MarketTrend,
  images: StockImageItem[],
  credits: OpenRouterCreditInfo,
  csvFilename: string = "adobe_stock_metadata.csv"
): string {
  const imagesHtml = images
    .map((img) => {
      const keywordsString = img.keywords.join(", ");
      return `
      <div style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 28px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 14px 20px; color: #ffffff;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="background-color: #3b82f6; color: #ffffff; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; text-transform: uppercase;">Image #${img.id}</span>
                <span style="color: #94a3b8; font-size: 13px; margin-left: 10px;">Ratio: <strong>${img.aspectRatio}</strong></span>
              </td>
              <td align="right">
                <span style="color: #38bdf8; font-size: 12px; font-family: monospace;">Model: ${img.modelUsed}</span>
              </td>
            </tr>
          </table>
        </div>

        <div style="padding: 20px;">
          <!-- Associated Image Filename Reference -->
          <div style="margin-bottom: 16px; background-color: #f1f5f9; padding: 12px 14px; border-radius: 8px; border-left: 4px solid #0f172a;">
            <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;">
              📁 ชื่อไฟล์รูปภาพ (Associated Image Filename):
            </div>
            <div style="font-size: 14px; font-weight: 700; color: #0f172a; font-family: monospace; word-break: break-all;">
              ${escapeHtml(img.filename || `stock_image_${img.id}.png`)}
            </div>
          </div>

          ${
            img.imageUrl
              ? `
          <!-- Image Preview -->
          <div style="text-align: center; margin-bottom: 20px; background-color: #0f172a; border-radius: 8px; overflow: hidden; padding: 10px;">
            <img src="${img.imageUrl}" alt="${escapeHtml(img.seoTitle)}" style="max-width: 100%; max-height: 380px; height: auto; border-radius: 6px; display: inline-block; vertical-align: middle;" />
          </div>`
              : ""
          }

          <!-- SEO Title -->
          <div style="margin-bottom: 16px;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">📌 Adobe Stock SEO Title (Copy &amp; Paste)</div>
            <div style="font-size: 16px; font-weight: 700; color: #0f172a; background-color: #f8fafc; padding: 10px 14px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              ${escapeHtml(img.seoTitle)}
            </div>
          </div>

          <!-- Category -->
          <div style="margin-bottom: 14px; font-size: 13px; color: #475569;">
            <strong>Category:</strong> <span style="background-color: #f1f5f9; padding: 2px 8px; border-radius: 4px;">${escapeHtml(img.category)}</span>
          </div>

          <!-- Prompt -->
          <div style="margin-bottom: 16px;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">💡 Full Generation Prompt</div>
            <div style="font-size: 12px; color: #334155; line-height: 1.5; background-color: #f8fafc; padding: 10px 12px; border-radius: 6px; font-family: monospace; border: 1px dashed #cbd5e1;">
              ${escapeHtml(img.prompt)}
            </div>
          </div>

          <!-- Keywords Ready to Paste -->
          <div>
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
              🏷️ Adobe Stock Optimized Keywords (Single Words / Top 10 Prioritized)
            </div>
            <div style="font-size: 12px; color: #1e293b; line-height: 1.6; background-color: #f1f5f9; padding: 12px; border-radius: 8px; word-break: break-word;">
              ${escapeHtml(keywordsString)}
            </div>
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  const appUrl = process.env.APP_URL || "https://adobe-stock-lovat.vercel.app";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Adobe Stock Daily Dispatch</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
  <div style="max-width: 680px; margin: 0 auto;">
    
    <!-- Top Quick Access Bar -->
    <div style="background-color: #0f172a; border: 1px solid #1e293b; border-radius: 14px; padding: 12px 18px; margin-bottom: 18px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <span style="color: #94a3b8; font-size: 13px; margin-right: 6px;">🔗 เข้าใช้งานระบบ:</span>
            <a href="${appUrl}" style="color: #38bdf8; font-weight: 700; font-size: 14px; text-decoration: underline;">
              ${appUrl}
            </a>
          </td>
          <td align="right">
            <a href="${appUrl}" style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); color: #ffffff; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; text-decoration: none; display: inline-block; box-shadow: 0 2px 4px rgba(99, 102, 241, 0.3);">
              เปิดเว็บทันที &rarr;
            </a>
          </td>
        </tr>
      </table>
    </div>

    <!-- Header Banner -->
    <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: #ffffff; padding: 26px 24px; border-radius: 16px; margin-bottom: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">📸 Adobe Stock Daily Dispatch</h1>
            <p style="margin: 0; color: #cbd5e1; font-size: 13px;">${todayStr} | Automated AI Stock Production</p>
          </td>
          <td align="right" valign="top">
            <div style="background-color: ${credits.remainingCredits <= 0.05 ? "rgba(239, 68, 68, 0.3)" : "rgba(255, 255, 255, 0.15)"}; backdrop-filter: blur(8px); border-radius: 12px; padding: 10px 14px; text-align: center; border: 1px solid ${credits.remainingCredits <= 0.05 ? "#ef4444" : "rgba(255,255,255,0.2)"};">
              <div style="font-size: 10px; text-transform: uppercase; color: ${credits.remainingCredits <= 0.05 ? "#fca5a5" : "#a5b4fc"}; font-weight: 700;">OpenRouter Credit</div>
              <div style="font-size: 18px; font-weight: 800; color: ${credits.remainingCredits <= 0.05 ? "#ef4444" : "#38bdf8"};">$${credits.remainingCredits.toFixed(4)}</div>
            </div>
          </td>
        </tr>
      </table>
    </div>

    ${
      credits.remainingCredits <= 0.05
        ? `
    <!-- Low / Depleted Credit Urgent Banner -->
    <div style="background-color: #fef2f2; border: 2px solid #ef4444; border-radius: 14px; padding: 18px 20px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.15);">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="color: #991b1b; font-size: 16px; font-weight: 800; margin-bottom: 4px;">
              🚨 แจ้งเตือน: เครดิต OpenRouter ของคุณใกล้หมดหรือหมดแล้ว ($${credits.remainingCredits.toFixed(4)})
            </div>
            <div style="color: #b91c1c; font-size: 13px; line-height: 1.4;">
              ยอดเงินคงเหลือไม่เพียงพอต่อการสร้างภาพในรอบถัดไป กรุณากดปุ่มเพื่อเติมเครดิตบน OpenRouter
            </div>
          </td>
          <td align="right" valign="middle" style="padding-left: 16px;">
            <a href="https://openrouter.ai/credits" style="background-color: #dc2626; color: #ffffff; padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 700; text-decoration: none; display: inline-block; white-space: nowrap; box-shadow: 0 2px 4px rgba(220, 38, 38, 0.3);">
              เติมเครดิตทันที &rarr;
            </a>
          </td>
        </tr>
      </table>
    </div>`
        : ""
    }

    <!-- Market Research Card -->
    <div style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="display: inline-block; background-color: #dcfce7; color: #15803d; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; margin-bottom: 10px; text-transform: uppercase;">
        🎯 High-Demand Winning Niche
      </div>
      <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #0f172a;">${escapeHtml(trend.theme)}</h2>
      <p style="margin: 0 0 12px 0; color: #475569; font-size: 14px; line-height: 1.5;">${escapeHtml(trend.commercialReasoning)}</p>
      
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 10px;">
        <tr>
          <td><strong>Target Market:</strong> ${escapeHtml(trend.targetMarket)}</td>
          <td align="right"><strong>Seasonal Target:</strong> ${escapeHtml(trend.seasonalRelevance)}</td>
        </tr>
      </table>
    </div>

    <!-- Attached CSV Banner Notice -->
    <div style="background-color: #f0fdf4; border: 1.5px solid #22c55e; border-radius: 14px; padding: 16px 20px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(34, 197, 94, 0.1);">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="color: #15803d; font-size: 15px; font-weight: 800; margin-bottom: 4px;">
              📄 แนบไฟล์ CSV ข้อมูลภาพเรียบร้อยแล้ว: <span style="font-family: monospace; background-color: #dcfce7; padding: 2px 8px; border-radius: 6px;">${escapeHtml(csvFilename)}</span>
            </div>
            <div style="color: #166534; font-size: 13px; line-height: 1.4;">
              ประกอบด้วยคอลัมน์ <strong>Filename, Title, Keywords</strong> เท่านั้น สามารถนำไปใช้จับคู่ภาพหรือ Bulk Upload บน Adobe Stock Contributor ได้ทันที
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Generated Images Section -->
    <h3 style="font-size: 16px; font-weight: 700; color: #334155; margin: 0 0 16px 4px;">
      🎨 5 Curated Commercial Prompts &amp; Metadata
    </h3>

    ${imagesHtml}

    <!-- Footer -->
    <div style="text-align: center; color: #94a3b8; font-size: 12px; padding: 20px 0;">
      <p style="margin: 0 0 6px 0;">This email was generated automatically by your <strong>adobe_stock</strong> system on Vercel.</p>
      <p style="margin: 0;">Recipient: <strong>hs5ckt@gmail.com</strong> | Repository: github.com/diowcnx/adobe_stock</p>
    </div>

  </div>
</body>
</html>
  `;
}

function generateEmailPlainText(
  todayStr: string,
  trend: MarketTrend,
  images: StockImageItem[],
  credits: OpenRouterCreditInfo,
  csvFilename: string = "adobe_stock_metadata.csv"
): string {
  const appUrl = process.env.APP_URL || "https://adobe-stock-lovat.vercel.app";
  let text = `📸 Adobe Stock Daily Dispatch - ${todayStr}\n`;
  text += `🔗 Web Dashboard: ${appUrl}\n`;
  text += `OpenRouter Remaining Credit: $${credits.remainingCredits.toFixed(4)}\n`;
  text += `📄 Attached Metadata CSV: ${csvFilename} (Columns: Filename,Title,Keywords)\n\n`;
  text += `--- MARKET TREND ---\n`;
  text += `Theme: ${trend.theme}\n`;
  text += `Target Market: ${trend.targetMarket}\n`;
  text += `Commercial Reasoning: ${trend.commercialReasoning}\n`;
  text += `Seasonal Relevance: ${trend.seasonalRelevance}\n\n`;

  text += `--- 5 COMMERCIAL IMAGES & METADATA ---\n\n`;
  for (const img of images) {
    text += `[Image #${img.id}] (Ratio: ${img.aspectRatio}, Model: ${img.modelUsed})\n`;
    text += `📁 Filename: ${img.filename}\n`;
    text += `SEO Title: ${img.seoTitle}\n`;
    text += `Category: ${img.category}\n`;
    text += `Prompt: ${img.prompt}\n`;
    text += `Keywords: ${img.keywords.join(", ")}\n\n`;
  }

  return text;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * ส่งอีเมลแจ้งเตือนฉุกเฉินเมื่อเครดิต OpenRouter หมดหรือเหลือน้อยมาก
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
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const toEmail = recipientEmail || process.env.RECIPIENT_EMAIL || "hs5ckt@gmail.com";
  const fromEmail = senderEmail || process.env.SENDER_EMAIL || "stock-alerts@notify.diowcnx.com";
  const key = apiKey || process.env.SMTP2GO_API_KEY;

  const nowStr = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

  const html = `
  <!DOCTYPE html>
  <html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 2px solid #ef4444; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(239, 68, 68, 0.2);">
      <div style="background-color: #ef4444; color: #ffffff; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 800;">🚨 เครดิต OpenRouter ของคุณหมดแล้ว!</h1>
        <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">ระบบผลิตภาพขาย Adobe Stock อัตโนมัติหยุดชั่วคราว</p>
      </div>

      <div style="padding: 28px;">
        <div style="background-color: #fef2f2; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; border-left: 5px solid #dc2626;">
          <div style="font-size: 12px; color: #7f1d1d; text-transform: uppercase; font-weight: 700;">สถานะเครดิตปัจจุบัน</div>
          <div style="font-size: 28px; font-weight: 900; color: #dc2626; margin: 4px 0;">$${credits.remainingCredits.toFixed(4)}</div>
          <div style="font-size: 12px; color: #991b1b;">บันทึกเวลา: ${nowStr} (เวลาประเทศไทย)</div>
        </div>

        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          ระบบ <strong>adobe_stock</strong> ได้ทำการตรวจสอบยอดคงเหลือ และพบว่าเครดิตของคุณไม่เพียงพอสำหรับการสร้างภาพขายใน Adobe Stock
        </p>

        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          เมื่อคุณทำการเติมเครดิตเรียบร้อยแล้ว ระบบจะกลับมาทำงานตามรอบปกติเวลา 18:00 น. หรือคุณสามารถกดสั่งสร้างภาพรอบใหม่ได้ทันทีผ่านหน้า Dashboard
        </p>

        <div style="text-align: center; margin: 32px 0 16px 0;">
          <a href="https://openrouter.ai/credits" style="background-color: #dc2626; color: #ffffff; padding: 14px 28px; border-radius: 12px; font-size: 15px; font-weight: 800; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.35);">
            💳 เติมเงิน OpenRouter ทันที &rarr;
          </a>
        </div>
      </div>

      <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
        ส่งถึง: ${toEmail} &bull; ระบบอัตโนมัติ diowcnx/adobe_stock
      </div>
    </div>
  </body>
  </html>
  `;

  if (!key) {
    console.warn("SMTP2GO_API_KEY not configured. Simulated emergency credit alert.");
    return { success: true, messageId: `simulated-alert-${Date.now()}` };
  }

  try {
    const res = await fetch("https://api.smtp2go.com/v3/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        to: [toEmail],
        sender: fromEmail,
        subject: `🚨 [ด่วนที่สุด] เครดิต OpenRouter ของคุณหมดแล้ว ($${credits.remainingCredits.toFixed(4)}) - กรุณาเติมเครดิต`,
        html_body: html,
        text_body: `🚨 เครดิต OpenRouter ของคุณหมดแล้ว ($${credits.remainingCredits.toFixed(4)})\nกรุณาเติมเงินที่ https://openrouter.ai/credits เพื่อให้ระบบทำงานต่อ`,
      }),
    });
    const data: Smtp2goSendResponse = await res.json();
    return { success: res.ok && (data.data?.succeeded ?? 0) > 0 };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
