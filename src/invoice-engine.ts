import type { Invoice, InvoiceItem, InvoiceSnapshot, Payment, TeachingSession, WorkspaceData } from './types';
import { lessonAmount, sessionMinutes } from './domain';

export function isSessionBillable(session: TeachingSession): boolean {
  return session.billable ?? session.status === 'completed';
}

export function billedSessionIds(invoices: Invoice[], exceptInvoiceId?: string): Set<string> {
  return new Set(invoices.filter(invoice => invoice.status === 'issued' && invoice.id !== exceptInvoiceId).flatMap(invoice => invoice.items.flatMap(item => item.sessionId ? [item.sessionId] : [])));
}

export function eligibleInvoiceSessions(data: WorkspaceData, studentId: string, month: string, exceptInvoiceId?: string): TeachingSession[] {
  const billed = billedSessionIds(data.invoices, exceptInvoiceId);
  return data.sessions.filter(session => session.studentId === studentId && session.date.startsWith(month + '-') && isSessionBillable(session) && !billed.has(session.id)).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

export function invoiceSnapshot(data: WorkspaceData, studentId: string): InvoiceSnapshot {
  const student = data.students.find(item => item.id === studentId);
  if (!student) throw new Error('Không tìm thấy học sinh. Vui lòng chọn lại.');
  return { studentName: student.name, grade: student.grade, subject: student.subject, tutorName: data.profile.name, brand: data.profile.brand, bankName: data.settings.bankName, bankAccount: data.settings.bankAccount, bankHolder: data.settings.bankHolder, qrImage: data.settings.qrImage };
}

export function tuitionTotal(invoice: Pick<Invoice, 'items' | 'surcharge' | 'discount'>): number {
  return invoice.items.reduce((sum, item) => sum + item.amount, 0) + invoice.surcharge - invoice.discount;
}

export function paymentTotal(invoiceId: string, payments: Payment[]): number {
  return payments.filter(payment => payment.invoiceId === invoiceId).reduce((sum, payment) => sum + payment.amount, 0);
}

export function invoiceValidation(invoice: Invoice): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(invoice.month)) return 'Vui lòng chọn kỳ học phí hợp lệ.';
  if (!invoice.studentId) return 'Vui lòng chọn học sinh.';
  if (!invoice.items.length) return 'Chưa có buổi học đủ điều kiện để lập hóa đơn.';
  if (invoice.items.some(item => !Number.isSafeInteger(item.amount) || item.amount < 0 || item.amount > 1000000000000)) return 'Thành tiền mỗi buổi phải là số nguyên không âm, tối đa 1.000.000.000.000đ.';
  if (![invoice.surcharge, invoice.discount].every(amount => Number.isSafeInteger(amount) && amount >= 0 && amount <= 1000000000000)) return 'Phụ thu và giảm trừ phải là số nguyên không âm, tối đa 1.000.000.000.000đ.';
  const total = tuitionTotal(invoice);
  if (!Number.isSafeInteger(total) || total <= 0) return 'Tổng học phí phải lớn hơn 0đ và nằm trong giới hạn cho phép.';
  if (invoice.items.some(item => !Number.isSafeInteger(item.minutes) || item.minutes <= 0 || item.minutes > 1440 || !Number.isSafeInteger(item.rate) || item.rate < 0 || item.rate > 1000000000000)) return 'Có dòng học phí không hợp lệ. Vui lòng tổng hợp lại các buổi học.';
  if ((invoice.surcharge > 0 || invoice.discount > 0 || invoice.items.some(item => item.amount !== lessonAmount(item.rate, item.minutes, item.rateType))) && !invoice.adjustmentNote.trim()) return 'Vui lòng ghi lý do điều chỉnh thành tiền, phụ thu hoặc giảm trừ.';
  const sessionIds = invoice.items.flatMap(item => item.sessionId ? [item.sessionId] : []);
  if (new Set(sessionIds).size !== sessionIds.length) return 'Có buổi học bị tính trùng trong hóa đơn.';
  return null;
}

export function issueValidation(invoice: Invoice, data: WorkspaceData): string | null {
  const invalid = invoiceValidation(invoice);
  if (invalid) return invalid;
  if (!data.students.some(student => student.id === invoice.studentId)) return 'Học sinh này không còn tồn tại.';
  if (data.invoices.some(other => other.id !== invoice.id && other.status === 'issued' && other.studentId === invoice.studentId && other.month === invoice.month)) return 'Học sinh đã có hóa đơn phát hành cho kỳ này. Hãy mở hóa đơn đó để kiểm tra.';
  const billed = billedSessionIds(data.invoices, invoice.id);
  if (invoice.items.some(item => item.sessionId && billed.has(item.sessionId))) return 'Một buổi học đã nằm trong hóa đơn khác. Vui lòng tổng hợp lại.';
  if (invoice.items.some(item => item.sessionId && !data.sessions.some(session => session.id === item.sessionId && session.studentId === invoice.studentId && session.date.startsWith(invoice.month + '-') && session.date === item.date && sessionMinutes(session) === item.minutes && session.rate === item.rate && session.rateType === item.rateType && isSessionBillable(session)))) return 'Dữ liệu buổi học đã thay đổi. Vui lòng tổng hợp lại trước khi phát hành.';
  const included = new Set(invoice.items.flatMap(item => item.sessionId ? [item.sessionId] : []));
  if (eligibleInvoiceSessions(data, invoice.studentId, invoice.month, invoice.id).some(session => !included.has(session.id))) return 'Có buổi học tính phí mới trong kỳ này. Vui lòng tổng hợp lại để không bỏ sót học phí.';
  return null;
}

export function paymentValidation(invoice: Invoice, payments: Payment[], amount: number, date: string): string | null {
  if (invoice.status !== 'issued') return 'Chỉ ghi nhận thanh toán cho hóa đơn đã phát hành.';
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000000000) return 'Số tiền đã nhận phải là số nguyên lớn hơn 0đ, tối đa 1.000.000.000.000đ.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(new Date(date + 'T00:00:00Z').getTime()) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) return 'Vui lòng chọn ngày thanh toán hợp lệ.';
  const remaining = tuitionTotal(invoice) - paymentTotal(invoice.id, payments);
  if (remaining <= 0) return 'Hóa đơn đã được thanh toán đầy đủ.';
  if (amount > remaining) return 'Số tiền ghi nhận vượt quá học phí còn lại.';
  return null;
}

export function exportInvoiceFilename(invoice: Invoice): string {
  const name = invoice.snapshot.studentName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9]/g, '') || 'HocSinh';
  const [year, month] = invoice.month.split('-');
  return `HocPhi_${name}_${Number(month)}_${year}.png`;
}

export function withAdjustedItem(invoice: Invoice, itemId: string, amount: number): Invoice {
  return { ...invoice, items: invoice.items.map((item: InvoiceItem) => item.id === itemId ? { ...item, amount } : item) };
}
