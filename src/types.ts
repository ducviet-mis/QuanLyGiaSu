export type StudentStatus = 'active' | 'paused' | 'ended';
export type SessionStatus = 'scheduled' | 'completed' | 'student_absent' | 'teacher_absent' | 'cancelled' | 'rescheduled';
export type TeachingMode = 'online' | 'offline';
export type RateType = 'hour' | 'session';
export interface Student { id:string; name:string; grade:string; subject:string; parentName:string; parentPhone:string; startDate:string; mode:TeachingMode; rateType:RateType; rate:number; color:string; avatar:string; status:StudentStatus; notes:string; goals:string; createdAt:string; updatedAt:string; }
export interface LessonNote { content:string; attitude:string; understanding:string; homework:string; nextPlan:string; }
export interface TeachingSession { id:string; studentId:string; scheduleId:string|null; date:string; startTime:string; endTime:string; subject:string; mode:TeachingMode; location:string; notes:string; status:SessionStatus; actualMinutes:number|null; billable:boolean|null; rate:number; rateType:RateType; lessonNote:LessonNote; createdAt:string; updatedAt:string; }
export interface TeachingSchedule { id:string; studentId:string; weekdays:number[]; startDate:string; endDate:string; startTime:string; endTime:string; subject:string; mode:TeachingMode; location:string; notes:string; createdAt:string; updatedAt:string; }
export interface Profile { name:string; phone:string; email:string; avatar:string; brand:string; }
export interface AppSettings { theme:'light'|'dark'|'system'; defaultRate:number; reminderMinutes:number; bankName:string; bankAccount:string; bankHolder:string; qrImage:string; notifications:boolean; }
export interface InvoiceItem { id:string; sessionId:string|null; date:string; minutes:number; rate:number; rateType:RateType; amount:number; description:string; }
export interface InvoiceSnapshot { studentName:string; grade:string; subject:string; tutorName:string; brand:string; bankName:string; bankAccount:string; bankHolder:string; qrImage:string; }
export interface Invoice { id:string; studentId:string; code:string; month:string; status:'draft'|'issued'; items:InvoiceItem[]; surcharge:number; discount:number; adjustmentNote:string; comment:string; snapshot:InvoiceSnapshot; createdAt:string; updatedAt:string; issuedAt:string|null; }
export interface Payment { id:string; invoiceId:string; amount:number; date:string; note:string; createdAt:string; }
export interface WorkspaceData { schemaVersion:1; demo:boolean; profile:Profile; settings:AppSettings; students:Student[]; sessions:TeachingSession[]; schedules:TeachingSchedule[]; invoices:Invoice[]; payments:Payment[]; }
