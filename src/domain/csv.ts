export function serializeCsv(rows: string[][]): string {
  return '\uFEFF' + rows.map(row => row.map(value => value === '' || /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value).join(',')).join('\r\n');
}

export function parseCsv(source: string): string[][] {
  const text = source.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false, closed = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === ',') { row.push(field); field = ''; closed = false; }
    else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(field); rows.push(row); row = []; field = ''; closed = false;
    } else if (char === '"' && field === '' && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error('รูปแบบเครื่องหมายคำพูดใน CSV ไม่ถูกต้อง');
      field += char;
    }
  }
  if (quoted) throw new Error('เครื่องหมายคำพูดใน CSV ปิดไม่ครบ');
  if (field !== '' || row.length || closed) { row.push(field); rows.push(row); }
  return rows;
}

export interface RosterRow { number: number; name: string; studentCode: string }
export function validateRoster(csv: string[][]): { rows: RosterRow[]; errors: string[] } {
  const headers = csv[0] ?? [];
  const required = ['เลขที่', 'ชื่อ-นามสกุล', 'รหัสประจำตัว'];
  const indices = required.map(header => headers.indexOf(header));
  if (indices.includes(-1)) return { rows: [], errors: [`ต้องมีคอลัมน์ ${required.join(', ')}`] };
  const rows: RosterRow[] = [], errors: string[] = [], numbers = new Set<number>(), codes = new Set<string>();
  csv.slice(1).forEach((row, index) => {
    if (row.every(cell => !cell.trim())) return;
    const rawNumber = (row[indices[0]] ?? '').trim();
    const number = Number(rawNumber), name = (row[indices[1]] ?? '').trim(), studentCode = (row[indices[2]] ?? '').trim();
    const line = `แถว ${index + 2}`;
    if (!/^\d+$/.test(rawNumber) || !Number.isSafeInteger(number) || number < 1) errors.push(`${line}: เลขที่ต้องเป็นจำนวนเต็มมากกว่า 0`);
    if (!name) errors.push(`${line}: ยังไม่มีชื่อ-นามสกุล`);
    if (numbers.has(number)) errors.push(`${line}: เลขที่ ${number} ซ้ำ`);
    if (studentCode && codes.has(studentCode)) errors.push(`${line}: รหัสประจำตัว ${studentCode} ซ้ำ`);
    numbers.add(number); if (studentCode) codes.add(studentCode);
    rows.push({ number, name, studentCode });
  });
  return { rows, errors };
}
