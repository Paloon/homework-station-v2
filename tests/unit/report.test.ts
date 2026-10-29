import { describe, expect, it } from 'vitest';
import { reportRows } from '../../src/domain/report';
import { fixtureData } from '../e2e/fixtures';

describe('รายงานความคืบหน้า', () => {
  it('ชื่องานซ้ำแยกด้วยวิชา/รหัส และใช้สูตรเดียวกับหน้ารายการ', () => {
    const data = fixtureData(); data.assignments[1].title = data.assignments[0].title;
    const rows = reportRows(data);
    expect(new Set(rows[0]).size).toBe(rows[0].length);
    expect(rows[0][8]).toContain('task-a'); expect(rows[0][9]).toContain('task-b');
    expect(rows[1].slice(4, 8)).toEqual(['1', '2', '50', '0']);
    expect(rows[1][2]).toBe('00123');
  });
  it('ระบุสถานะ archived และไม่แต่งเปอร์เซ็นต์เมื่อไม่มีงานบังคับ', () => {
    const data = fixtureData(); data.students[0].archivedAt = '2026-10-29T05:00:00Z';
    data.assignments[0].archivedAt = '2026-10-29T05:00:00Z';
    expect(reportRows(data)[0][8]).toContain('เก็บเข้าประวัติ');
    data.assignments = data.assignments.filter(task => task.type === 'optional');
    expect(reportRows(data)[1][3]).toBe('เก็บเข้าประวัติ'); expect(reportRows(data)[1][6]).toBe('');
  });
});
