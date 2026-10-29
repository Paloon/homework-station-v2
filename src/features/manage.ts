import type { Repository, EntityKind } from '../data/repository';
import type { Assignment, ClassroomData, Student, Subject } from '../domain/types';
import { typeLabels } from '../domain/types';
import { bangkokToday, calendarDay, formatDate } from '../domain/dates';
import { reportRows } from '../domain/report';
import { parseCsv, serializeCsv, validateRoster } from '../domain/csv';
import { downloadFile, emptyState, escapeHtml as e, icon } from '../shared/html';
import { openDialog } from '../shared/dialog';

export type ManageTab = 'students' | 'subjects' | 'assignments' | 'timetable' | 'reports' | 'classroom';
const tabLabels: Record<ManageTab, string> = { students: 'นักเรียน', subjects: 'วิชา', assignments: 'งาน', timetable: 'ตารางสอน', reports: 'นำเข้า / รายงาน', classroom: 'ห้องเรียน' };
export interface ManageContext {
  data: ClassroomData; repository: Repository | null; admin: boolean; tab: ManageTab;
  notify(message: string): void; refresh(): Promise<void>; setTab(tab: ManageTab): void;
}

function actions(kind: EntityKind, id: string): string {
  return `<div class="row-actions"><button class="button" data-edit="${kind}" data-id="${e(id)}">แก้ไข</button><button class="button quiet" data-archive="${kind}" data-id="${e(id)}">เก็บเข้าประวัติ</button></div>`;
}

