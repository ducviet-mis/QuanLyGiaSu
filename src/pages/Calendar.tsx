import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight, ChevronDown, SlidersHorizontal, Clock3, Video, MapPin, Repeat2, CalendarDays, CheckCheck, Pencil, XCircle, BookOpen, ExternalLink } from 'lucide-react';
import { useWorkspace } from '../store';
import { today, formatDate, money, sessionMinutes, sessionCharge } from '../domain';
import type { TeachingSession, LessonNote } from '../types';
import { dateObject, localDate, shiftDate, cancelSessionScope } from '../calendar';
import { Avatar, Button, EmptyState, Field, Modal, PageHeading, StatusBadge, ConfirmDialog, statusLabels } from '../components/ui';
import SessionForm from '../components/SessionForm';
import { useUnsavedChangesGuard } from '../components/useUnsavedChangesGuard';
import { initialCalendarView, saveCalendarView, type CalendarView } from '../calendarViewPreference';
import '../core.css';
import '../calendar-ux.css';

export function SessionDetail({session,onClose}:{session:TeachingSession;onClose:()=>void}) {
  const {data,update,saving}=useWorkspace();const current=data.sessions.find(s=>s.id===session.id)||session;const student=data.students.find(s=>s.id===current.studentId);const [editing,setEditing]=useState(false);const [completing,setCompleting]=useState(false);const [confirm,setConfirm]=useState<'one'|'series'|null>(null);const [actual,setActual]=useState(String(sessionMinutes(current)));const [note,setNote]=useState<LessonNote>({...current.lessonNote});const [billable,setBillable]=useState(current.billable===null?'auto':current.billable?'yes':'no');const [error,setError]=useState('');
  const isReady=['scheduled','rescheduled'].includes(current.status);
  const completionStart=useRef<{actual:string;note:LessonNote;billable:string}|null>(null);
  const durationInput=useRef<HTMLInputElement>(null);
  const [durationError,setDurationError]=useState('');
  const dirty=completing&&completionStart.current!==null&&(actual!==completionStart.current.actual||billable!==completionStart.current.billable||Object.keys(note).some(key=>note[key as keyof LessonNote]!==completionStart.current?.note[key as keyof LessonNote]));
  const {requestClose,discardDialog}=useUnsavedChangesGuard(dirty,()=>setCompleting(false),saving);
  function startComplete(){const initial={actual:String(sessionMinutes(current)),note:{...current.lessonNote},billable:current.billable===null?'auto':current.billable?'yes':'no'};completionStart.current=initial;setActual(initial.actual);setNote({...initial.note});setBillable(initial.billable);setError('');setDurationError('');setCompleting(true);}
  function validateDuration(){const minutes=Number(actual);const message=!Number.isInteger(minutes)||minutes<1||minutes>1440?'Nhập thời lượng thực tế từ 1 đến 1.440 phút.':'';setDurationError(message);return !message;}
  async function finish(e:FormEvent){e.preventDefault();setError('');if(!validateDuration()){durationInput.current?.focus();return;}const minutes=Number(actual);const done=await update(d=>({...d,sessions:d.sessions.map(s=>s.id===current.id?{...s,status:'completed',actualMinutes:minutes,billable:billable==='auto'?null:billable==='yes',lessonNote:note,updatedAt:new Date().toISOString()}:s)}),'Đã lưu buổi học và nhật ký');if(done)setCompleting(false);else setError('Chưa lưu được nhật ký. Vui lòng kiểm tra thông báo và thử lại.');}
  async function cancel(){const done=await update(d=>({...d,sessions:cancelSessionScope(d.sessions,current.id,confirm==='series',today())}),confirm==='series'?'Đã hủy các buổi tương lai trong chuỗi':'Đã hủy buổi học');if(done)setConfirm(null);}
  async function absent(status:'student_absent'|'teacher_absent'){await update(d=>({...d,sessions:d.sessions.map(s=>s.id===current.id?{...s,status,updatedAt:new Date().toISOString()}:s)}),'Đã cập nhật trạng thái buổi học');}
  const link=/^https?:\/\//i.test(current.location)?current.location:null;
  return <><Modal open={!editing&&!completing} onClose={onClose} title="Chi tiết buổi học" description={`${formatDate(current.date)} · ${current.startTime}–${current.endTime}`} wide>
    <div className="session-detail-heading">{student&&<Avatar student={student} size="large"/>}<div><h2>{student?.name||'Học sinh'}</h2><p>{current.subject} · {student?.grade}</p></div><StatusBadge status={current.status}/></div>
    <div className="session-facts"><div><Clock3 size={18}/><span>Thời lượng<strong>{sessionMinutes(current)} phút{current.actualMinutes!==null?' thực tế':''}</strong></span></div><div>{current.mode==='online'?<Video size={18}/>:<MapPin size={18}/>}<span>Hình thức<strong>{current.mode==='online'?'Trực tuyến':'Trực tiếp'}</strong></span></div><div><BookOpen size={18}/><span>Học phí phát sinh<strong>{money(sessionCharge(current))}</strong></span></div></div><p className="form-hint">Chỉ tính học phí cho buổi đã hoàn thành. Buổi nghỉ, hủy hoặc chưa học không tính phí.</p>
    {current.location&&<div className="session-location"><MapPin size={17}/>{link?<a href={link} target="_blank" rel="noreferrer">Mở link lớp học <ExternalLink size={14}/></a>:<span>{current.location}</span>}</div>}{current.scheduleId&&<p className="muted session-recurrence"><Repeat2 size={15}/> Thuộc lịch học lặp lại hàng tuần</p>}{current.notes&&<p className="session-note-block">{current.notes}</p>}
    {Object.values(current.lessonNote).some(Boolean)&&<div className="lesson-note-list">{([['content','Nội dung đã học'],['attitude','Thái độ học tập'],['understanding','Mức độ tiếp thu'],['homework','Bài tập về nhà'],['nextPlan','Kế hoạch buổi tiếp theo']] as [keyof LessonNote,string][]).map(([key,label])=>current.lessonNote[key]&&<div key={key}><h3>{label}</h3><p>{current.lessonNote[key]}</p></div>)}</div>}
    <div className="session-detail-actions">{(isReady||current.status==='completed')&&<Button variant="primary" onClick={startComplete}><CheckCheck size={17}/>{current.status==='completed'?'Chỉnh sửa nhật ký':'Hoàn thành buổi học'}</Button>}<Button onClick={()=>setEditing(true)}><Pencil size={16}/>Chỉnh sửa / dời lịch</Button>{student&&<Link className="btn btn-ghost" to={`/students/${student.id}`}>Hồ sơ học sinh</Link>}</div>
    {isReady&&<div className="session-secondary-actions"><Button variant="ghost" loading={saving} onClick={()=>void absent('student_absent')}>Học sinh xin nghỉ</Button><Button variant="ghost" loading={saving} onClick={()=>void absent('teacher_absent')}>Gia sư xin nghỉ</Button></div>}{current.status!=='cancelled'&&<div className="session-cancel-actions"><Button variant="ghost" onClick={()=>setConfirm('one')}><XCircle size={16}/>Hủy buổi này</Button>{current.scheduleId&&<Button variant="ghost" onClick={()=>setConfirm('series')}>Hủy các buổi tương lai</Button>}</div>}
  </Modal><SessionForm open={editing} onClose={()=>setEditing(false)} session={current}/><Modal open={completing} onClose={requestClose} title={current.status==='completed'?'Nhật ký buổi học':'Hoàn thành buổi học'} description={`${student?.name||''} · ${formatDate(current.date)}`} wide><form className="journal-form" onSubmit={finish} noValidate><div className="form-grid"><Field label="Thời lượng thực tế (phút) *" error={durationError}><input ref={durationInput} required autoFocus type="number" min={1} max={1440} step={1} aria-invalid={!!durationError} value={actual} onBlur={validateDuration} onChange={e=>{setActual(e.target.value);setDurationError('');}}/></Field><Field label="Tính học phí" hint="Chỉ buổi đã hoàn thành mới phát sinh học phí."><select value={billable} onChange={e=>setBillable(e.target.value)}><option value="auto">Tự động (có tính phí)</option><option value="yes">Có tính phí</option><option value="no">Không tính phí</option></select></Field>{([['content','Nội dung kiến thức đã giảng dạy','Hôm nay học sinh đã học được gì?'],['attitude','Thái độ học tập','Mức độ tập trung, sự chủ động...'],['understanding','Mức độ tiếp thu','Kiến thức đã nắm vững và cần củng cố...'],['homework','Bài tập về nhà','Bài tập cần hoàn thành trước buổi sau...'],['nextPlan','Ghi chú cho buổi tiếp theo','Nội dung dự định và điều cần lưu ý...']] as [keyof LessonNote,string,string][]).map(([key,label,placeholder])=><Field key={key} label={label} className={key==='content'||key==='nextPlan'?'field-full':''}><textarea rows={3} maxLength={10000} value={note[key]} placeholder={placeholder} onChange={e=>setNote(n=>({...n,[key]:e.target.value}))}/></Field>)}</div><p className="form-hint">Nhật ký là tùy chọn. Sau khi lưu, thời lượng và học phí sẽ cập nhật trong hồ sơ học sinh.</p>{error&&<p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><Button type="button" onClick={requestClose} disabled={saving}>Quay lại</Button><Button variant="primary" type="submit" loading={saving}><CheckCheck size={17}/>Lưu buổi học</Button></div></form></Modal>{discardDialog}<ConfirmDialog open={confirm!==null} onClose={()=>setConfirm(null)} onConfirm={()=>void cancel()} loading={saving} danger title={confirm==='series'?'Hủy các buổi tương lai?':'Hủy buổi học này?'} description={confirm==='series'?'Các buổi chưa hoàn thành từ hôm nay của chuỗi sẽ chuyển sang Đã hủy và không tính phí. Toàn bộ lịch sử và buổi đã hoàn thành được giữ lại.':'Buổi học sẽ chuyển sang Đã hủy và không tính phí. Nhật ký vẫn được lưu trong lịch sử.'} confirmLabel="Xác nhận hủy"/></>;
}


function monthShift(date: string, amount: number) {
  const d = dateObject(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + amount);
  return localDate(d);
}

function isMobileCalendar() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 767px)').matches
    : false;
}

