# คู่มือ Supabase ของ HomeWork Station

คู่มือนี้อธิบายโครงสร้าง วิธีตั้งค่า และวิธีพัฒนาต่อ โดยใช้ placeholder ทั้งหมด ไม่มีอีเมล รหัสผ่าน project ref หรือ API key ของระบบจริง

## รูปแบบการใช้งาน

- ใช้ห้องเรียนเดียว นักเรียนเลือกชื่อเพื่อดูและบันทึกความคืบหน้า
- ทุกคนที่เข้าถึงเว็บจัดการงาน วิชา รายชื่อ ห้องเรียน และตารางสอนร่วมกันได้ ไม่ต้องล็อกอินแยก
- ครูเปิดภาพรวมและดูรายชื่อคนที่งานยังไม่ครบได้ สถานะเป็นข้อมูลที่นักเรียนรายงานเอง
- การเลือกชื่อไม่ได้ยืนยันตัวบุคคล ระบบนี้ไม่มีสิทธิ์แบบ “เฉพาะเจ้าของรายการแก้ไขได้”
- เก็บรายการเข้าประวัติด้วย `archived_at` แทนการลบถาวร

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
|---|---|
| [20261029130838_initial_classroom.sql](migrations/20261029130838_initial_classroom.sql) | ตาราง ความสัมพันธ์ constraints สูตรเปลี่ยนสถานะ import และ Realtime |
| [20261029131036_timetable_storage.sql](migrations/20261029131036_timetable_storage.sql) | Bucket ตารางสอน นโยบายอัปโหลด และการตรวจภาพพร้อมใช้ |
| [20261030042654_collaborative_classroom.sql](migrations/20261030042654_collaborative_classroom.sql) | เปลี่ยนสิทธิ์เดิมที่จำกัดผู้ดูแลเป็นการจัดการร่วมกันโดยไม่ล็อกอิน |
| [src/data/supabase.ts](../src/data/supabase.ts) | การอ่าน/เขียนจริงผ่าน Supabase JavaScript, RPC, Storage และ Realtime |
| [src/data/repository.ts](../src/data/repository.ts) | สัญญาที่หน้าจอใช้เรียกชั้นข้อมูล |
| [.env.example](../.env.example) | รายชื่อตัวแปรเชื่อมต่อ ไม่มีค่าจริง |
| [tests/integration/database.test.ts](../tests/integration/database.test.ts) | ตรวจ migrations และสิทธิ์ด้วย Postgres WASM (PGlite) |

ต้องใช้ migrations ครบทั้งสามไฟล์ตามลำดับ สองไฟล์แรกเป็นประวัติการออกแบบเดิม ส่วนไฟล์ที่สามปรับสิทธิ์เป็นรูปแบบปัจจุบัน ไม่ต้องเพิ่มสมาชิกผู้ดูแลเพื่อใช้งานเว็บ

## ตั้งค่าโปรเจกต์ใหม่

1. สร้าง Supabase project และเปิด Data API แยก development ออกจาก production
2. รันคำสั่งจากโฟลเดอร์ที่มี `package.json` ของแอป ตรวจรูปแบบคำสั่งก่อนใช้ เพราะ CLI เปลี่ยนได้:

```powershell
npx supabase --version
npx supabase --help
npx supabase init --help
npx supabase link --help
npx supabase db push --help
```