export function manageView(context: ManageContext): string {
  const { data, repository, admin, tab } = context;
  const heading = `<div class="page-heading"><div><h1>จัดการห้องเรียน</h1><p>รายชื่อ วิชา งาน และข้อมูลที่ใช้ร่วมกันในห้อง</p></div>${admin ? `<button class="button" data-signout>${icon('logout')} ออกจากระบบ</button>` : ''}</div>`;
  if (!repository) return heading + `<div class="paper">${emptyState('เริ่มต้นห้องเรียนของคุณ', 'เชื่อมต่อระบบข้อมูลก่อน แล้วผู้ดูแลจะเพิ่มห้องเรียน รายชื่อ วิชา และงานได้', 'manage', '<button class="button primary" data-setup>ดูขั้นตอนเชื่อมต่อ</button>')}</div><p class="task-intro">${icon('check', 18)} เริ่มข้อมูลใหม่ตามที่กำหนด ไม่มีการนำเข้าข้อมูลจากระบบเก่า</p>`;
  if (!admin) return heading + `<div class="paper">${emptyState('เข้าสู่ระบบผู้ดูแล', 'นักเรียนเลือกชื่อเพื่อดูงานได้ตามปกติ ส่วนการแก้ข้อมูลห้องเรียนใช้บัญชีผู้ดูแล', 'manage', '<button class="button primary" data-admin-login>เข้าสู่ระบบผู้ดูแล</button>')}</div>`;
  const tabs = `<div class="manage-tabs" role="group" aria-label="ส่วนจัดการ">${Object.entries(tabLabels).map(([value, label]) => `<button class="button" data-manage-tab="${value}" aria-pressed="${tab === value}">${label}</button>`).join('')}</div>`;
  if (!data.classroom && tab !== 'classroom') return heading + tabs + `<div class="paper">${emptyState('ตั้งค่าห้องเรียนก่อน', 'เพิ่มชื่อห้องและภาคเรียนก่อนเพิ่มรายชื่อ วิชา หรืองาน', 'book', '<button class="button primary" data-edit-classroom>ตั้งค่าห้องเรียน</button>')}</div>`;
  let content = '';
  if (tab === 'students') content = `<div class="section-header"><h2>รายชื่อนักเรียน <span class="count">${data.students.length} คน</span></h2><button class="button primary" data-add="students">${icon('plus')} เพิ่มนักเรียน</button></div><label class="field"><span>ค้นหาชื่อ เลขที่ หรือรหัสประจำตัว</span><input id="manage-search" type="search" placeholder="ค้นหานักเรียน" /></label><ul class="data-list" id="manage-student-list">${data.students.map(student => `<li class="data-row" data-search="${e(`${student.number} ${student.name} ${student.studentCode}`.toLocaleLowerCase('th'))}"><div class="data-row-main"><strong>${student.number}. ${e(student.name)}</strong><p>รหัสประจำตัว ${e(student.studentCode || 'ยังไม่ระบุ')}</p></div>${actions('students', student.id)}</li>`).join('')}</ul>${!data.students.length ? emptyState('ยังไม่มีรายชื่อนักเรียน', 'เพิ่มทีละคน หรือนำเข้า CSV ในส่วนนำเข้า / รายงาน', 'students') : ''}<p id="manage-no-results" class="muted" hidden>ไม่พบนักเรียนที่ตรงกับคำค้น <button class="button quiet" data-clear-manage-search>ล้างคำค้น</button></p>`;
  if (tab === 'subjects') content = `<div class="section-header"><h2>วิชา <span class="count">${data.subjects.length} วิชา</span></h2><button class="button primary" data-add="subjects">${icon('plus')} เพิ่มวิชา</button></div><ul class="data-list">${data.subjects.map(subject => `<li class="data-row"><div class="data-row-main"><strong>${e(subject.name)}</strong><p>ใช้อยู่ใน ${data.assignments.filter(task => task.subjectId === subject.id).length} งาน</p></div>${actions('subjects', subject.id)}</li>`).join('')}</ul>${!data.subjects.length ? emptyState('ยังไม่มีวิชา', 'เพิ่มวิชาเพื่อใช้ร่วมกันในหน้าสร้างงานและแก้ไขงาน', 'book') : ''}`;
  if (tab === 'assignments') content = `<div class="section-header"><h2>งานทั้งหมด <span class="count">${data.assignments.length} งาน</span></h2><button class="button primary" data-add="assignments" ${!data.subjects.length ? 'disabled' : ''}>${icon('plus')} เพิ่มงาน</button></div>${!data.subjects.length ? '<p class="notice info">เพิ่มวิชาก่อน แล้วจึงสร้างงานในวิชานั้นได้</p>' : ''}<ul class="data-list">${[...data.assignments].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(task => `<li class="data-row"><div class="data-row-main"><strong>${e(task.title)}</strong><p>${e(data.subjects.find(subject => subject.id === task.subjectId)?.name ?? '')} · ${typeLabels[task.type]} · ครบกำหนด ${formatDate(task.dueDate)}</p></div>${actions('assignments', task.id)}</li>`).join('')}</ul>${!data.assignments.length ? emptyState('ยังไม่มีงาน', 'เพิ่มชื่องาน วันที่มอบหมาย และวันครบกำหนด เพื่อให้นักเรียนติดตามได้', 'tasks') : ''}`;
  if (tab === 'timetable') content = `<div class="section-header"><h2>รูปตารางสอน</h2><button class="button primary" data-upload-timetable>${icon('upload')} เพิ่มรูปตารางสอน</button></div><p class="section-description">PNG, JPEG หรือ WebP ขนาดไม่เกิน 6 MB เก็บรูปต้นฉบับและประวัติภาพเดิมไว้</p>${data.timetable ? `<p>ใช้งานอยู่: <strong>${e(data.timetable.title)}</strong></p>` : '<p class="muted">ยังไม่ได้เพิ่มตารางสอน</p>'}<button class="button" data-timetable-history style="margin-top:20px">ดูประวัติรูป</button>`;
  if (tab === 'reports') content = `<div class="section-header"><h2>นำเข้ารายชื่อและส่งออกรายงาน</h2></div><p class="section-description">ตรวจตัวอย่างและรายการซ้ำก่อนนำเข้า รายงานใช้ข้อมูลงานและความคืบหน้าทั้งห้องตามขอบเขตที่เลือก</p><ul class="data-list"><li class="data-row"><div class="data-row-main"><strong>นำเข้ารายชื่อนักเรียน</strong><p>CSV ภาษาไทย คอลัมน์เลขที่ ชื่อ-นามสกุล และรหัสประจำตัว</p></div><div class="row-actions"><button class="button" data-roster-template>ดาวน์โหลดแม่แบบ</button><button class="button primary" data-import>${icon('upload')} เลือกไฟล์ CSV</button></div></li><li class="data-row"><div class="data-row-main"><strong>รายงานความคืบหน้าทั้งห้อง</strong><p>หนึ่งแถวต่อนักเรียน พร้อมสถานะทุกงาน วิชา วันส่ง และรหัสงาน</p><p>สูตรความครบคำนวณจากงานในขอบเขตที่เลือก</p></div><div class="row-actions"><label class="field"><span>ขอบเขตรายงาน</span><select id="report-scope"><option value="active">เฉพาะที่ใช้งานอยู่</option><option value="all">รวมข้อมูลที่เก็บเข้าประวัติ</option></select></label><button class="button" data-export>${icon('download')} ส่งออก CSV</button></div></li></ul>`;
  if (tab === 'classroom') content = `<div class="section-header"><h2>ข้อมูลห้องเรียน</h2><button class="button primary" data-edit-classroom>${icon('manage')} ${data.classroom ? 'แก้ไขข้อมูลห้อง' : 'ตั้งค่าห้องเรียน'}</button></div><p><strong>${e(data.classroom?.name ?? 'ยังไม่ได้ตั้งชื่อห้อง')}</strong></p><p class="muted">${e(data.classroom?.term ?? 'ยังไม่ได้ระบุภาคเรียน')}</p><p class="notice info" style="margin-top:24px">รุ่นแรกใช้หนึ่งห้อง เริ่มข้อมูลใหม่ และยังไม่ส่งอีเมลแจ้งงาน</p>`;
  return heading + tabs + `<section class="paper manage-section">${content}</section>`;
}

