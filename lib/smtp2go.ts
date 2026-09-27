import { MarketTrend, OpenRouterCreditInfo, StockImageItem } from "./types";

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

  const htmlBody = generateEmailHtml(todayStr, trend, images, credits);
  const textBody = generateEmailPlainText(todayStr, trend, images, credits);

  // เตรียม attachments
  const attachments = images
    .filter((img) => img.imageBase64)
    .map((img) => {
      const isSvg = img.imageUrl?.includes("svg") || false;
      return {
        filename: `adobe_stock_${img.id}_${img.aspectRatio.replace(":", "x")}.${isSvg ? "svg" : "jpg"}`,
        fileblob: img.imageBase64!,
        mimetype: isSvg ? "image/svg+xml" : "image/jpeg",
      };
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
    const payload = {
      api_key: key,
      to: [toEmail],
      sender: fromEmail,
      subject: `📸 [Adobe Stock Daily] 5 New Commercial Images & SEO Keywords - ${todayStr}`,
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
  credits: OpenRouterCreditInfo
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
              🏷️ 40-50 Keywords (Ready to Copy into Adobe Stock Contributor)
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

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Adobe Stock Daily Dispatch</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
  <div style="max-width: 680px; margin: 0 auto;">
    
    <!-- Header Banner -->
    <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: #ffffff; padding: 28px 24px; border-radius: 16px; margin-bottom: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">📸 Adobe Stock Daily Dispatch</h1>
            <p style="margin: 0; color: #cbd5e1; font-size: 13px;">${todayStr} | Automated AI Stock Production</p>
          </td>
          <td align="right" valign="top">
            <div style="background-color: rgba(255, 255, 255, 0.15); backdrop-filter: blur(8px); border-radius: 12px; padding: 10px 14px; text-align: center; border: 1px solid rgba(255,255,255,0.2);">
              <div style="font-size: 10px; text-transform: uppercase; color: #a5b4fc; font-weight: 700;">OpenRouter Credit</div>
              <div style="font-size: 18px; font-weight: 800; color: #38bdf8;">$${credits.remainingCredits.toFixed(4)}</div>
            </div>
          </td>
        </tr>
      </table>
    </div>

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
  credits: OpenRouterCreditInfo
): string {
  let text = `📸 Adobe Stock Daily Dispatch - ${todayStr}\n`;
  text += `OpenRouter Remaining Credit: $${credits.remainingCredits.toFixed(4)}\n\n`;
  text += `--- MARKET TREND ---\n`;
  text += `Theme: ${trend.theme}\n`;
  text += `Target Market: ${trend.targetMarket}\n`;
  text += `Commercial Reasoning: ${trend.commercialReasoning}\n`;
  text += `Seasonal Relevance: ${trend.seasonalRelevance}\n\n`;

  text += `--- 5 COMMERCIAL IMAGES & METADATA ---\n\n`;
  for (const img of images) {
    text += `[Image #${img.id}] (Ratio: ${img.aspectRatio}, Model: ${img.modelUsed})\n`;
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
