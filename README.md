# HomeWork Station

เว็บติดตามงานภาษาไทยตาม `DESIGN_PLAN.md` ใช้ Vite + TypeScript และ Supabase รองรับมือถือและ desktop

ข้อสรุปรุ่นแรก (29 ต.ค. 2569): นักเรียนเลือกชื่อเหมือนระบบเดิม, ใช้หนึ่งห้อง, เริ่มข้อมูลใหม่, ยังไม่ส่งอีเมล ไม่มีการนำข้อมูลจากโฟลเดอร์ Old มาใช้โดยอัตโนมัติ

## เปิดในเครื่อง

ใช้ Node.js 24 LTS (แนะนำ) หรือ 22.12+ ที่ dependency รองรับ

```powershell
npm ci
npm run dev
```

เปิด URL ที่ Vite แสดง ถ้ายังไม่มี `.env` เว็บจะเปิดทุกหน้าได้พร้อมสถานะยังไม่เชื่อมข้อมูล ไม่มีการสร้างรายชื่อหรืองานสมมุติ ปุ่มบันทึกข้อมูลจริงใช้ได้หลังตั้งค่า Supabase

## ตั้งค่า Supabase

1. สร้างโปรเจกต์ Supabase **ใหม่สำหรับ development** และเก็บ production แยกกัน
2. ใช้ Supabase CLI ที่รองรับ `supabase --help` เพื่อเชื่อมโปรเจกต์ แล้ว apply ไฟล์ใน `supabase/migrations/` ตามลำดับ หรือเปิด SQL Editor แล้วรันแต่ละไฟล์ตามลำดับ ห้ามรันกับระบบเก่าที่มีข้อมูลโดยไม่ตรวจ schema
3. คัดลอก `.env.example` เป็น `.env` ตั้ง URL กับ **publishable key** ของโปรเจกต์เดียวกันทั้งสี่ค่า ห้ามใส่ `service_role`/secret key ในตัวแปร `VITE_`
4. สร้างผู้ใช้สำหรับผู้ดูแลผ่าน Supabase Dashboard → Authentication → Users (ไม่เปิดสมัครสมาชิกในเว็บ) แล้วเพิ่ม UUID ของผู้ใช้นั้นใน SQL Editor:

```sql
insert into private.admin_members(user_id)
values ('UUID-ของผู้ดูแลจาก-Authentication-Users');
```

5. เปิดเว็บใหม่ → จัดการ → เข้าสู่ระบบผู้ดูแล → ตั้งชื่อห้อง/ภาคเรียน → เพิ่มวิชาและนักเรียน → เพิ่มงาน
6. ทดสอบสองเบราว์เซอร์กับ development project: เปลี่ยนสถานะ, เพิ่ม/เก็บงาน, หลุดเครือข่ายแล้วต่อใหม่ และเปลี่ยนรูปตารางสอน

ข้อมูลห้องเรียนเปิดอ่านตามรูปแบบเลือกชื่อที่กำหนดไว้ นักเรียนเลือกชื่อใดก็เปลี่ยนสถานะของชื่อนั้นได้ การเลือกชื่อไม่ได้ยืนยันตัวบุคคล ส่วนการเพิ่ม/แก้/เก็บข้อมูลห้องเรียนใช้บัญชีที่อยู่ใน `private.admin_members` เท่านั้น

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

เว็บจริง: https://homework-station-v2.vercel.app/ — เชื่อม Supabase และให้สิทธิ์บัญชีผู้ดูแลที่ผู้ใช้สร้างแล้ว เข้าหน้าจัดการด้วยอีเมลและรหัสผ่านที่ตั้ง จากนั้นเริ่มตั้งชื่อห้อง/ภาคเรียน เพิ่มรายชื่อ วิชา และงานได้

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