export function bindManage(container: HTMLElement, context: ManageContext): void {
  const { data, repository, refresh, notify } = context;
  container.querySelector('[data-admin-login]')?.addEventListener('click', () => {
    const dialog = openDialog('เข้าสู่ระบบผู้ดูแล', `<form><label class="field"><span>อีเมล</span><input type="email" name="email" autocomplete="username" required /></label><label class="field"><span>รหัสผ่าน</span><input type="password" name="password" autocomplete="current-password" required /></label><div class="form-error" role="alert" hidden></div><div class="form-actions"><button class="button primary" type="submit">เข้าสู่ระบบ</button></div></form>`);
    submitForm(dialog, async values => {
      await repository!.signIn(text(values, 'email'), text(values, 'password'));
      if (!await repository!.adminAccess()) { await repository!.signOut(); throw new Error('บัญชีนี้ยังไม่ได้รับสิทธิ์ผู้ดูแลห้องเรียน'); }
    }, refresh, notify, 'เข้าสู่ระบบผู้ดูแลแล้ว');
  });
  container.querySelector('[data-signout]')?.addEventListener('click', async () => { try { await repository!.signOut(); await refresh(); notify('ออกจากระบบแล้ว'); } catch (error) { notify(message(error)); } });
  container.querySelectorAll<HTMLButtonElement>('[data-manage-tab]').forEach(button => button.addEventListener('click', () => context.setTab(button.dataset.manageTab as ManageTab)));
  container.querySelectorAll<HTMLButtonElement>('[data-add],[data-edit]').forEach(button => button.addEventListener('click', () => editEntity(context, (button.dataset.add || button.dataset.edit) as EntityKind, button.dataset.id)));
  container.querySelectorAll<HTMLButtonElement>('[data-archive]').forEach(button => button.addEventListener('click', () => {
    const kind = button.dataset.archive as EntityKind, id = button.dataset.id!;
    const dialog = openDialog('เก็บรายการเข้าประวัติ', '<form><p>รายการนี้จะไม่แสดงในหน้าติดตามงานปกติ ประวัติที่เกี่ยวข้องยังถูกเก็บไว้</p><div class="form-error" role="alert" hidden></div><div class="form-actions"><button type="button" class="button" data-cancel>ยกเลิก</button><button class="button primary" type="submit">เก็บเข้าประวัติ</button></div></form>');
    dialog.querySelector('[data-cancel]')!.addEventListener('click', () => dialog.close());
    submitForm(dialog, () => repository!.archive(kind, id), refresh, notify, 'เก็บเข้าประวัติแล้ว');
  }));
  container.querySelector('[data-edit-classroom]')?.addEventListener('click', () => {
    const dialog = openDialog('ข้อมูลห้องเรียน', `<form><label class="field"><span>ชื่อห้อง</span><input name="name" maxlength="100" required value="${e(data.classroom?.name ?? '')}" placeholder="ระบุชื่อห้องจริง" /></label><label class="field"><span>ภาคเรียน / ปีการศึกษา</span><input name="term" maxlength="100" value="${e(data.classroom?.term ?? '')}" placeholder="ระบุตามที่ห้องใช้งาน" /></label>${formFooter()}</form>`);
    submitForm(dialog, values => repository!.saveClassroom(text(values, 'name'), text(values, 'term')), refresh, notify);
  });
  container.querySelector('[data-upload-timetable]')?.addEventListener('click', () => uploadTimetable(context));
  container.querySelector('[data-timetable-history]')?.addEventListener('click', async () => {
    try {
      const images = await repository!.timetableHistory(data.classroom!.id);
      const dialog = openDialog('ประวัติรูปตารางสอน', images.length ? `<ul class="data-list">${images.map(image => `<li class="data-row"><div class="data-row-main"><strong>${e(image.title)}</strong><p>${formatDate(image.updatedAt.slice(0, 10))}</p></div><button class="button" data-activate="${e(image.id)}" ${image.id === data.timetable?.id ? 'disabled' : ''}>${image.id === data.timetable?.id ? 'ใช้งานอยู่' : 'ใช้รูปนี้'}</button></li>`).join('')}</ul><p class="form-error" hidden role="alert"></p>` : '<p class="muted">ยังไม่มีประวัติรูป</p>');
      dialog.querySelectorAll<HTMLButtonElement>('[data-activate]').forEach(button => button.addEventListener('click', async () => {
        button.disabled = true;
        try { await repository!.activateTimetable(button.dataset.activate!, data.classroom!.id); dialog.close(); await refresh(); notify('เปลี่ยนรูปตารางสอนแล้ว'); }
        catch (error) { const notice = dialog.querySelector<HTMLElement>('.form-error')!; notice.hidden = false; notice.textContent = message(error); button.disabled = false; }
      }));
    } catch (error) { notify(message(error)); }
  });
  container.querySelector('[data-import]')?.addEventListener('click', () => importRoster(context));
  container.querySelector('[data-roster-template]')?.addEventListener('click', () => downloadFile('student-template.csv', serializeCsv([['เลขที่', 'ชื่อ-นามสกุล', 'รหัสประจำตัว']])));
  container.querySelector('[data-export]')?.addEventListener('click', async event => {
    const button = event.currentTarget as HTMLButtonElement, scope = container.querySelector<HTMLSelectElement>('#report-scope')!.value;
    button.disabled = true;
    try {
      const report = await repository!.load(scope === 'all');
      if (!report.students.length) { notify('ยังไม่มีรายชื่อในขอบเขตที่เลือก'); return; }
      downloadFile(`homework-report-${bangkokToday()}-${scope}.csv`, serializeCsv(reportRows(report)));
    } catch (error) { notify(message(error)); }
    finally { button.disabled = false; }
  });
  const search = container.querySelector<HTMLInputElement>('#manage-search');
  const filterStudents = () => {
    const rows = [...container.querySelectorAll<HTMLElement>('[data-search]')];
    rows.forEach(row => { row.hidden = !row.dataset.search!.includes(search!.value.trim().toLocaleLowerCase('th')); });
    container.querySelector<HTMLElement>('#manage-no-results')!.hidden = rows.some(row => !row.hidden) || !search!.value;
  };
  search?.addEventListener('input', filterStudents);
  container.querySelector('[data-clear-manage-search]')?.addEventListener('click', () => { search!.value = ''; filterStudents(); search!.focus(); });
}

