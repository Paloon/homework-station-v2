# การเชื่อมบริการ HomeWork Station

29 ตุลาคม 2569: ผู้ใช้อนุญาตให้สร้างและเชื่อมบริการใหม่ตามแผน

- GitHub repository ใหม่ (private): https://github.com/Paloon/homework-station-v2
- Vercel project: `paloon/homework-station-v2`, Node.js 24.x, Vite, build `npm run build`, output `dist`
- เชื่อม Vercel Git integration กับ repository ใหม่แล้ว
- เว็บ production: https://homework-station-v2.vercel.app/
- Supabase: https://supabase.com/dashboard/project/bujseyrbnqqozjpvjpdb — `HomeWork Station`, Singapore, Data API เปิด, การ expose ตารางอัตโนมัติปิด
- ติดตั้งและบันทึก migration ทั้งสองไฟล์แล้ว: ตาราง public 6 ตารางเปิด RLS ครบ, bucket `timetables` 1 ชุด
- ผู้ใช้สร้างบัญชี Auth แล้ว ตรวจอีเมลยืนยันและสมาชิก `private.admin_members` เป็น true
- ค่า URL/publishable key ครบสี่ตัวตั้งเฉพาะ Vercel Production; Preview ยังไม่เชื่อมฐาน production
- `GET /api/health` บน production ตอบ 200, `database: ok`, `Cache-Control: no-store` หลังเชื่อมจริง
- หน้าจัดการ production แสดง “เชื่อมต่อแล้ว” และปุ่มเข้าสู่ระบบผู้ดูแล
- UptimeRobot Web monitor: `804471630`; Database monitor: `804472027`; ตรวจทุก 5 นาที, timeout 10 วินาที, ใช้ผู้รับอีเมลเดิมของบัญชี
- บัญชี UptimeRobot Free ล็อก method เป็น HEAD; endpoint ตรวจ dependency สำหรับ HEAD เหมือน GET จึงใช้ได้โดยไม่อัปเกรดบริการ
- ยังไม่มีข้อมูลนักเรียน งาน หรือตารางสอนจริง ไม่ย้ายข้อมูลจากระบบเดิม

ไฟล์ environment, Vercel linkage/OIDC token และข้อมูลชั่วคราวไม่อยู่ใน Git

ผ่าน typecheck/build และ 50 tests ก่อนเชื่อมบริการ พร้อม targeted health และ test-isolation checks หลังตั้งค่า environment จริง ยังไม่ได้ทดสอบเข้าสู่ระบบด้วยรหัสผ่านที่ผู้ใช้ตั้ง, CRUD ข้อมูลจริง, อัปโหลดรูปจริง, backup/restore หรือ monitor failure/recovery drill จึงยังไม่อ้างว่าผ่าน flow ใช้งานจริงครบทุกส่วน
