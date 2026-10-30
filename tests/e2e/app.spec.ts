import { test, expect } from '@playwright/test';
import { fixtureData, installFixture } from './fixtures';
import { emptyData } from '../../src/domain/types';

test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-10-29T05:00:00Z')); });

test('นักเรียนเพิ่มวิชาและงานร่วมกันจากหน้างานได้โดยไม่ล็อกอิน', async ({ page, context }) => {
  const data = fixtureData(); data.subjects = []; data.assignments = []; data.submissions = [];
  const fixture = await installFixture(context, data);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?fixture=1&student=student-a');
  await expect(page.getByRole('button', { name: 'เพิ่มงาน', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'เพิ่มวิชา', exact: true }).click();
  await page.getByRole('dialog').getByLabel('ชื่อวิชา').fill('คณิตศาสตร์ร่วมกัน');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'เพิ่มงาน', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('ชื่องาน', { exact: true }).fill('แบบฝึกหัดที่เพื่อนเพิ่ม');
  await dialog.getByLabel('วันครบกำหนด', { exact: true }).fill('2026-10-30');
  await dialog.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-task]')).toContainText('แบบฝึกหัดที่เพื่อนเพิ่ม');
  await expect(page).toHaveURL(/student=student-a/);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  expect(fixture.state.subjects).toHaveLength(1); expect(fixture.state.assignments).toHaveLength(1);
  expect(fixture.calls.some(call => /adminAccess|signIn/.test(call.action))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '.local-check/student-managed-tasks.png', fullPage: true });
});

test('นักเรียนแก้และเก็บงานเข้าประวัติหลังกรองรายการได้ และบันทึกซ้ำเมื่อเกิดข้อผิดพลาดได้', async ({ page, context }) => {
  const fixture = await installFixture(context, fixtureData(), { saveError: true });
  await page.goto('/?fixture=1&student=student-a');
  const search = page.getByRole('searchbox', { name: 'ค้นหางาน', exact: true });
  await search.fill('ไม่มีรายการ'); await search.fill('ต้องส่ง');
  await page.getByRole('button', { name: 'แก้ไขงาน งานทดสอบที่ต้องส่ง', exact: true }).click();
  await page.getByRole('dialog').getByLabel('ชื่องาน', { exact: true }).fill('งานที่เพื่อนแก้ไขร่วมกัน');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('จำลองบันทึกล้มเหลว');
  await expect(page.getByRole('dialog').getByLabel('ชื่องาน', { exact: true })).toHaveValue('งานที่เพื่อนแก้ไขร่วมกัน');
  fixture.recoverSave();
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await search.fill('');
  await expect(page.locator('[data-task="task-a"]')).toContainText('งานที่เพื่อนแก้ไขร่วมกัน');
  await page.getByRole('button', { name: 'เก็บงานเข้าประวัติ งานที่เพื่อนแก้ไขร่วมกัน', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'เก็บเข้าประวัติ', exact: true }).click();
  await expect(page.locator('[data-task="task-a"]')).toHaveCount(0);
  expect(fixture.state.assignments.find(task => task.id === 'task-a')?.archivedAt).toBeTruthy();
});