function formFooter(): string { return '<div class="form-error" role="alert" hidden></div><div class="form-actions"><button class="button primary" type="submit">บันทึก</button></div>'; }
function text(values: FormData, key: string): string { return String(values.get(key) ?? '').trim(); }
function message(error: unknown): string { return error instanceof Error ? error.message : 'ทำรายการไม่สำเร็จ กรุณาลองใหม่'; }

function submitForm(dialog: HTMLDialogElement, save: (values: FormData) => Promise<void>, refresh: () => Promise<void>, notify: (message: string) => void, success = 'บันทึกแล้ว'): void {
  const form = dialog.querySelector('form')!;
  let saving = false;
  dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
  dialog.querySelector<HTMLButtonElement>('[data-close]')!.addEventListener('click', event => { if (saving) { event.preventDefault(); event.stopImmediatePropagation(); } }, { capture: true });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (saving || !form.reportValidity()) return;
    const values = new FormData(form), button = form.querySelector<HTMLButtonElement>('[type=submit]')!, original = button.textContent;
    const inputs = [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')].filter(input => !input.disabled);
    const errorBox = form.querySelector<HTMLElement>('.form-error')!;
    saving = true; button.disabled = true; button.textContent = 'กำลังบันทึก…'; errorBox.hidden = true; inputs.forEach(input => { input.disabled = true; });
    try { await save(values); dialog.close(); await refresh(); notify(success); }
    catch (error) { errorBox.textContent = message(error); errorBox.hidden = false; }
    finally { saving = false; button.disabled = false; button.textContent = original; inputs.forEach(input => { input.disabled = false; }); }
  });
}

