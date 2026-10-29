import { describe, expect, it } from 'vitest';
import { bangkokToday, dueLabel, weekRange } from '../../src/domain/dates';
import { calculateProgress, isComplete, selectAssignments } from '../../src/domain/progress';
import { parseCsv, serializeCsv, validateRoster } from '../../src/domain/csv';
import type { Assignment, Submission } from '../../src/domain/types';

const task = (id: string, type: Assignment['type'], dueDate = '2026-10-29'): Assignment => ({
  id, subjectId: 's1', title: 'งานทดสอบ', type, assignedOn: '2026-10-26', dueDate, description: '', attachmentUrl: null,
});
const submission = (assignmentId: string, status: Submission['status']): Submission => ({ assignmentId, studentId: 'p1', status, version: 1 });

describe('กฎงานบังคับ', () => {
  it('ต้องส่งต้อง submitted แต่ต้องทำยอมรับ done', () => {
    expect(isComplete(task('1', 'submit'), 'done')).toBe(false);
    expect(isComplete(task('1', 'submit'), 'submitted')).toBe(true);
    expect(isComplete(task('2', 'do'), 'done')).toBe(true);
  });
  it('งานเสริมไม่ลดเปอร์เซ็นต์และงานชิ้นสุดท้ายอัปเดตเป็นครบ', () => {
    const tasks = [task('1', 'submit'), task('2', 'do'), task('3', 'optional')];
    expect(calculateProgress(tasks, [submission('1', 'submitted'), submission('2', 'done')], 'p1')).toEqual({ required: 2, completed: 2, optionalCompleted: 0, percent: 100 });
  });
  it('ไม่มีงานบังคับไม่แสดง 0% และไม่นับสถานะของอีกคน', () => {
    expect(calculateProgress([task('3', 'optional')], [], 'p1').percent).toBeNull();
    expect(calculateProgress([task('1', 'submit')], [submission('1', 'submitted')], 'p2').completed).toBe(0);
  });
  it('กรอง/เรียงคงที่ และ done ของงานต้องส่งยังอยู่ในรายการค้าง', () => {
    const assignments = [task('b', 'do'), task('a', 'submit'), task('c', 'do', '2026-10-28')];
    const statuses = [submission('a', 'done'), submission('b', 'done')];
    expect(selectAssignments(assignments, statuses, 'p1', { completion: 'pending', subjectId: '', type: '', due: '', search: '' }, '2026-10-29').map(item => item.id)).toEqual(['c', 'a']);
    expect(calculateProgress(assignments, statuses, 'p1').required).toBe(3);
  });
});

describe('วันในประเทศไทย', () => {
  it.each(['2026-10-28T17:01:00Z', '2026-10-29T00:00:00Z', '2026-10-29T05:00:00Z', '2026-10-29T16:59:59Z'])('วันนี้ไม่เกินกำหนด ณ %s', instant => {
    const today = bangkokToday(new Date(instant));
    expect(today).toBe('2026-10-29');
    expect(dueLabel('2026-10-29', today)).toEqual({ text: 'วันนี้', overdue: false });
  });
  it('ข้ามเที่ยงคืนไทย เดือน ปี และ leap day ถูกต้อง', () => {
    expect(dueLabel('2026-10-29', bangkokToday(new Date('2026-10-29T17:00:00Z')))).toEqual({ text: 'เกินกำหนด 1 วัน', overdue: true });
    expect(dueLabel('2026-12-31', '2027-01-01').overdue).toBe(true);
    expect(dueLabel('2028-03-01', '2028-02-28').text).toBe('อีก 2 วัน');
  });
  it('สัปดาห์เริ่มจันทร์และสิ้นสุดอาทิตย์ รวมวันอาทิตย์และข้ามปี', () => {
    expect(weekRange('2026-11-01')).toEqual({ start: '2026-10-26', end: '2026-11-01' });
    expect(weekRange('2027-01-01')).toEqual({ start: '2026-12-28', end: '2027-01-03' });
  });
});

describe('CSV ภาษาไทย', () => {
  it('BOM, comma, quote, newline, empty และรหัสศูนย์นำหน้า round-trip', () => {
    const rows = [['เลขที่', 'ชื่อ-นามสกุล', 'รหัสประจำตัว'], ['1', 'ทดสอบ, "ชื่อ"\nหลายบรรทัด', '00123'], ['2', '', '00001']];
    const csv = serializeCsv(rows);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(parseCsv(csv)).toEqual(rows);
  });
  it('ไม่ยอมรับ CSV quote ไม่ครบหรืออักขระหลัง quote', () => {
    expect(() => parseCsv('a,"b')).toThrow();
    expect(() => parseCsv('a,"b"c')).toThrow();
  });
  it('ช่องว่างเดี่ยวไม่หายไประหว่าง round-trip', () => {
    expect(parseCsv(serializeCsv([['']]))).toEqual([['']]);
  });
  it('ตรวจเลขที่/รหัสซ้ำและชื่อว่างโดยไม่เขียนทับ', () => {
    const result = validateRoster([['เลขที่', 'ชื่อ-นามสกุล', 'รหัสประจำตัว'], ['1', 'ทดสอบ หนึ่ง', '001'], ['1', 'ทดสอบ สอง', '001'], ['3', ' ', '003']]);
    expect(result.rows[0].studentCode).toBe('001');
    expect(result.errors).toHaveLength(3);
  });
});
