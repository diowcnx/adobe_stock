import { getOpenRouterCredits } from "./openrouter";
import { conductMarketResearchAndGeneratePrompts } from "./market-research";
import { generateAllStockImages } from "./image-generator";
import { sendDailyStockEmail, sendCreditDepletedEmergencyAlert } from "./smtp2go";
import { WorkflowResult } from "./types";

export async function executeDailyStockWorkflow(): Promise<WorkflowResult> {
  const startTime = Date.now();
  console.log("Starting Adobe Stock daily generation workflow...");

  // 1. ดึงเครดิต OpenRouter
  const initialCredits = await getOpenRouterCredits();
  console.log(`Initial OpenRouter Credits: $${initialCredits.remainingCredits.toFixed(4)}`);

  // 2. ทำการวิจัยตลาดและสร้าง 5 Prompts พร้อม SEO Metadata
  console.log("Conducting market research & crafting commercial prompts...");
  const { trend, items } = await conductMarketResearchAndGeneratePrompts();

  // 3. สร้างภาพทั้ง 5 ภาพ
  console.log("Generating 5 commercial images...");
  const generatedImages = await generateAllStockImages(items);

  // 4. ตรวจสอบเครดิตหลังสร้างภาพ
  const latestCredits = await getOpenRouterCredits();

  // ตรวจสอบว่าเครดิตหมดหรือไม่ (เหลือน้อยกว่า $0.01)
  const isCreditDepleted = latestCredits.remainingCredits <= 0.01 && Boolean(process.env.OPENROUTER_API_KEY);
  if (isCreditDepleted) {
    console.warn(`[ALERT] OpenRouter credit is depleted: $${latestCredits.remainingCredits.toFixed(4)}. Sending emergency alert...`);
    await sendCreditDepletedEmergencyAlert({ credits: latestCredits });
  }

  // 5. ส่งอีเมลประจำวันพร้อมข้อมูลและไฟล์แนบผ่าน SMTP2GO
  console.log("Dispatching email via SMTP2GO to hs5ckt@gmail.com...");
  const emailResult = await sendDailyStockEmail({
    trend,
    images: generatedImages,
    credits: latestCredits,
  });

  const durationMs = Date.now() - startTime;
  console.log(`Workflow completed in ${durationMs}ms with email success: ${emailResult.success}`);

  return {
    success: emailResult.success,
    timestamp: new Date().toISOString(),
    trend,
    images: generatedImages,
    credits: latestCredits,
    emailDelivery: {
      success: emailResult.success,
      recipient: process.env.RECIPIENT_EMAIL || "hs5ckt@gmail.com",
      messageId: emailResult.messageId,
      error: emailResult.error,
    },
    durationMs,
  };
}
