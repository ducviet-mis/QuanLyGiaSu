import { z } from 'zod';
import type { Invoice, Payment, TeachingSession, WorkspaceData } from './types';

z.config(z.locales.vi());

export const newId = () => crypto.randomUUID();
export const today = () => { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const part = (type: string) => parts.find(p => p.type === type)!.value; return `${part('year')}-${part('month')}-${part('day')}`; };
export const currentMonth = () => today().slice(0, 7);
export const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
export const formatDate = (value: string) => { const [y, m, d] = value.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
export const addDays = (value: string, days: number) => { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
export const durationMinutes = (start: string, end: string) => { const parts = (time: string) => time.split(':').reduce((total, v, i) => total + Number(v) * (i === 0 ? 60 : 1), 0); return parts(end) - parts(start); };
export const sessionMinutes = (session: TeachingSession) => session.actualMinutes ?? durationMinutes(session.startTime, session.endTime);
/** Exact integer VND, with one documented half-up rounding per lesson. */
export function lessonAmount(rate: number, minutes: number, rateType: 'hour' | 'session') {
  if (![rate, minutes].every(Number.isSafeInteger) || rate < 0 || minutes < 0) throw new Error('Đơn giá và thời lượng phải là số nguyên không âm.');
  const result = rateType === 'session' ? BigInt(rate) : (BigInt(rate) * BigInt(minutes) + 30n) / 60n;
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Số tiền vượt giới hạn được hỗ trợ.');
  return Number(result);
}
export const isSessionBillable = (session: TeachingSession) => session.status === 'completed' && session.billable !== false;
export const sessionCharge = (session: TeachingSession) => isSessionBillable(session) ? lessonAmount(session.rate, sessionMinutes(session), session.rateType) : 0;
export const invoiceTotal = (invoice: Invoice) => invoice.items.reduce((sum, row) => sum + row.amount, 0) + invoice.surcharge - invoice.discount;
export const invoicePaid = (invoice: Invoice, payments: Payment[]) => payments.filter(p => p.invoiceId === invoice.id).reduce((sum, p) => sum + p.amount, 0);
export const invoiceRemaining = (invoice: Invoice, payments: Payment[]) => Math.max(0, invoiceTotal(invoice) - invoicePaid(invoice, payments));
export const invoiceStatus = (invoice: Invoice, payments: Payment[]): 'draft' | 'unpaid' | 'partial' | 'paid' => invoice.status === 'draft' ? 'draft' : invoiceRemaining(invoice, payments) === 0 ? 'paid' : invoicePaid(invoice, payments) > 0 ? 'partial' : 'unpaid';
export const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map(part => part[0]).join('').toUpperCase();
export function emptyWorkspace(): WorkspaceData {
  return { schemaVersion: 1, demo: false, profile: { name: '', phone: '', email: '', avatar: '', brand: 'TutorSpace' }, settings: { theme: 'light', defaultRate: 150000, reminderMinutes: 15, bankName: '', bankAccount: '', bankHolder: '', qrImage: '', notifications: false }, students: [], sessions: [], schedules: [], invoices: [], payments: [] };
}
export function monthMetrics(data: WorkspaceData, month: string) {
  const sessions = data.sessions.filter(s => s.date.startsWith(month));
  const completed = sessions.filter(s => s.status === 'completed');
  return { activeStudents: data.students.filter(s => s.status === 'active').length, completedSessions: completed.length, hours: completed.reduce((sum, s) => sum + sessionMinutes(s), 0) / 60, accrued: sessions.reduce((sum, s) => sum + sessionCharge(s), 0), received: data.payments.filter(p => p.date.startsWith(month)).reduce((sum, p) => sum + p.amount, 0), outstanding: data.invoices.filter(i => i.status === 'issued' && i.month <= month).reduce((sum, i) => sum + invoiceRemaining(i, data.payments), 0) };
}
export const monthlySeries = (data: WorkspaceData, year: number) => Array.from({ length: 12 }, (_, index) => { const month = `${year}-${String(index + 1).padStart(2, '0')}`; const metric = monthMetrics(data, month); return { month, label: `T${index + 1}`, accrued: metric.accrued, received: metric.received, hours: metric.hours, sessions: metric.completedSessions }; });

const text = z.string().max(20000);
const id = z.string().uuid();
const integer = z.number().int().nonnegative().max(1000000000000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(`${v}T12:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; }, 'Ngày không tồn tại');
const timestamp = z.string().datetime({ offset: true });
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const month = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/);
const image = z.string().max(7000000).refine(v => {
  if (!v) return true;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(v);
  if (!match || match[2].length % 4 !== 0) return false;
  try {
    const prefix = atob(match[2].slice(0, 24));
    return match[1] === 'png' ? prefix.startsWith('\x89PNG\r\n\x1a\n') : match[1] === 'jpeg' ? prefix.startsWith('\xff\xd8\xff') : prefix.startsWith('RIFF') && prefix.slice(8,12) === 'WEBP';
  } catch { return false; }
}, 'Ảnh không hợp lệ');
const mode = z.enum(['online', 'offline']);
const rateType = z.enum(['hour', 'session']);
const base = { id, createdAt: timestamp, updatedAt: timestamp };
const lessonNote = z.object({ content: text, attitude: text, understanding: text, homework: text, nextPlan: text }).strict();
const workspaceSchema = z.object({
  schemaVersion: z.literal(1), demo: z.boolean(),
  profile: z.object({ name: text, phone: text, email: text, avatar: image, brand: text }).strict(),
  settings: z.object({ theme: z.enum(['light', 'dark', 'system']), defaultRate: integer, reminderMinutes: z.number().int().min(0).max(1440), bankName: text, bankAccount: text, bankHolder: text, qrImage: image, notifications: z.boolean() }).strict(),
  students: z.array(z.object({ ...base, name: z.string().trim().min(1).max(200), grade: text, subject: text, parentName: text, parentPhone: text, startDate: date, mode, rateType, rate: integer, color: z.string().regex(/^#[\da-fA-F]{6}$/), avatar: image, status: z.enum(['active', 'paused', 'ended']), notes: text, goals: text }).strict()).max(5000),
  sessions: z.array(z.object({ ...base, studentId: id, scheduleId: id.nullable(), date, startTime: time, endTime: time, subject: text, mode, location: text, notes: text, status: z.enum(['scheduled', 'completed', 'student_absent', 'teacher_absent', 'cancelled', 'rescheduled']), actualMinutes: z.number().int().min(0).max(1440).nullable(), billable: z.boolean().nullable(), rate: integer, rateType, lessonNote }).strict().refine(s => durationMinutes(s.startTime, s.endTime) > 0, 'Giờ kết thúc phải sau giờ bắt đầu')).max(100000),
  schedules: z.array(z.object({ ...base, studentId: id, weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).refine(v => new Set(v).size === v.length), startDate: date, endDate: date, startTime: time, endTime: time, subject: text, mode, location: text, notes: text }).strict().refine(s => s.endDate >= s.startDate && durationMinutes(s.startTime, s.endTime) > 0, 'Khoảng lịch không hợp lệ')).max(5000),
  invoices: z.array(z.object({ ...base, studentId: id, code: z.string().min(1).max(100), month, status: z.enum(['draft', 'issued']), items: z.array(z.object({ id, sessionId: id.nullable(), date, minutes: z.number().int().min(0).max(1440), rate: integer, rateType, amount: integer, description: text }).strict()).max(1000), surcharge: integer, discount: integer, adjustmentNote: text, comment: text, snapshot: z.object({ studentName: text, grade: text, subject: text, tutorName: text, brand: text, bankName: text, bankAccount: text, bankHolder: text, qrImage: image }).strict(), issuedAt: timestamp.nullable() }).strict()).max(20000),
  payments: z.array(z.object({ id, invoiceId: id, amount: integer.refine(v => v > 0), date, note: text, createdAt: timestamp }).strict()).max(100000),
}).strict();

export function validateBackup(value: unknown): WorkspaceData {
  const parsed = workspaceSchema.safeParse(value);
  if (!parsed.success) { const issue = parsed.error.issues[0]; throw new Error(`Dữ liệu không hợp lệ (${issue.path.join('.') || 'tệp'}): ${issue.message}`); }
  const data = parsed.data as WorkspaceData;
  const seen = new Set<string>();
  for (const rows of [data.students, data.sessions, data.schedules, data.invoices, data.payments]) for (const row of rows) { if (seen.has(row.id)) throw new Error('Dữ liệu chứa mã định danh bị trùng.'); seen.add(row.id); }
  const students = new Set(data.students.map(s => s.id));
  const schedules = new Map(data.schedules.map(s => [s.id, s]));
  const sessions = new Map(data.sessions.map(s => [s.id, s]));
  const invoices = new Map(data.invoices.map(i => [i.id, i]));
  const recurring = new Set<string>();
  for (const s of data.schedules) if (!students.has(s.studentId)) throw new Error('Lịch cố định tham chiếu học sinh không tồn tại.');
  for (const s of data.sessions) {
    if (!students.has(s.studentId)) throw new Error('Buổi học tham chiếu học sinh không tồn tại.');
    if (s.scheduleId) { if (schedules.get(s.scheduleId)?.studentId !== s.studentId) throw new Error('Chuỗi lịch của buổi học không hợp lệ.'); const key = `${s.scheduleId}:${s.date}`; if (recurring.has(key)) throw new Error('Chuỗi lịch chứa buổi học trùng ngày.'); recurring.add(key); }
  }
  const issuedMonths = new Set<string>(), billed = new Set<string>(), itemIds = new Set<string>();
  for (const invoice of data.invoices) {
    if (!students.has(invoice.studentId)) throw new Error('Hóa đơn tham chiếu học sinh không tồn tại.');
    if (invoiceTotal(invoice) < 0 || !Number.isSafeInteger(invoiceTotal(invoice))) throw new Error('Tổng hóa đơn phải là số nguyên không âm trong giới hạn.');
    if ((invoice.status === 'issued') !== Boolean(invoice.issuedAt)) throw new Error('Ngày phát hành hóa đơn không hợp lệ.');
    if (invoice.status === 'issued') { const key = `${invoice.studentId}:${invoice.month}`; if (issuedMonths.has(key)) throw new Error('Đã có hóa đơn phát hành cho học sinh trong tháng này.'); issuedMonths.add(key); }
    for (const item of invoice.items) {
      if (itemIds.has(item.id)) throw new Error('Dòng hóa đơn bị trùng mã.'); itemIds.add(item.id);
      if (item.sessionId) { const session = sessions.get(item.sessionId); if (!session || session.studentId !== invoice.studentId) throw new Error('Dòng hóa đơn tham chiếu buổi học không hợp lệ.'); if (invoice.status === 'issued') { if (billed.has(item.sessionId)) throw new Error('Một buổi học bị tính phí trong nhiều dòng hóa đơn.'); billed.add(item.sessionId); } }
    }
    if (invoicePaid(invoice, data.payments) > invoiceTotal(invoice)) throw new Error('Thanh toán vượt quá tổng học phí của hóa đơn.');
  }
  for (const payment of data.payments) if (invoices.get(payment.invoiceId)?.status !== 'issued') throw new Error('Chỉ ghi nhận thanh toán cho hóa đơn đã phát hành.');
  return data;
}
export function protectIssuedInvoices(before: WorkspaceData, after: WorkspaceData, allowIssuedChanges = false) {
  if (allowIssuedChanges) return;
  for (const invoice of before.invoices.filter(i => i.status === 'issued')) {
    const next = after.invoices.find(i => i.id === invoice.id);
    const immutable = (v: Invoice) => ({ ...v, updatedAt: '' });
    if (!next || JSON.stringify(immutable(invoice)) !== JSON.stringify(immutable(next))) throw new Error('Hóa đơn đã phát hành được bảo toàn. Hãy dùng thao tác chỉnh sửa có xác nhận.');
  }
}

export function createDemoData(): WorkspaceData {
  const data = emptyWorkspace(); data.demo = true;
  data.profile = { name: 'Gia sư mẫu', phone: '', email: '', avatar: '', brand: 'TutorSpace · Dữ liệu mẫu' };
  const now = new Date().toISOString(); const current = today();
  const names = ['Nguyễn Minh Anh', 'Trần Gia Huy', 'Lê Khánh Linh', 'Phạm Đức Anh', 'Hoàng Bảo Ngọc', 'Đỗ Nhật Minh'];
  const subjects = ['Toán', 'Tiếng Anh', 'Toán', 'Vật lý', 'Tiếng Anh', 'Hóa học'];
  const colors = ['#4F7CFF', '#26A69A', '#F3AA42', '#9B7CE5', '#DE6F94', '#548FB2'];
  data.students = names.map((name, n) => ({ id: newId(), name, grade: `Lớp ${[9, 8, 11, 12, 7, 10][n]}`, subject: subjects[n], parentName: `Phụ huynh mẫu ${n + 1}`, parentPhone: '', startDate: addDays(current, -210 + n * 10), mode: n % 2 ? 'online' : 'offline', rateType: n === 4 ? 'session' : 'hour', rate: [180000, 160000, 200000, 220000, 240000, 180000][n], color: colors[n], avatar: '', status: n === 5 ? 'paused' : 'active', notes: 'Hồ sơ minh họa để thử các chức năng. Có thể xóa trong Cài đặt.', goals: ['Nắm vững kiến thức nền tảng, tự tin trong bài kiểm tra.', 'Cải thiện kỹ năng đọc hiểu và giao tiếp.'][n % 2], createdAt: now, updatedAt: now }));
  const emptyNote = { content: '', attitude: '', understanding: '', homework: '', nextPlan: '' };
  for (let offset = -5; offset <= 0; offset++) {
    const start = new Date(`${current.slice(0, 7)}-01T12:00:00Z`); start.setUTCMonth(start.getUTCMonth() + offset);
    const monthKey = start.toISOString().slice(0, 7);
    for (let n = 0; n < 5; n++) {
      const student = data.students[n]; const count = 4 + ((n - offset) % 3);
      for (let k = 0; k < count; k++) {
        const date = `${monthKey}-${String(2 + n + k * 4).padStart(2, '0')}`;
        if (date >= current && offset === 0) continue;
        const hour = [14, 16, 18, 20, 10][n]; data.sessions.push({ id: newId(), studentId: student.id, scheduleId: null, date, startTime: `${hour}:00`, endTime: `${hour + 1}:30`, subject: student.subject, mode: student.mode, location: student.mode === 'online' ? 'Lớp học trực tuyến (mẫu)' : 'Nhà học sinh (mẫu)', notes: '', status: 'completed', actualMinutes: k === 1 ? 100 : 90, billable: null, rate: student.rate, rateType: student.rateType, lessonNote: { content: k % 2 ? 'Ôn tập kiến thức và luyện bài tập vận dụng.' : 'Giải đáp bài tập, củng cố kiến thức mới.', attitude: 'Chủ động đặt câu hỏi, tập trung tốt.', understanding: 'Nắm được kiến thức cơ bản.', homework: 'Hoàn thành phiếu bài tập ôn luyện.', nextPlan: 'Kiểm tra bài cũ và luyện bài tổng hợp.' }, createdAt: now, updatedAt: now });
      }
      if (offset < 0) {
        const sessions = data.sessions.filter(s => s.studentId === student.id && s.date.startsWith(monthKey));
        const invoice: Invoice = { id: newId(), studentId: student.id, code: `TS-${monthKey.replace('-', '')}-${n + 1}`, month: monthKey, status: 'issued', items: sessions.map(s => ({ id: newId(), sessionId: s.id, date: s.date, minutes: sessionMinutes(s), rate: s.rate, rateType: s.rateType, amount: sessionCharge(s), description: s.subject })), surcharge: 0, discount: 0, adjustmentNote: '', comment: 'Nhận xét mẫu: Em học tập tích cực và có tiến bộ qua từng buổi. Cần tiếp tục luyện tập đều đặn để củng cố kiến thức.', snapshot: { studentName: student.name, grade: student.grade, subject: student.subject, tutorName: data.profile.name, brand: data.profile.brand, bankName: '', bankAccount: '', bankHolder: '', qrImage: '' }, issuedAt: `${monthKey}-28T12:00:00Z`, createdAt: now, updatedAt: now };
        data.invoices.push(invoice);
        if (offset < -1 || n < 3) data.payments.push({ id: newId(), invoiceId: invoice.id, amount: offset === -1 && n === 2 ? Math.floor(invoiceTotal(invoice) / 2) : invoiceTotal(invoice), date: `${monthKey}-28`, note: 'Thanh toán minh họa, không phải giao dịch thật.', createdAt: now });
      }
    }
  }
  // Seed today's and upcoming lessons relative to the Ho Chi Minh City calendar.
  for (let day = 0; day < 30; day++) for (let n = 0; n < 5; n++) if ((day + n) % 4 === 0 || (day === 0 && n < 3)) {
    const student = data.students[n]; const hour = [14, 16, 18, 20, 10][n]; const complete = day === 0 && (n < 2 || n === 4); data.sessions.push({ id: newId(), studentId: student.id, scheduleId: null, date: addDays(current, day), startTime: `${hour}:00`, endTime: `${hour + 1}:30`, subject: student.subject, mode: student.mode, location: student.mode === 'online' ? 'Lớp trực tuyến (mẫu)' : 'Nhà học sinh (mẫu)', notes: '', status: complete ? 'completed' : 'scheduled', actualMinutes: complete ? 90 : null, billable: null, rate: student.rate, rateType: student.rateType, lessonNote: { ...emptyNote, content: complete ? 'Buổi học minh họa: ôn kiến thức và làm bài tập.' : '' }, createdAt: now, updatedAt: now });
  }
  return validateBackup(data);
}