3. ถ้ายังไม่มี `supabase/config.toml` ให้รัน `npx supabase init` หนึ่งครั้ง แล้วเชื่อมโปรเจกต์เป้าหมาย:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase migration list --linked
npx supabase db push --linked --skip-vault --dry-run
```

แทน `YOUR_PROJECT_REF` ด้วยค่าของโปรเจกต์ที่จะใช้ ตรวจว่าเป็น development หรือ production ที่ตั้งใจไว้ ใส่ข้อมูลรับรองผ่าน prompt หรือเครื่องมือเก็บข้อมูลรับรอง ไม่เขียนรหัสผ่าน/token ในไฟล์หรือคำสั่งตัวอย่างที่ commit

4. เมื่อตรวจรายการ migration แล้วจึง apply และตรวจประวัติ:

```powershell
npx supabase db push --linked --skip-vault
npx supabase migration list --linked
```

`--skip-vault` ใช้เพราะโปรเจกต์นี้ไม่ได้กำหนดให้ CLI เปลี่ยน Vault secrets ในขั้นตอน deploy ฐานข้อมูล

อีกทางหนึ่งคือเปิด SQL Editor แล้วรันไฟล์ migration ตามลำดับทีละไฟล์บนฐานใหม่ แต่ SQL Editor ไม่ได้ลงประวัติ CLI migrations ให้อัตโนมัติ หากภายหลังจะเปลี่ยนมาใช้ CLI ต้องเทียบประวัติและปรับให้ตรงก่อน อย่ารัน migration เดิมซ้ำบนตารางที่สร้างแล้ว

5. สร้าง `.env` จากแม่แบบเฉพาะเมื่อยังไม่มีไฟล์:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

กรอกทั้งสี่ค่าจากโปรเจกต์เดียวกัน ตัวอย่างด้านล่างเป็น placeholder:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

สองค่า `VITE_` ใช้ใน browser อีกสองค่าใช้กับ health endpoint ฝั่ง server ไม่ต้องใช้ `service_role` หรือ secret key ในแอปนี้ โดยเฉพาะตัวแปร `VITE_` จะถูกส่งไปกับ frontend build

6. เปิดเว็บ ตั้งชื่อห้อง เพิ่มวิชา/รายชื่อ แล้วเพิ่มงาน ไม่มีการสร้างข้อมูลเริ่มต้นอัตโนมัติ
7. ถ้า deploy Vercel ให้ตั้งตัวแปรเดียวกันใน environment ของ deployment แล้ว build ใหม่ Preview ต้องใช้ฐานทดสอบแยกจาก production

## โครงสร้างข้อมูล

| ตาราง | ข้อมูลและกฎหลัก |
|---|---|
| `public.classrooms` | ชื่อห้องและภาคเรียน; `singleton` จำกัดหนึ่งห้อง |
| `public.students` | เลขที่ ชื่อ รหัสประจำตัว; เลขที่/รหัสที่ใช้งานอยู่ต้องไม่ซ้ำในห้อง |
| `public.subjects` | ชื่อวิชา; ชื่อที่ใช้งานอยู่ต้องไม่ซ้ำในห้อง |
| `public.assignments` | วิชา ชื่องาน ประเภท วันที่มอบหมาย วันส่ง รายละเอียด ลิงก์แนบ; วันมอบหมายต้องไม่เกินวันส่ง |
| `public.submissions` | สถานะของคู่ student/assignment, `version`, `completed_at`, `updated_at` |
| `public.timetable_images` | Metadata ของภาพ ขนาดไฟล์ สัดส่วน path และสถานะพร้อมใช้/active |
| `private.import_batches` | เก็บ batch ID และ payload เพื่อให้ retry การนำเข้าไม่สร้างข้อมูลซ้ำ |
| `private.admin_members` | โครงสร้างผู้ดูแลจากรุ่นเดิม; ไม่ใช้เป็น gate ในหน้าจอปัจจุบัน |

Frontend อ่านข้อมูลห้องให้ครบก่อนคำนวณ progress โดยแบ่ง query ครั้งละ 500 แถวใน `allRows()` ไม่คำนวณเปอร์เซ็นต์จากรายการที่ถูกกรองหรือเฉพาะหน้าแรก

## สิทธิ์และ RLS

- เปิด RLS บน public tables ทั้งหกตาราง
- `anon` และ `authenticated` อ่านข้อมูลห้องได้ และ INSERT/UPDATE ข้อมูลที่จัดการร่วมกันได้ตาม policy ของห้อง
- `submissions` เปลี่ยนสถานะผ่าน RPC เท่านั้น เพื่อคง version check; ไม่เปิดเขียนสถานะตรงจาก client
- ไม่เปิด DELETE ตารางข้อมูลหลักให้ client
- `private.admin_members` และ `private.import_batches` ไม่ได้เปิดอ่าน/เขียนโดยตรงจาก browser
- RPC import ใช้ฟังก์ชันภายในแบบ `SECURITY DEFINER` เพื่อบันทึก batch ใน private schema โดยตรวจรูปแบบข้อมูล/ห้อง/รายการซ้ำภายใน transaction; ฟังก์ชันนี้ตั้งใจให้ผู้ร่วมใช้ห้องเรียกได้
- ไม่แก้ปัญหาสิทธิ์ด้วยการปิด RLS ต้องปรับ `GRANT` และ policy ให้ตรงกับการใช้งาน

## วิธีเรียกใช้จากโค้ด

ใช้ adapter เดิมใน `src/data/supabase.ts` เป็นจุดรวมการเชื่อมต่อ ไม่สร้าง client แยกกระจายตามหน้าจอ

| งาน | วิธีที่ใช้ |
|---|---|
| ตั้งชื่อห้อง/ภาคเรียน | RPC `save_classroom(p_label, p_term_label)` |
| เพิ่ม/แก้ไขนักเรียน วิชา งาน | `from(table).upsert(row).select('id').single()` |
| เก็บเข้าประวัติ | UPDATE `archived_at` แล้วอ่านข้อมูลใหม่ |
| เปลี่ยนสถานะ | RPC `set_submission_status(p_student_id, p_assignment_id, p_status, p_expected_version)` |
| นำเข้า CSV | RPC `import_students(p_classroom_id, p_batch_id, p_rows)` |
| ยืนยันว่าไฟล์ภาพอัปโหลดแล้ว | RPC `mark_timetable_ready(p_id, p_classroom_id)` |
| เลือกภาพที่ใช้งาน | RPC `activate_timetable(p_id, p_classroom_id)` |

ตัวอย่างรูปแบบการเรียก RPC (UUID และ version ต้องมาจากข้อมูลจริงที่โหลดไว้ ไม่ใช่ชื่อที่แสดง):

```typescript
const { data, error } = await client.rpc('set_submission_status', {
  p_student_id: student.id,
  p_assignment_id: assignment.id,
  p_status: 'submitted',
  p_expected_version: currentSubmission?.version ?? 0,
});
if (error) throw error;
```

หากได้ `STATUS_CONFLICT` ให้โหลดข้อมูลล่าสุดและให้ผู้ใช้เลือกใหม่ ไม่เขียนทับด้วย version ใหม่โดยอัตโนมัติ ค่า status มี `not_started`, `in_progress`, `done`, `submitted`; งาน `submit` จะครบเมื่อ `submitted` เท่านั้น ส่วนงาน `do` ยอมรับ `done` ด้วย และ `optional` ไม่นับลดเปอร์เซ็นต์งานบังคับ

การเพิ่มรายการสร้าง UUID ครั้งเดียวต่อฟอร์มและใช้ UUID เดิมตอน retry ส่วน import ใช้ batch ID เดิมกับ payload เดิมเพื่อลดการสร้างรายการซ้ำ

## รูปตารางสอนและ Realtime

Bucket ชื่อ `timetables` อ่านภาพได้แบบ public รองรับ PNG/JPEG/WebP ไม่เกิน 6 MiB ต่อไฟล์ Path เป็น `<classroom UUID>/<image UUID>/original.<extension>`

ลำดับอัปโหลดคือจอง metadata → ส่งไฟล์โดยไม่ overwrite → ตรวจไฟล์ด้วย `mark_timetable_ready` → สลับภาพด้วย `activate_timetable` การสลับภาพล็อกห้องและมี unique index จำกัด active หนึ่งภาพ หากส่งไฟล์หรือ activate ล้มเหลว UI จะรายงานปัญหาและคงภาพเดิมไว้

Migrations เพิ่ม public tables ทั้งหกเข้า publication `supabase_realtime` เมื่อ publication นี้มีอยู่ Adapter subscribe การเปลี่ยนตารางแล้ว refetch ข้อมูล รวมทั้ง refetch หลังเชื่อมต่อใหม่ ไม่คำนวณสถานะห้องด้วยการเดาการเปลี่ยนแปลงเฉพาะแถว

## เพิ่มหรือแก้ schema ในอนาคต

1. สร้าง migration ใหม่ด้วย CLI ไม่แก้ประวัติไฟล์ที่ deploy แล้ว:

```powershell
npx supabase migration new describe_your_change
```

2. เขียน SQL ในไฟล์ที่ CLI สร้าง ใช้ constraints/FK เป็นกฎข้อมูล และกำหนด RLS/GRANT ชัดเจนเมื่อเพิ่มตารางหรือ RPC
3. ปรับ types, adapter และ UI ที่ใช้ข้อมูลนั้น รวมทั้ง tests ที่พิสูจน์พฤติกรรมที่เปลี่ยน
4. ตรวจในฐานทดสอบก่อน แล้วตรวจ dry-run/apply ตามขั้นตอนด้านบน หากใช้ Supabase MCP ให้ตรวจ schema ก่อน ใช้ `apply_migration` สำหรับ DDL และเก็บ SQL/ชื่อไฟล์ให้ตรงกับ migration history ที่ server บันทึก ไม่ apply ซ้ำผ่าน CLI
5. ตรวจ advisors หลังเปลี่ยนสิทธิ์หรือ schema และบันทึกผลตรวจโดยไม่ใส่ข้อมูลส่วนตัว

## ตรวจสอบโดยไม่เปิดเผยข้อมูลรายบุคคล

SQL ด้านล่างอ่านเฉพาะ metadata ของระบบ:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
```

