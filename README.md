# 📸 Adobe Stock Automated AI Generator & Daily Dispatcher

ระบบสร้างภาพพร้อม SEO metadata ผ่าน OpenRouter วันละ 10 แนวคิด โดยหมุนเวียน 7 หมวดตามวันเวลาไทย ใช้สัญญาณจากรายงานแนวโน้มสาธารณะเพื่อเป็นแนวคิดตั้งต้น (ไม่ใช่ข้อมูลยอดขาย Adobe Stock) พร้อมตรวจเครดิตและจัดส่งอีเมลผ่าน SMTP2GO ทุกวันเวลา 18:00 น.

---

## 🚀 คุณสมบัติเด่น (Features)

1. **Market Research Engine**:
   - วิเคราะห์ปฏิทินเทศกาลล่วงหน้า 1-3 เดือน (ช่วงที่เอเจนซี่และนักการตลาดค้นหาภาพซื้อจริง)
   - ไม่จำกัดเฉพาะตลาด US แต่วิเคราะห์ครอบคลุมตลาดโลก (APAC, ยุโรป, ตะวันออกกลาง, อเมริกา)
   - หมุนหมวด Wall art, Wedding stationery, Tactile branding, Playful learning, Local hospitality, Climate adaptation และ Accessible living รายวัน
   - รายงานแยกสัญญาณจากตลาด Etsy / Adobe Creative Trends ออกจากสมมติฐานที่ยังไม่ได้ตรวจสอบบน Adobe Stock
2. **Adobe Stock Compliant Prompts & Metadata**:
   - สร้าง 10 Prompts ที่มี subject, buyer use และรายละเอียดภาพต่างกัน แทนการสร้างหลาย crop จากแนวคิดซ้ำ
   - งาน Wall art สร้างตัว artwork เต็มภาพ ไม่บังคับ mockup หรือ copy space; หมวดโฆษณาจะมีพื้นที่วางข้อความเมื่อเหมาะกับโจทย์
   - ไม่มีเครื่องหมายการค้า โลโก้ หรือองค์ประกอบละเมิดลิขสิทธิ์
   - ให้ **SEO Title** กระชับ ชัดเจน
   - ให้ **Keywords 15-25 คำ** เรียงคำเฉพาะไว้ก่อนและตรวจความเกี่ยวข้อง
3. **OpenRouter Integration**:
   - ใช้ Gemini 3.1 Flash Lite Image สำหรับภาพ และ Gemini 2.5 Flash Lite สำหรับวางแผนแนวคิดหนึ่งครั้งต่อชุด
   - ไม่ส่งคำขอภาพซ้ำไปยังโมเดลราคาแพงขึ้นอัตโนมัติเมื่อเกิด timeout; ตรวจ OpenRouter Activity เพื่อดูยอดที่เรียกเก็บจริง
   - ตรวจสอบยอดเครดิตคงเหลือ (Remaining Credits) ผ่าน OpenRouter API และแนบรายงานในอีเมลทุกวัน
4. **SMTP2GO Automated Delivery**:
   - ส่งอีเมลตรงถึง `hs5ckt@gmail.com`
   - จัดรูปแบบ HTML สวยงาม พร้อมกล่อง Copy SEO Title และ Keywords
   - แนบ metadata CSV; ปุ่ม Dashboard ใช้ดาวน์โหลดภาพ ZIP หรือทีละภาพ
   - ไฟล์ชุด JPEG ใช้ส่วนขยาย `.jpeg`; ชุด PNG ใช้ `.png`
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
