# 📸 Adobe Stock Automated AI Generator & Daily Dispatcher

ระบบวิจัยแนวโน้มตลาด Stock Photography ทั่วโลก, วิเคราะห์คีย์เวิร์ด, สร้าง 5 Prompts ที่แตกต่างกัน, สร้างภาพในอัตราส่วนสำหรับ Adobe Stock ผ่าน OpenRouter, ตรวจสอบยอดเครดิตคงเหลือ และจัดส่งอีเมลพร้อมไฟล์แนบและ SEO Metadata อัตโนมัติทุกวันเวลา 18:00 น. ผ่าน SMTP2GO

---

## 🚀 คุณสมบัติเด่น (Features)

1. **Market Research Engine**:
   - วิเคราะห์ปฏิทินเทศกาลล่วงหน้า 1-3 เดือน (ช่วงที่เอเจนซี่และนักการตลาดค้นหาภาพซื้อจริง)
   - ไม่จำกัดเฉพาะตลาด US แต่วิเคราะห์ครอบคลุมตลาดโลก (APAC, ยุโรป, ตะวันออกกลาง, อเมริกา)
   - เจาะ Niche เชิงพาณิชย์ที่มีความต้องการสูง เช่น Modern Agri-tech & ESG, AI & Smart Industry, Authentic Lifestyles, Senior Care, Sustainable Cuisine
2. **Adobe Stock Compliant Prompts & Metadata**:
   - สร้าง 5 Prompts ในมุมมองภาพและสัดส่วนที่แตกต่างกัน (16:9 Landscape Banner, 3:2 Commercial Wide, 4:5 Social/Portrait, 1:1 Flat Lay/Macro, 3:2 In-action)
   - มี **Copy Space** สำหรับใส่ข้อความโฆษณาตามความต้องการของผู้ซื้อ Stock
   - ไม่มีเครื่องหมายการค้า โลโก้ หรือองค์ประกอบละเมิดลิขสิทธิ์
   - ให้ **SEO Title** กระชับ ชัดเจน
   - ให้ **Keywords 40-50 คำ** เรียงลำดับคำค้นหาสำคัญ 10 คำแรกตามเกณฑ์ Adobe Stock
3. **OpenRouter Integration**:
   - เลือกใช้โมเดลสร้างภาพที่สมจริง คมชัด และคุ้มค่าที่สุด (เช่น ตระกูล FLUX.1)
   - ตรวจสอบยอดเครดิตคงเหลือ (Remaining Credits) ผ่าน OpenRouter API และแนบรายงานในอีเมลทุกวัน
4. **SMTP2GO Automated Delivery**:
   - ส่งอีเมลตรงถึง `hs5ckt@gmail.com`
   - จัดรูปแบบ HTML สวยงาม พร้อมกล่อง Copy SEO Title และ Keywords
   - แนบไฟล์ภาพทั้ง 5 ภาพความละเอียดสูง
5. **Daily Loop via Vercel Cron**:
   - ตั้งเวลาทำงานอัตโนมัติทุกวันเวลา 18:00 น. ตามเวลาไทย (`0 11 * * *` UTC)
   - มี Web Dashboard ให้กด "Run Today's Batch Now" เพื่อทดสอบและดูผลลัพธ์ได้ทันที

---

## 🛠️ Environment Variables

กำหนดใน **Vercel Project Settings > Environment Variables**:

| Variable Name | Description | Example / Source |
|---|---|---|
| `OPENROUTER_API_KEY` | OpenRouter API Key | `sk-or-v1-...` |
| `SMTP2GO_API_KEY` | SMTP2GO API Key | `api-...` |
| `SENDER_EMAIL` | Verified Sender Email ใน SMTP2GO | `alerts@yourdomain.com` |
| `RECIPIENT_EMAIL` | อีเมลปลายทาง | `hs5ckt@gmail.com` |
| `ADMIN_PASSWORD` | รหัสผ่าน Admin ไม่ต่ำกว่า 12 ตัวอักษร | `use-a-unique-long-password` |
| `SESSION_SECRET` | Secret สุ่มสำหรับลงลายเซ็น session ไม่ต่ำกว่า 32 ตัวอักษร และห้ามซ้ำกับรหัสผ่าน | `openssl-rand-base64-32-output` |
| `CRON_SECRET` | Secret สุ่มป้องกัน Cron Endpoint ไม่ต่ำกว่า 32 ตัวอักษร | `openssl-rand-base64-32-output` |
| `APP_URL` | URL หลักของแอปสำหรับลิงก์ในอีเมล | `https://your-app.vercel.app` |
| `REMOTE_IMAGE_ALLOWED_HOSTS` | Hostname HTTPS ของภาพภายนอกที่อนุญาต คั่นด้วย comma (ห้ามใช้ wildcard) | `images.example-cdn.com` |

---

## 💻 การทดสอบและรันในเครื่อง (Local Development)

```bash
# 1. ติดตั้ง Dependencies
npm install

# 2. คัดลอกและตั้งค่า Environment Variables
cp .env.example .env.local

# 3. รัน Development Server
npm run dev
```

เปิดบราวเซอร์ที่ [http://localhost:3000](http://localhost:3000)

---

## 📦 การ Deploy ไปยัง Vercel

1. นำเข้า Repository `diowcnx/adobe_stock` เข้าสู่ Vercel Project ชื่อ `adobe_stock`
2. ใส่ Environment Variables ในหน้า Project Settings
3. Vercel จะเริ่มจับการทำงานของ `vercel.json` และสั่งรัน Cron Job ทุกวันเวลา 18:00 น. (11:00 UTC) โดยอัตโนมัติ