export default function Calendar() {
  const { data } = useWorkspace();
  const [params] = useSearchParams();
  const queryDate = params.get('date') || '';
  const linkedDate = /^\d{4}-\d{2}-\d{2}$/.test(queryDate)
    && !Number.isNaN(dateObject(queryDate).getTime())
    && localDate(dateObject(queryDate)) === queryDate ? queryDate : '';
  const [start, setStart] = useState(() => linkedDate || today());
  const [selectedDate, setSelectedDate] = useState(() => linkedDate || today());
  const [mobile, setMobile] = useState(isMobileCalendar);
  const [view, setView] = useState<CalendarView>(() => initialCalendarView(isMobileCalendar()));
  const [studentFilter, setStudentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [chosen, setChosen] = useState<TeachingSession | null>(null);

  useEffect(() => {
    if (linkedDate) { setStart(linkedDate); setSelectedDate(linkedDate); }
  }, [linkedDate]);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(max-width: 767px)');
    const updateMobile = () => setMobile(media.matches);
    media.addEventListener('change', updateMobile);
    return () => media.removeEventListener('change', updateMobile);
  }, []);

  const rangeStart = view === 'month' ? `${start.slice(0, 7)}-01` : start;
  const rangeEnd = view === 'month' ? shiftDate(monthShift(rangeStart, 1), -1) : shiftDate(start, 29);
  const days = useMemo(() => {
    const list: string[] = [];
    for (let day = rangeStart; day <= rangeEnd; day = shiftDate(day, 1)) list.push(day);
    return list;
  }, [rangeStart, rangeEnd]);
  const sessions = data.sessions
    .filter(s => s.date >= rangeStart && s.date <= rangeEnd
      && (studentFilter === 'all' || s.studentId === studentFilter)
      && (statusFilter === 'all' || s.status === statusFilter))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  const daySessions = sessions.filter(s => s.date === selectedDate);
  const groups = view === 'list' ? days.filter(date => sessions.some(s => s.date === date)) : [selectedDate];
  const leading = (dateObject(rangeStart).getDay() + 6) % 7;
  const activeFilters = Number(studentFilter !== 'all') + Number(statusFilter !== 'all');
  const filteredStudent = data.students.find(student => student.id === studentFilter);

  function resetFilters() { setStudentFilter('all'); setStatusFilter('all'); }
  function changeRange(date: string) { setStart(date); setSelectedDate(date); }
  function move(amount: number) {
    changeRange(view === 'month' ? monthShift(start, amount) : shiftDate(start, amount * 30));
  }
  function changeView(value: CalendarView) {
    setView(value);
    saveCalendarView(isMobileCalendar(), value);
    if (value === 'month') setSelectedDate(`${start.slice(0, 7)}-01`);
  }
  const dayLabel = (date: string) => new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(dateObject(date));

  return <div className="calendar-page">
    <PageHeading title="Lịch dạy" description="Theo dõi lịch học và nhật ký của bạn." actions={
      <Button variant="primary" onClick={() => setAdding(true)}><Plus size={18} aria-hidden="true" />Thêm lịch dạy</Button>
    } />
    <div className="calendar-toolbar panel">
      <div className="calendar-range-controls">
        <div className="calendar-arrows">
          <Button aria-label="Khoảng trước" onClick={() => move(-1)}><ChevronLeft size={18} aria-hidden="true" /></Button>
          <Button aria-label="Khoảng tiếp theo" onClick={() => move(1)}><ChevronRight size={18} aria-hidden="true" /></Button>
        </div>
        <label className="date-control">
          <span className="sr-only">Ngày bắt đầu khoảng lịch</span>
          <input aria-label="Ngày bắt đầu khoảng lịch" type="date" value={start}
            onInput={e => e.currentTarget.value && changeRange(e.currentTarget.value)}
            onChange={e => e.target.value && changeRange(e.target.value)} />
        </label>
      </div>
      <div className="calendar-view-controls">
        <Button className="calendar-today" onClick={() => changeRange(today())}>Hôm nay</Button>
        <div className="segmented-control" role="group" aria-label="Chế độ xem lịch">
          {([['30', '30 ngày'], ['month', 'Tháng'], ['list', 'Danh sách']] as const).map(([value, label]) =>
            <button key={value} type="button" className={view === value ? 'active' : ''}
              aria-pressed={view === value} onClick={() => changeView(value)}>{label}</button>)}
        </div>
      </div>
    </div>
    <div className="calendar-filter-row">
      <div className="calendar-range-summary">
        <h2>{view === 'month' ? `Tháng ${Number(start.slice(5, 7))}, ${start.slice(0, 4)}` : `${formatDate(rangeStart)} – ${formatDate(rangeEnd)}`}</h2>
        <p className="muted" role="status">{sessions.length} buổi học{activeFilters ? ' phù hợp với bộ lọc' : ' trong khoảng này'}</p>
      </div>
      <Button className={`calendar-filter-toggle ${activeFilters ? 'has-filters' : ''}`}
        aria-expanded={filtersOpen} aria-controls="calendar-filter-controls" onClick={() => setFiltersOpen(open => !open)}>
        <SlidersHorizontal size={17} aria-hidden="true" />Lọc{activeFilters > 0 && <span className="calendar-filter-count">{activeFilters}</span>}
        <ChevronDown size={16} aria-hidden="true" />
      </Button>
      <div id="calendar-filter-controls" className="calendar-filters" hidden={mobile && !filtersOpen}>
        <label><span>Học sinh</span><select aria-label="Lọc theo học sinh" value={studentFilter} onChange={e => setStudentFilter(e.target.value)}>
          <option value="all">Tất cả học sinh</option>{data.students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></label>
        <label><span>Trạng thái</span><select aria-label="Lọc trạng thái buổi học" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      </div>
    </div>
    {activeFilters > 0 && <div className="calendar-active-filters">
      <span className="calendar-active-label">Đang lọc:</span>
      {studentFilter !== 'all' && <span className="calendar-filter-chip">{filteredStudent?.name || 'Học sinh đã chọn'}</span>}
      {statusFilter !== 'all' && <span className="calendar-filter-chip">{statusLabels[statusFilter as keyof typeof statusLabels]}</span>}
      <Button variant="ghost" onClick={resetFilters}>Xóa bộ lọc</Button>
    </div>}
    <div className={`calendar-layout ${view === 'list' ? 'calendar-list-layout' : ''}`}>
      {view !== 'list' && <section className="calendar-board panel" aria-label="Lịch các buổi dạy">
        <div className="calendar-weekdays">{['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'].map(day => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {Array.from({ length: leading }, (_, i) => <div className="calendar-spacer" key={`pad-${i}`} />)}
          {days.map(date => {
            const daily = sessions.filter(s => s.date === date);
            return <button type="button" key={date}
              className={`calendar-day ${date === selectedDate ? 'is-selected' : ''} ${date === today() ? 'is-today' : ''}`}
              onClick={() => setSelectedDate(date)} aria-label={`${dayLabel(date)}, ${formatDate(date)}, ${daily.length} buổi học`}
              aria-pressed={date === selectedDate}>
              <span className="day-number">{Number(date.slice(8))}{date.slice(8) === '01' && <small>/{Number(date.slice(5, 7))}</small>}</span>
              {daily.length > 0 && <span className="day-count">{daily.length}</span>}
              <span className="day-sessions">{daily.slice(0, 2).map(s => {
                const name = data.students.find(x => x.id === s.studentId)?.name || 'Học sinh';
                return <span key={s.id} className={`day-session ${s.status}`} title={`${s.startTime}–${s.endTime} · ${name} · ${s.subject} · ${statusLabels[s.status]}`}>
                  <i aria-hidden="true" /><span className="day-session-copy"><strong>{s.startTime}</strong><span>{name}</span></span>
                </span>;
              })}{daily.length > 2 && <span className="day-more">+{daily.length - 2} buổi</span>}</span>
            </button>;
          })}
        </div>
        <div className="calendar-legend"><span><i className="scheduled" />Sắp diễn ra</span><span><i className="completed" />Đã hoàn thành</span><span><i className="rescheduled" />Đã dời lịch</span><span><i className="cancelled" />Nghỉ / Đã hủy</span></div>
      </section>}
      <section className={`calendar-agenda ${view === 'list' ? '' : 'panel'}`} aria-label={view === 'list' ? 'Danh sách buổi học' : 'Buổi học trong ngày đã chọn'}>
        <div className="agenda-header"><div>
          <h2>{view === 'list' ? 'Các buổi học' : dayLabel(selectedDate)}</h2>
          <p className="muted">{view === 'list' ? 'Chọn một buổi để xem chi tiết hoặc ghi nhật ký.' : `${formatDate(selectedDate)} · ${daySessions.length} buổi học`}</p>
        </div><CalendarDays size={21} aria-hidden="true" /></div>
        {(view === 'list' ? sessions.length : daySessions.length) === 0 ? <EmptyState
          title={activeFilters ? 'Không có buổi học phù hợp' : view === 'list' ? 'Chưa có lịch trong khoảng này' : 'Ngày này chưa có lịch học'}
          description={activeFilters ? 'Thử xóa bộ lọc để xem tất cả buổi học trong khoảng đã chọn.' : 'Bạn có thể thêm buổi học hoặc chọn một khoảng thời gian khác.'}
          action={activeFilters ? <Button onClick={resetFilters}>Xóa bộ lọc</Button> : <Button onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" />Thêm buổi học</Button>} />
          : groups.map(date => <div className={`agenda-date-group ${date === selectedDate ? 'is-linked-date' : ''}`} key={date}>
            {view === 'list' && <h3><span>{dayLabel(date)}</span><span>{formatDate(date)}</span></h3>}
            {sessions.filter(s => s.date === date).map(s => {
              const student = data.students.find(x => x.id === s.studentId);
              return <button key={s.id} type="button" className="agenda-session" onClick={() => setChosen(s)}>
                <div className="agenda-time"><span>{s.startTime}</span><small>{s.endTime}</small></div>
                <div className="agenda-marker" style={{ background: student?.color || 'var(--primary)' }} />
                <div className="agenda-info">
                  <div className="agenda-student">{student && <Avatar student={student} size="small" />}<strong>{student?.name || 'Học sinh'}</strong></div>
                  <p>{s.subject}{student?.grade && ` · ${student.grade}`}</p>
                  <div className="agenda-meta"><span>{s.mode === 'online' ? <Video size={14} aria-hidden="true" /> : <MapPin size={14} aria-hidden="true" />}{s.mode === 'online' ? 'Trực tuyến' : 'Trực tiếp'}</span><span><Clock3 size={14} aria-hidden="true" />{sessionMinutes(s)} phút</span></div>
                  <StatusBadge status={s.status} />
                </div><ChevronRight size={16} aria-hidden="true" />
              </button>;
            })}
          </div>)}
      </section>
    </div>
    <SessionForm open={adding} onClose={() => setAdding(false)} initialDate={selectedDate} />
    {chosen && <SessionDetail session={chosen} onClose={() => setChosen(null)} />}
  </div>;
}
