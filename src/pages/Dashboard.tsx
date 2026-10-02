import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CalendarDays, Clock3, Wallet, CircleCheck, Plus, ChevronLeft, ChevronRight, ReceiptText, Video, MapPin, CircleDollarSign } from 'lucide-react';
import { useWorkspace } from '../store';
import { today, currentMonth, addDays, money, monthMetrics, invoiceRemaining, sessionMinutes } from '../domain';
import type { TeachingSession } from '../types';
import { Button, PageHeading, EmptyState, Avatar, StatusBadge } from '../components/ui';
import { SessionForm } from '../components/SessionForm';
import { StudentForm } from '../components/StudentForm';
import { SessionDetail } from './Calendar';
import { RevenueChart } from '../components/Charts';

function MiniCalendar() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth());
  const { data } = useWorkspace();
  const first = month + '-01';
  const offset = (new Date(first + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const start = addDays(first, -offset);
  const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const days = Array.from({ length: cells }, (_, i) => addDays(start, i));
  const shift = (n: number) => {
    const date = new Date(first + 'T12:00:00Z');
    date.setUTCMonth(date.getUTCMonth() + n);
    setMonth(date.toISOString().slice(0, 7));
  };
  return <section className="mini-calendar panel dashboard-calendar" aria-label="Lịch tháng">
    <div className="mini-calendar-head">
      <div><span className="eyebrow">NHỊP DẠY CỦA BẠN</span><h3>Tháng {Number(month.slice(5))}, {month.slice(0, 4)}</h3></div>
      <div><button className="icon-btn" onClick={() => shift(-1)} aria-label="Tháng trước"><ChevronLeft size={18}/></button><button className="icon-btn" onClick={() => shift(1)} aria-label="Tháng sau"><ChevronRight size={18}/></button></div>
    </div>
    <div className="mini-weekdays">{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => <span key={day}>{day}</span>)}</div>
    <div className="mini-days">{days.map(day => {
      const count = data.sessions.filter(session => session.date === day && !['cancelled', 'student_absent', 'teacher_absent'].includes(session.status)).length;
      return <button key={day} onClick={() => navigate(`/calendar?date=${day}`)} aria-label={`${day}${count ? `, ${count} buổi học` : ''}`} className={`${day === today() ? 'is-today' : ''} ${day.slice(0, 7) !== month ? 'other-month' : ''}`}>
        <span>{Number(day.slice(-2))}</span>{count > 0 && <i/>}
      </button>;
    })}</div>
    <div className="mini-calendar-foot"><span><i/> Có lịch dạy</span><Button variant="ghost" onClick={() => navigate('/calendar')}>Mở lịch dạy <ChevronRight size={15}/></Button></div>
  </section>;
}

