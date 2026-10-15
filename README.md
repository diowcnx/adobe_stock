# 📸 Adobe Stock Automated AI Generator & Daily Dispatcher

ระบบสร้างภาพพร้อม SEO metadata ผ่าน OpenRouter วันละ 10 แนวคิด โดยทุกภาพใช้ Buyer-Context Editorial Still Life 18 ช่อง เริ่มจากกลุ่มผู้ซื้อและการใช้งานจริง แล้วเลือกวัสดุ ฤดูกาล สี และรายละเอียดท้องถิ่นให้เหมาะกับตลาดปลายทางแทนการผูกทุกภาพกับประเทศไทย ใช้ธีมผู้ซื้อรายวันและสัญญาณสาธารณะเป็นบริบท (ไม่ใช่ข้อมูลยอดขายรวมที่ยืนยันแล้ว) พร้อมตรวจเครดิตและจัดส่งอีเมลผ่าน SMTP2GO ทุกวันเวลา 18:00 น.

---

## 🚀 คุณสมบัติเด่น (Features)

1. **Market Research Engine**:
   - ใช้แผน 31 ธีมผู้ซื้อเป็นบริบท แล้วสร้าง Buyer-Context Editorial Still Life ที่ต่างกัน 10 แนวคิดต่อชุด
   - กระจายแนวทางเป็นทั้งภาพสากลที่ใช้งานได้กว้างและภาพที่มีบริบทตลาดปลายทางอย่างถูกต้อง โดยให้แต่ละชุดครอบคลุมหลายภูมิภาคเมื่อหมวดนั้นเหมาะสม
   - เก็บ `USER_INPUT` ครบ 18 ช่อง ตั้งแต่ `CAMPAIGN_THEME`, กล้อง แสง ฉาก วัสดุ และองค์ประกอบ ไปจนถึง `TEXT_ELEMENTS` เพื่อให้ตรวจสอบ Prompt ได้
   - เก็บ Commercial Intent แยกจาก Structure ทุกภาพ ได้แก่ กลุ่มผู้ซื้อเป้าหมาย งานที่นำไปใช้จริง และเหตุผลจากคุณค่าที่มองเห็นได้ว่าทำไมควรซื้อภาพนี้แทนภาพทั่วไป
   - ออกแบบเป็น Structure Registry เพื่อเพิ่ม Structure รูปแบบใหม่ภายหลังได้โดยยังรักษาชนิดข้อมูลของชุดเดิม
   - สำรวจโปรไฟล์สาธารณะ 50 โปรไฟล์เพื่อหา buyer-use patterns โดยไม่เลียนแบบผู้สร้าง
   - แยกอันดับภายในโปรไฟล์และสัญญาณจาก Pinterest/Etsy/Adobe Creative Trends ออกจากยอดขาย Adobe Stock ที่ยังไม่มีข้อมูลยืนยัน
2. **Adobe Stock Compliant Prompts & Metadata**:
   - สร้าง 10 Prompts ที่มี subject, buyer use และรายละเอียดภาพต่างกัน แทนการสร้างหลาย crop จากแนวคิดซ้ำ
   - เน้น Editorial Still Life แบบงานถ่ายภาพสตูดิโอ วัสดุสมจริง การจัดองค์ประกอบเชิงแนวคิด และพื้นที่สำหรับใส่ข้อความภายหลัง โดยไม่เติมธง ชุดประจำชาติ หรือสัญลักษณ์เหมารวมเพื่อบอกสถานที่
   - `TEXT_ELEMENTS` ใช้กำหนดพื้นที่เลย์เอาต์ แต่ระบบห้ามสร้างตัวอักษร โลโก้ หรือตัวหนังสือจำลองลงในภาพ
   - บังคับภาพเต็มขอบ โดย Copy Space ต้องเป็นพื้นที่ธรรมชาติภายในฉาก ไม่ใช่กรอบขาว หัวโปสเตอร์ ท้ายโปสเตอร์ หรือแผงข้อความ
   - ตรวจภาพหลังสร้างด้วย Pixel Guard และ Vision Guard; เมื่อพบตัวอักษร กรอบ พาสพาร์ตู หรือเลย์เอาต์แบบโปสเตอร์ ระบบจะนำเหตุผลทั้งหมดไปแก้ Prompt เปลี่ยนมุมกล้อง/การจัดวาง แล้วสร้างภาพทดแทนได้สูงสุด 3 ครั้ง
   - หากภาพล่าสุดยังไม่ผ่านหลังสร้างทดแทนครบ 3 ครั้ง ระบบจะส่งภาพให้ครบชุดพร้อมคำเตือนและเหตุผลการปฏิเสธทุกครั้งทั้งบน Dashboard และในอีเมล
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
   - ชุด Structured Editorial Still Life ใช้ชื่อไฟล์ `.jpeg` ในภาพและ CSV อย่างสอดคล้องกัน
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
| `ENABLE_STRUCTURED_CONCEPTS` | เปิด Structured Editorial Still Life ทั้ง 10 ภาพตามค่าเริ่มต้น; ตั้ง `false` เพื่อ rollback เป็น planner เดิม | `true` |

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

รัน regression tests โดยไม่เรียกสร้างภาพจริง:

```bash
npm test
```

การทดสอบครอบคลุม planner แบบ mock, ช่องข้อมูลครบ 18 รายการ, curated fallback, ธีมครบทั้ง 31 วัน, CSV, rollback switch และวงจรสร้างภาพทดแทนเมื่อ QA ปฏิเสธ โดยไม่ใช้เครดิตสร้างภาพจริง

---

## 📦 การ Deploy ไปยัง Vercel

1. นำเข้า Repository `diowcnx/adobe_stock` เข้าสู่ Vercel Project ชื่อ `adobe_stock`
2. ใส่ Environment Variables ในหน้า Project Settings
3. ใน Project ไปที่ **Storage → Create Database → Blob** แล้วสร้าง Blob Store แบบ **Private** และเชื่อมต่อกับโปรเจกต์นี้ Vercel จะผูก `BLOB_STORE_ID` และการยืนยันตัวตน OIDC ให้กับ Functions โดยไม่ต้องใส่ Blob token ลงในโค้ด
4. ตรวจสอบให้ Blob Store ใช้ Environment เดียวกับ Production แล้ว Redeploy โปรเจกต์
5. Vercel จะเริ่มจับการทำงานของ `vercel.json` และสั่งรัน Cron Job ทุกวันเวลา 18:00 น. (11:00 UTC) โดยอัตโนมัติ

ภาพและ Metadata จะถูกเก็บใน Private Blob แยกตามชุดที่สร้าง หน้าเว็บที่ล็อกอินแล้วจึงสามารถเปิดดูและดาวน์โหลดได้ข้าม Vercel Functions; หลังดาวน์โหลดครบ ระบบจะถามก่อนลบเฉพาะชุดนั้นออกจาก Storage
