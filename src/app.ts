import { bangkokToday, formatDate } from './domain/dates';
import { calculateProgress, statusFor } from './domain/progress';
import { emptyData, statusLabels } from './domain/types';
import type { ClassroomData, Filters, Status, View } from './domain/types';
import { createRepository } from './data/repository';
import type { Repository } from './data/repository';
import { emptyState, escapeHtml as e, icon } from './shared/html';
import { openDialog } from './shared/dialog';
import { progressMarkup, taskFilters, taskList } from './features/tasks';
import { bindTimetable, timetableView } from './features/timetable';
import { bindOverview, overviewView, weeklySummary } from './features/overview';
import { bindManage, manageView, uploadTimetable } from './features/manage';
import type { ManageContext, ManageTab } from './features/manage';

const views: Record<View, { label: string; icon: Parameters<typeof icon>[0] }> = {
  tasks: { label: 'งาน', icon: 'tasks' }, timetable: { label: 'ตารางสอน', icon: 'calendar' }, students: { label: 'รายชื่อ', icon: 'students' }, overview: { label: 'ภาพรวม', icon: 'overview' }, manage: { label: 'จัดการ', icon: 'manage' }, more: { label: 'เพิ่มเติม', icon: 'more' },
};
const initialFilters = (): Filters => ({ completion: 'pending', subjectId: '', type: '', due: '', search: '' });

