const dayMilliseconds = 86_400_000;
const thaiDate = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function bangkokToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}

export function calendarDay(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('วันที่ต้องเป็น YYYY-MM-DD');
  // UTC is used only for calendar arithmetic, never to determine the user's current day.
  const milliseconds = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 10) !== value) throw new Error('วันที่ไม่ถูกต้อง');
  return milliseconds / dayMilliseconds;
}

export function formatDate(value: string): string { return thaiDate.format(new Date(calendarDay(value) * dayMilliseconds)); }

export function dueLabel(dueDate: string, today = bangkokToday()): { text: string; overdue: boolean } {
  const difference = calendarDay(dueDate) - calendarDay(today);
  if (difference < 0) return { text: `เกินกำหนด ${-difference} วัน`, overdue: true };
  return { text: difference === 0 ? 'วันนี้' : difference === 1 ? 'พรุ่งนี้' : `อีก ${difference} วัน`, overdue: false };
}

export function weekRange(today = bangkokToday()): { start: string; end: string } {
  const day = calendarDay(today);
  const weekday = new Date(day * dayMilliseconds).getUTCDay();
  const monday = day - (weekday + 6) % 7;
  return { start: new Date(monday * dayMilliseconds).toISOString().slice(0, 10), end: new Date((monday + 6) * dayMilliseconds).toISOString().slice(0, 10) };
}