export default function Dashboard() {
  const { data } = useWorkspace();
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(Number(currentMonth().slice(0, 4)));
  const [addSession, setAddSession] = useState(false);
  const [addStudent, setAddStudent] = useState(false);
  const [detail, setDetail] = useState<TeachingSession | null>(null);
  const metric = monthMetrics(data, month);
  const todaySessions = data.sessions.filter(session => session.date === today()).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const nextSessions = data.sessions.filter(session => session.date > today() && session.date <= addDays(today(), 7) && ['scheduled', 'rescheduled'].includes(session.status)).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  const debt = data.invoices.filter(invoice => invoice.status === 'issued' && invoiceRemaining(invoice, data.payments) > 0);
  const outstanding = debt.reduce((sum, invoice) => sum + invoiceRemaining(invoice, data.payments), 0);
  const name = data.demo ? 'bạn' : data.profile.name.trim().split(' ').slice(-1)[0] || 'bạn';
  const upcomingCount = todaySessions.filter(session => ['scheduled', 'rescheduled'].includes(session.status)).length;
  const monthLabel = `${Number(month.slice(5))}/${month.slice(0, 4)}`;
  const kpis = [
    { label: 'Học sinh đang học', value: metric.activeStudents, unit: 'học sinh', icon: Users, color: 'blue', note: 'Số học sinh hiện tại' },
    { label: 'Buổi đã hoàn thành', value: metric.completedSessions, unit: 'buổi', icon: CalendarDays, color: 'cyan', note: `Trong tháng ${monthLabel}` },
    { label: 'Thời gian đã dạy', value: metric.hours.toLocaleString('vi-VN', { maximumFractionDigits: 1 }), unit: 'giờ', icon: Clock3, color: 'purple', note: 'Theo thời lượng thực tế' },
    { label: 'Học phí phát sinh', value: money(metric.accrued), unit: '', icon: Wallet, color: 'amber', note: 'Từ buổi hoàn thành có học phí' },
  ];

  return <>
    <PageHeading eyebrow="KHÔNG GIAN GIẢNG DẠY" title="Tổng quan" description={`Chào ${name}, ${upcomingCount ? `hôm nay bạn có ${upcomingCount} buổi học sắp diễn ra.` : 'cùng chuẩn bị cho những buổi học tiếp theo.'}`} actions={<Button variant="primary" onClick={() => setAddSession(true)}><Plus size={18}/> Thêm lịch dạy</Button>}/>
    <div className="dashboard-screen">
      <section className="panel today-panel dashboard-today">
        <div className="panel-heading"><div><h2>Hôm nay <span className="count-pill">{todaySessions.length} buổi</span></h2><p>{new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(today() + 'T12:00:00+07:00'))}</p></div><Button variant="ghost" onClick={() => navigate(`/calendar?date=${today()}`)}>Mở lịch <ChevronRight size={15}/></Button></div>
        {todaySessions.length ? <div className="today-lessons">{todaySessions.map(session => {
          const student = data.students.find(item => item.id === session.studentId);
          if (!student) return null;
          return <div className={`lesson-row ${session.status === 'completed' ? 'lesson-done' : ''}`} key={session.id}>
            <div className="lesson-time"><strong>{session.startTime}</strong><span>{session.endTime}</span></div>
            <div className="lesson-line" style={{ background: student.color }}/><Avatar student={student}/>
            <button className="lesson-info" onClick={() => setDetail(session)}><strong>{student.name}</strong><span>{session.subject} · Lớp {student.grade.replace(/^Lớp /, '')}<small>{session.mode === 'online' ? <Video size={13}/> : <MapPin size={13}/>} {session.mode === 'online' ? 'Trực tuyến' : 'Trực tiếp'}</small></span></button>
            <StatusBadge status={session.status}/>
            <Button variant={session.status === 'completed' ? 'ghost' : 'secondary'} onClick={() => setDetail(session)}>{session.status === 'completed' ? <><CircleCheck size={17}/> Nhật ký</> : <>Chi tiết <ChevronRight size={15}/></>}</Button>
          </div>;
        })}</div> : <EmptyState title="Hôm nay chưa có lịch dạy" description="Thêm buổi học hoặc dành thời gian chuẩn bị cho tuần mới." action={<Button onClick={() => setAddSession(true)}><Plus size={16}/> Thêm buổi học</Button>}/>}
        <div className="today-summary"><span><CircleCheck size={16}/>{todaySessions.filter(session => session.status === 'completed').length}/{todaySessions.length} buổi đã hoàn thành</span><span><Clock3 size={16}/>{(todaySessions.reduce((sum, session) => sum + (session.status === 'completed' ? sessionMinutes(session) : 0), 0) / 60).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ đã dạy</span></div>
      </section>

      <section className="panel upcoming-panel dashboard-upcoming">
        <div className="panel-heading"><div><h2>Sắp tới</h2><p>7 ngày tiếp theo</p></div><span className="count-pill">{nextSessions.length} buổi</span></div>
        {nextSessions.length ? nextSessions.slice(0, 3).map(session => {
          const student = data.students.find(item => item.id === session.studentId);
          if (!student) return null;
          return <button className="upcoming-row" key={session.id} onClick={() => setDetail(session)}><span className="date-block"><small>TH {Number(session.date.slice(5, 7))}</small><strong>{Number(session.date.slice(-2))}</strong></span><span><strong>{student.name}</strong><small>{session.startTime}–{session.endTime} · {session.subject}</small></span><ChevronRight size={17}/></button>;
        }) : <div className="compact-empty">Chưa có buổi học sắp tới.</div>}
        <Button className="full-width upcoming-all" variant="ghost" onClick={() => navigate('/calendar')}>Xem lịch dạy <ChevronRight size={16}/></Button>
      </section>

      <section className={`dashboard-debt ${debt.length ? 'has-debt' : ''}`} aria-label="Học phí cần theo dõi"><span className="callout-icon"><ReceiptText size={23}/></span><div className="dashboard-debt-copy"><span className="eyebrow">HỌC PHÍ CẦN THEO DÕI</span><strong>{debt.length ? money(outstanding) : 'Đã cập nhật học phí'}</strong><p>{debt.length ? `${debt.length} hóa đơn còn chờ thanh toán` : 'Bạn chưa có hóa đơn cần thu thêm.'}</p></div><Button onClick={() => navigate('/invoices?status=unpaid')}>Xem hóa đơn <ChevronRight size={16}/></Button></section>

      <section className="dashboard-stats" aria-label="Tổng quan theo tháng"><div className="dashboard-section-heading"><div><h2>Tháng giảng dạy</h2><p>Buổi học và học phí trong tháng đã chọn.</p></div><input className="month-select" aria-label="Tháng tổng quan" type="month" value={month} onChange={event => event.target.value && setMonth(event.target.value)}/></div><div className="kpi-grid">{kpis.map(kpi => <section className="kpi-card" key={kpi.label}><div className="kpi-top"><span>{kpi.label}</span><span className={`kpi-icon ${kpi.color}`}><kpi.icon size={19}/></span></div><div className="kpi-value">{kpi.value}<small>{kpi.unit}</small></div><div className="kpi-note">{kpi.note}</div></section>)}</div></section>

      <section className="panel income-panel dashboard-income"><div className="panel-heading"><div><h2>Dòng tiền học phí</h2><p>Học phí phát sinh và tiền thực nhận theo năm.</p></div><select aria-label="Năm biểu đồ" value={year} onChange={event => setYear(Number(event.target.value))}>{[year - 1, year, year + 1].map(value => <option key={value}>{value}</option>)}</select></div><div className="income-metrics"><div><span><i className="legend-dot received"/> Đã thu · {monthLabel}</span><strong>{money(metric.received)}</strong></div><div><span><i className="legend-dot debt"/> Còn thiếu đến {monthLabel}</span><strong>{money(metric.outstanding)}</strong></div></div><RevenueChart data={data} year={year} height={265}/><div className="chart-legend"><span><i className="legend-line"/>Học phí phát sinh</span><span><i className="legend-line dashed"/>Đã thu</span></div></section>
      <MiniCalendar/>
      <section className="quick-actions dashboard-quick"><span>THAO TÁC NHANH</span><Button onClick={() => setAddStudent(true)}><Users size={17}/> Thêm học sinh</Button><Button onClick={() => navigate('/invoices?new=1')}><ReceiptText size={17}/> Tạo hóa đơn</Button><Button onClick={() => navigate('/analytics')}><CircleDollarSign size={17}/> Xem thống kê</Button></section>
    </div>
    <SessionForm open={addSession} onClose={() => setAddSession(false)}/><StudentForm open={addStudent} onClose={() => setAddStudent(false)}/>{detail && <SessionDetail session={data.sessions.find(session => session.id === detail.id) || detail} onClose={() => setDetail(null)}/>}
  </>;
}