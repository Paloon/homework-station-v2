import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { installFixture } from '../tests/e2e/fixtures.ts';

const browser = await chromium.launch();
await mkdir('artifacts', { recursive: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-10-29T05:00:00Z'));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('heading', { name: 'ห้องเรียนกำลังรอรายชื่อ' }).waitFor();
  await page.screenshot({ path: 'artifacts/desktop-empty.png', fullPage: true });
  await installFixture(context);
  for (const [width, height, name] of [[1440, 1000, 'desktop-tasks'], [390, 844, 'mobile-tasks'], [320, 568, 'small-mobile-tasks']]) {
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:5173/?fixture=1&student=student-a');
    await page.getByRole('progressbar').waitFor();
    await page.getByRole('button', { name: 'ทั้งหมด', exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `artifacts/${name}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5173/?fixture=1&view=manage');
  await page.getByRole('button', { name: 'เพิ่มนักเรียน', exact: true }).waitFor();
  await page.screenshot({ path: 'artifacts/desktop-manage.png', fullPage: true });
  console.log('Saved five screenshots under artifacts/');
} finally { await browser.close(); }