test('เครื่องมือรายชื่อ วิชา ห้องเรียน และตารางสอนเปิดใช้โดยไม่ล็อกอิน', async ({ page, context }) => {
  const fixture = await installFixture(context);
  await page.goto('/?fixture=1&view=manage');
  await expect(page.getByRole('button', { name: 'เข้าสู่ระบบผู้ดูแล', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'เพิ่มนักเรียน', exact: true }).click();
  await page.getByRole('dialog').getByLabel('เลขที่', { exact: true }).fill('20');
  await page.getByRole('dialog').getByLabel('ชื่อ-นามสกุล', { exact: true }).fill('นักเรียนเพิ่มร่วมกัน');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#manage-student-list')).toContainText('นักเรียนเพิ่มร่วมกัน');
  await page.getByRole('button', { name: 'วิชา', exact: true }).click();
  await page.locator('.data-row').first().getByRole('button', { name: 'แก้ไข', exact: true }).click();
  await page.getByRole('dialog').getByLabel('ชื่อวิชา').fill('วิชาที่ช่วยกันแก้ไข');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.manage-section')).toContainText('วิชาที่ช่วยกันแก้ไข');
  await page.getByRole('button', { name: 'ห้องเรียน', exact: true }).click();
  await page.getByRole('button', { name: 'แก้ไขข้อมูลห้อง', exact: true }).click();
  await page.getByRole('dialog').getByLabel('ชื่อห้อง', { exact: true }).fill('ห้องที่นักเรียนจัดการ');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#classroom-context')).toContainText('ห้องที่นักเรียนจัดการ');
  await page.goto('/?fixture=1&view=timetable');
  await page.getByRole('button', { name: 'เพิ่มรูปตารางสอน', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(fixture.calls.some(call => /adminAccess|signIn/.test(call.action))).toBe(false);
});

test('ติดตามงาน: แยกกำหนดส่ง ดูคนยังไม่ครบ และคัดลอกเมื่อ Clipboard ใช้ไม่ได้', async ({ page, context }) => {
  const data = fixtureData();
  data.assignments.push({ ...data.assignments[1], id: 'task-future', title: 'งานในอนาคต', dueDate: '2026-10-31' });
  data.submissions.push({ studentId: 'student-a', assignmentId: 'task-a', status: 'done', version: 1 });
  await installFixture(context, data);
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }));
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/?fixture=1&view=overview');
  await expect(page.locator('[data-follow-up-row]')).toHaveCount(3);
  await page.getByRole('combobox', { name: 'ช่วงกำหนดส่งที่ต้องติดตาม' }).selectOption('overdue');
  await expect(page.locator('[data-follow-up-row]:visible')).toHaveCount(1);
  await page.getByRole('button', { name: 'ดูรายชื่อ งานทดสอบที่ต้องส่ง', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('li')).toHaveCount(2);
  await expect(dialog.locator('li').filter({ hasText: 'นักเรียนทดสอบ หนึ่ง' })).toContainText('ทำเสร็จแล้ว');
  await expect(dialog.locator('li').filter({ hasText: 'นักเรียนทดสอบ สอง' })).toContainText('ยังไม่เริ่ม');
  await page.screenshot({ path: '.local-check/follow-up-mobile.png' });
  await dialog.getByRole('button', { name: 'คัดลอกรายชื่อ', exact: true }).click();
  await expect(dialog.getByLabel('รายชื่อนักเรียนที่งานยังไม่ครบ')).toHaveValue(/2 คน\n1\. นักเรียนทดสอบ หนึ่ง/);
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'ดูรายชื่อ งานทดสอบที่ต้องส่ง', exact: true })).toBeFocused();
  await page.getByRole('combobox', { name: 'ช่วงกำหนดส่งที่ต้องติดตาม' }).selectOption('today');
  await page.getByRole('button', { name: 'ดูรายชื่อ งานทดสอบที่ต้องทำ', exact: true }).click();
  await expect(dialog.locator('li')).toHaveCount(1);
  await expect(dialog).toContainText('นักเรียนทดสอบ สอง');
  await expect(dialog).not.toContainText('นักเรียนทดสอบ หนึ่ง');
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'ช่วงกำหนดส่งที่ต้องติดตาม' }).selectOption('upcoming');
  await expect(page.locator('[data-follow-up-row]:visible')).toHaveCount(1);
  await expect(page.locator('[data-follow-up-row]:visible')).toContainText('งานในอนาคต');
});

test('ติดตามงาน: คัดลอกรายชื่อเฉพาะคนที่ยังไม่ครบสำเร็จ', async ({ page, context }) => {
  await installFixture(context);
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => { (window as any).copiedFollowUp = text; } }, configurable: true }));
  await page.goto('/?fixture=1&view=overview');
  await page.getByRole('button', { name: 'ดูรายชื่อ งานทดสอบที่ต้องทำ', exact: true }).click();
  await page.getByRole('button', { name: 'คัดลอกรายชื่อ', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).copiedFollowUp)).toContain('12. นักเรียนทดสอบ สอง — ยังไม่เริ่ม');
  expect(await page.evaluate(() => (window as any).copiedFollowUp)).not.toContain('นักเรียนทดสอบ หนึ่ง');
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText('คัดลอกรายชื่อแล้ว');
});

