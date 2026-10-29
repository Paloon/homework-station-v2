# สถานะการพัฒนา HomeWork Station

เริ่ม 29 ตุลาคม 2569 ตามคำสั่งให้เริ่มทำ `DESIGN_PLAN.md`

## ข้อสรุปที่ผู้ใช้ยืนยันในรอบพัฒนา

- นักเรียนเลือกชื่อเหมือนเดิม ใช้ห้องเดียว เริ่มข้อมูลใหม่ ไม่ย้ายข้อมูลจาก Old
- ยังไม่ทำอีเมล เน้นติดตามงานก่อน
- เริ่มจาก local แล้วผู้ใช้อนุญาตให้สร้างและเชื่อม Supabase/Git remote/Vercel/UptimeRobot ต่อในวันที่ 29 ต.ค. 2569 สถานะบริการล่าสุดอยู่ใน `DEPLOYMENT.md`

## ขอบเขตที่พัฒนาและตรวจแล้วในเครื่อง

- [x] A: บันทึกคำตอบข้างต้นก่อนสร้าง schema
- [x] B: Vite + TypeScript, ฟอนต์ภายในเว็บ, navigation ทุกหน้า, responsive และ empty/error states
- [x] C local: สูตรความครบ วันที่ไทย CSV, schema/FK/index/RLS/RPC และ apply migration ฐานว่างด้วย PGlite
- [x] D local: Supabase repository + CRUD/admin forms + status version conflict + Realtime subscription/reconnect refetch (service จริงยังไม่ตรวจ)
- [x] E local: empty/error states, image viewer, preview/upload/activate/history adapter (Storage จริงยังไม่ตรวจ)
- [x] F local: CSV preview/validation/import transaction, รายงานทั้งห้องเลือก active/รวมประวัติ และสรุปสัปดาห์
- [x] I local: health endpoint ตรวจ read query จริงเมื่อมี config; ทดสอบ timeout/error/no-config และไม่ cache
- [x] typecheck, unit, SQL integration, browser และ production build

## หลักฐานรอบสุดท้าย

ทดสอบบน Node.js 24.22.1 ที่มากับ runtime ของ Codex วันที่ 29 ต.ค. 2569

| การตรวจ | ผลและขอบเขต |
|---|---|
| TypeScript | ผ่าน `tsc --noEmit` รวม browser, server และ tests |
| Unit | ผ่าน 23 tests: วันไทย/ข้ามเดือนปี/สัปดาห์, สูตร, CSV/รายงาน, health, SDK HTTP mapping/pagination |
| SQL integration | ผ่าน 8 tests บน Postgres WASM (PGlite); apply migrations สองไฟล์จริง, constraints/RLS/RPC/import retry และรูป active |
| Chromium E2E | ผ่าน 19 tests; ทุกหน้าที่ 320×568, 390×844, 844×390, 768×1024, 1024×768, 1440×900; ไม่มี overflow แนวนอน |
| พฤติกรรม UI | ชิ้นสุดท้าย/งานเสริม, ค้นหาเลขที่, retry คงฟอร์ม/UUID, conflict, duplicate submit, CSV preview, viewer/Escape, clipboard fallback, DOM/focus และ text 200% |
| ภาพจริง | เปิดดู screenshots ของ desktop/mobile/empty/manage และ text 200%; แก้แถบ progress ที่สูงผิดจริงและขนาดชื่อแล้ว |
| Build | Vite production build ผ่าน; fixture adapter แยกจาก production |

ไฟล์ภาพตรวจอยู่ใน `artifacts/` ภาพที่แสดงงาน/รายชื่อเป็น fixture ที่มีป้ายข้อมูลทดสอบ ไม่ใช่ข้อมูลห้องเรียนจริง

## งานต่อเมื่อสร้างบริการ

- [x] สร้าง Supabase project ใหม่, apply migrations, เพิ่มบัญชีผู้ดูแล และตั้ง `.env` ตาม README (ฐาน production; automated tests ใช้ fixture แยก)
- [ ] ตรวจ PostgREST/Auth/RLS/Realtime/Storage บน Supabase จริง โดยเปิดสอง browser และทดสอบหลุดแล้ว reconnect
- [ ] ตรวจการอัปโหลด/activate ล้มเหลว/สลับรูปพร้อมกันกับ Storage จริง; รูปจริงยังรอผู้ใช้ตามแผน
- [ ] ตรวจ browser zoom และอุปกรณ์จริงเพิ่มเติม (ที่ทดสอบ text 200% เป็นการขยายฟอนต์ของ document)
- [x] ตั้ง Git Repo ใหม่และ verify remote หลัง push, deploy Vercel production และตรวจ function/URL จริง; Preview ไม่ตั้งค่าให้เข้าถึงฐาน production
- [ ] ตั้ง UptimeRobot และผู้รับแจ้ง failure/recovery แล้วทำ drill ใน environment ทดสอบ
- [ ] ผู้ใช้ตรวจ flow และทดสอบสำรอง/คืนข้อมูลก่อนเปิดใช้จริง

Migration จาก Firebase และ notification worker ไม่อยู่ในรุ่นนี้ตามคำตอบผู้ใช้ ไม่ถือว่า local tests ผ่านแล้วเท่ากับพร้อมเปิด production

ไม่มีการสร้างข้อมูลรายชื่อ/งาน/ตารางสอนสมมุติในเว็บปกติ และไม่แก้ต้นฉบับใน Old Git HomeWork

ข้อมูล fixture ใช้เฉพาะ test mode ที่ระบุชัดว่าเป็นข้อมูลทดสอบ ไม่ใช่ข้อมูลห้องเรียนจริง ไม่มีการใช้ localStorage แทนฐานข้อมูลร่วม

## ลำดับไฟล์และการตรวจ

1. `src/domain/{types,dates,progress,csv}.ts` และ `tests/unit/`: กฎกลางก่อน UI
2. `src/{main,app}.ts`, `src/features/`, `src/styles/`: shell และหน้าจอที่อ่านกฎกลาง
3. `src/data/`: read/write boundary ที่แสดงสถานะยังไม่เชื่อมระบบจริงตามข้อเท็จจริง
4. `server/health.ts`, `api/health.ts`: dependency check พร้อม cancellation และ tests
5. `tests/e2e/`: navigation, keyboard, filters/status, viewer, loading/error, responsive

ทิศทางภาพใช้สมุดงานประจำห้องตามแผน: พื้น #F6F8FB, ข้อความ #17233B, สีหลัก #2456C7, IBM Plex Sans Thai Looped, เนื้อหาชิดซ้าย รายชื่อด้านซ้ายบน desktop และเมนูล่างสี่รายการบนมือถือ เน้นรายการงานและวันส่ง ไม่ใช้ตัวเลขสถิติใหญ่แทนเนื้อหาหลัก
