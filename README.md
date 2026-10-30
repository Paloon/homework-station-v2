# HomeWork Station

เว็บติดตามงานภาษาไทยตาม `DESIGN_PLAN.md` ใช้ Vite + TypeScript และ Supabase รองรับมือถือและ desktop

หน้าภาพรวมเลือกช่วงกำหนดส่งและกด “ดูรายชื่อ” เพื่อดูสถานะของนักเรียนที่งานยังไม่ครบ พร้อมคัดลอกรายชื่อได้ หน้างานของนักเรียนค้นหาชื่องานหรือรายละเอียดร่วมกับตัวกรองเดิมได้ ส่วนจัดการ → งาน รองรับค้นหา กรองวิชา/กำหนดส่ง และล้างตัวกรอง โดยไม่เปลี่ยนสูตรความคืบหน้าทั้งหมด

รูปแบบใช้งานล่าสุด (30 ต.ค. 2569): นักเรียนเพิ่ม/แก้ไขงาน วิชา รายชื่อ ห้องเรียน และตารางสอนร่วมกันได้โดยไม่ล็อกอินแยก ครูใช้หน้าภาพรวมติดตามสถานะที่นักเรียนรายงานเอง หน้างานมีปุ่มเพิ่มงาน/เพิ่มวิชา และแก้ไข/เก็บงานเข้าประวัติได้ทันที

ข้อสรุปรุ่นแรก (29 ต.ค. 2569): นักเรียนเลือกชื่อเหมือนระบบเดิม, ใช้หนึ่งห้อง, เริ่มข้อมูลใหม่, ยังไม่ส่งอีเมล ไม่มีการนำข้อมูลจากโฟลเดอร์ Old มาใช้โดยอัตโนมัติ

## Clone และเปิดในเครื่อง

