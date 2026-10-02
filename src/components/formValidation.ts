import { minutesBetween, shiftDate } from '../calendar';

export type FieldErrors = Record<string, string>;

export function closeIntent(dirty: boolean, busy = false): 'stay' | 'close' | 'confirm' {
  return busy ? 'stay' : dirty ? 'confirm' : 'close';
}

export function formSnapshot(value: object): string {
  return JSON.stringify(value, (key, item: unknown) => key === 'weekdays' && Array.isArray(item) ? [...item].sort() : item);
}

// These are the existing editor checks, now returned by field instead of as a single banner.
export function validateStudentFields(value: { name: string; grade: string; subject: string; rate: number; parentPhone: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (!value.name.trim()) errors.name = 'Vui lòng nhập họ và tên học sinh.';
  if (!value.grade.trim()) errors.grade = 'Vui lòng nhập lớp hiện tại.';
  if (!value.subject.trim()) errors.subject = 'Vui lòng nhập môn học.';
  if (!Number.isSafeInteger(value.rate) || value.rate < 0) errors.rate = 'Đơn giá phải là số nguyên không âm.';
  if (value.parentPhone && !/^[+\d\s().-]{7,20}$/.test(value.parentPhone)) errors.parentPhone = 'Số điện thoại phụ huynh chưa hợp lệ.';
  return errors;
}

export function validateSessionFields(value: { subject: string; startTime: string; endTime: string; date: string; endDate: string; weekdays: number[]; actualMinutes: string }, hasStudent: boolean, isSeries: boolean): FieldErrors {
  const errors: FieldErrors = {};
  if (!hasStudent) errors.studentId = 'Hãy chọn một học sinh.';
  if (!value.subject.trim()) errors.subject = 'Vui lòng nhập môn học.';
  const duration = minutesBetween(value.startTime, value.endTime);
  if (!(duration > 0 && duration <= 720)) errors.endTime = 'Giờ kết thúc phải sau giờ bắt đầu, tối đa 12 giờ mỗi buổi.';
  if (isSeries) {
    if (!value.weekdays.length) errors.weekdays = 'Chọn ít nhất một thứ trong tuần.';
    if (value.endDate < value.date || value.endDate > shiftDate(value.date, 730)) errors.endDate = 'Ngày kết thúc phải từ ngày bắt đầu và trong khoảng tối đa 2 năm.';
  }
  if (value.actualMinutes && (!Number.isInteger(Number(value.actualMinutes)) || Number(value.actualMinutes) < 1 || Number(value.actualMinutes) > 1440)) errors.actualMinutes = 'Thời lượng thực tế phải từ 1 đến 1.440 phút.';
  return errors;
}

// Respect the same required/min/max/step/length constraints already declared on native controls.
export function collectNativeFieldErrors(form: HTMLFormElement, errors: FieldErrors): FieldErrors {
  const result = { ...errors };
  for (const control of Array.from(form.elements)) {
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) || !control.name || !control.willValidate || control.validity.valid || result[control.name]) continue;
    result[control.name] = control.validity.valueMissing ? 'Vui lòng điền thông tin này.' : control.validity.rangeUnderflow || control.validity.rangeOverflow ? `Giá trị phải nằm trong khoảng ${control.getAttribute('min') || 'cho phép'} đến ${control.getAttribute('max') || 'cho phép'}.` : 'Vui lòng kiểm tra lại giá trị đã nhập.';
  }
  return result;
}

export function focusFirstFieldError(form: HTMLFormElement, errors: FieldErrors): void {
  for (const control of Array.from(form.querySelectorAll<HTMLElement>('[name]'))) {
    if (errors[control.getAttribute('name') || '']) {
      control.focus();
      return;
    }
  }
}