test('ค้นหางานของนักเรียนร่วมกับตัวกรอง โดยความคืบหน้ายังคิดจากงานทั้งหมด', async ({ page, context }) => {
  await installFixture(context); await page.goto('/?fixture=1&student=student-a');
  await page.getByRole('searchbox', { name: 'ค้นหางาน', exact: true }).fill('แบบฝึกหัด');
  await expect(page.locator('[data-task]')).toHaveCount(1);
  await expect(page.locator('[data-task]')).toContainText('งานทดสอบที่ต้องส่ง');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  await page.getByRole('combobox', { name: 'วิชา', exact: true }).selectOption('subject-b');
  await expect(page.getByRole('heading', { name: 'ไม่พบงานที่ตรงกับตัวกรอง' })).toBeVisible();
  await page.getByRole('button', { name: 'ล้างตัวกรอง', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'ค้นหางาน', exact: true })).toHaveValue('');
  await expect(page.locator('[data-task]')).toHaveCount(3);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
});

test('ค้นหางานที่จัดการร่วมกับวิชาและกำหนดส่ง ล้างและรักษาตัวกรองเมื่อกลับมาได้', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await installFixture(context); await page.goto('/?fixture=1&view=manage');
  await page.getByRole('button', { name: 'งาน', exact: true }).click();
  const search = page.getByRole('searchbox', { name: 'ค้นหางานที่จัดการ' });
  await search.fill('ต้อง');
  await page.getByRole('combobox', { name: 'วิชาของงาน' }).selectOption('subject-b');
  await page.getByRole('combobox', { name: 'กำหนดส่งของงาน' }).selectOption('today');
  await expect(page.locator('[data-manage-assignment]:visible')).toHaveCount(1);
  await expect(page.locator('[data-manage-assignment]:visible')).toContainText('งานทดสอบที่ต้องทำ');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '.local-check/manage-search-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'วิชา', exact: true }).click();
  await page.getByRole('button', { name: 'งาน', exact: true }).click();
  await expect(search).toHaveValue('ต้อง');
  await expect(page.getByRole('combobox', { name: 'วิชาของงาน' })).toHaveValue('subject-b');
  await expect(page.locator('[data-manage-assignment]:visible')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'กำหนดส่งของงาน' }).selectOption('overdue');
  await expect(page.locator('#manage-assignment-empty')).toBeVisible();
  await expect(page.locator('[data-manage-assignment]:visible')).toHaveCount(0);
  await page.getByRole('button', { name: 'ล้างตัวกรองงาน', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await expect(page.locator('[data-manage-assignment]:visible')).toHaveCount(3);
});

test('เว็บปกติไม่มีข้อมูลสมมุติ ทุกหน้ามีสถานะว่างและ browser back ใช้ได้', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ห้องเรียนกำลังรอรายชื่อ' })).toBeVisible();
  await expect(page.getByText('ยังไม่เชื่อมข้อมูล', { exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'เมนูหลัก', exact: true }).getByRole('link', { name: 'ตารางสอน' }).click();
  await expect(page.getByRole('heading', { name: 'ยังไม่ได้เพิ่มตารางสอน' })).toBeVisible();
  await page.goBack(); await expect(page.getByRole('heading', { name: 'งานของห้องเรียน', exact: true })).toBeVisible();
  for (const view of ['overview', 'students', 'manage', 'more']) { await page.goto(`/?view=${view}`); await expect(page.locator('h1')).toBeVisible(); }
  expect(errors).toEqual([]);
});

for (const [width, height] of [[320, 568], [390, 844], [844, 390], [768, 1024], [1024, 768], [1440, 900]]) {
  test(`responsive ${width}×${height}: ทุกหน้าไม่มีแนวนอนล้น`, async ({ page, context }) => {
    await page.setViewportSize({ width, height }); await installFixture(context);
    for (const view of ['tasks', 'timetable', 'overview', 'students', 'manage', 'more']) {
      await page.goto(`/?fixture=1&student=student-a&view=${view}`); await expect(page.locator('h1')).toBeVisible();
      await expect(page.getByText('ข้อมูลทดสอบสำหรับตรวจหน้าจอ', { exact: false })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), view).toBe(true);
    }
  });
}

