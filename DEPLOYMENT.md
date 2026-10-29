# การเชื่อมบริการ HomeWork Station

29 ตุลาคม 2569: ผู้ใช้อนุญาตให้สร้างและเชื่อมบริการใหม่ตามแผน

- GitHub repository ใหม่ (private): https://github.com/Paloon/homework-station-v2
- Vercel project: `paloon/homework-station-v2`, Node.js 24.x, Vite, build `npm run build`, output `dist`
- เชื่อม Vercel Git integration กับ repository ใหม่แล้ว
- Supabase: เตรียมชื่อ `HomeWork Station`, Singapore, Data API เปิด, การ expose ตารางอัตโนมัติปิด รอผู้ใช้ตั้ง Database password และสร้างโปรเจกต์
- ยังไม่มีข้อมูลนักเรียน งาน หรือตารางสอนจริง ไม่ย้ายข้อมูลจากระบบเดิม

ไฟล์ environment, Vercel linkage/OIDC token และข้อมูลชั่วคราวไม่อยู่ใน Git

สถานะนี้เป็นระหว่างเชื่อมบริการ การสร้าง repo/project ยังไม่ใช่หลักฐานว่า database/deployment/monitor พร้อมใช้งาน จะปรับผลหลังตรวจ URL และฐานข้อมูลจริง
