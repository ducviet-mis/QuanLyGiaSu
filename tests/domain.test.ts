import { describe, expect, it, vi } from 'vitest';
import { addDays, createDemoData, emptyWorkspace, invoicePaid, invoiceRemaining, invoiceStatus, invoiceTotal, isSessionBillable, lessonAmount, monthMetrics, monthlySeries, newId, protectIssuedInvoices, sessionCharge, sessionMinutes, today, validateBackup } from '../src/domain';
import type { Invoice, TeachingSession } from '../src/types';

function fixture() { const data = createDemoData(); data.demo = false; return data; }
function invoiceFixture(): { invoice: Invoice; session: TeachingSession } { const data = fixture(); const invoice = data.invoices[0]; const session = data.sessions.find(s => s.id === invoice.items[0].sessionId)!; return { invoice, session }; }
describe('Exact VND tuition', () => {
  it('rounds the rational minute amount once using integer half-up arithmetic', () => {
    expect(lessonAmount(150000, 120, 'hour')).toBe(300000);
    expect(lessonAmount(100001, 1, 'hour')).toBe(1667);
    expect(lessonAmount(99999, 30, 'hour')).toBe(50000);
    expect(lessonAmount(180000, 100, 'hour')).toBe(300000);
    expect(lessonAmount(240000, 100, 'session')).toBe(240000);
    expect(() => lessonAmount(1.5, 90, 'hour')).toThrow();
    expect(() => lessonAmount(150000, -1, 'hour')).toThrow();
  });
  it('uses actual duration for completed lessons and respects free completed lessons', () => {
    const { session } = invoiceFixture();
    expect(sessionMinutes({ ...session, actualMinutes: 100 })).toBe(100);
    expect(sessionCharge({ ...session, actualMinutes: 100, rate: 180000 })).toBe(300000);
    expect(sessionCharge({ ...session, status: 'student_absent', billable: null })).toBe(0);
    expect(sessionCharge({ ...session, status: 'student_absent', billable: true, actualMinutes: 90, rate: 180000 })).toBe(0);
    expect(sessionCharge({ ...session, status: 'completed', billable: true, actualMinutes: 90, rate: 180000 })).toBe(270000);
    expect(sessionCharge({ ...session, status: 'completed', billable: false })).toBe(0);
  });
  it.each(['student_absent', 'teacher_absent', 'cancelled', 'scheduled', 'rescheduled'] as const)('never charges %s lessons, even with a legacy billable override', status => {
    const { session } = invoiceFixture();
    for (const billable of [null, false, true]) {
      const value = { ...session, status, billable };
      expect(isSessionBillable(value)).toBe(false);
      expect(sessionCharge(value)).toBe(0);
    }
  });
  it('separates issued invoices, payments and remaining amounts', () => {
    const { invoice } = invoiceFixture(); const total = invoiceTotal(invoice);
    const payment = { id: newId(), invoiceId: invoice.id, amount: 100000, date: '2026-10-01', note: '', createdAt: new Date().toISOString() };
    expect(invoicePaid(invoice, [payment])).toBe(100000);
    expect(invoiceRemaining(invoice, [payment])).toBe(total - 100000);
    expect(invoiceStatus(invoice, [])).toBe('unpaid');
    expect(invoiceStatus(invoice, [payment])).toBe('partial');
    expect(invoiceStatus(invoice, [{ ...payment, amount: total }])).toBe('paid');
    expect(invoiceStatus({ ...invoice, status: 'draft' }, [])).toBe('draft');
  });
});
describe('Backups and financial integrity', () => {
  it('accepts empty and realistic sample workspaces without real banking details', () => {
    expect(validateBackup(emptyWorkspace())).toEqual(emptyWorkspace());
    const sample = createDemoData(); expect(sample.students).toHaveLength(6); expect(sample.demo).toBe(true);
    expect(sample.settings.bankAccount).toBe(''); expect(sample.settings.qrImage).toBe('');
    expect(validateBackup(JSON.parse(JSON.stringify(sample)))).toEqual(sample);
    const byDay = new Map<string, TeachingSession[]>();
    for (const session of sample.sessions) { const rows = byDay.get(session.date) ?? []; rows.push(session); byDay.set(session.date, rows); }
    for (const rows of byDay.values()) { rows.sort((a,b) => a.startTime.localeCompare(b.startTime)); for (let n=1; n<rows.length; n++) expect(rows[n].startTime >= rows[n-1].endTime).toBe(true); }
  });
  it('rejects unsupported schema, invalid dates, broken relations and dangerous image URLs', () => {
    const data = fixture(); expect(() => validateBackup({ ...data, schemaVersion: 2 })).toThrow();
    data.students[0].startDate = '2026-02-30'; expect(() => validateBackup(data)).toThrow('Ngày');
    const broken = fixture(); broken.sessions[0].studentId = newId(); expect(() => validateBackup(broken)).toThrow('không tồn tại');
    const image = fixture(); image.settings.qrImage = 'https://example.com/private-qr.png'; expect(() => validateBackup(image)).toThrow('Ảnh');
    image.settings.qrImage = 'data:image/png;base64,YWJjZA=='; expect(() => validateBackup(image)).toThrow('Ảnh');
  });
  it('rejects duplicate issued student/month invoices and duplicate billed sessions', () => {
    const data = fixture(); const old = data.invoices[0];
    data.invoices.push({ ...old, id: newId(), items: old.items.map(i => ({ ...i, id: newId() })) });
    expect(() => validateBackup(data)).toThrow('hóa đơn phát hành');
    const other = fixture(); other.invoices[0].items.push({ ...other.invoices[0].items[0], id: newId() });
    expect(() => validateBackup(other)).toThrow('nhiều dòng');
  });
  it('rejects overpayment, draft payments and negative invoice totals', () => {
    const data = fixture(); data.payments.push({ id: newId(), invoiceId: data.invoices[0].id, amount: invoiceTotal(data.invoices[0]) + 1, date: today(), note: '', createdAt: new Date().toISOString() });
    expect(() => validateBackup(data)).toThrow('vượt quá');
    const draft = fixture(); draft.invoices[0].status = 'draft'; draft.invoices[0].issuedAt = null; expect(() => validateBackup(draft)).toThrow('đã phát hành');
    const negative = fixture(); negative.invoices[0].discount = invoiceTotal(negative.invoices[0]) + 1; expect(() => validateBackup(negative)).toThrow('không âm');
  });
  it('preserves issued snapshots when schedules, students and settings change', () => {
    const before = fixture(); const after = structuredClone(before); const fixed = invoiceTotal(before.invoices[0]);
    after.students[0].rate = 900000; after.sessions[0].rate = 900000; after.settings.bankHolder = 'Người khác';
    expect(() => protectIssuedInvoices(before, after)).not.toThrow(); expect(invoiceTotal(after.invoices[0])).toBe(fixed);
    after.invoices[0].snapshot.bankHolder = 'Thay đổi'; expect(() => protectIssuedInvoices(before, after)).toThrow('xác nhận');
    expect(() => protectIssuedInvoices(before, after, true)).not.toThrow();
    after.invoices.shift(); expect(() => protectIssuedInvoices(before, after)).toThrow();
  });
});
describe('Calendar and metrics', () => {
  it('reports three attended lessons at 450k instead of charging a fourth absent lesson', () => {
    const sample = fixture(); const student = sample.students[0]; const template = sample.sessions.find(session => session.studentId === student.id)!;
    const data = emptyWorkspace(); data.students = [student];
    data.sessions = ['2026-09-01', '2026-09-06', '2026-09-08'].map(date => ({ ...template, id: newId(), scheduleId: null, date, status: 'completed' as const, actualMinutes: 120, rate: 150000, rateType: 'session' as const, billable: true }));
    data.sessions.push({ ...data.sessions[0], id: newId(), date: '2026-09-13', status: 'student_absent', billable: true });
    data.sessions.push({ ...data.sessions[0], id: newId(), date: '2026-10-01', status: 'scheduled', billable: true });
    expect(monthMetrics(data, '2026-09')).toMatchObject({ completedSessions: 3, hours: 6, accrued: 450000 });
    expect(monthlySeries(data, 2026)[8]).toMatchObject({ month: '2026-09', sessions: 3, hours: 6, accrued: 450000 });
    expect(monthMetrics(data, '2026-10')).toMatchObject({ completedSessions: 0, hours: 0, accrued: 0 });
    data.sessions[3].status = 'completed';
    expect(monthMetrics(data, '2026-09').accrued).toBe(600000);
    data.sessions[3].billable = false;
    expect(monthMetrics(data, '2026-09').accrued).toBe(450000);
  });
  it('uses Ho Chi Minh City date even across UTC midnight', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-30T18:01:00Z')); expect(today()).toBe('2026-10-01'); vi.useRealTimers();
  });
  it('crosses month/year boundaries and leap days using date arithmetic', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01'); expect(addDays('2028-02-28', 1)).toBe('2028-02-29'); expect(addDays('2028-02-29', 1)).toBe('2028-03-01'); expect(addDays('2026-10-01', 29)).toBe('2026-10-30');
  });
  it('counts money received by payment date, rather than invoice creation', () => {
    const data = fixture(); data.payments = []; const invoice = data.invoices[0]; const month = today().slice(0, 7);
    expect(monthMetrics(data, month).received).toBe(0);
    data.payments.push({ id: newId(), invoiceId: invoice.id, amount: 100000, date: `${month}-01`, note: '', createdAt: new Date().toISOString() });
    expect(monthMetrics(data, month).received).toBe(100000); expect(monthMetrics(data, month).completedSessions).toBeGreaterThan(0);
  });
});
