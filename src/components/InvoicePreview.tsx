import { Fragment, forwardRef } from 'react';
import { toBlob, getFontEmbedCSS } from 'html-to-image';
import type { Invoice } from '../types';
import { tuitionTotal, exportInvoiceFilename } from '../invoice-engine';
import { lessonAmount } from '../domain';

const vnd = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
const dateLabel = (value: string) => value.split('-').reverse().join('/');
const issueDateLabel = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
const duration = (minutes: number) => minutes % 60 === 0 ? `${minutes / 60} giờ` : `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} giờ ` : ''}${minutes % 60} phút`;

export const InvoicePreview = forwardRef<HTMLDivElement, { invoice: Invoice }>(function InvoicePreview({ invoice }, ref) {
  const [year, month] = invoice.month.split('-');
  const { snapshot } = invoice;
  const total = tuitionTotal(invoice);
  const minutes = invoice.items.reduce((sum, item) => sum + item.minutes, 0);
  const firstItem = invoice.items[0];
  const commonRate = firstItem && invoice.items.every(item => item.rate === firstItem.rate && item.rateType === firstItem.rateType && item.amount === lessonAmount(item.rate, item.minutes, item.rateType)) ? firstItem : null;
  const dateCounts = new Map<string, number>();
  invoice.items.forEach(item => dateCounts.set(item.date, (dateCounts.get(item.date) || 0) + 1));
  const lessonDates = [...dateCounts.entries()].sort(([a], [b]) => a.localeCompare(b));
  const bankReady = snapshot.bankName || snapshot.bankAccount || snapshot.bankHolder;
  const transferNote = `Học phí ${snapshot.studentName} ${Number(month)}/${year}`;
  return <div ref={ref} className="invoice-paper" aria-label={`Phiếu học phí ${snapshot.studentName}, tháng ${Number(month)}/${year}`}>
    <div className="invoice-topline"><span>{snapshot.brand || 'TutorSpace'}</span><span>THÁNG {Number(month)} / {year}</span></div>
    <div className="invoice-paper-header"><div><h2>Thông báo học phí</h2><p>{snapshot.tutorName || 'Gia sư cá nhân'}</p></div><div className="invoice-code"><span>MÃ PHIẾU</span><strong>{invoice.code}</strong><span>{invoice.issuedAt ? `Phát hành ${issueDateLabel(invoice.issuedAt)}` : 'Bản xem trước'}</span></div></div>
    <div className="invoice-student-block"><div><span>HỌC SINH</span><h3>{snapshot.studentName}</h3></div><div><span>LỚP • MÔN HỌC</span><strong>{[snapshot.grade, snapshot.subject].filter(Boolean).join(' • ') || '—'}</strong></div><div><span>KỲ HỌC PHÍ</span><strong>Tháng {Number(month)}/{year}</strong></div></div>
    <section className="invoice-paper-section"><h3><span>01</span> Tổng hợp học phí</h3>
      <div className="invoice-lesson-summary">
        <div className="invoice-lesson-summary-top"><div><strong>{invoice.items.length} buổi học</strong>{invoice.items.some(item => item.rateType === 'hour') && <span>{duration(minutes)} tổng thời lượng</span>}</div>{commonRate && <div className="invoice-common-rate"><span>Đơn giá</span><strong>{vnd(commonRate.rate)}<small>/{commonRate.rateType === 'hour' ? 'giờ' : 'buổi'}</small></strong></div>}</div>
        <div className="invoice-lesson-dates"><span>Ngày học</span><p>{lessonDates.map(([date, count], index) => <Fragment key={date}><span><time dateTime={date}>{date.startsWith(invoice.month + '-') ? dateLabel(date).slice(0, 5) : dateLabel(date)}</time>{count > 1 && ` (${count} buổi)`}</span>{index < lessonDates.length - 1 && ', '}</Fragment>)}</p></div>
      </div>
      {(invoice.surcharge > 0 || invoice.discount > 0) && <div className="invoice-subtotal"><div><p><span>Học phí các buổi</span><strong>{vnd(invoice.items.reduce((sum, item) => sum + item.amount, 0))}</strong></p>{invoice.surcharge > 0 && <p><span>Phụ thu</span><strong>+{vnd(invoice.surcharge)}</strong></p>}{invoice.discount > 0 && <p><span>Giảm trừ</span><strong>−{vnd(invoice.discount)}</strong></p>}</div></div>}
      {invoice.adjustmentNote && <p className="invoice-adjustment">Điều chỉnh: {invoice.adjustmentNote}</p>}
      <div className="invoice-grand-total"><span>TỔNG HỌC PHÍ</span><strong>{vnd(total)}</strong></div>
    </section>
    {invoice.comment.trim() && <section className="invoice-paper-section invoice-comment"><h3><span>02</span> Nhận xét trong tháng</h3><div className="invoice-comment-body">{invoice.comment.trim().split(/\r?\n/).map((line, index) => <p key={index} className={/^(ưu điểm|nhược điểm|góp ý|cần cải thiện|định hướng|đề xuất|nội dung cần rèn luyện)\s*:?$/iu.test(line.trim()) ? 'invoice-comment-label' : undefined}>{line || '\u00a0'}</p>)}</div></section>}
    <section className="invoice-paper-section"><h3><span>{invoice.comment.trim() ? '03' : '02'}</span> Thông tin thanh toán</h3><div className={`invoice-bank ${snapshot.qrImage ? '' : 'invoice-bank-noqr'}`}>
      <div>{bankReady ? <><dl><div><dt>Ngân hàng</dt><dd>{snapshot.bankName || '—'}</dd></div><div><dt>Số tài khoản</dt><dd className="invoice-account">{snapshot.bankAccount || '—'}</dd></div><div><dt>Chủ tài khoản</dt><dd>{snapshot.bankHolder || '—'}</dd></div></dl><div className="invoice-transfer"><span>Nội dung chuyển khoản</span><strong>{transferNote}</strong></div><div className="invoice-transfer-amount"><span>Số tiền chuyển khoản</span><strong>{vnd(total)}</strong></div></> : <p className="invoice-missing-bank">Vui lòng liên hệ gia sư để nhận thông tin thanh toán.</p>}</div>
      {snapshot.qrImage && <div className="invoice-qr"><img src={snapshot.qrImage} alt="Ảnh QR chuyển khoản do gia sư cung cấp" /><span>Đối chiếu số tiền trước khi chuyển</span></div>}
    </div></section>
    <footer className="invoice-paper-footer"><p>Cảm ơn Quý phụ huynh đã luôn đồng hành trong quá trình học tập của học sinh.</p><span>Chứng từ thông báo học phí cá nhân</span><span>{snapshot.brand || 'TutorSpace'}</span></footer>
  </div>;
});

function blobDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Không thể đọc ảnh QR.')); reader.readAsDataURL(blob); });
}

export interface GeneratedInvoicePNG { url: string; file: File; filename: string; width: number; height: number; bytes: number }

function withExportTimeout<T>(promise: Promise<T>, message: string, milliseconds = 30000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), milliseconds);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

/** Export a full-height copy, independent of the scrolling preview and app theme. */
export async function exportInvoicePNG(node: HTMLDivElement, invoice: Invoice): Promise<GeneratedInvoicePNG> {
  try { await withExportTimeout(Promise.all([400, 500, 600, 700].map(weight => document.fonts.load(`${weight} 16px "Be Vietnam Pro"`, 'Học phí Nguyễn Minh Anh'))), 'Phông chữ đang tải quá lâu. Vui lòng kiểm tra kết nối và thử lại.'); }
  catch { throw new Error('Chưa tải được đầy đủ phông chữ tiếng Việt. Vui lòng kiểm tra kết nối và thử lại.'); }
  await withExportTimeout(document.fonts.ready, 'Phông chữ chưa sẵn sàng. Vui lòng thử lại.');
  const copy = node.cloneNode(true) as HTMLDivElement;
  const stage = document.createElement('div');
  stage.setAttribute('aria-hidden', 'true');
  stage.style.cssText = 'position:fixed;left:-100000px;top:0;width:760px;pointer-events:none;z-index:-1;';
  copy.style.width = '760px'; copy.style.height = 'auto'; copy.style.maxHeight = 'none'; copy.style.transform = 'none';
  stage.append(copy); document.body.append(stage);
  try {
    const images = Array.from(copy.querySelectorAll('img'));
    await withExportTimeout(Promise.all(images.map(async img => {
      if (!img.src.startsWith('data:')) {
        let response: Response;
        try { response = await fetch(img.src, { credentials: 'same-origin' }); }
        catch { throw new Error('Không thể tải đầy đủ ảnh QR. Vui lòng kiểm tra kết nối hoặc tải lại ảnh trong Cài đặt.'); }
        if (!response.ok) throw new Error('Không thể tải đầy đủ ảnh QR. Vui lòng kiểm tra kết nối hoặc tải lại ảnh trong Cài đặt.');
        img.src = await blobDataURL(await response.blob());
      }
      try { await img.decode(); } catch { throw new Error('Ảnh QR không thể hiển thị. Vui lòng thay thế bằng ảnh PNG, JPG hoặc WEBP hợp lệ.'); }
      if (!img.naturalWidth || !img.naturalHeight) throw new Error('Ảnh QR chưa sẵn sàng. Vui lòng thử lại.');
    })), 'Ảnh QR đang tải quá lâu. Vui lòng kiểm tra kết nối hoặc tải lại ảnh.');
    // A timer also resolves in embedded or background browsers where animation frames can pause.
    await new Promise<void>(resolve => setTimeout(resolve, 16));
    const fontEmbedCSS = await withExportTimeout(getFontEmbedCSS(copy, { preferredFontFormat: 'woff2' }), 'Không thể nhúng phông chữ. Vui lòng kiểm tra kết nối và thử lại.');
    const embeddedFontURLs = Array.from(fontEmbedCSS.matchAll(/url\(([^)]+)\)/g), match => match[1].trim().replace(/^["']|["']$/g, ''));
    if (!fontEmbedCSS.includes('Be Vietnam Pro') || !embeddedFontURLs.length || embeddedFontURLs.some(url => !url.startsWith('data:') || url.endsWith('base64,'))) throw new Error('Chưa nhúng được đầy đủ phông chữ tiếng Việt. Vui lòng tải lại trang rồi thử lại.');
    const width = Math.ceil(copy.getBoundingClientRect().width);
    const height = Math.ceil(Math.max(copy.scrollHeight, copy.getBoundingClientRect().height));
    const blob = await withExportTimeout(toBlob(copy, { pixelRatio: 2, width, height, backgroundColor: '#ffffff', fontEmbedCSS, cacheBust: false, skipAutoScale: false }), 'Ảnh chưa được tạo xong. Vui lòng thử lại hoặc giảm độ dài nhận xét.', 45000);
    if (!blob) throw new Error('Không thể tạo ảnh hóa đơn. Vui lòng thử lại.');
    const url = URL.createObjectURL(blob);
    try {
      const bitmap = new Image(); bitmap.src = url;
      await withExportTimeout(bitmap.decode(), 'Không thể mở ảnh đã tạo. Vui lòng thử lại.');
      if (!bitmap.naturalWidth || !bitmap.naturalHeight) throw new Error('Ảnh hóa đơn không hợp lệ. Vui lòng thử lại.');
      const filename = exportInvoiceFilename(invoice);
      const file = new File([blob], filename, { type: 'image/png' });
      return { url, file, filename, width: bitmap.naturalWidth, height: bitmap.naturalHeight, bytes: blob.size };
    } catch (error) { URL.revokeObjectURL(url); throw error; }
  } finally { stage.remove(); }
}
