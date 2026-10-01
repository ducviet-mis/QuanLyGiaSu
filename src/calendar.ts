import type { TeachingSession } from './types';

export const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export function localDate(date:Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function dateObject(date:string) { return new Date(`${date}T12:00:00`); }
export function shiftDate(date:string,days:number) { const value=dateObject(date); value.setDate(value.getDate()+days); return localDate(value); }
export function minutesBetween(start:string,end:string) { const [a,b]=start.split(':').map(Number); const [c,d]=end.split(':').map(Number); return c*60+d-a*60-b; }
export function weeklyDates(start:string,end:string,days:number[]) { const output:string[]=[]; if(!start||!end||end<start||!days.length) return output; let count=0; for(let day=start;day<=end&&count<732;day=shiftDate(day,1),count++) { if(days.includes(dateObject(day).getDay())) output.push(day); } return output; }
export function sameSlot(a:Pick<TeachingSession,'studentId'|'date'|'startTime'|'endTime'>,b:Pick<TeachingSession,'studentId'|'date'|'startTime'|'endTime'>) { return a.studentId===b.studentId&&a.date===b.date&&a.startTime===b.startTime&&a.endTime===b.endTime; }
export function sessionAlreadyRetained(candidate:TeachingSession,retained:TeachingSession[]) { return retained.some(s=>sameSlot(candidate,s)||(Boolean(candidate.scheduleId)&&candidate.scheduleId===s.scheduleId&&candidate.date===s.date)); }
export function validateSessionConflicts(candidates:TeachingSession[],existing:TeachingSession[]) {
  const occupied=existing.filter(s=>!['cancelled','student_absent','teacher_absent'].includes(s.status));
  for(const candidate of candidates) {
    if(['cancelled','student_absent','teacher_absent'].includes(candidate.status)) continue;
    const conflict=occupied.find(s=>s.id!==candidate.id&&s.date===candidate.date&&s.startTime<candidate.endTime&&s.endTime>candidate.startTime);
    if(conflict) throw new Error(`Trùng lịch ngày ${candidate.date.split('-').reverse().join('/')} với buổi ${conflict.startTime}–${conflict.endTime}. Hãy chọn khung giờ khác.`);
    occupied.push(candidate);
  }
}
export function seriesEditableSessions(sessions:TeachingSession[],scheduleId:string,fromDate:string,protectedIds:string[]=[]) { return sessions.filter(s=>s.scheduleId===scheduleId&&s.date>=fromDate&&s.status!=='completed'&&!protectedIds.includes(s.id)); }
export function cancelSessionScope(sessions:TeachingSession[],targetId:string,allFuture:boolean,fromDate:string) {
  const target=sessions.find(s=>s.id===targetId); if(!target)throw new Error('Buổi học không còn tồn tại.'); const now=new Date().toISOString();
  return sessions.map(s=>(allFuture?Boolean(target.scheduleId)&&s.scheduleId===target.scheduleId&&s.date>=fromDate&&s.status!=='completed':s.id===targetId)?{...s,status:'cancelled' as const,billable:false,updatedAt:now}:s);
}