test('ส่งชิ้นสุดท้ายอัปเดต progress ก่อนแสดงรายการว่างและไม่นับงานเสริม', async ({ page, context }) => {
  await installFixture(context); await page.goto('/?fixture=1&student=student-a');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  await page.getByRole('combobox', { name: 'สถานะ งานทดสอบที่ต้องส่ง' }).selectOption('done');
  await expect(page.getByRole('combobox', { name: 'สถานะ งานทดสอบที่ต้องส่ง' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  await page.getByRole('combobox', { name: 'สถานะ งานทดสอบที่ต้องส่ง' }).focus();
  await page.getByRole('combobox', { name: 'สถานะ งานทดสอบที่ต้องส่ง' }).selectOption('submitted');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await expect(page.locator('[data-task="task-a"]')).toHaveCount(0);
  await expect(page.locator('[data-task="task-c"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ยังไม่ครบ', exact: true })).toBeFocused();
});

test('มือถือค้นหาเลขที่ เปลี่ยนนักเรียน และกลับจากตารางแล้วยังเลือกคนเดิม', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await installFixture(context);
  await page.goto('/?fixture=1'); await page.getByRole('button', { name: 'เลือกชื่อ', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('searchbox').fill('12');
  await dialog.getByRole('button', { name: '12 นักเรียนทดสอบ สอง', exact: false }).click();
  await expect(page).toHaveURL(/student=student-b/);
  await page.getByRole('navigation', { name: 'เมนูมือถือ' }).getByRole('link', { name: 'ตารางสอน' }).click();
  await page.getByRole('navigation', { name: 'เมนูมือถือ' }).getByRole('link', { name: 'งาน', exact: true }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.locator('h1 + p')).toContainText('นักเรียนทดสอบ สอง');
});

test('โหลดและบันทึกล้มเหลวลองใหม่ได้ พร้อมคงค่าฟอร์ม/UUID', async ({ page, context }) => {
  const fixture = await installFixture(context, fixtureData(), { loadError: true });
  await page.goto('/?fixture=1&view=manage');
  await expect(page.getByRole('heading', { name: 'โหลดข้อมูลไม่สำเร็จ' })).toBeVisible();
  fixture.recoverLoad(); await page.getByRole('button', { name: 'ลองใหม่', exact: true }).click();
  await page.getByRole('button', { name: 'เพิ่มนักเรียน', exact: true }).click();
  await page.getByLabel('เลขที่', { exact: true }).fill('3'); await page.getByLabel('ชื่อ-นามสกุล', { exact: true }).fill('ชื่อที่เพิ่มจากการทดสอบ');
  const saveRoutes: any[] = [];
  await context.route('**/__test__/repository', async route => {
    const body = route.request().postDataJSON();
    if (body.action !== 'saveStudent') return route.fallback();
    saveRoutes.push(body);
    if (saveRoutes.length === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'จำลองบันทึกล้มเหลว' }) });
    return route.fallback();
  });
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.getByLabel('ชื่อ-นามสกุล', { exact: true })).toHaveValue('ชื่อที่เพิ่มจากการทดสอบ');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(saveRoutes[0].payload.student.id).toBe(saveRoutes[1].payload.student.id);
  await expect(page.getByText('3. ชื่อที่เพิ่มจากการทดสอบ', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'เพิ่มนักเรียน', exact: true })).toBeFocused();
});

test('status conflict แจ้งและโหลดล่าสุด ไม่เขียนทับสถานะอีกเครื่อง', async ({ page, context }) => {
  const fixture = await installFixture(context); await page.goto('/?fixture=1&student=student-a');
  await expect(page.getByRole('combobox', { name: 'สถานะ งานทดสอบที่ต้องส่ง' })).toBeVisible();
  fixture.state.submissions.push({ studentId: 'student-a', assignmentId: 'task-a', status: 'in_progress', version: 1 });
  await page.getByRole('combobox', { name: 'สถานะ งานทดสอบที่ต้องส่ง' }).selectOption('submitted');
  await expect(page.getByRole('status').filter({ hasText: 'สถานะถูกเปลี่ยนจากอีกเครื่องแล้ว' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'สถานะ งานทดสอบที่ต้องส่ง' })).toHaveValue('in_progress');
});