export function startApp(root: HTMLElement): void {
  let data: ClassroomData = emptyData(), repository: Repository | null = null, admin = false;
  let view: View = 'tasks', studentId = '', loading = true, loadError = '', studentSearch = '', today = bangkokToday();
  let filters = initialFilters(), manageTab: ManageTab = 'students', loadGeneration = 0, loaded = false;
  const assignmentFilters: ManageContext['assignmentFilters'] = { search: '', subjectId: '', due: '' };
  let followUpDue = '';
  let realtimeReady = false, refreshTimer: ReturnType<typeof setTimeout> | undefined, deferredRefresh = false;
  const scrollPositions = new Map<View, number>(), saving = new Set<string>();

  function link(target: View, selectedStudent = studentId): string {
    const url = new URL(location.href); url.searchParams.set('view', target);
    if (selectedStudent) url.searchParams.set('student', selectedStudent); else url.searchParams.delete('student');
    return url.pathname + url.search;
  }
  function nav(target: View, mobile = false): string {
    const current = mobile && ['students', 'manage'].includes(view) ? 'more' : view;
    return `<a class="nav-link" data-view="${target}" href="${e(link(target))}" ${current === target ? 'aria-current="page"' : ''}>${icon(views[target].icon)}<span>${views[target].label}</span></a>`;
  }
  function readRoute() {
    const params = new URLSearchParams(location.search), value = params.get('view') ?? 'tasks';
    view = Object.hasOwn(views, value) ? value as View : 'tasks'; studentId = params.get('student') ?? '';
  }
  function navigate(target: View, selected = studentId) {
    scrollPositions.set(view, window.scrollY);
    history.pushState(null, '', link(target, selected)); readRoute(); renderContent();
    window.scrollTo(0, scrollPositions.get(target) ?? 0);
    root.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }
  function notify(message: string) {
    const toast = root.querySelector<HTMLElement>('#notice-live')!;
    toast.textContent = message; toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; toast.textContent = ''; }, 6500);
  }
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function context(): ManageContext { return { data, repository, admin, tab: manageTab, assignmentFilters, notify, refresh, setTab: tab => { manageTab = tab; renderContent(); } }; }
  function classroomContext(): void {
    root.querySelector<HTMLElement>('#classroom-context')!.innerHTML = data.classroom ? `<strong>${e(data.classroom.name)}</strong><span>${e(data.classroom.term)}</span>` : '<span>ยังไม่ได้ตั้งค่าห้องเรียน</span>';
    const connection = root.querySelector<HTMLElement>('#connection')!;
    connection.textContent = !navigator.onLine ? 'ออฟไลน์' : loadError ? 'โหลดไม่สำเร็จ' : !repository ? 'ยังไม่เชื่อมข้อมูล' : loading ? 'กำลังโหลด…' : repository.fixture ? 'ข้อมูลทดสอบ' : realtimeReady ? 'เชื่อมต่อแล้ว' : 'ข้อมูลอาจยังไม่อัปเดต';
    connection.className = `connection ${repository && !loadError && navigator.onLine && (realtimeReady || repository.fixture) ? 'ready' : ''} ${loadError || !navigator.onLine ? 'offline' : ''}`;
    root.querySelector<HTMLElement>('#offline-notice')!.hidden = !loaded || (!loadError && navigator.onLine);
  }

  function studentsMarkup(prefix: string): string {
    return `<div class="sidebar-heading"><h2>นักเรียนในห้อง</h2><span class="count">${data.students.length} คน</span></div><div class="student-search"><label class="sr-only" for="${prefix}-search">ค้นหานักเรียน ชื่อ เลขที่ หรือรหัส</label><div class="search-wrap">${icon('search')}<input id="${prefix}-search" data-student-search type="search" placeholder="ค้นหาชื่อ / เลขที่" value="${e(studentSearch)}" autocomplete="off" /></div></div><div class="student-list" data-student-list>${studentList()}</div><div class="sidebar-footer">เลือกชื่อเพื่อดูและบันทึกสถานะงาน</div>`;
  }
  function studentList(): string {
    const search = studentSearch.trim().toLocaleLowerCase('th');
    const students = data.students.filter(student => `${student.name} ${student.number} ${student.studentCode}`.toLocaleLowerCase('th').includes(search));
    if (!students.length) return `<div class="sidebar-empty">${icon(search ? 'search' : 'students', 28)}<p>${search ? 'ไม่พบนักเรียนที่ตรงกับคำค้น' : 'ยังไม่มีรายชื่อนักเรียน'}</p>${search ? '<button class="button quiet" data-clear-search>ล้างคำค้น</button>' : '<p class="field-help">ผู้ดูแลเพิ่มรายชื่อได้จากหน้าจัดการ</p>'}</div>`;
    return students.map(student => {
      const progress = calculateProgress(data.assignments, data.submissions, student.id);
      return `<button class="student-choice" data-student="${e(student.id)}" aria-pressed="${studentId === student.id}"><span class="student-number">${student.number}</span><span style="flex:1;min-width:0"><span class="student-name">${e(student.name)}</span><span class="student-meta" data-student-progress="${e(student.id)}">${progress.percent === null ? 'ยังไม่มีงานบังคับ' : `งานบังคับครบ ${progress.completed}/${progress.required}`}</span>${progress.percent !== null ? `<span class="student-mini-progress" aria-hidden="true"><span style="width:${progress.percent}%"></span></span>` : ''}</span></button>`;
    }).join('');
  }
  function bindStudents(container: HTMLElement, dialog?: HTMLDialogElement): void {
    container.querySelectorAll<HTMLButtonElement>('[data-student]').forEach(button => button.addEventListener('click', () => {
      dialog?.close(); filters = initialFilters(); navigate('tasks', button.dataset.student!);
    }));
    const search = container.querySelector<HTMLInputElement>('[data-student-search]');
    search?.addEventListener('input', () => {
      studentSearch = search.value;
      container.querySelector('[data-student-list]')!.innerHTML = studentList();
      bindStudentList(container, dialog);
    });
    container.querySelector('[data-clear-search]')?.addEventListener('click', () => { studentSearch = ''; search!.value = ''; container.querySelector('[data-student-list]')!.innerHTML = studentList(); bindStudentList(container, dialog); search!.focus(); });
  }
  function bindStudentList(container: HTMLElement, dialog?: HTMLDialogElement) {
    const list = container.querySelector<HTMLElement>('[data-student-list]')!;
    list.querySelectorAll<HTMLButtonElement>('[data-student]').forEach(button => button.addEventListener('click', () => { dialog?.close(); filters = initialFilters(); navigate('tasks', button.dataset.student!); }));
    list.querySelector('[data-clear-search]')?.addEventListener('click', () => {
      studentSearch = ''; const search = container.querySelector<HTMLInputElement>('[data-student-search]')!; search.value = ''; list.innerHTML = studentList(); bindStudentList(container, dialog); search.focus();
    });
  }
  function openStudentPicker() {
    const dialog = openDialog('เลือกนักเรียน', studentsMarkup('picker'));
    bindStudents(dialog, dialog); dialog.querySelector<HTMLInputElement>('[data-student-search]')?.focus();
  }

  function renderContent() {
    const priorArea = root.querySelector<HTMLElement>('#page-content')!;
    const priorFocus = document.activeElement instanceof HTMLElement && priorArea.contains(document.activeElement) ? document.activeElement : null;
    const focusId = priorFocus?.id;
    const focusAttributes = priorFocus ? [...priorFocus.attributes].filter(attribute => attribute.name.startsWith('data-') && attribute.name !== 'data-bound') : [];
    const focusSelector = focusId ? `#${CSS.escape(focusId)}` : focusAttributes.length ? `${priorFocus!.tagName.toLowerCase()}${focusAttributes.map(attribute => `[${attribute.name}="${CSS.escape(attribute.value)}"]`).join('')}` : '';
    const priorValue = priorFocus instanceof HTMLInputElement ? priorFocus.value : null;
    const priorSelection = priorFocus instanceof HTMLInputElement ? priorFocus.selectionStart : null;
    document.title = `${views[view].label} — HomeWork Station`;
    root.querySelectorAll<HTMLAnchorElement>('[data-view]').forEach(anchor => {
      const target = anchor.dataset.view as View, current = anchor.closest('.mobile-nav') && ['students', 'manage'].includes(view) ? 'more' : view;
      anchor.href = link(target); if (current === target) anchor.setAttribute('aria-current', 'page'); else anchor.removeAttribute('aria-current');
    });
    classroomContext();
    const area = root.querySelector<HTMLElement>('#page-content')!;
    if (loading && !loaded) { area.innerHTML = '<h1 tabindex="-1">กำลังเปิดห้องเรียน</h1><div class="paper skeleton" role="status" aria-label="กำลังโหลดข้อมูล"><span></span><span></span><span></span><p class="muted">กำลังโหลดข้อมูล…</p></div>'; return; }
    if (loadError && !loaded) {
      area.innerHTML = `<h1 tabindex="-1">เปิดข้อมูลไม่สำเร็จ</h1><div class="paper">${emptyState('โหลดข้อมูลไม่สำเร็จ', loadError, 'alert', '<button class="button primary" data-retry-load>ลองใหม่</button>')}</div>`;
      area.querySelector('[data-retry-load]')!.addEventListener('click', () => { void refresh(); }); return;
    }
    let content = '';
    const student = data.students.find(item => item.id === studentId);
    if (view === 'tasks') {
      const mobile = `<div class="mobile-student"><div><small>นักเรียนที่เลือก</small><strong>${e(student?.name ?? 'ยังไม่ได้เลือกนักเรียน')}</strong></div><button class="button" data-select-student>${student ? 'เปลี่ยน' : 'เลือกชื่อ'}</button></div>`;
      const heading = `<div class="page-heading"><div><h1>${student ? 'งานของคุณ' : 'งานของห้องเรียน'}</h1><p>${student ? `${e(student.name)} · เลขที่ ${student.number}` : 'ดูสิ่งที่ต้องทำ แล้วค่อย ๆ ทำให้ครบ'}</p></div><a class="button" data-view="timetable" href="${e(link('timetable'))}">${icon('calendar')} ตารางสอน</a></div>`;
      let body: string;
      if (!student) body = `<div class="paper">${emptyState(studentId ? 'ไม่พบชื่อนักเรียนนี้แล้ว' : data.students.length ? 'เลือกนักเรียนเพื่อดูงานของคุณ' : 'ห้องเรียนกำลังรอรายชื่อ', studentId ? 'รายชื่อนี้อาจถูกเก็บเข้าประวัติ เลือกชื่ออื่นเพื่อดูงานต่อได้' : data.students.length ? 'ดูงานที่ยังไม่ครบ วันกำหนดส่ง และบันทึกความคืบหน้าของคุณ' : 'เมื่อผู้ดูแลเพิ่มนักเรียนและงานแล้ว จะเลือกชื่อเพื่อติดตามงานได้จากหน้านี้', 'tasks', data.students.length ? '<button class="button primary" data-select-student>เลือกนักเรียน</button>' : `<a class="button primary" data-view="manage" href="${e(link('manage'))}">${icon('plus')} เริ่มตั้งค่าห้องเรียน</a>`)}<div class="blank-lines" aria-hidden="true"><i></i><i></i><i></i></div></div><p class="task-intro">${icon('calendar', 18)} เปิดตารางสอนได้ทันที แม้ยังไม่ได้เลือกนักเรียน</p>`;
      else body = `<div id="student-progress">${progressMarkup(data, student.id)}</div><div id="task-filters">${taskFilters(data, filters)}</div><div id="task-list">${taskList(data, student.id, filters, today)}</div>`;
      content = `<div class="work-layout"><aside class="student-sidebar" aria-label="รายชื่อนักเรียน">${studentsMarkup('sidebar')}</aside><section class="task-main">${mobile}${heading}${body}</section></div>`;
    } else if (view === 'timetable') content = timetableView(data, admin);
    else if (view === 'overview') content = overviewView(data, today, followUpDue);
    else if (view === 'manage') content = manageView(context());
    else if (view === 'students') content = `<div class="page-heading"><div><h1>รายชื่อนักเรียน</h1><p>เลือกชื่อเพื่อเปิดดูงานและความคืบหน้า</p></div></div><div class="paper" style="max-width:640px">${studentsMarkup('roster')}</div>`;
    else content = `<div class="page-heading"><div><h1>เพิ่มเติม</h1><p>รายชื่อและเครื่องมือของห้องเรียน</p></div></div><div class="paper more-links"><a data-view="students" href="${e(link('students'))}"><span>${icon('students')} รายชื่อนักเรียน</span>${icon('arrow')}</a><a data-view="manage" href="${e(link('manage'))}"><span>${icon('manage')} จัดการห้องเรียน</span>${icon('arrow')}</a></div>`;
    area.innerHTML = content;
    area.querySelectorAll('h1').forEach(heading => heading.setAttribute('tabindex', '-1'));
    area.querySelectorAll('[data-select-student]').forEach(button => button.addEventListener('click', openStudentPicker));
    if (view === 'tasks' || view === 'students') bindStudents(area);
    if (view === 'tasks' && student) { bindTaskFilters(); bindStatuses(); }
    if (view === 'overview') bindOverview(area, data, today, value => { followUpDue = value; });
    if (view === 'timetable') {
      bindTimetable(area, data, notify);
      area.querySelector('[data-upload-timetable]')?.addEventListener('click', () => uploadTimetable(context()));
    }
    if (view === 'manage') { bindManage(area, context()); area.querySelector('[data-setup]')?.addEventListener('click', openSetup); }
    area.querySelector('[data-copy-week]')?.addEventListener('click', async () => {
      const summary = weeklySummary(data, today);
      try { if (!navigator.clipboard?.writeText) throw new Error(); await navigator.clipboard.writeText(summary); notify('คัดลอกสรุปแล้ว'); }
      catch { openDialog('คัดลอกสรุปงาน', `<p class="field-help">เลือกข้อความด้านล่างแล้วคัดลอกได้</p><label class="field"><span>สรุปประจำสัปดาห์</span><textarea readonly rows="10">${e(summary)}</textarea></label>`); }
    });
    if (priorFocus) {
      const nextFocus = focusSelector ? area.querySelector<HTMLElement>(focusSelector) : null;
      if (nextFocus instanceof HTMLInputElement && priorValue !== null) {
        nextFocus.value = priorValue; nextFocus.dispatchEvent(new Event('input'));
        if (priorSelection !== null) nextFocus.setSelectionRange(priorSelection, priorSelection);
      }
      (nextFocus ?? area.querySelector<HTMLElement>('h1'))?.focus({ preventScroll: true });
    }
  }

  function bindTaskFilters() {
    root.querySelector<HTMLInputElement>('#filter-search')?.addEventListener('input', event => {
      filters.search = (event.target as HTMLInputElement).value.trim(); updateTasks();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-completion]').forEach(button => button.addEventListener('click', () => {
      filters.completion = button.dataset.completion as Filters['completion'];
      root.querySelectorAll<HTMLButtonElement>('[data-completion]').forEach(item => item.setAttribute('aria-pressed', String(item === button))); updateTasks();
    }));
    for (const [id, property] of [['filter-subject', 'subjectId'], ['filter-type', 'type'], ['filter-due', 'due']] as const) {
      root.querySelector<HTMLSelectElement>(`#${id}`)?.addEventListener('change', event => { (filters[property] as string) = (event.target as HTMLSelectElement).value; updateTasks(); });
    }
    root.querySelector('#task-filters [data-reset-filters]')?.addEventListener('click', resetFilters);
  }
  function resetFilters() {
    filters = { ...initialFilters(), completion: 'all' };
    root.querySelector('#task-filters')!.innerHTML = taskFilters(data, filters); bindTaskFilters(); updateTasks();
    root.querySelector<HTMLButtonElement>('[data-completion="all"]')!.focus();
  }
  function updateTasks() {
    const container = root.querySelector<HTMLElement>('#task-list'); if (!container) return;
    const active = document.activeElement as HTMLElement | null;
    const activeTask = active?.getAttribute('data-status');
    const desired = document.createElement('div'); desired.innerHTML = taskList(data, studentId, filters, today);
    const groups = [...desired.querySelectorAll<HTMLElement>('[data-group]')];
    if (!groups.length) container.replaceChildren(...desired.childNodes);
    else {
      container.querySelectorAll(':scope > :not([data-group])').forEach(node => node.remove());
      const keepCards = new Set<string>(), keepGroups = new Set<string>();
      let previousGroup: HTMLElement | null = null;
      for (const freshGroup of groups) {
        const key = freshGroup.dataset.group!; keepGroups.add(key);
        let currentGroup = container.querySelector<HTMLElement>(`[data-group="${CSS.escape(key)}"]`);
        if (!currentGroup) { currentGroup = freshGroup.cloneNode(false) as HTMLElement; currentGroup.append(freshGroup.querySelector('h2')!.cloneNode(true)); }
        else currentGroup.querySelector('h2')!.innerHTML = freshGroup.querySelector('h2')!.innerHTML;
        const reference: ChildNode | null = previousGroup ? previousGroup.nextSibling : container.firstChild;
        if (reference !== currentGroup) container.insertBefore(currentGroup, reference);
        previousGroup = currentGroup;
        let previousCard: HTMLElement | null = null;
        for (const freshCard of freshGroup.querySelectorAll<HTMLElement>('[data-task]')) {
          const id = freshCard.dataset.task!; keepCards.add(id);
          let currentCard = container.querySelector<HTMLElement>(`[data-task="${CSS.escape(id)}"]`);
          if (!currentCard) currentCard = freshCard;
          else {
            currentCard.className = freshCard.className;
            const currentSelect = currentCard.querySelector<HTMLSelectElement>('[data-status]')!, freshSelect = freshCard.querySelector<HTMLSelectElement>('[data-status]')!;
            currentSelect.value = freshSelect.value; currentSelect.className = freshSelect.className;
            currentCard.querySelector('.task-due')!.innerHTML = freshCard.querySelector('.task-due')!.innerHTML;
          }
          const cardReference: ChildNode | null = previousCard ? previousCard.nextSibling : currentGroup.querySelector('h2')!.nextSibling;
          if (cardReference !== currentCard) currentGroup.insertBefore(currentCard, cardReference);
          previousCard = currentCard;
        }
      }
      container.querySelectorAll<HTMLElement>('[data-task]').forEach(card => { if (!keepCards.has(card.dataset.task!)) card.remove(); });
      container.querySelectorAll<HTMLElement>('[data-group]').forEach(group => { if (!keepGroups.has(group.dataset.group!)) group.remove(); });
    }
    bindStatuses();
    container.querySelector('[data-reset-filters]')?.addEventListener('click', resetFilters);
    if (activeTask) (container.querySelector<HTMLSelectElement>(`[data-status="${CSS.escape(activeTask)}"]`) ?? root.querySelector<HTMLButtonElement>('[data-completion][aria-pressed=true]'))?.focus({ preventScroll: true });
    root.querySelector('#student-progress')!.innerHTML = progressMarkup(data, studentId);
    root.querySelectorAll<HTMLElement>('[data-student-progress]').forEach(element => {
      const progress = calculateProgress(data.assignments, data.submissions, element.dataset.studentProgress!);
      element.textContent = progress.percent === null ? 'ยังไม่มีงานบังคับ' : `งานบังคับครบ ${progress.completed}/${progress.required}`;
      const bar = element.parentElement?.querySelector<HTMLElement>('.student-mini-progress span'); if (bar) bar.style.width = `${progress.percent ?? 0}%`;
    });
  }
  function bindStatuses() {
    root.querySelectorAll<HTMLSelectElement>('[data-status]').forEach(select => {
      const assignmentId = select.dataset.status!, selectedStudent = studentId, key = `${studentId}:${assignmentId}`;
      select.disabled = saving.has(key);
      if (select.dataset.bound) return;
      select.dataset.bound = 'true';
      select.addEventListener('change', async () => {
        if (saving.has(key) || !repository) return;
        const previous = statusFor(data.submissions, selectedStudent, assignmentId), next = select.value as Status;
        const version = data.submissions.find(item => item.studentId === selectedStudent && item.assignmentId === assignmentId)?.version ?? 0;
        const hadFocus = document.activeElement === select;
        select.disabled = true; select.setAttribute('aria-busy', 'true'); saving.add(key);
        try {
          await repository.setStatus(selectedStudent, assignmentId, next, version);
          await refresh(false); notify(`บันทึกสถานะ “${statusLabels[next]}” แล้ว`);
        } catch (error) {
          select.value = previous; notify(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่');
          await refresh(false);
        } finally {
          saving.delete(key);
          if (select.isConnected) { select.disabled = false; select.removeAttribute('aria-busy'); }
          root.querySelectorAll<HTMLSelectElement>(`[data-status="${CSS.escape(assignmentId)}"]`).forEach(item => { item.disabled = saving.has(`${studentId}:${assignmentId}`); });
          if (hadFocus && selectedStudent === studentId && view === 'tasks' && (document.activeElement === document.body || document.activeElement === select)) {
            (root.querySelector<HTMLSelectElement>(`[data-status="${CSS.escape(assignmentId)}"]`) ?? root.querySelector<HTMLButtonElement>('[data-completion][aria-pressed=true]'))?.focus({ preventScroll: true });
          }
        }
      });
    });
  }
  async function refresh(rebuild = true): Promise<void> {
    if (!repository) { loading = false; loaded = true; renderContent(); return; }
    const generation = ++loadGeneration;
    loading = true; loadError = ''; classroomContext();
    try {
      const [next, access] = await Promise.all([repository.load(), repository.adminAccess()]);
      if (generation !== loadGeneration) return;
      const priorStudent = studentId, priorAssignments = data.assignments, priorStudents = data.students, priorSubjects = data.subjects;
      data = next; admin = access; loaded = true; loading = false;
      if (filters.subjectId && !data.subjects.some(subject => subject.id === filters.subjectId)) filters.subjectId = '';
      if (studentId && !data.students.some(student => student.id === studentId)) {
        studentId = ''; history.replaceState(null, '', link(view, '')); notify('นักเรียนที่เลือกไม่อยู่ในรายชื่อปัจจุบัน กรุณาเลือกชื่อใหม่'); rebuild = true;
      }
      const sameStructure = JSON.stringify(priorAssignments) === JSON.stringify(data.assignments) && JSON.stringify(priorStudents) === JSON.stringify(data.students) && JSON.stringify(priorSubjects) === JSON.stringify(data.subjects);
      if ((!rebuild || sameStructure) && view === 'tasks' && priorStudent === studentId && root.querySelector('#task-list')) { updateTasks(); classroomContext(); }
      else renderContent();
    } catch (error) {
      if (generation !== loadGeneration) return;
      loadError = error instanceof Error ? error.message : 'ตรวจการเชื่อมต่อแล้วลองใหม่'; loading = false;
      if (!loaded) renderContent(); else { classroomContext(); notify(`ข้อมูลอาจยังไม่อัปเดต: ${loadError}`); }
    }
  }
  function scheduleRefresh() {
    if (document.querySelector('dialog[open]')) { deferredRefresh = true; return; }
    clearTimeout(refreshTimer); refreshTimer = setTimeout(() => { void refresh(); }, 250);
  }
  function openSetup() {
    openDialog('เชื่อมต่อห้องเรียน', '<ol class="setup-steps"><li>สร้างโปรเจกต์ Supabase แล้วใช้ไฟล์ migration ที่เตรียมไว้</li><li>ตั้งค่า URL และ publishable key ในไฟล์ .env ตาม .env.example</li><li>เพิ่มบัญชีผู้ดูแลตาม README แล้วเปิดเว็บใหม่</li><li>เข้าสู่ระบบผู้ดูแล ตั้งชื่อห้อง เพิ่มวิชาและนักเรียน แล้วเริ่มเพิ่มงาน</li></ol><p class="field-help">ขั้นตอนสำหรับผู้ดูแลระบบอยู่ใน README.md ของโปรเจกต์</p>');
  }

  readRoute();
  root.innerHTML = `<a class="skip-link" href="#main">ข้ามไปเนื้อหาหลัก</a><header class="topbar"><div class="topbar-inner"><a class="brand" href="${e(link('tasks'))}" data-view="tasks" aria-label="HomeWork Station หน้างาน"><span class="brand-mark">${icon('book', 24)}</span><span class="brand-name">HomeWork Station<span class="brand-subtitle">สมุดงานประจำห้องเรียน</span></span></a><nav class="desktop-nav" aria-label="เมนูหลัก">${(['tasks', 'timetable', 'students', 'overview', 'manage'] as View[]).map(target => nav(target)).join('')}</nav></div></header><main class="workspace" id="main" tabindex="-1"><div class="context-line"><div class="classroom-tag" id="classroom-context"></div><time datetime="${today}">${formatDate(today)}</time><span class="connection" id="connection"></span></div><div class="notice info" id="fixture-notice" hidden>${icon('alert')} ข้อมูลทดสอบสำหรับตรวจหน้าจอ ไม่ใช่ข้อมูลห้องเรียนจริง</div><div class="notice error" id="offline-notice" hidden>ข้อมูลอาจยังไม่อัปเดต ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่ <button class="button" data-retry>ลองใหม่</button></div><div id="page-content"></div></main><nav class="mobile-nav" aria-label="เมนูมือถือ">${(['tasks', 'timetable', 'overview', 'more'] as View[]).map(target => nav(target, true)).join('')}</nav><div class="toast" id="notice-live" role="status" aria-live="polite" hidden></div>`;
  root.addEventListener('click', event => {
    const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-view]');
    if (anchor && !(event as MouseEvent).ctrlKey && !(event as MouseEvent).metaKey && !(event as MouseEvent).shiftKey && (event as MouseEvent).button === 0) { event.preventDefault(); navigate(anchor.dataset.view as View); }
  });
  root.querySelector('[data-retry]')!.addEventListener('click', () => { void refresh(); });
  window.addEventListener('popstate', () => { readRoute(); renderContent(); window.scrollTo(0, scrollPositions.get(view) ?? 0); });
  const freshness = () => {
    const next = bangkokToday();
    if (today !== next) { today = next; const time = root.querySelector('time')!; time.dateTime = today; time.textContent = formatDate(today); renderContent(); }
    root.querySelector<HTMLElement>('#offline-notice')!.hidden = navigator.onLine;
    classroomContext(); if (repository && navigator.onLine && document.visibilityState === 'visible') scheduleRefresh();
  };
  window.addEventListener('online', freshness); window.addEventListener('offline', freshness);
  document.addEventListener('visibilitychange', freshness);
  setInterval(() => { if (bangkokToday() !== today) freshness(); }, 30_000);
  document.addEventListener('close', () => { if (deferredRefresh) { deferredRefresh = false; scheduleRefresh(); } }, true);
  renderContent();
  void (async () => {
    try {
      repository = await createRepository();
      root.querySelector<HTMLElement>('#fixture-notice')!.hidden = !repository?.fixture;
      await refresh();
      repository?.subscribe(scheduleRefresh, ready => { realtimeReady = ready; classroomContext(); });
    } catch (error) { loading = false; loadError = error instanceof Error ? error.message : 'เริ่มระบบไม่สำเร็จ'; renderContent(); }
  })();
}
