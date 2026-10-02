import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useWorkspace } from '../store';
import { today, newId } from '../domain';
import type { Student } from '../types';
import { Button, Field, Modal, Avatar } from './ui';
import { collectNativeFieldErrors, focusFirstFieldError, formSnapshot, validateStudentFields, type FieldErrors } from './formValidation';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';

const colors=['#147d96','#5e63b6','#b77628','#3b8971','#b55d7a','#59799e'];
function blank(rate:number):Student {
  const now=new Date().toISOString();
  return {id:newId(),name:'',grade:'',subject:'',parentName:'',parentPhone:'',startDate:today(),mode:'online',rateType:'hour',rate,color:colors[0],avatar:'',status:'active',notes:'',goals:'',createdAt:now,updatedAt:now};
}

export function StudentForm({open,onClose,student}:{open:boolean;onClose:()=>void;student?:Student}) {
  const {data,update,saving,uploadImage}=useWorkspace();
  const [form,setForm]=useState<Student>(()=>student?{...student}:blank(data.settings.defaultRate));
  const [baseline,setBaseline]=useState(()=>formSnapshot(form));
  const [error,setError]=useState('');
  const [fieldErrors,setFieldErrors]=useState<FieldErrors>({});
  const [uploading,setUploading]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const submitPending=useRef(false);
  const initializedFor=useRef<string|null>(null);
  const photoInput=useRef<HTMLInputElement>(null);
  const busy=saving||uploading||submitting;
  const {requestClose,discardDialog}=useUnsavedChangesGuard(formSnapshot(form)!==baseline,onClose,busy);

  useEffect(()=>{
    if(!open){initializedFor.current=null;return;}
    const key=student?.id||'new';
    if(!busy&&initializedFor.current!==key){
      const next=student?{...student}:blank(data.settings.defaultRate);
      setForm(next);setBaseline(formSnapshot(next));setError('');setFieldErrors({});
      initializedFor.current=key;
    }
  },[open,student?.id,busy]);

  const change=<K extends keyof Student>(key:K,value:Student[K])=>{
    setForm(f=>({...f,[key]:value}));
    setFieldErrors(errors=>{const next={...errors};delete next[key];return next;});
  };

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy||submitPending.current)return;
    setError('');
    const errors=collectNativeFieldErrors(event.currentTarget,validateStudentFields(form));
    setFieldErrors(errors);
    if(Object.keys(errors).length){focusFirstFieldError(event.currentTarget,errors);return;}
    submitPending.current=true;setSubmitting(true);
    try {
      const saved=await update(d=>({...d,students:student?d.students.map(s=>s.id===student.id?{...form,name:form.name.trim(),updatedAt:new Date().toISOString()}:s):[...d.students,{...form,name:form.name.trim()}]}),student?'Đã cập nhật hồ sơ học sinh':'Đã thêm học sinh');
      if(saved)onClose();else setError('Chưa lưu được hồ sơ. Vui lòng kiểm tra thông báo và thử lại.');
    } catch(e) {setError(e instanceof Error?e.message:'Không thể lưu hồ sơ. Vui lòng thử lại.');}
    finally {submitPending.current=false;setSubmitting(false);}
  }

  async function upload(file?:File) {
    if(!file||busy)return;
    setUploading(true);setError('');
    try{change('avatar',await uploadImage(file));}
    catch(e){setError(e instanceof Error?e.message:'Không thể tải ảnh.');}
    finally{setUploading(false);}
  }

  return <><Modal open={open} onClose={requestClose} title={student?'Chỉnh sửa học sinh':'Thêm học sinh mới'} description="Một hồ sơ gọn gàng để theo dõi hành trình học tập." wide>
    <form onSubmit={submit} noValidate aria-busy={busy}>
      <fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}}>
        <div className="student-photo-row"><Avatar student={form} size="large"/><div>
          <Button type="button" loading={uploading} onClick={()=>photoInput.current?.click()}><ImagePlus size={16}/>{uploading?'Đang tải ảnh...':'Tải ảnh đại diện'}</Button>
          <input ref={photoInput} type="file" aria-label="Chọn ảnh đại diện học sinh" accept="image/png,image/jpeg,image/webp" hidden disabled={uploading} onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/>
          {form.avatar&&<Button variant="ghost" type="button" onClick={()=>change('avatar','')}><Trash2 size={15}/>Xóa ảnh</Button>}<p className="muted">PNG, JPG hoặc WEBP</p>
        </div></div>
        <div className="form-grid">
          <Field label="Họ và tên *" error={fieldErrors.name}><input name="name" required autoFocus maxLength={120} value={form.name} onChange={e=>change('name',e.target.value)}/></Field>
          <Field label="Lớp hiện tại *" error={fieldErrors.grade}><input name="grade" required maxLength={60} placeholder="Ví dụ: Lớp 10" value={form.grade} onChange={e=>change('grade',e.target.value)}/></Field>
          <Field label="Môn học *" error={fieldErrors.subject}><input name="subject" required maxLength={120} placeholder="Ví dụ: Toán" value={form.subject} onChange={e=>change('subject',e.target.value)}/></Field>
          <Field label="Ngày bắt đầu *" error={fieldErrors.startDate}><input name="startDate" required type="date" value={form.startDate} onInput={e=>change('startDate',e.currentTarget.value)} onChange={e=>change('startDate',e.target.value)}/></Field>
          <Field label="Tên phụ huynh" error={fieldErrors.parentName}><input name="parentName" maxLength={120} value={form.parentName} onChange={e=>change('parentName',e.target.value)}/></Field>
          <Field label="Số điện thoại phụ huynh" error={fieldErrors.parentPhone}><input name="parentPhone" type="tel" maxLength={20} value={form.parentPhone} onChange={e=>change('parentPhone',e.target.value)}/></Field>
          <Field label="Hình thức giảng dạy"><select name="mode" value={form.mode} onChange={e=>change('mode',e.target.value as Student['mode'])}><option value="online">Trực tuyến</option><option value="offline">Trực tiếp</option></select></Field>
          <Field label="Trạng thái"><select name="status" value={form.status} onChange={e=>change('status',e.target.value as Student['status'])}><option value="active">Đang học</option><option value="paused">Tạm nghỉ</option><option value="ended">Đã kết thúc</option></select></Field>
          <Field label="Cách tính học phí"><select name="rateType" value={form.rateType} onChange={e=>change('rateType',e.target.value as Student['rateType'])}><option value="hour">Theo giờ</option><option value="session">Theo buổi</option></select></Field>
          <Field label={`Đơn giá (đ/${form.rateType==='hour'?'giờ':'buổi'}) *`} hint="Đơn giá mới áp dụng khi tạo buổi học mới." error={fieldErrors.rate}><input name="rate" required type="number" min={0} max={999999999} step={1} value={form.rate} onChange={e=>change('rate',Number(e.target.value))}/></Field>
          <Field label="Mục tiêu học tập" className="field-full" error={fieldErrors.goals}><textarea name="goals" rows={3} maxLength={5000} placeholder="Mục tiêu của học sinh trong giai đoạn này..." value={form.goals} onChange={e=>change('goals',e.target.value)}/></Field>
          <Field label="Ghi chú cá nhân" className="field-full" error={fieldErrors.notes}><textarea name="notes" rows={3} maxLength={10000} value={form.notes} onChange={e=>change('notes',e.target.value)}/></Field>
        </div>
        <div className="student-color-picker"><span>Màu nhận diện</span>{colors.map(color=><button type="button" aria-label={`Chọn màu ${color}`} aria-pressed={color===form.color} key={color} className={color===form.color?'selected':''} style={{background:color}} onClick={()=>change('color',color)}/>)}</div>
      </fieldset>
      {error&&<p className="form-error" role="alert">{error}</p>}
      {form.status==='ended'&&<p className="form-hint">Hồ sơ, lịch sử học tập và hóa đơn được giữ lại khi kết thúc giảng dạy.</p>}
      <div className="modal-footer form-actions-sticky"><Button type="button" disabled={busy} onClick={requestClose}>Hủy</Button><Button type="submit" variant="primary" loading={busy}>{uploading?'Đang tải ảnh...':submitting||saving?'Đang lưu...':'Lưu học sinh'}</Button></div>
    </form>
  </Modal>{discardDialog}</>;
}
export default StudentForm;
