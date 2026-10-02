import { describe, expect, it } from 'vitest';
import { emptyWorkspace } from './domain';
import { eligibleInvoiceSessions, exportInvoiceFilename, invoiceSnapshot, invoiceValidation, issueValidation, paymentValidation, tuitionTotal } from './invoice-engine';
import type { Invoice, Payment, Student, TeachingSession, WorkspaceData } from './types';

const now = '2026-10-01T00:00:00Z';
const student: Student = { id: 'student-1', name: 'Nguyễn Minh Anh', grade: 'Lớp 9', subject: 'Toán', parentName: '', parentPhone: '', startDate: '2026-01-01', mode: 'online', rateType: 'hour', rate: 150000, color: '#147d96', avatar: '', status: 'active', notes: '', goals: '', createdAt: now, updatedAt: now };
const session: TeachingSession = { id: 'session-1', studentId: student.id, scheduleId: null, date: '2026-09-03', startTime: '19:00', endTime: '21:00', subject: 'Toán', mode: 'online', location: '', notes: '', status: 'completed', actualMinutes: 120, billable: null, rate: 150000, rateType: 'hour', lessonNote: { content: '', attitude: '', understanding: '', homework: '', nextPlan: '' }, createdAt: now, updatedAt: now };
function workspace(): WorkspaceData { const data = emptyWorkspace(); data.students = [{ ...student }]; data.sessions = [{ ...session }]; data.profile.name = 'Gia sư mẫu'; return data; }
function invoice(data = workspace()): Invoice { return { id: 'invoice-1', studentId: student.id, code: 'TS-202609-001', month: '2026-09', status: 'draft', items: [{ id: 'item-1', sessionId: session.id, date: session.date, minutes: 120, rate: 150000, rateType: 'hour', amount: 300000, description: 'Toán' }], surcharge: 0, discount: 0, adjustmentNote: '', comment: '', snapshot: invoiceSnapshot(data, student.id), createdAt: now, updatedAt: now, issuedAt: null }; }
function payment(amount: number): Payment { return { id: 'payment-1', invoiceId: 'invoice-1', amount, date: '2026-10-01', note: '', createdAt: now }; }
const unfinishedStatuses = ['student_absent', 'teacher_absent', 'cancelled', 'scheduled', 'rescheduled'] as const;
const unfinishedCases = unfinishedStatuses.flatMap(status => [true, null, false].map(billable => ({ status, billable })));

describe('invoice eligibility and historical snapshots', () => {
  it('counts completed lessons and excludes completed lessons explicitly marked free', () => {
    const data = workspace();
    data.sessions.push({ ...session, id: 'completed-billable', billable: true }, { ...session, id: 'completed-free', billable: false }, { ...session, id: 'other-month', date: '2026-08-30' });
    expect(eligibleInvoiceSessions(data, student.id, '2026-09').map(item => item.id)).toEqual(['session-1', 'completed-billable']);
  });
  it.each(unfinishedCases)('never includes $status lessons with billable=$billable', ({ status, billable }) => {
    const data = workspace(); data.sessions = [{ ...session, status, billable }];
    expect(eligibleInvoiceSessions(data, student.id, '2026-09')).toEqual([]);
  });
  it.each(unfinishedStatuses)('rejects a stale draft when a charged lesson is now %s', status => {
    const data = workspace(); const candidate = invoice(data);
    data.sessions[0] = { ...data.sessions[0], status, billable: true };
    expect(issueValidation(candidate, data)).toContain('Dữ liệu buổi học đã thay đổi');
  });
  it('excludes already billed sessions while letting a correction retain its own rows', () => {
    const data = workspace(); const issued = { ...invoice(data), status: 'issued' as const, issuedAt: now }; data.invoices = [issued];
    expect(eligibleInvoiceSessions(data, student.id, '2026-09')).toHaveLength(0);
    expect(eligibleInvoiceSessions(data, student.id, '2026-09', issued.id)).toHaveLength(1);
  });
  it('refreshes correction eligibility from completed lessons without changing the issued snapshot', () => {
    const data = workspace(); const issued = { ...invoice(data), status: 'issued' as const, issuedAt: now };
    const absent = { ...session, id: 'later-absent', date: '2026-09-10', status: 'student_absent' as const, billable: true };
    data.sessions.push(absent);
    issued.items.push({ ...issued.items[0], id: 'item-absent', sessionId: absent.id, date: absent.date });
    data.invoices = [issued]; const preserved = structuredClone(issued);

    expect(eligibleInvoiceSessions(data, student.id, '2026-09', issued.id).map(item => item.id)).toEqual(['session-1']);
    expect(data.invoices[0]).toEqual(preserved);
    expect(tuitionTotal(data.invoices[0])).toBe(600000);
  });
  it('copies bank and student values into a snapshot independent of future changes', () => {
    const data = workspace(); data.settings.bankAccount = 'uploaded-by-owner'; data.settings.qrImage = 'data:image/png;base64,owner-image';
    const snapshot = invoiceSnapshot(data, student.id); data.students[0].name = 'Đổi tên'; data.settings.bankAccount = 'new-account';
    expect(snapshot.studentName).toBe('Nguyễn Minh Anh'); expect(snapshot.bankAccount).toBe('uploaded-by-owner'); expect(snapshot.qrImage).toBe('data:image/png;base64,owner-image');
  });
  it('blocks another issued invoice in the same month and stale billability', () => {
    const data = workspace(); const candidate = invoice(data); data.invoices = [{ ...candidate, id: 'issued-other', status: 'issued', issuedAt: now }];
    expect(issueValidation(candidate, data)).toContain('đã có hóa đơn phát hành');
    data.invoices = []; data.sessions[0].billable = false;
    expect(issueValidation(candidate, data)).toContain('Dữ liệu buổi học đã thay đổi');
  });
  it('requires refresh when duration or rate changes before issue', () => {
    const data = workspace(); const candidate = invoice(data); data.sessions[0].actualMinutes = 90;
    expect(issueValidation(candidate, data)).toContain('Dữ liệu buổi học đã thay đổi');
    data.sessions[0].actualMinutes = 120; data.sessions[0].rate = 160000;
    expect(issueValidation(candidate, data)).toContain('Dữ liệu buổi học đã thay đổi');
  });
  it('requires refresh if a newly completed session would otherwise be left out', () => {
    const data = workspace(); const candidate = invoice(data); data.sessions.push({ ...session, id: 'newly-completed', date: '2026-09-10' });
    expect(issueValidation(candidate, data)).toContain('không bỏ sót học phí');
  });
});