function editEntity(context: ManageContext, kind: EntityKind, id?: string): void {
  const { data, repository, refresh, notify } = context;
  if (!data.classroom) return;
  const recordId = id || crypto.randomUUID(); // Keep this UUID for every retry of the same form.
  let content = '', title = '';
  const student = data.students.find(item => item.id === id), subject = data.subjects.find(item => item.id === id), task = data.assignments.find(item => item.id === id);
  if (kind === 'students') {
    title = id ? 'แก้ไขนักเรียน' : 'เพิ่มนักเรียน';
    content = `<div class="form-grid"><label class="field"><span>เลขที่</span><input name="number" type="number" min="1" max="2147483647" step="1" required value="${student?.number ?? ''}" /></label><label class="field"><span>รหัสประจำตัว (ถ้ามี)</span><input name="code" maxlength="100" value="${e(student?.studentCode ?? '')}" /></label></div><label class="field"><span>ชื่อ-นามสกุล</span><input name="name" maxlength="200" required value="${e(student?.name ?? '')}" /></label>`;
  } else if (kind === 'subjects') {
    title = id ? 'แก้ไขวิชา' : 'เพิ่มวิชา'; content = `<label class="field"><span>ชื่อวิชา</span><input name="name" maxlength="200" required value="${e(subject?.name ?? '')}" /></label>`;
  } else {
    title = id ? 'แก้ไขงาน' : 'เพิ่มงาน';
    content = `<label class="field"><span>ชื่องาน</span><input name="title" maxlength="300" required value="${e(task?.title ?? '')}" /></label><div class="form-grid"><label class="field"><span>วิชา</span><select name="subject" required>${data.subjects.map(item => `<option value="${e(item.id)}" ${task?.subjectId === item.id ? 'selected' : ''}>${e(item.name)}</option>`).join('')}</select></label><label class="field"><span>ประเภทงาน</span><select name="type">${Object.entries(typeLabels).map(([value, label]) => `<option value="${value}" ${task?.type === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div><div class="form-grid"><label class="field"><span>วันที่มอบหมาย</span><input name="assigned" type="date" value="${e(task?.assignedOn ?? bangkokToday())}" required /></label><label class="field"><span>วันครบกำหนด</span><input name="due" type="date" value="${e(task?.dueDate ?? '')}" required /></label></div><label class="field"><span>รายละเอียด (ถ้ามี)</span><textarea name="description" maxlength="10000">${e(task?.description ?? '')}</textarea></label><label class="field"><span>ลิงก์เอกสารแนบ (ถ้ามี)</span><input name="attachment" type="url" pattern="https?://.*" value="${e(task?.attachmentUrl ?? '')}" placeholder="https://" /></label>`;
  }
  const dialog = openDialog(title, `<form>${content}${formFooter()}</form>`);
  submitForm(dialog, async values => {
    if (kind === 'students') {
      const name = text(values, 'name'), number = Number(values.get('number')), studentCode = text(values, 'code');
      if (!name) throw new Error('กรอกชื่อ-นามสกุล');
      if (data.students.some(item => item.id !== recordId && (item.number === number || (studentCode && item.studentCode === studentCode)))) throw new Error('เลขที่หรือรหัสประจำตัวซ้ำกับนักเรียนในห้อง');
      await repository!.saveStudent({ id: recordId, number, name, studentCode } satisfies Student, data.classroom!.id);
    } else if (kind === 'subjects') {
      const name = text(values, 'name'); if (!name) throw new Error('กรอกชื่อวิชา');
      await repository!.saveSubject({ id: recordId, name } satisfies Subject, data.classroom!.id);
    } else {
      const assignedOn = text(values, 'assigned'), dueDate = text(values, 'due');
      if (calendarDay(assignedOn) > calendarDay(dueDate)) throw new Error('วันที่มอบหมายต้องไม่อยู่หลังวันครบกำหนด');
      if (!text(values, 'title')) throw new Error('กรอกชื่องาน');
      await repository!.saveAssignment({ id: recordId, title: text(values, 'title'), subjectId: text(values, 'subject'), type: text(values, 'type') as Assignment['type'], assignedOn, dueDate, description: text(values, 'description'), attachmentUrl: text(values, 'attachment') || null }, data.classroom!.id);
    }
  }, refresh, notify);
}

export function uploadTimetable(context: ManageContext): void {
  const { data, repository, refresh, notify } = context;
  if (!data.classroom || !repository || !context.admin) return;
  let imageId = crypto.randomUUID(), imageUrl = '', dimensions = { width: 0, height: 0 }, selectedFile: File | null = null;
  const dialog = openDialog('เพิ่มรูปตารางสอน', `<form><p class="field-help">${e(data.classroom.name)} ${e(data.classroom.term)} · เก็บต้นฉบับและรูปเดิมไว้</p><label class="field"><span>รูปตารางสอน</span><input name="image" type="file" accept="image/png,image/jpeg,image/webp" required /><span class="field-help">PNG, JPEG หรือ WebP ไม่เกิน 6 MB</span></label><div id="image-preview" hidden></div><label class="field"><span>ชื่อตาราง</span><input name="title" maxlength="200" required /></label><label class="field"><span>ข้อความประกอบ (ถ้ามี)</span><textarea name="note" maxlength="2000"></textarea></label>${formFooter()}</form>`);
  const input = dialog.querySelector<HTMLInputElement>('[name=image]')!, preview = dialog.querySelector<HTMLElement>('#image-preview')!;
  input.addEventListener('change', async () => {
    const file = input.files?.[0]; selectedFile = null; dimensions = { width: 0, height: 0 }; imageId = crypto.randomUUID();
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    preview.hidden = true;
    if (!file) return;
    const errorBox = dialog.querySelector<HTMLElement>('.form-error')!;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 6 * 1024 * 1024 || file.size === 0) { errorBox.hidden = false; errorBox.textContent = 'เลือกไฟล์ PNG, JPEG หรือ WebP ขนาดไม่เกิน 6 MB'; return; }
    imageUrl = URL.createObjectURL(file); const currentUrl = imageUrl, image = new Image(); image.src = currentUrl;
    try {
      await image.decode(); if (currentUrl !== imageUrl || !dialog.isConnected) return;
      selectedFile = file; dimensions = { width: image.naturalWidth, height: image.naturalHeight }; errorBox.hidden = true;
      preview.innerHTML = `<img class="preview-image" src="${e(imageUrl)}" alt="ตัวอย่างรูปที่เลือกก่อนอัปโหลด" /><p class="field-help">${e(file.name)} · ${dimensions.width} × ${dimensions.height} px · ${(file.size / 1024 / 1024).toFixed(2)} MB</p>`; preview.hidden = false;
    } catch { errorBox.hidden = false; errorBox.textContent = 'เปิดไฟล์รูปนี้ไม่ได้ กรุณาเลือกไฟล์ใหม่'; }
  });
  dialog.addEventListener('close', () => { if (imageUrl) URL.revokeObjectURL(imageUrl); });
  submitForm(dialog, async values => {
    if (!selectedFile || !dimensions.width) throw new Error('รอภาพตัวอย่าง หรือเลือกไฟล์ภาพที่เปิดได้ก่อนบันทึก');
    const title = text(values, 'title'); if (!title) throw new Error('กรอกชื่อตาราง');
    await repository.uploadTimetable(selectedFile, { title, note: text(values, 'note'), ...dimensions }, data.classroom!.id, imageId);
  }, refresh, notify, 'เพิ่มรูปตารางสอนแล้ว');
}

function importRoster(context: ManageContext): void {
  const { data, repository, notify, refresh } = context;
  let batchId = crypto.randomUUID(), rows: ReturnType<typeof validateRoster>['rows'] = [];
  const dialog = openDialog('นำเข้ารายชื่อนักเรียน', `<form><label class="field"><span>ไฟล์ CSV</span><input name="csv" type="file" accept=".csv,text/csv" required /></label><p class="field-help">คอลัมน์: เลขที่, ชื่อ-นามสกุล, รหัสประจำตัว · ไม่เกิน 1,000 คนต่อไฟล์</p><div id="csv-preview"></div>${formFooter()}</form>`);
  const input = dialog.querySelector<HTMLInputElement>('[name=csv]')!, button = dialog.querySelector<HTMLButtonElement>('[type=submit]')!;
  button.disabled = true;
  let readGeneration = 0;
  input.addEventListener('change', async () => {
    const generation = ++readGeneration; batchId = crypto.randomUUID(); rows = []; button.disabled = true;
    const file = input.files?.[0]; if (!file) return;
    const preview = dialog.querySelector<HTMLElement>('#csv-preview')!;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('ไฟล์ CSV ต้องไม่เกิน 2 MB');
      const source = await file.text(); if (generation !== readGeneration) return;
      const result = validateRoster(parseCsv(source));
      for (const row of result.rows) if (data.students.some(student => student.number === row.number || (row.studentCode && student.studentCode === row.studentCode))) result.errors.push(`เลขที่ ${row.number}: ซ้ำกับนักเรียนที่มีอยู่ในห้อง`);
      if (!result.rows.length) result.errors.push('ไม่มีรายชื่อในไฟล์');
      if (result.rows.length > 1000) result.errors.push('นำเข้าได้ไม่เกิน 1,000 คนต่อไฟล์');
      rows = result.rows;
      preview.innerHTML = `<p><strong>พบ ${rows.length} คน</strong> · ${result.errors.length ? 'มีรายการที่ต้องแก้ไข' : 'พร้อมนำเข้า'}</p><div class="csv-preview"><table><thead><tr><th>เลขที่</th><th>ชื่อ-นามสกุล</th><th>รหัส</th></tr></thead><tbody>${rows.slice(0, 50).map(row => `<tr><td>${row.number}</td><td>${e(row.name)}</td><td>${e(row.studentCode)}</td></tr>`).join('')}</tbody></table></div>${rows.length > 50 ? '<p class="field-help">แสดงตัวอย่าง 50 คนแรก จำนวนที่จะนำเข้าแสดงด้านบน</p>' : ''}${result.errors.length ? `<div class="notice error"><ul>${result.errors.map(error => `<li>${e(error)}</li>`).join('')}</ul></div>` : ''}`;
      button.disabled = result.errors.length > 0;
      button.textContent = `ยืนยันนำเข้า ${rows.length} คน`;
    } catch (error) { preview.innerHTML = `<p class="notice error">${e(message(error))}</p>`; }
  });
  submitForm(dialog, () => repository!.importStudents(rows, batchId, data.classroom!.id), refresh, notify, 'นำเข้ารายชื่อแล้ว');
}
