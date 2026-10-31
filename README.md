# Adobe Stock AI Generator

สร้างภาพ JPEG สำหรับส่ง Adobe Stock ครั้งละ 10 ภาพ พร้อมไฟล์ `metadata.csv` ผ่าน OpenRouter โดยสั่งจาก command line หรือสั่ง AI agent ไม่มีเว็บหรือ Dashboard

## ตั้งเครื่องใหม่

```bash
git clone https://github.com/diowcnx/adobe_stock.git
cd adobe_stock
npm install
cp .env.example .env.local
```

จากนั้นเปิดไฟล์ `.env.local` แล้วใส่ OpenRouter API key ของคุณ ไฟล์นี้ไม่ขึ้น git

## คำสั่ง

```bash
npm run generate -- credits
```

```bash
npm run generate -- sold ~/Downloads/sale.jpg --plan
```

```bash
npm run generate -- resume "<โฟลเดอร์ที่ขึ้นมา>"
```

| คำสั่ง | ทำอะไร |
|---|---|
| `sold <ไฟล์ภาพ>` | **ต่อยอด:** 10 ภาพใหม่จากภาพที่ขายได้ |
| `research` | **รีเสิร์ช:** สร้างจากไฟล์ `research/manual-prompts-*.md` ล่าสุด |
| `structure` | **โครงสร้าง:** สร้างจากคลัง 9 Structure รวม 10 ภาพ |
| `resume <โฟลเดอร์>` | สร้างเฉพาะภาพที่ยังขาด |
| `credits` | ดูเครดิต OpenRouter |

ใส่ `--plan` เพื่อดูแผนก่อน โดยยังไม่สร้างภาพ

ภาพจะอยู่ที่ `~/Downloads/adobe/` ในเครื่องที่สร้างเท่านั้น ไม่ขึ้น git เพราะ repo นี้เป็น public

ขั้นตอนสำหรับ AI agent อยู่ใน [AGENTS.md](AGENTS.md)
