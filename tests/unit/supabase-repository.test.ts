import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseRepository } from '../../src/data/supabase';

afterEach(() => vi.unstubAllGlobals());
describe('Supabase SDK repository with HTTP test doubles', () => {
  it('map fields correctly, read every page, and use optimistic version RPC', async () => {
    const requested: URL[] = [], bodies: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (input, options) => {
      const url = new URL(String(input)); requested.push(url);
      if (options?.body) bodies.push(JSON.parse(String(options.body)));
      const table = url.pathname.split('/').pop(); let result: unknown = [];
      if (table === 'classrooms') result = [{ id: 'room', label: 'ห้องทดสอบ SDK', term_label: 'ภาคเรียนทดสอบ' }];
      if (table === 'students') {
        const offset = Number(url.searchParams.get('offset') ?? 0);
        result = offset === 0 ? Array.from({ length: 500 }, (_, index) => ({ id: `student-${index}`, no: index + 1, name: `ทดสอบ ${index}`, student_code: `00${index}` })) : [{ id: 'student-last', no: 501, name: 'หน้าสุดท้าย', student_code: '00501' }];
      }
      if (table === 'subjects') result = [{ id: 'subject', name: 'วิชาทดสอบ' }];
      if (table === 'assignments') result = [{ id: 'task', subject_id: 'subject', title: 'งาน', task_type: 'submit', assigned_on: '2026-10-26', due_date: '2026-10-29', description: '', attachment_url: null }];
      if (table === 'submissions') result = [{ student_id: 'student-last', assignment_id: 'task', status: 'submitted', version: 2 }];
      if (table === 'set_submission_status') result = { version: 3 };
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    }));
    const repository = createSupabaseRepository('https://fixture.supabase.co', 'sb_publishable_fixture');
    const data = await repository.load();
    expect(data.students).toHaveLength(501); expect(data.students[500].studentCode).toBe('00501');
    expect(data.assignments[0].subjectId).toBe('subject'); expect(data.classroom?.name).toBe('ห้องทดสอบ SDK');
    expect(requested.some(url => url.pathname.endsWith('/students') && url.searchParams.get('offset') === '500')).toBe(true);
    await repository.setStatus('student-last', 'task', 'done', 2);
    expect(bodies.at(-1)).toEqual({ p_student_id: 'student-last', p_assignment_id: 'task', p_status: 'done', p_expected_version: 2 });
  });
  it('does not turn database errors into empty classroom data', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ code: '42501', message: 'denied' }), { status: 403, headers: { 'Content-Type': 'application/json' } })));
    const repository = createSupabaseRepository('https://failure.supabase.co', 'sb_publishable_fixture');
    await expect(repository.load()).rejects.toThrow('ไม่มีสิทธิ์');
  });
});
