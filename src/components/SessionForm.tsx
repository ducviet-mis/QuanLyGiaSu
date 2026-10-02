import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { CalendarDays, Clock3, Repeat2, Info } from 'lucide-react';
import { useWorkspace } from '../store';
import { today, newId, money } from '../domain';
import type { TeachingSession, TeachingSchedule, SessionStatus, TeachingMode, WorkspaceData } from '../types';
import { weeklyDates, weekdays, minutesBetween, prepareSessionCandidates, shiftDate, seriesEditableSessions } from '../calendar';
import { Button, Field, Modal, statusLabels } from './ui';
import { collectNativeFieldErrors, focusFirstFieldError, formSnapshot, validateSessionFields, type FieldErrors } from './formValidation';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';
type Values={studentId:string;date:string;startTime:string;endTime:string;subject:string;mode:TeachingMode;location:string;notes:string;status:SessionStatus;actualMinutes:string;billable:string;endDate:string;weekdays:number[];recurring:boolean;scope:'one'|'series'};
export function SessionForm({open,onClose,session,initialDate,initialStudentId}:{open:boolean;onClose:()=>void;session?:TeachingSession;initialDate?:string;initialStudentId?:string}) {
  const {data,update,saving}=useWorkspace(); const [error,setError]=useState('');
  function initial():Values {const student=data.students.find(s=>s.id===(session?.studentId||initialStudentId))||data.students.find(s=>s.status==='active')||data.students[0];const date=session?.date||initialDate||today();const series=data.schedules.find(s=>s.id===session?.scheduleId);return {studentId:student?.id||'',date,startTime:session?.startTime||'18:00',endTime:session?.endTime||'19:30',subject:session?.subject||student?.subject||'',mode:session?.mode||student?.mode||'online',location:session?.location||'',notes:session?.notes||'',status:session?.status||'scheduled',actualMinutes:session?.actualMinutes?.toString()||'',billable:session?.billable===null||session?.billable===undefined?'auto':session.billable?'yes':'no',endDate:series?.endDate||shiftDate(date,90),weekdays:series?.weekdays||[new Date(date+'T12:00:00').getDay()],recurring:false,scope:'one'};}
  const [form,setForm]=useState<Values>(initial);
  const [baseline,setBaseline]=useState(()=>formSnapshot(form));
  const [fieldErrors,setFieldErrors]=useState<FieldErrors>({});
  const [submitting,setSubmitting]=useState(false);
  const submitPending=useRef(false);
  const initializedFor=useRef<string|null>(null);
  const recurrenceId=useId();
  const busy=saving||submitting;
  const {requestClose,discardDialog}=useUnsavedChangesGuard(formSnapshot(form)!==baseline,onClose,busy);
  useEffect(()=>{
    if(!open){initializedFor.current=null;return;}
    const key=JSON.stringify([session?.id||'new',initialDate,initialStudentId]);
    if(!busy&&initializedFor.current!==key){const next=initial();setForm(next);setBaseline(formSnapshot(next));setError('');setFieldErrors({});initializedFor.current=key;}
  },[open,session?.id,initialDate,initialStudentId,busy]);
  const change=<K extends keyof Values>(key:K,value:Values[K])=>{
    setForm(f=>({...f,[key]:value}));
    setFieldErrors(errors=>{const next={...errors};delete next[key];if(key==='startTime')delete next.endTime;return next;});
  };
  const student=data.students.find(s=>s.id===form.studentId); const duration=minutesBetween(form.startTime,form.endTime); const isSeries=form.recurring||form.scope==='series';
  function selectStudent(id:string) {const selected=data.students.find(s=>s.id===id);setForm(f=>({...f,studentId:id,subject:selected?.subject||f.subject,mode:selected?.mode||f.mode}));setFieldErrors(errors=>{const next={...errors};delete next.studentId;if(selected?.subject)delete next.subject;return next;});}
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();if(busy||submitPending.current)return;setError('');
    const errors=collectNativeFieldErrors(e.currentTarget,validateSessionFields(form,Boolean(student),isSeries));
    setFieldErrors(errors);
    if(Object.keys(errors).length){
      if(errors.endTime||errors.endDate||errors.weekdays)setError('Lịch học chưa hợp lệ. Kiểm tra lại khoảng giờ và chu kỳ lặp được đánh dấu bên trên.');
      focusFirstFieldError(e.currentTarget,errors);return;
    }
    let amount=1;
    function transform(d:WorkspaceData):WorkspaceData {
      const currentStudent=d.students.find(s=>s.id===form.studentId);if(!currentStudent)throw new Error('Học sinh không còn tồn tại.');const now=new Date().toISOString();const activeSession=session?d.sessions.find(s=>s.id===session.id):undefined;if(session&&!activeSession)throw new Error('Buổi học không còn tồn tại.');const currentSchedule=d.schedules.find(s=>s.id===session?.scheduleId);const scheduleId=isSeries?(form.scope==='series'&&currentSchedule?currentSchedule.id:newId()):null;const effectiveStart=form.scope==='series'&&form.date<today()?today():form.date;const dates=isSeries?weeklyDates(effectiveStart,form.endDate,form.weekdays):[form.date];if(!dates.length)throw new Error('Khoảng thời gian chưa có ngày nào phù hợp với các thứ đã chọn.');
      if(form.scope==='series'&&currentSchedule&&currentSchedule.studentId!==form.studentId)throw new Error('Không thể thay học sinh cho cả chuỗi. Hãy tạo một lịch mới.');
      const protectedIds=d.invoices.flatMap(i=>i.items.flatMap(item=>item.sessionId?[item.sessionId]:[]));
      const replace= form.scope==='series'&&currentSchedule ? seriesEditableSessions(d.sessions,currentSchedule.id,today(),protectedIds) : activeSession?[activeSession]:[];
      const retained=d.sessions.filter(s=>!replace.some(r=>r.id===s.id));
      const candidates:TeachingSession[]=dates.map(date=>{const prior=form.scope==='series'?replace.find(s=>s.date===date&&s.studentId===form.studentId):activeSession;return {id:prior?.id||newId(),studentId:form.studentId,scheduleId,date,startTime:form.startTime,endTime:form.endTime,subject:form.subject.trim(),mode:form.mode,location:form.location.trim(),notes:form.notes.trim(),status:prior&&prior.date!==date&&form.status==='scheduled'?'rescheduled':form.status,actualMinutes:form.actualMinutes?Number(form.actualMinutes):null,billable:form.billable==='auto'?null:form.billable==='yes',rate:prior?.rate??currentStudent.rate,rateType:prior?.rateType??currentStudent.rateType,lessonNote:prior?.lessonNote||{content:'',attitude:'',understanding:'',homework:'',nextPlan:''},createdAt:prior?.createdAt||now,updatedAt:now};});
      const unique=prepareSessionCandidates(candidates,retained,isSeries);amount=unique.length;
      const schedule:TeachingSchedule={id:scheduleId||'',studentId:form.studentId,weekdays:form.weekdays,startDate:form.date,endDate:form.endDate,startTime:form.startTime,endTime:form.endTime,subject:form.subject.trim(),mode:form.mode,location:form.location.trim(),notes:form.notes.trim(),createdAt:currentSchedule?.createdAt||now,updatedAt:now};
      return {...d,sessions:[...retained,...unique],schedules:isSeries?[...d.schedules.filter(s=>s.id!==schedule.id),schedule]:d.schedules};
    }
    try{transform(data);}catch(e){setError(e instanceof Error?e.message:'Lịch học chưa hợp lệ.');return;}
    submitPending.current=true;setSubmitting(true);
    try{const saved=await update(transform,session?'Đã cập nhật lịch học':`Đã tạo ${amount} buổi học`);if(saved)onClose();else setError('Chưa lưu được lịch. Vui lòng kiểm tra thông báo và thử lại.');}
    catch(e){setError(e instanceof Error?e.message:'Không thể lưu lịch học. Vui lòng thử lại.');}
    finally{submitPending.current=false;setSubmitting(false);}
  }
  return <><Modal open={open} onClose={requestClose} title={session?'Chỉnh sửa lịch dạy':'Thêm lịch dạy'} description="Sắp xếp thời gian, giữ nhịp học đều đặn." wide>
    <form onSubmit={submit} noValidate aria-busy={busy}>
      <fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}}>
        {!data.students.length?<div className="form-hint">Bạn cần thêm học sinh trước khi tạo lịch dạy.</div>:<>
          <div className="form-grid">
            <Field label="Học sinh *" error={fieldErrors.studentId}><select name="studentId" required disabled={form.scope==='series'} value={form.studentId} onChange={e=>selectStudent(e.target.value)}>{data.students.map(s=><option key={s.id} value={s.id}>{s.name}{s.status!=='active'?` · ${s.status==='paused'?'Tạm nghỉ':'Đã kết thúc'}`:''}</option>)}</select></Field>
            <Field label="Môn học *" error={fieldErrors.subject}><input name="subject" required maxLength={120} value={form.subject} onChange={e=>change('subject',e.target.value)}/></Field>
            {session?.scheduleId&&<Field label="Phạm vi chỉnh sửa" className="field-full" hint="Chọn rõ buổi hiện tại hoặc các buổi sắp tới cần thay đổi."><select name="scope" value={form.scope} onChange={e=>{
              const scope=e.target.value as Values['scope'];const schedule=data.schedules.find(s=>s.id===session.scheduleId);
              if(scope==='series'&&schedule){setForm(f=>({...f,scope,status:'scheduled',studentId:schedule.studentId,date:schedule.startDate,endDate:schedule.endDate,weekdays:schedule.weekdays,startTime:schedule.startTime,endTime:schedule.endTime}));setFieldErrors({});}
              else change('scope',scope);
            }}><option value="one">Chỉ buổi học này</option><option value="series">Toàn bộ các buổi tương lai của chuỗi</option></select></Field>}
            <Field label={isSeries?'Ngày bắt đầu chu kỳ *':'Ngày dạy *'} error={fieldErrors.date}><input name="date" required type="date" value={form.date} onInput={e=>change('date',e.currentTarget.value)} onChange={e=>change('date',e.target.value)}/></Field>
            <Field label="Trạng thái"><select name="status" value={form.status} onChange={e=>change('status',e.target.value as SessionStatus)}>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Giờ bắt đầu *" error={fieldErrors.startTime}><input name="startTime" required type="time" value={form.startTime} onInput={e=>change('startTime',e.currentTarget.value)} onChange={e=>change('startTime',e.target.value)}/></Field>
            <Field label="Giờ kết thúc *" error={fieldErrors.endTime}><input name="endTime" required type="time" value={form.endTime} onInput={e=>change('endTime',e.currentTarget.value)} onChange={e=>change('endTime',e.target.value)}/></Field>
          </div>
          <div className="duration-callout"><Clock3 size={17}/><span>Thời lượng dự kiến: <strong>{duration>0?`${Math.floor(duration/60)} giờ${duration%60?` ${duration%60} phút`:''}`:'Chưa hợp lệ'}</strong></span></div>
          {!session&&<label className="checkbox-field"><input name="recurring" type="checkbox" checked={form.recurring} onChange={e=>change('recurring',e.target.checked)}/><Repeat2 size={17}/> Lặp lại hàng tuần</label>}
          {isSeries&&<div className="recurrence-box">
            <div className="field"><span id={`${recurrenceId}-label`}>Các thứ trong tuần *</span>
              <div className="weekday-picker" role="group" aria-labelledby={`${recurrenceId}-label`} aria-describedby={fieldErrors.weekdays?`${recurrenceId}-error`:undefined} aria-invalid={fieldErrors.weekdays?true:undefined}>
                {[1,2,3,4,5,6,0].map(day=><button name="weekdays" className={form.weekdays.includes(day)?'selected':''} key={day} type="button" aria-pressed={form.weekdays.includes(day)} onClick={()=>change('weekdays',form.weekdays.includes(day)?form.weekdays.filter(d=>d!==day):[...form.weekdays,day])}>{weekdays[day]}</button>)}
              </div>
              {fieldErrors.weekdays&&<small id={`${recurrenceId}-error`} className="field-error" role="alert">{fieldErrors.weekdays}</small>}
            </div>
            <Field label="Ngày kết thúc chu kỳ *" error={fieldErrors.endDate}><input name="endDate" required type="date" min={form.date} max={shiftDate(form.date,730)} value={form.endDate} onInput={e=>change('endDate',e.currentTarget.value)} onChange={e=>change('endDate',e.target.value)}/></Field>
            <p className="muted"><CalendarDays size={14}/> {weeklyDates(form.scope==='series'&&form.date<today()?today():form.date,form.endDate,form.weekdays).length} buổi dự kiến. Các buổi đã có của học sinh này sẽ được bỏ qua.</p>
            {form.scope==='series'&&<p className="form-hint">Chỉ cập nhật các buổi từ hôm nay chưa hoàn thành. Toàn bộ lịch sử và các buổi đã hoàn thành được giữ lại.</p>}
          </div>}
          <div className="form-grid">
            <Field label="Hình thức"><select name="mode" value={form.mode} onChange={e=>change('mode',e.target.value as TeachingMode)}><option value="online">Trực tuyến</option><option value="offline">Trực tiếp</option></select></Field>
            <Field label={form.mode==='online'?'Link học (tùy chọn)':'Địa điểm (tùy chọn)'} error={fieldErrors.location}><input name="location" maxLength={1000} placeholder={form.mode==='online'?'https://meet.google.com/...':'Địa chỉ buổi học'} value={form.location} onChange={e=>change('location',e.target.value)}/></Field>
            {form.status==='completed'&&<Field label="Thời lượng thực tế (phút)" hint="Bỏ trống để dùng thời lượng dự kiến." error={fieldErrors.actualMinutes}><input name="actualMinutes" type="number" min={1} max={1440} step={1} value={form.actualMinutes} onChange={e=>change('actualMinutes',e.target.value)}/></Field>}
            <Field label="Tính học phí" hint="Chỉ tính phí khi đã hoàn thành. Buổi nghỉ, hủy hoặc chưa học không tính phí."><select name="billable" value={form.billable} onChange={e=>change('billable',e.target.value)}><option value="auto">Tự động khi hoàn thành</option><option value="yes">Tính phí khi hoàn thành</option><option value="no">Không tính phí</option></select></Field>
            <Field label="Ghi chú lịch dạy" className="field-full" error={fieldErrors.notes}><textarea name="notes" rows={3} maxLength={10000} value={form.notes} onChange={e=>change('notes',e.target.value)}/></Field>
          </div>
          <p className="form-hint"><Info size={15}/> Đơn giá buổi học: {money(session?.rate??student?.rate??0)}/{(session?.rateType??student?.rateType)==='hour'?'giờ':'buổi'}. Được lưu riêng tại thời điểm tạo lịch.</p>
        </>}
      </fieldset>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <div className="modal-footer form-actions-sticky"><Button type="button" disabled={busy} onClick={requestClose}>Hủy</Button><Button type="submit" variant="primary" disabled={!data.students.length} loading={busy}>{busy?'Đang lưu...':session?'Lưu thay đổi':isSeries?'Tạo lịch lặp lại':'Tạo buổi học'}</Button></div>
    </form>
  </Modal>{discardDialog}</>;
}
export default SessionForm;