Repository นี้เป็น Public ใช้ HTTPS clone ได้โดยไม่ต้องล็อกอิน GitHub หรือขอสิทธิ์ก่อน ต้องมี [Git](https://git-scm.com/downloads) และ [Node.js](https://nodejs.org/) พร้อม npm แนะนำ Node.js 24 LTS (มี `.nvmrc` ให้ผู้ใช้ nvm); รองรับ Node.js ตาม `engines` ใน `package.json`

### 1. ดาวน์โหลดและติดตั้ง

```sh
git clone https://github.com/Paloon/homework-station-v2.git
cd homework-station-v2
npm ci
npm run dev
```

เปิด URL ที่ Vite แสดงใน terminal (ปกติ `http://127.0.0.1:5173`) ถ้ายังไม่มี `.env` จะเปิดดูหน้าจอและสถานะว่างได้ แต่ยังบันทึกข้อมูลไม่ได้ ไม่มีข้อมูลนักเรียน งาน หรือบัญชีของห้องจริงติดมากับการ clone

หากใช้ nvm บน macOS/Linux ให้รัน `nvm install` และ `nvm use` ก่อน `npm ci` เพื่ออ่านเวอร์ชันจาก `.nvmrc` ไม่ต้องใช้ nvm หากติดตั้ง Node.js รุ่นที่รองรับไว้แล้ว

ไม่ใช้ Git ก็เลือก **Code → Download ZIP** บน GitHub แตกไฟล์ เปิด terminal ในโฟลเดอร์ที่มี `package.json` แล้วรัน `npm ci` และ `npm run dev` ได้

### 2. เชื่อมฐานข้อมูลของคุณ

สร้าง Supabase project ของคุณเองและทำตาม [คู่มือ Supabase](supabase/README.md) ตั้งแต่ migrations จนถึง environment ไม่มีรหัสผ่านหรือ key ของระบบจริงอยู่ใน repository

เมื่อยังไม่มี `.env` ให้คัดลอกแม่แบบ:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```sh
# macOS / Linux
cp .env.example .env
```

กรอก URL และ publishable key ของโปรเจกต์เดียวกันทั้งสี่ตัวใน `.env` ตามคำอธิบายในแม่แบบ จากนั้นหยุด dev server แล้วรัน `npm run dev` ใหม่ อย่าคัดลอกทับ `.env` ที่ตั้งค่าไว้แล้ว และไม่ commit ไฟล์นี้

### 3. Build และอัปเดตโค้ด

```sh
npm run build
npm run preview
```

Build อยู่ใน `dist/`; preview ใช้ดู frontend ส่วน `/api/health` ต้องใช้ dev server หรือ Vercel ตามหัวข้อด้านล่าง

เมื่อต้องการรับโค้ดใหม่ใน checkout ที่ไม่มีงานค้าง:

```sh
git pull --ff-only
npm ci
```

หากมี migration ใหม่ ต้อง apply ให้ฐานของคุณตามคู่มือ Supabase ด้วย การ pull Git ไม่ได้อัปเดตฐานข้อมูลให้อัตโนมัติ

## ตั้งค่า Supabase

ดู [คู่มือ Supabase](supabase/README.md) สำหรับโครงสร้างตาราง สิทธิ์/RLS วิธีตั้งค่า migration, RPC, Storage, Realtime และการตรวจสอบ โดยใช้ placeholder แทนข้อมูลส่วนตัวทั้งหมด

1. สร้างโปรเจกต์ Supabase **ใหม่สำหรับ development** และเก็บ production แยกกัน
2. ใช้ Supabase CLI ที่รองรับ `supabase --help` เพื่อเชื่อมโปรเจกต์ แล้ว apply ไฟล์ใน `supabase/migrations/` ตามลำดับ หรือเปิด SQL Editor แล้วรันแต่ละไฟล์ตามลำดับ ห้ามรันกับระบบเก่าที่มีข้อมูลโดยไม่ตรวจ schema
3. คัดลอก `.env.example` เป็น `.env` ตั้ง URL กับ **publishable key** ของโปรเจกต์เดียวกันทั้งสี่ค่า ห้ามใส่ `service_role`/secret key ในตัวแปร `VITE_`
4. เปิดเว็บ → จัดการ → ตั้งชื่อห้อง/ภาคเรียน → เพิ่มวิชาและนักเรียน → เพิ่มงาน หรือใช้ปุ่มเพิ่มงาน/เพิ่มวิชาในหน้างาน
5. ทดสอบสองเบราว์เซอร์กับ development project: เปลี่ยนสถานะ, เพิ่ม/แก้ไข/เก็บงาน, หลุดเครือข่ายแล้วต่อใหม่ และเปลี่ยนรูปตารางสอน

ข้อมูลห้องเรียนเป็นพื้นที่ร่วมกัน ผู้ที่เข้าถึงเว็บเพิ่ม/แก้ไข/เก็บข้อมูลเข้าประวัติได้ตามรูปแบบที่เจ้าของกำหนด การเลือกชื่อใช้เลือกความคืบหน้าที่ดูและบันทึก ไม่ใช่การยืนยันตัวบุคคล ไม่ต้องสร้างบัญชีผู้ดูแลเพื่อใช้เครื่องมือในเว็บ; บัญชีเดิมใน Supabase ยังอยู่แต่ไม่ใช้เป็นประตูเข้าจัดการห้อง

ไม่มีการ seed ห้อง รายชื่อ วิชา หรืองานเมื่อเปิดเว็บ ไม่มีอีเมล และไม่ใช้ localStorage แทนฐานข้อมูลร่วม การเก็บเข้าประวัติรักษาข้อมูลเดิมไว้ รายงาน CSV เลือกเฉพาะข้อมูลที่ใช้งานอยู่หรือรวมประวัติได้ โดยสูตรความครบใช้ขอบเขตที่เลือก ไม่มีปุ่มลบถาวรในรุ่นนี้

## กฎงาน

- ต้องส่ง (`submit`): ครบเมื่อส่งแล้ว (`submitted`)
- ต้องทำ (`do`): ครบเมื่อทำเสร็จแล้วหรือส่งแล้ว
- งานเสริม (`optional`): แสดงแยกและไม่นับลดเปอร์เซ็นต์หลัก
- วันครบกำหนดวันนี้ยังไม่เกินกำหนดจนกว่าจะขึ้นวันใหม่ใน `Asia/Bangkok`
- เปอร์เซ็นต์คำนวณจากงานทั้งห้องที่ active ไม่เปลี่ยนตาม filter
- RPC เปลี่ยนสถานะตรวจ version และไม่เขียนทับการเปลี่ยนจากอีกเครื่องเงียบ ๆ
- เพิ่มข้อมูลใช้ UUID เดิมเมื่อ retry; CSV import ใช้ batch ID เดิมและทำทั้งชุดใน transaction

## ตารางสอน

PNG, JPEG, WebP ไม่เกิน 6 MB มีตัวอย่างภาพก่อนอัปโหลด เก็บต้นฉบับใน public bucket `timetables` ด้วย path ใหม่เสมอ รูปเดิมยัง active จนกว่าจะอัปโหลดและ activate รูปใหม่สำเร็จ ประวัติรูปที่อัปโหลดไม่ครบยังอยู่ให้ตรวจและลองอัปโหลดเดิมอีกครั้ง ไม่ลบไฟล์อัตโนมัติ

Viewer ดูภาพเต็มสัดส่วน, พอดีหน้าจอ, ขนาดจริง, ซูม 50–300%, scroll, Escape และคืน focus การ fit ภาพใหญ่อาจต่ำกว่า 50% เพื่อให้เห็นทั้งรูป รองรับ browser zoom ตามปกติ รูปอย่างเดียวไม่ทดแทนข้อความรายคาบสำหรับ screen reader

## ตรวจงาน

```powershell
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

- Unit: สูตรสถานะ วันที่ CSV และ health timeout/error
- Integration: รัน SQL migrations จริงด้วย PGlite (Postgres WASM) ตรวจ constraints, RLS/สิทธิ์, RPC, version conflict, import atomic/retry และ active image **ไม่ได้ใช้ Supabase Cloud, PostgREST, Auth หรือ Storage service จริง**
- E2E: Chromium + fixture repository ที่ intercept ใน test runner เท่านั้น ไม่เขียนข้อมูลจริง; fixture adapter ถูกตัดออกจาก production build
- หากยังไม่มี Chromium ให้ `npx playwright install chromium`

## Vercel และ monitoring

ตั้ง project root เป็นโฟลเดอร์นี้, build `npm run build`, output `dist` ตั้ง environment จาก `.env.example` ให้ตรง environment นั้น แล้ว deploy ด้วย Git integration ใช้ Preview project/data แยกจาก production

`GET /api/health` และ `HEAD /api/health` ตรวจอ่าน `classrooms.id` ไม่เกินหนึ่งแถว ผลว่างคือ 200; config หาย/network/database error คือ 503; timeout 5 วินาทียกเลิก request จริง ผลตอบเป็น JSON และ `Cache-Control: no-store` ไม่มี SPA rewrite มาทับ route นี้ `npm run dev` รองรับ endpoint เดียวกันเพื่อทดสอบในเครื่อง แต่ `vite preview` เสิร์ฟเฉพาะ frontend ให้ตรวจ function บน Vercel Preview เพิ่ม

เว็บจริง: https://homework-station-v2.vercel.app/ — เชื่อม Supabase และเปิดให้จัดการข้อมูลร่วมกันโดยไม่ล็อกอินแยกแล้ว ใช้หน้างานหรือหน้าจัดการเพื่อเพิ่มวิชา งาน รายชื่อ และตารางสอน

ตั้ง UptimeRobot ตรวจหน้าเว็บและ `/api/health` แล้ว โดยใช้ HEAD ที่บัญชี Free รองรับ (ตรวจฐานข้อมูลเหมือน GET) ทุก 5 นาทีและ timeout 10 วินาที รายละเอียดหลักฐานและข้อที่ยังไม่ได้ทดสอบอยู่ใน `DEPLOYMENT.md`

## โครงสร้าง

- `src/domain/`: ชนิดข้อมูล สูตร วันที่ CSV
- `src/features/`: งาน ตารางสอน ภาพรวม และจัดการ
- `src/data/supabase.ts`: การอ่านครบชุด, CRUD, Storage, Realtime และ RPC
- `server/health.ts`, `api/health.ts`: health logic และ Vercel handler
- `supabase/migrations/`: schema/RPC/RLS และ Storage แยกไฟล์
- `tests/`: domain, SQL integration และ browser
- `IMPLEMENTATION.md`: สถานะงานและขอบเขตหลักฐาน

Font: IBM Plex Sans Thai Looped จาก Fontsource เสิร์ฟผ่าน build ภายในเว็บ เก็บ OFL license ใน `public/fonts/LICENSE.txt` ไอคอนใช้ Lucide ตาม license ใน `public/licenses/lucide.txt`

เอกสารอ้างอิง: [Vite](https://vite.dev/guide/), [Fontsource](https://fontsource.org/fonts/ibm-plex-sans-thai-looped/use), [Supabase JavaScript](https://supabase.com/docs/reference/javascript/initializing), [Storage uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads), [Realtime](https://supabase.com/docs/guides/realtime/postgres-changes)