test('ภาพเสียต่างจากไม่มีภาพ, viewer ใช้ zoom/Escape และคืน focus', async ({ page, context }) => {
  const data = fixtureData(); data.timetable = { id: 'image-test', title: 'ภาพสำหรับทดสอบ viewer', url: 'http://127.0.0.1:4173/test-image.svg', width: 1200, height: 800, updatedAt: '2026-10-29T05:00:00Z', note: 'ภาพทดสอบ ไม่ใช่ตารางสอนจริง' };
  await installFixture(context, data);
  await context.route('**/test-image.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#eef3ff"/><text x="50" y="100" font-size="40">VIEWER TEST FIXTURE</text></svg>' }));
  await page.goto('/?fixture=1&view=timetable');
  const open = page.getByRole('button', { name: 'ขยายดู', exact: true }); await open.click();
  await page.getByRole('button', { name: 'ขนาด 100%', exact: true }).click(); await page.getByRole('button', { name: 'ซูมเข้า', exact: true }).click();
  await expect(page.getByRole('dialog').locator('output')).toHaveText('125%');
  await page.keyboard.press('Escape'); await expect(open).toBeFocused();
  await context.unroute('**/test-image.svg'); await context.route('**/test-image.svg', route => route.fulfill({ status: 404, body: '' }));
  await page.reload(); await expect(page.getByRole('heading', { name: 'โหลดรูปตารางสอนไม่สำเร็จ' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ยังไม่ได้เพิ่มตารางสอน' })).toHaveCount(0);
});

test('สร้างห้องใหม่ได้ และ validation วันที่ไม่ทำค่าฟอร์มหาย', async ({ page, context }) => {
  const fixture = await installFixture(context, emptyData()); await page.goto('/?fixture=1&view=manage');
  await page.getByRole('button', { name: 'ตั้งค่าห้องเรียน', exact: true }).click();
  await page.getByLabel('ชื่อห้อง', { exact: true }).fill('ห้องสร้างจากการทดสอบ'); await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await page.getByRole('button', { name: 'วิชา', exact: true }).click(); await page.getByRole('button', { name: 'เพิ่มวิชา', exact: true }).click();
  await page.getByLabel('ชื่อวิชา', { exact: true }).fill('วิชาสร้างใหม่ทดสอบ'); await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await page.getByRole('button', { name: 'งาน', exact: true }).click(); await page.getByRole('button', { name: 'เพิ่มงาน', exact: true }).click();
  await page.getByLabel('ชื่องาน', { exact: true }).fill('งานใหม่สำหรับทดสอบ'); await page.getByLabel('วันที่มอบหมาย', { exact: true }).fill('2026-10-30'); await page.getByLabel('วันครบกำหนด', { exact: true }).fill('2026-10-29');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('วันที่มอบหมายต้องไม่อยู่หลังวันครบกำหนด');
  await expect(page.getByLabel('ชื่องาน', { exact: true })).toHaveValue('งานใหม่สำหรับทดสอบ');
  expect(fixture.state.assignments).toHaveLength(0);
  await page.getByLabel('วันครบกำหนด', { exact: true }).fill('2026-10-31'); await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); expect(fixture.state.assignments).toHaveLength(1);
});

test('Clipboard API ไม่มี แสดงข้อความให้เลือกคัดลอกเอง', async ({ page, context }) => {
  await installFixture(context); await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: undefined }));
  await page.goto('/?fixture=1&view=overview'); await page.getByRole('button', { name: 'คัดลอกสรุป', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('สรุปประจำสัปดาห์')).toContainText('26 ต.ค. 2569');
});

test('health local ตอบ JSON 503 เมื่อไม่มีฐานข้อมูล ไม่ได้คืน HTML', async ({ request }) => {
  const response = await request.get('/api/health'); expect(response.status()).toBe(503); expect(response.headers()['cache-control']).toBe('no-store'); expect((await response.json()).status).toBe('degraded');
  const head = await request.head('/api/health'); expect(head.status()).toBe(503);
  expect((await request.post('/api/health')).status()).toBe(405);
});

