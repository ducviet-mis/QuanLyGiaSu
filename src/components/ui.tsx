import { Children, cloneElement, isValidElement, useId, type ReactNode, type ButtonHTMLAttributes, type ReactElement } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { X, Inbox, LoaderCircle, Check, Circle } from 'lucide-react';
import type { Student, SessionStatus } from '../types';

export function Button({children,variant='secondary',className='',loading=false,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'ghost'|'danger';loading?:boolean}) {return <button {...props} disabled={loading||props.disabled} className={`btn btn-${variant} ${className}`}>{loading&&<LoaderCircle className="spin" size={17}/ >}{children}</button>}
export function PageHeading({eyebrow,title,description,actions}: {eyebrow?:string;title:string;description?:string;actions?:ReactNode}) {return <div className="page-heading"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description&&<p>{description}</p>}</div><div className="page-actions">{actions}</div></div>}
export function Modal({open,onClose,title,description,children,wide=false}:{open:boolean;onClose:()=>void;title:string;description?:string;children:ReactNode;wide?:boolean}) {const id=useId();return <Dialog.Root open={open} onOpenChange={v=>!v&&onClose()}><Dialog.Portal><Dialog.Overlay className="modal-overlay"/><Dialog.Content className={`modal ${wide?'modal-wide':''}`} aria-describedby={description?id:undefined}><div className="modal-header"><div><Dialog.Title className="modal-title">{title}</Dialog.Title>{description&&<Dialog.Description id={id}>{description}</Dialog.Description>}</div><Dialog.Close asChild><button className="icon-btn" aria-label="Đóng"><X size={20}/></button></Dialog.Close></div>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>}
export function Field({label,children,hint,error,className=''}:{label:string;children:ReactNode;hint?:string;error?:string;className?:string}) {
  const id=useId(); const labelId=`${id}-label`; const hintId=`${id}-hint`; const errorId=`${id}-error`;
  const controlIds:string[]=[];
  function associate(nodes:ReactNode):ReactNode {
    return Children.map(nodes,child=>{
      if(!isValidElement(child)||child.type===Field)return child;
      const element=child as ReactElement<{id?:string;children?:ReactNode;'aria-describedby'?:string;'aria-labelledby'?:string;'aria-label'?:string;'aria-invalid'?:boolean|string}>;
      if(typeof element.type==='string'&&['input','select','textarea'].includes(element.type)) {
        const controlId=element.props.id||`${id}-control-${controlIds.length}`;controlIds.push(controlId);
        const describedBy=[element.props['aria-describedby'],hint?hintId:'',error?errorId:''].filter(Boolean).join(' ');
        return cloneElement(element,{id:controlId,'aria-describedby':describedBy||undefined,'aria-invalid':error?true:element.props['aria-invalid'],'aria-labelledby':element.props['aria-labelledby']||(!element.props['aria-label']?labelId:undefined)});
      }
      return element.props.children?cloneElement(element,{children:associate(element.props.children)}):element;
    });
  }
  const controls=associate(children);
  return <div className={`field ${className}`}><label id={labelId} htmlFor={controlIds.length===1?controlIds[0]:undefined}>{label}</label>{controls}{hint&&<small id={hintId}>{hint}</small>}{error&&<small id={errorId} className="field-error" role="alert">{error}</small>}</div>;
}
export function EmptyState({title,description,action,icon}:{title:string;description?:string;action?:ReactNode;icon?:ReactNode}) {return <div className="empty-state"><div className="empty-icon">{icon||<Inbox size={27}/>}</div><h3>{title}</h3>{description&&<p>{description}</p>}{action}</div>}
export function Avatar({student,size='normal'}:{student:Pick<Student,'name'|'color'|'avatar'>;size?:'normal'|'large'|'small'}) {const text=student.name.trim().split(/\s+/).slice(-2).map(x=>x[0]).join('');return <span className={`avatar avatar-${size}`} style={{background:student.color+'19',color:student.color}}>{student.avatar?<img src={student.avatar} alt={`Ảnh ${student.name}`}/>:text}</span>}
export const statusLabels:Record<SessionStatus,string>={scheduled:'Sắp diễn ra',completed:'Đã hoàn thành',student_absent:'Học sinh xin nghỉ',teacher_absent:'Gia sư xin nghỉ',cancelled:'Đã hủy',rescheduled:'Đã dời lịch'};
export function StatusBadge({status,label}:{status:string;label?:string}) {return <span className={`badge badge-${status}`}>{status==='completed'||status==='paid'?<Check size={12}/>:<Circle size={7} fill="currentColor"/>}{label||statusLabels[status as SessionStatus]||{active:'Đang học',paused:'Tạm nghỉ',ended:'Đã kết thúc',draft:'Bản nháp',unpaid:'Chưa thanh toán',partial:'Thanh toán một phần',paid:'Đã thanh toán'}[status as 'active']||status}</span>}
export function Tabs({value,onChange,items,children}:{value:string;onChange:(v:string)=>void;items:{value:string;label:string}[];children:ReactNode}) {return <TabsPrimitive.Root value={value} onValueChange={onChange}><TabsPrimitive.List className="tabs" aria-label="Các mục hồ sơ">{items.map(i=><TabsPrimitive.Trigger key={i.value} value={i.value} className="tab">{i.label}</TabsPrimitive.Trigger>)}</TabsPrimitive.List><TabsPrimitive.Content value={value}>{children}</TabsPrimitive.Content></TabsPrimitive.Root>}
export function ConfirmDialog({open,onClose,onConfirm,title,description,confirmLabel='Xác nhận',danger=false,loading=false}:{open:boolean;onClose:()=>void;onConfirm:()=>void;title:string;description:string;confirmLabel?:string;danger?:boolean;loading?:boolean}) {return <Modal open={open} onClose={onClose} title={title} description={description}><div className="modal-footer"><Button onClick={onClose}>Quay lại</Button><Button variant={danger?'danger':'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button></div></Modal>}
