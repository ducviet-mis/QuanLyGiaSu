import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpRight, Banknote, BookOpen, CheckCircle2, ChevronDown, ClipboardList, FilePlus2, FileText, Pencil, Plus, RefreshCw, Search, Send, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '../store';
import { currentMonth, formatDate, invoicePaid, invoiceRemaining, invoiceStatus, invoiceTotal, money, newId, sessionCharge, sessionMinutes, today } from '../domain';
import { eligibleInvoiceSessions, invoiceSnapshot, invoiceValidation, issueValidation, paymentValidation, withAdjustedItem } from '../invoice-engine';
import { InvoicePreview, exportInvoicePNG, type GeneratedInvoicePNG } from '../components/InvoicePreview';
import { Avatar, Button, ConfirmDialog, EmptyState, Field, Modal, PageHeading, StatusBadge } from '../components/ui';
import type { Invoice, InvoiceItem, WorkspaceData } from '../types';
import '../invoices.css';

type ConfirmAction = 'issue' | 'refresh' | 'delete' | 'discard' | 'correct-start' | 'correct-save' | null;
type InvoiceFilter = 'all' | 'draft' | 'unpaid' | 'partial' | 'paid';
const filterLabels: Record<InvoiceFilter, string> = { all: 'Tất cả', draft: 'Bản nháp', unpaid: 'Chưa thanh toán', partial: 'Thanh toán một phần', paid: 'Đã thanh toán' };
const monthLabel = (month: string) => `Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`;
const hoursLabel = (minutes: number) => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(minutes / 60)} giờ`;

function makeItems(data: WorkspaceData, studentId: string, month: string, invoiceId?: string): InvoiceItem[] {
  return eligibleInvoiceSessions(data, studentId, month, invoiceId).map(session => ({ id: newId(), sessionId: session.id, date: session.date, minutes: sessionMinutes(session), rate: session.rate, rateType: session.rateType, amount: sessionCharge(session), description: session.subject }));
}

function nextCode(data: WorkspaceData, month: string): string {
  const prefix = `TS-${month.replace('-', '')}-`;
  const maximum = Math.max(0, ...data.invoices.filter(invoice => invoice.code.startsWith(prefix)).map(invoice => Number(invoice.code.slice(prefix.length)) || 0));
  return `${prefix}${String(maximum + 1).padStart(3, '0')}`;
}

export default function Invoices() {
  const { data, update, saving } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(''); const [monthFilter, setMonthFilter] = useState('all'); const [statusFilter, setStatusFilter] = useState<InvoiceFilter>('all');
  const [createOpen, setCreateOpen] = useState(false); const [studentId, setStudentId] = useState(''); const [month, setMonth] = useState(currentMonth);
  const [active, setActive] = useState<Invoice | null>(null); const [editing, setEditing] = useState(false); const [previewOnly, setPreviewOnly] = useState(false); const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction>(null); const [formError, setFormError] = useState(''); const [exporting, setExporting] = useState(false);
  const [generatedPNG, setGeneratedPNG] = useState<GeneratedInvoicePNG | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false); const [paymentAmount, setPaymentAmount] = useState(''); const [paymentDate, setPaymentDate] = useState(today); const [paymentNote, setPaymentNote] = useState(''); const [paymentError, setPaymentError] = useState('');
  const paperRef = useRef<HTMLDivElement>(null);
  const queryHandled = useRef('');

  useEffect(() => { return () => { if (generatedPNG) URL.revokeObjectURL(generatedPNG.url); }; }, [generatedPNG]);

  useEffect(() => {
    const requestedInvoice = params.get('invoice');
    const requestKey = requestedInvoice ? `invoice:${requestedInvoice}` : params.get('new') === '1' ? `new:${params.get('studentId') || ''}` : '';
    if (!requestKey) { queryHandled.current = ''; return; }
    if (queryHandled.current === requestKey) return;
    if (requestedInvoice) {
      const invoice = data.invoices.find(item => item.id === requestedInvoice);
      if (!invoice) return;
      queryHandled.current = requestKey;
      setActive({ ...structuredClone(invoice), snapshot: invoice.status === 'draft' ? invoiceSnapshot(data, invoice.studentId) : invoice.snapshot }); setEditing(false); setPreviewOnly(true); setDirty(false); setFormError('');
      const next = new URLSearchParams(params); next.delete('invoice'); setParams(next, { replace: true }); return;
    }
    queryHandled.current = requestKey;
    const requested = params.get('studentId');
    setStudentId(requested && data.students.some(student => student.id === requested) ? requested : data.students.find(student => student.status === 'active')?.id || data.students[0]?.id || '');
    setCreateOpen(true);
    const next = new URLSearchParams(params); next.delete('new'); next.delete('studentId'); setParams(next, { replace: true });
  }, [params, setParams, data.students, data.invoices]);

  const scope = useMemo(() => data.invoices.filter(invoice => (monthFilter === 'all' || invoice.month === monthFilter) && `${invoice.snapshot.studentName} ${invoice.code}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))).sort((a, b) => b.month.localeCompare(a.month) || b.updatedAt.localeCompare(a.updatedAt)), [data.invoices, search, monthFilter]);
  const visible = scope.filter(invoice => statusFilter === 'all' || invoiceStatus(invoice, data.payments) === statusFilter);
  const issued = scope.filter(invoice => invoice.status === 'issued');
  const totalIssued = issued.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);
  const totalPaid = issued.reduce((sum, invoice) => sum + invoicePaid(invoice, data.payments), 0);
  const totalRemaining = issued.reduce((sum, invoice) => sum + invoiceRemaining(invoice, data.payments), 0);
  const allMonths = [...new Set([currentMonth(), ...data.invoices.map(invoice => invoice.month)])].sort().reverse();
  const duplicate = data.invoices.find(invoice => invoice.studentId === studentId && invoice.month === month && invoice.status === 'issued');
  const eligible = studentId && month ? eligibleInvoiceSessions(data, studentId, month) : [];
  const notes = active ? data.sessions.filter(session => session.studentId === active.studentId && session.date.startsWith(active.month + '-') && Object.values(session.lessonNote).some(value => value.trim())).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const paid = active ? invoicePaid(active, data.payments) : 0;
  const remaining = active ? invoiceRemaining(active, data.payments) : 0;
  const correction = active?.status === 'issued' && editing;
  const activePayments = active ? data.payments.filter(payment => payment.invoiceId === active.id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)) : [];

  function startNew() {
    queryHandled.current = '';
    setStudentId(data.students.find(student => student.status === 'active')?.id || data.students[0]?.id || ''); setMonth(currentMonth()); setFormError(''); setCreateOpen(true);
  }
  function openInvoice(invoice: Invoice) { setActive({ ...structuredClone(invoice), snapshot: invoice.status === 'draft' ? invoiceSnapshot(data, invoice.studentId) : invoice.snapshot }); setEditing(false); setPreviewOnly(true); setDirty(false); setFormError(''); }
  function closeInvoice() { if (dirty) { setConfirm('discard'); return; } setActive(null); setFormError(''); }
  function patchInvoice(patch: Partial<Invoice>) { if (!active) return; setActive({ ...active, ...patch }); setDirty(true); setFormError(''); }
  function createInvoice() {
    if (!studentId || !month || duplicate || !eligible.length) return;
    const now = new Date().toISOString();
    setActive({ id: newId(), studentId, month, code: nextCode(data, month), status: 'draft', items: makeItems(data, studentId, month), surcharge: 0, discount: 0, adjustmentNote: '', comment: '', snapshot: invoiceSnapshot(data, studentId), createdAt: now, updatedAt: now, issuedAt: null });
    setCreateOpen(false); setEditing(true); setPreviewOnly(false); setDirty(true); setFormError('');
  }
  async function saveInvoice(issue = false, correct = false) {
    if (!active) return;
    const problem = invoiceValidation(active);
    if (problem) { setFormError(problem); setConfirm(null); return; }
    let persisted: Invoice | null = null;
    const ok = await update(current => {
      const existing = current.invoices.find(invoice => invoice.id === active.id);
      if (existing && existing.updatedAt !== active.updatedAt) throw new Error('Hóa đơn đã thay đổi. Đóng phiếu và mở lại trước khi tiếp tục.');
      if (existing?.status === 'issued' && !correct) throw new Error('Hóa đơn đã phát hành. Hãy dùng thao tác chỉnh sửa có xác nhận.');
      if (correct && (!existing || existing.status !== 'issued' || invoicePaid(existing, current.payments) > 0)) throw new Error('Chỉ chỉnh sửa hóa đơn chưa có khoản thanh toán.');
      if (issue) { const issueProblem = issueValidation(active, current); if (issueProblem) throw new Error(issueProblem); }
      const now = new Date().toISOString();
      persisted = { ...active, code: existing?.code || nextCode(current, active.month), snapshot: correct ? active.snapshot : invoiceSnapshot(current, active.studentId), updatedAt: now, status: issue || correct ? 'issued' : 'draft', issuedAt: correct ? existing!.issuedAt : issue ? now : null };
      return { ...current, invoices: existing ? current.invoices.map(invoice => invoice.id === active.id ? persisted! : invoice) : [...current.invoices, persisted] };
    }, correct ? 'Đã lưu điều chỉnh hóa đơn.' : issue ? 'Đã phát hành hóa đơn học phí.' : 'Đã lưu bản nháp.', { allowIssuedChanges: correct });
    setConfirm(null);
    if (ok && persisted) { setActive(persisted); setDirty(false); if (issue || correct) { setEditing(false); setPreviewOnly(true); } }
  }
  async function downloadPNG() {
    if (!active || !paperRef.current) return;
    const invalid = invoiceValidation(active);
    if (invalid) { setFormError(invalid); toast.error(invalid); return; }
    setExporting(true);
    try { setGeneratedPNG(await exportInvoicePNG(paperRef.current, active)); toast.success('Ảnh hóa đơn đã sẵn sàng để tải.'); }
    catch (problem) { toast.error(problem instanceof Error ? problem.message : 'Không thể xuất ảnh. Vui lòng thử lại.'); }
    finally { setExporting(false); }
  }
  function startPayment() { setPaymentAmount(String(remaining)); setPaymentDate(today()); setPaymentNote(''); setPaymentError(''); setPaymentOpen(true); }
  async function savePayment() {
    if (!active) return;
    const amount = Number(paymentAmount);
    const invalid = paymentValidation(active, data.payments, amount, paymentDate);
    if (invalid) { setPaymentError(invalid); return; }
    const ok = await update(current => {
      const invoice = current.invoices.find(item => item.id === active.id);
      if (!invoice) throw new Error('Không tìm thấy hóa đơn. Vui lòng mở lại.');
      const problem = paymentValidation(invoice, current.payments, amount, paymentDate); if (problem) throw new Error(problem);
      return { ...current, payments: [...current.payments, { id: newId(), invoiceId: invoice.id, amount, date: paymentDate, note: paymentNote.trim(), createdAt: new Date().toISOString() }] };
    }, 'Đã ghi nhận khoản thanh toán.');
    if (ok) { setPaymentOpen(false); setPaymentError(''); }
  }
  async function confirmAction() {
    if (!active) return;
    if (confirm === 'issue') { await saveInvoice(true); return; }
    if (confirm === 'correct-save') { await saveInvoice(false, true); return; }
    if (confirm === 'correct-start') { setEditing(true); setPreviewOnly(false); setFormError(''); setConfirm(null); return; }
    if (confirm === 'refresh') { patchInvoice({ items: makeItems(data, active.studentId, active.month, active.id), snapshot: invoiceSnapshot(data, active.studentId) }); setConfirm(null); return; }
    if (confirm === 'discard') { setConfirm(null); setActive(null); setDirty(false); return; }
    if (confirm === 'delete') {
      const ok = await update(current => { const target = current.invoices.find(invoice => invoice.id === active.id); if (target?.status === 'issued') throw new Error('Không thể xóa hóa đơn đã phát hành.'); return { ...current, invoices: current.invoices.filter(invoice => invoice.id !== active.id) }; }, 'Đã xóa bản nháp.');
      setConfirm(null); if (ok) { setActive(null); setDirty(false); }
    }
  }
  const confirms = {
    issue: { title: 'Phát hành hóa đơn học phí?', description: 'Thông tin học sinh, đơn giá, các buổi học và thông tin chuyển khoản sẽ được lưu tại thời điểm phát hành. Vui lòng đối chiếu tổng tiền trước khi xác nhận.', label: 'Phát hành' },
    refresh: { title: 'Tổng hợp lại các buổi học?', description: 'Danh sách buổi học và thông tin chuyển khoản sẽ được cập nhật từ dữ liệu hiện tại. Những thành tiền bạn đã điều chỉnh sẽ trở về mức tính tự động; nhận xét, phụ thu và giảm trừ được giữ lại.', label: 'Tổng hợp lại' },
    delete: { title: 'Xóa bản nháp?', description: 'Bản nháp sẽ được xóa khỏi danh sách. Lịch học và nhật ký của học sinh vẫn được giữ.', label: 'Xóa bản nháp' },
    discard: { title: 'Bỏ các thay đổi chưa lưu?', description: 'Các thay đổi trên phiếu chưa được lưu. Đóng phiếu sẽ bỏ phần thay đổi này.', label: 'Bỏ thay đổi' },
    'correct-start': { title: 'Điều chỉnh hóa đơn đã phát hành?', description: 'Bạn đang mở thao tác điều chỉnh rõ ràng cho hóa đơn chưa có thanh toán. Mã phiếu và ngày phát hành được giữ lại; mọi thay đổi chỉ có hiệu lực sau khi bạn xác nhận lưu.', label: 'Mở chỉnh sửa' },
    'correct-save': { title: 'Xác nhận lưu điều chỉnh?', description: 'Phiếu đã phát hành sẽ được cập nhật theo nội dung đang xem. Mã phiếu, ngày phát hành và thông tin chuyển khoản đã lưu được giữ lại. Hãy tải lại PNG để gửi bản đã sửa.', label: 'Lưu điều chỉnh' },
  } as const;

  return <>
    <PageHeading eyebrow="QUẢN LÝ HỌC PHÍ" title="Hóa đơn & thanh toán" description="Gọn gàng từ cuối buổi học đến cuối tháng." actions={<Button variant="primary" onClick={startNew}><Plus size={18} aria-hidden="true" />Tạo hóa đơn</Button>} />
    <div className="invoice-summary-grid"><div className="panel invoice-summary"><span className="invoice-summary-icon"><FileText size={20} /></span><div><span>Học phí đã phát hành</span><strong>{money(totalIssued)}</strong><small>{issued.length} hóa đơn trong kỳ đang xem</small></div></div><div className="panel invoice-summary"><span className="invoice-summary-icon received"><CheckCircle2 size={20} /></span><div><span>Đã thu</span><strong>{money(totalPaid)}</strong><small>Từ các khoản thanh toán đã ghi nhận</small></div></div><div className="panel invoice-summary"><span className="invoice-summary-icon outstanding"><Banknote size={20} /></span><div><span>Còn cần thu</span><strong>{money(totalRemaining)}</strong><small>{issued.filter(invoice => invoiceRemaining(invoice, data.payments) > 0).length} hóa đơn chưa thanh toán đủ</small></div></div></div>
    <section className="panel invoice-list-panel"><div className="invoice-list-top"><div><h2 className="section-title">Danh sách hóa đơn</h2><p className="muted">Bản nháp giúp bạn đối chiếu trước khi gửi phụ huynh.</p></div><div className="invoice-search-controls"><label className="invoice-search"><Search size={17} aria-hidden="true" /><input aria-label="Tìm hóa đơn theo học sinh hoặc mã phiếu" placeholder="Tìm học sinh, mã phiếu..." value={search} onChange={event => setSearch(event.target.value)} /></label><select aria-label="Lọc kỳ học phí" value={monthFilter} onChange={event => setMonthFilter(event.target.value)}><option value="all">Tất cả kỳ</option>{allMonths.map(value => <option key={value} value={value}>{monthLabel(value)}</option>)}</select></div></div>
      <div className="invoice-filter-tabs" role="group" aria-label="Lọc trạng thái hóa đơn">{(Object.keys(filterLabels) as InvoiceFilter[]).map(status => <button key={status} className={statusFilter === status ? 'selected' : ''} aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)}>{filterLabels[status]}<span>{status === 'all' ? scope.length : scope.filter(invoice => invoiceStatus(invoice, data.payments) === status).length}</span></button>)}</div>
      {!visible.length ? <EmptyState icon={<FileText size={28} />} title={data.invoices.length ? 'Chưa có hóa đơn phù hợp' : 'Cuối tháng sẽ nhẹ nhàng hơn'} description={data.invoices.length ? 'Thử thay đổi tên học sinh, kỳ học phí hoặc trạng thái.' : 'Hoàn thành các buổi học rồi tạo phiếu học phí đầu tiên của bạn.'} action={data.invoices.length ? <Button onClick={() => { setSearch(''); setMonthFilter('all'); setStatusFilter('all'); }}>Xóa bộ lọc</Button> : <Button variant="primary" onClick={startNew}><FilePlus2 size={17} />Tạo hóa đơn đầu tiên</Button>} /> : <><div className="table-wrap invoice-desktop-table"><table className="data-table"><thead><tr><th>Học sinh</th><th>Mã phiếu / Kỳ</th><th>Học phí</th><th>Đã thu</th><th>Trạng thái</th><th><span className="invoice-sr-only">Thao tác</span></th></tr></thead><tbody>{visible.map(invoice => { const student = data.students.find(item => item.id === invoice.studentId); return <tr key={invoice.id}><td><div className="invoice-student-cell">{student && <Avatar student={{ ...student, name: invoice.snapshot.studentName }} />}<div><strong>{invoice.snapshot.studentName}</strong><small>{[invoice.snapshot.grade, invoice.snapshot.subject].filter(Boolean).join(' • ')}</small></div></div></td><td><strong className="invoice-table-code">{invoice.code}</strong><small>{monthLabel(invoice.month)}</small></td><td><strong>{money(invoiceTotal(invoice))}</strong><small>{invoice.items.length} buổi • {hoursLabel(invoice.items.reduce((sum, item) => sum + item.minutes, 0))}</small></td><td><strong>{money(invoicePaid(invoice, data.payments))}</strong>{invoice.status === 'issued' && invoiceRemaining(invoice, data.payments) > 0 && <small>Còn {money(invoiceRemaining(invoice, data.payments))}</small>}</td><td><StatusBadge status={invoiceStatus(invoice, data.payments)} /></td><td><Button variant="ghost" onClick={() => openInvoice(invoice)} aria-label={`Mở hóa đơn ${invoice.code}`}>Mở phiếu<ArrowUpRight size={16} /></Button></td></tr>; })}</tbody></table></div><div className="invoice-mobile-list">{visible.map(invoice => <article key={invoice.id}><div><strong>{invoice.snapshot.studentName}</strong><StatusBadge status={invoiceStatus(invoice, data.payments)} /></div><p>{invoice.code} · {monthLabel(invoice.month)}</p><div><span>Học phí<strong>{money(invoiceTotal(invoice))}</strong></span><span>Đã thu<strong>{money(invoicePaid(invoice, data.payments))}</strong></span></div><Button onClick={() => openInvoice(invoice)}>Mở phiếu<ArrowUpRight size={16} /></Button></article>)}</div><div className="invoice-list-footer"><span>{visible.length} hóa đơn</span><span><ShieldCheck size={15} />Số tiền đã thu luôn tính từ thanh toán thực tế</span></div></>}
    </section>

    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo hóa đơn học phí" description="Chọn học sinh và kỳ học phí để tổng hợp các buổi được tính phí.">
      {!data.students.length ? <EmptyState title="Thêm học sinh trước khi tạo hóa đơn" description="Thông tin học sinh và đơn giá là cơ sở tính học phí." action={<Link className="btn btn-primary" to="/students?new=1" onClick={() => setCreateOpen(false)}>Thêm học sinh<ArrowUpRight size={16} /></Link>} /> : <><div className="form-grid"><Field label="Học sinh"><select value={studentId} onChange={event => setStudentId(event.target.value)}><option value="" disabled>Chọn học sinh</option>{data.students.map(student => <option key={student.id} value={student.id}>{student.name}{student.status === 'ended' ? ' · Đã kết thúc' : student.status === 'paused' ? ' · Tạm nghỉ' : ''}</option>)}</select></Field><Field label="Kỳ học phí"><input type="month" value={month} min="2000-01" max="2100-12" onInput={event => setMonth(event.currentTarget.value)} onChange={event => setMonth(event.target.value)} /></Field></div>
        {duplicate ? <div className="invoice-callout warning"><FileText size={19} /><div><strong>Kỳ này đã có hóa đơn phát hành</strong><p>{duplicate.code}. Mỗi học sinh chỉ có một hóa đơn phát hành trong một tháng.</p><Button onClick={() => { setCreateOpen(false); openInvoice(duplicate); }}>Mở hóa đơn hiện có<ArrowUpRight size={15} /></Button></div></div> : <div className="invoice-callout"><ClipboardList size={21} /><div><strong>{eligible.length} buổi học có thể tính phí</strong><p>{eligible.length ? `${hoursLabel(eligible.reduce((sum, session) => sum + sessionMinutes(session), 0))} · Học phí dự kiến ${money(eligible.reduce((sum, session) => sum + sessionCharge(session), 0))}` : 'Chưa có buổi học đủ điều kiện. Hoàn thành buổi học hoặc kiểm tra lựa chọn tính phí trong Lịch dạy.'}</p><small>Mặc định tính các buổi đã hoàn thành; áp dụng điều chỉnh tính phí riêng và bỏ qua buổi đã có trong hóa đơn phát hành.</small></div></div>}
        <div className="modal-footer"><Button onClick={() => setCreateOpen(false)}>Để sau</Button><Button variant="primary" disabled={!studentId || !/^\d{4}-\d{2}$/.test(month) || !eligible.length || Boolean(duplicate)} onClick={createInvoice}><FilePlus2 size={17} />Tổng hợp học phí</Button></div></>}
    </Modal>

    <Modal open={Boolean(active)} onClose={closeInvoice} title={active ? `${editing ? correction ? 'Điều chỉnh hóa đơn' : 'Soạn phiếu học phí' : 'Phiếu học phí'} · ${active.snapshot.studentName}` : 'Phiếu học phí'} description={active ? `${active.code} · ${monthLabel(active.month)}${dirty ? ' · Có thay đổi chưa lưu' : ''}` : undefined} wide>
      {active && <><div className="invoice-editor-toolbar"><div><StatusBadge status={invoiceStatus(active, data.payments)} />{active.status === 'issued' && <span className="invoice-preserved"><ShieldCheck size={14} />Đã lưu thông tin khi phát hành</span>}</div><div>{editing && <Button variant="ghost" onClick={() => setPreviewOnly(!previewOnly)}><FileText size={16} />{previewOnly ? 'Tiếp tục soạn' : 'Xem trước'}</Button>}<Button loading={exporting} onClick={downloadPNG}><ArrowDownToLine size={16} />Tải ảnh PNG</Button></div></div>
        {formError && <div className="invoice-form-error" role="alert">{formError}</div>}
        {!editing && <div className="invoice-payment-overview"><div><span>Tổng học phí</span><strong>{money(invoiceTotal(active))}</strong></div><div><span>Đã thu</span><strong>{money(paid)}</strong></div><div><span>Còn lại</span><strong>{active.status === 'draft' ? 'Chưa phát hành' : money(remaining)}</strong></div></div>}
        {editing && !previewOnly && <div className="invoice-edit-form"><div className="invoice-edit-section-title"><h3>Các buổi học trong tháng</h3>{!correction && <Button variant="ghost" onClick={() => setConfirm('refresh')}><RefreshCw size={15} />Tổng hợp lại</Button>}</div><p className="muted invoice-form-description">Đơn giá được lấy từ từng buổi học. Bạn có thể điều chỉnh thành tiền theo thỏa thuận với phụ huynh.</p><div className="table-wrap"><table className="data-table invoice-edit-table"><thead><tr><th>Ngày / Nội dung</th><th>Thời lượng</th><th>Đơn giá</th><th>Thành tiền (đ)</th></tr></thead><tbody>{active.items.map(item => <tr key={item.id}><td><strong>{formatDate(item.date)}</strong><small>{item.description}</small></td><td>{hoursLabel(item.minutes)}</td><td>{money(item.rate)}<small>/{item.rateType === 'hour' ? 'giờ' : 'buổi'}</small></td><td><input aria-label={`Thành tiền buổi ${formatDate(item.date)}`} type="number" min="0" max="1000000000000" step="1" value={item.amount} onChange={event => { setActive(withAdjustedItem(active, item.id, Number(event.target.value))); setDirty(true); setFormError(''); }} /></td></tr>)}</tbody></table></div>{!active.items.length && <EmptyState title="Không còn buổi học đủ điều kiện" description="Kiểm tra các buổi được tính phí và hóa đơn đã phát hành trong kỳ." />}
          <div className="form-grid invoice-adjustment-fields"><Field label="Phụ thu (đ)"><input type="number" min="0" max="1000000000000" step="1" value={active.surcharge} onChange={event => patchInvoice({ surcharge: Number(event.target.value) })} /></Field><Field label="Giảm trừ / ưu đãi (đ)"><input type="number" min="0" max="1000000000000" step="1" value={active.discount} onChange={event => patchInvoice({ discount: Number(event.target.value) })} /></Field><Field label="Lý do điều chỉnh" hint="Bắt buộc khi thay đổi thành tiền, phụ thu hoặc giảm trừ." className="invoice-full-field"><input value={active.adjustmentNote} maxLength={20000} placeholder="Ví dụ: Giảm học phí theo thỏa thuận tháng này" onChange={event => patchInvoice({ adjustmentNote: event.target.value })} /></Field></div>
          <div className="invoice-edit-total"><span>Tổng học phí</span><strong>{money(invoiceTotal(active))}</strong></div>
          <Field label="Nhận xét học sinh trong tháng" hint="Nội dung sẽ hiển thị đầy đủ trên phiếu, tự xuống dòng theo độ dài."><textarea rows={5} maxLength={20000} value={active.comment} placeholder="Chia sẻ sự tiến bộ, thái độ học tập và những điều cần rèn luyện thêm..." onChange={event => patchInvoice({ comment: event.target.value })} /></Field>
          <details className="invoice-note-reference"><summary><BookOpen size={17} /><span>Tham khảo nhật ký buổi học ({notes.length})</span><ChevronDown size={16} /></summary>{notes.length ? <div>{notes.map(session => <article key={session.id}><strong>{formatDate(session.date)} · {session.subject}</strong>{Object.entries(session.lessonNote).map(([key, value]) => value && <p key={key}><span>{{ content: 'Nội dung', attitude: 'Thái độ', understanding: 'Tiếp thu', homework: 'Bài tập', nextPlan: 'Buổi tiếp theo' }[key]}:</span> {value}</p>)}{(session.lessonNote.attitude || session.lessonNote.understanding) && <Button variant="ghost" onClick={() => patchInvoice({ comment: [active.comment, [session.lessonNote.attitude, session.lessonNote.understanding].filter(Boolean).join(' ')].filter(Boolean).join('\n\n').slice(0, 20000) })}><Plus size={14} />Chèn nhận xét</Button>}</article>)}</div> : <p className="muted">Chưa có nhật ký trong kỳ này. Bạn vẫn có thể nhập nhận xét trực tiếp.</p>}</details>
          {!active.snapshot.bankAccount && <div className="invoice-callout"><Banknote size={18} /><div><strong>Chưa có thông tin nhận học phí</strong><p>Thiết lập tài khoản và tải ảnh QR của bạn trong <Link to="/settings">Cài đặt</Link>. Khi lưu bản nháp hoặc phát hành, phiếu sẽ lấy thông tin mới nhất.</p></div></div>}
        </div>}
        <div className={`invoice-preview-scroll ${editing && !previewOnly ? 'invoice-preview-hidden' : ''}`}><InvoicePreview ref={paperRef} invoice={active} /></div>
        {!editing && activePayments.length > 0 && <div className="invoice-payment-history"><h3>Lịch sử thanh toán</h3>{activePayments.map(payment => <div key={payment.id}><span><strong>{formatDate(payment.date)}</strong><small>{payment.note || 'Ghi nhận thanh toán'}</small></span><strong>{money(payment.amount)}</strong></div>)}</div>}
        <div className="modal-footer invoice-editor-footer"><div>{active.status === 'draft' && data.invoices.some(invoice => invoice.id === active.id) && <Button variant="ghost" className="invoice-delete" onClick={() => setConfirm('delete')} disabled={saving}><Trash2 size={16} />Xóa nháp</Button>}</div><div>{editing ? <><Button onClick={() => correction ? setConfirm('correct-save') : void saveInvoice()} loading={saving}>{correction ? <Pencil size={16} /> : <FileText size={16} />}{correction ? 'Lưu điều chỉnh' : 'Lưu bản nháp'}</Button>{!correction && <Button variant="primary" onClick={() => { const problem = invoiceValidation(active); if (problem) setFormError(problem); else setConfirm('issue'); }} disabled={saving}><Send size={16} />Phát hành</Button>}</> : <>{active.status === 'draft' ? <Button variant="primary" onClick={() => { setEditing(true); setPreviewOnly(false); }}><Pencil size={16} />Sửa bản nháp</Button> : <>{paid === 0 && <Button onClick={() => setConfirm('correct-start')}><Pencil size={16} />Điều chỉnh phiếu</Button>}{remaining > 0 && <Button variant="primary" onClick={startPayment}><Banknote size={16} />Ghi nhận thanh toán</Button>}</>}</>}</div></div>
      </>}
    </Modal>

    <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Ghi nhận thanh toán" description={active ? `${active.snapshot.studentName} · ${active.code}` : undefined}>
      <div className="invoice-payment-balance"><span>Học phí còn lại</span><strong>{money(remaining)}</strong></div><form onSubmit={event => { event.preventDefault(); void savePayment(); }}><div className="form-grid"><Field label="Số tiền đã nhận (đ)" error={paymentError || undefined}><input autoFocus required type="number" min="1" max={remaining} step="1" value={paymentAmount} onChange={event => { setPaymentAmount(event.target.value); setPaymentError(''); }} /></Field><Field label="Ngày thanh toán"><input required type="date" value={paymentDate} onInput={event => { setPaymentDate(event.currentTarget.value); setPaymentError(''); }} onChange={event => { setPaymentDate(event.target.value); setPaymentError(''); }} /></Field><Field label="Ghi chú" className="invoice-full-field"><textarea rows={3} maxLength={20000} value={paymentNote} placeholder="Ví dụ: Phụ huynh chuyển khoản đợt 1" onChange={event => setPaymentNote(event.target.value)} /></Field></div><div className="modal-footer"><Button type="button" onClick={() => setPaymentOpen(false)}>Quay lại</Button><Button type="submit" variant="primary" loading={saving}><CheckCircle2 size={17} />Lưu thanh toán</Button></div></form>
    </Modal>
    <Modal open={Boolean(generatedPNG)} onClose={() => setGeneratedPNG(null)} title="Ảnh hóa đơn đã sẵn sàng" description="Tải ảnh PNG hoặc nhấn giữ ảnh trên điện thoại để lưu vào thiết bị." wide>
      {generatedPNG && <><div className="invoice-generated-meta"><span>{generatedPNG.filename}</span><small>{generatedPNG.width} × {generatedPNG.height} px · {new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(generatedPNG.bytes / 1024)} KB</small></div><div className="invoice-generated-image"><img src={generatedPNG.url} width={generatedPNG.width} height={generatedPNG.height} alt="Ảnh PNG hóa đơn hoàn chỉnh, gồm nhận xét và thông tin thanh toán" /></div><div className="modal-footer"><Button onClick={() => setGeneratedPNG(null)}>Đóng</Button><a className="btn btn-primary" href={generatedPNG.url} download={generatedPNG.filename}><ArrowDownToLine size={16} aria-hidden="true" />Tải ảnh PNG</a><a className="btn btn-secondary" href={generatedPNG.url} target="_blank" rel="noopener noreferrer">Mở ảnh<ArrowUpRight size={16} aria-hidden="true" /></a></div></>}
    </Modal>
    <ConfirmDialog open={Boolean(confirm)} onClose={() => setConfirm(null)} onConfirm={() => void confirmAction()} title={confirm ? confirms[confirm].title : ''} description={confirm ? confirms[confirm].description : ''} confirmLabel={confirm ? confirms[confirm].label : ''} danger={confirm === 'delete' || confirm === 'discard'} loading={saving} />
  </>;
}