test('CSV preview ปฏิเสธรายการชนกัน และนำเข้ารหัสศูนย์นำหน้าได้', async ({ page, context }) => {
  const fixture = await installFixture(context); await page.goto('/?fixture=1&view=manage');
  await page.getByRole('button', { name: 'นำเข้า / รายงาน', exact: true }).click(); await page.getByRole('button', { name: 'เลือกไฟล์ CSV', exact: true }).click();
  const file = page.getByLabel('ไฟล์ CSV', { exact: true });
  await file.setInputFiles({ name: 'collision.csv', mimeType: 'text/csv', buffer: Buffer.from('\uFEFFเลขที่,ชื่อ-นามสกุล,รหัสประจำตัว\r\n1,ทดสอบนำเข้า,00999') });
  await expect(page.getByRole('button', { name: 'ยืนยันนำเข้า 1 คน' })).toBeDisabled();
  await expect(page.getByRole('dialog')).toContainText('ซ้ำกับนักเรียนที่มีอยู่ในห้อง');
  await file.setInputFiles({ name: 'valid.csv', mimeType: 'text/csv', buffer: Buffer.from('\uFEFFเลขที่,ชื่อ-นามสกุล,รหัสประจำตัว\r\n3,"ทดสอบ, นำเข้า",00003') });
  await page.getByRole('button', { name: 'ยืนยันนำเข้า 1 คน' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(fixture.state.students.find(student => student.number === 3)?.studentCode).toBe('00003');
});

test('สถานะที่ไม่ถูกกรองทิ้งคง DOM control เดิม และ dialog trap/คืน focus', async ({ page, context }) => {
  await installFixture(context); await page.goto('/?fixture=1&student=student-a');
  const select = page.getByRole('combobox', { name: 'สถานะ งานทดสอบที่ต้องส่ง' }); await select.waitFor();
  const original = await select.elementHandle();
  await select.focus(); await select.selectOption('in_progress');
  await expect(select).toBeEnabled(); await expect(select).toHaveValue('in_progress');
  expect(await select.evaluate((node, prior) => node === prior, original)).toBe(true); await expect(select).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 }); const change = page.getByRole('button', { name: 'เปลี่ยน', exact: true }); await change.click();
  for (let index = 0; index < 10; index++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true); }
  await page.keyboard.press('Escape'); await expect(change).toBeFocused();
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('navigation', { name: 'เมนูมือถือ' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/mobile-text-200.png', fullPage: true });
});

test('ช่วง network ช้ากดบันทึกซ้ำไม่สร้างงานซ้ำ', async ({ page, context }) => {
  const fixture = await installFixture(context, fixtureData(), { delayMs: 180 }); await page.goto('/?fixture=1&view=manage');
  await page.getByRole('button', { name: 'งาน', exact: true }).click(); await page.getByRole('button', { name: 'เพิ่มงาน', exact: true }).click();
  await page.getByLabel('ชื่องาน', { exact: true }).fill('งานทดสอบป้องกันซ้ำ'); await page.getByLabel('วันครบกำหนด', { exact: true }).fill('2026-10-31');
  const form = page.getByRole('dialog').locator('form');
  await form.evaluate(form => { (form as HTMLFormElement).requestSubmit(); (form as HTMLFormElement).requestSubmit(); });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(fixture.calls.filter(call => call.action === 'saveAssignment')).toHaveLength(1);
  expect(fixture.state.assignments.filter(task => task.title === 'งานทดสอบป้องกันซ้ำ')).toHaveLength(1);
});

test('รายงานเลือกขอบเขตรวม archived และโหลดข้อมูลก่อนส่งออกจริง', async ({ page, context }) => {
  const fixture = await installFixture(context); await page.goto('/?fixture=1&view=manage');
  await page.getByRole('button', { name: 'นำเข้า / รายงาน', exact: true }).click();
  await page.getByRole('combobox', { name: 'ขอบเขตรายงาน', exact: true }).selectOption('all');
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'ส่งออก CSV', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('homework-report-2026-10-29-all.csv');
  expect(fixture.calls.filter(call => call.action === 'load').at(-1)?.payload.includeArchived).toBe(true);
});
