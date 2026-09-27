import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const apiKey = process.env.SMTP2GO_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL || "fms@ptis.ac.th";
  const recipientEmail = process.env.RECIPIENT_EMAIL || "hs5ckt@gmail.com";

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      configured: false,
      error: "SMTP2GO_API_KEY is not defined in Vercel environment variables.",
      senderEmail,
      recipientEmail,
    });
  }

  try {
    const payload = {
      api_key: apiKey,
      to: [recipientEmail],
      sender: senderEmail,
      subject: "🧪 Test Email from Adobe Stock AI Producer",
      text_body: `This is a test email sent from Adobe Stock AI Producer to verify SMTP2GO configuration.\n\nSender: ${senderEmail}\nRecipient: ${recipientEmail}\nTimestamp: ${new Date().toISOString()}`,
      html_body: `<div style="font-family: sans-serif; padding: 20px; background-color: #f8fafc;">
        <h2 style="color: #0f172a;">🧪 SMTP2GO Delivery Test</h2>
        <p>This is a verification email from your <strong>Adobe Stock AI Producer</strong> system on Vercel.</p>
        <ul>
          <li><strong>Sender:</strong> ${senderEmail}</li>
          <li><strong>Recipient:</strong> ${recipientEmail}</li>
          <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
        </ul>
        <p style="color: #16a34a; font-weight: bold;">If you are reading this, SMTP2GO delivery is working 100% correctly!</p>
      </div>`,
    };

    const res = await fetch("https://api.smtp2go.com/v3/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();

    return NextResponse.json({
      success: res.ok && data?.data?.succeeded > 0,
      httpStatus: res.status,
      smtpResponse: data,
      senderEmail,
      recipientEmail,
      keyPrefix: apiKey.slice(0, 8) + "...",
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || String(error),
      senderEmail,
      recipientEmail,
    }, { status: 500 });
  }
}