คำสั่งตรวจในเครื่อง:

```powershell
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

Integration ใช้ PGlite และ browser tests ใช้ fixture ไม่ใช่หลักฐานว่า Auth/Storage/Realtime บน Cloud ใช้งานได้ครบ ต้องตรวจบริการจริงแยกด้วยฐานทดสอบ และลองสอง browser เมื่อมีการแก้ไขพร้อมกัน

`GET`/`HEAD /api/health` อ่าน `classrooms.id` อย่างมากหนึ่งแถว: config/เครือข่าย/ฐานข้อมูลผิดพลาดตอบ 503, สำเร็จตอบ 200 ฐานว่างถือว่าสำเร็จ Endpoint นี้ไม่ได้ตรวจ upload หรือการส่ง Realtime event

## สิ่งที่เก็บใน Git

เก็บ SQL migrations, คู่มือ, source และ tests ส่วน `.env`, credential/token, `.vercel`, `supabase/.temp` และ dump ข้อมูลจริงต้องอยู่นอก Git หากทำ backup ต้องสำรองทั้งฐานข้อมูลและไฟล์ Storage; รายงาน CSV ไม่ใช่ backup ทั้งระบบ

## เอกสารอ้างอิง

- [Database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [CLI db push](https://supabase.com/docs/reference/cli/supabase-db-push)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Database backups](https://supabase.com/docs/guides/platform/backups)