describe('invoice amount and payment safeguards', () => {
  it('adds surcharge and subtracts discount in integer VND', () => {
    const value = { ...invoice(), surcharge: 20000, discount: 50000, adjustmentNote: 'Theo thỏa thuận' };
    expect(tuitionTotal(value)).toBe(270000); expect(invoiceValidation(value)).toBeNull();
  });
  it('rejects decimals, negative totals, duplicate sessions, and unexplained manual adjustments', () => {
    const value = invoice(); value.items[0].amount = 300000.5; expect(invoiceValidation(value)).toContain('số nguyên');
    value.items[0].amount = 290000; expect(invoiceValidation(value)).toContain('lý do điều chỉnh');
    value.adjustmentNote = 'Điều chỉnh theo thỏa thuận'; value.discount = 300000; expect(invoiceValidation(value)).toContain('lớn hơn 0đ');
    value.discount = 0; value.items.push({ ...value.items[0], id: 'second-row' }); expect(invoiceValidation(value)).toContain('bị tính trùng');
  });
  it('rejects draft payments and overpayments; accepts partial and final payments', () => {
    const value = invoice(); expect(paymentValidation(value, [], 100000, '2026-10-01')).toContain('đã phát hành');
    value.status = 'issued'; value.issuedAt = now;
    expect(paymentValidation(value, [], 100000, '2026-10-01')).toBeNull();
    expect(paymentValidation(value, [payment(100000)], 200001, '2026-10-01')).toContain('vượt quá');
    expect(paymentValidation(value, [payment(100000)], 200000, '2026-10-01')).toBeNull();
    expect(paymentValidation(value, [payment(300000)], 1, '2026-10-01')).toContain('đầy đủ');
  });
  it('rejects invalid calendar dates, zero and noninteger payments', () => {
    const value = { ...invoice(), status: 'issued' as const, issuedAt: now };
    expect(paymentValidation(value, [], 1, '2026-02-30')).toContain('ngày thanh toán');
    expect(paymentValidation(value, [], 0, '2026-10-01')).toContain('lớn hơn 0đ');
    expect(paymentValidation(value, [], 1.5, '2026-10-01')).toContain('số nguyên');
  });
  it('uses portable, accent-free PNG names', () => {
    const value = invoice(); value.snapshot.studentName = 'Đỗ Nguyễn Minh Anh'; value.month = '2026-10';
    expect(exportInvoiceFilename(value)).toBe('HocPhi_DoNguyenMinhAnh_10_2026.png');
  });
});
