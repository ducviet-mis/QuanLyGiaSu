import { describe, expect, it } from 'vitest';
import { closeIntent, formSnapshot, validateSessionFields, validateStudentFields } from './formValidation';

describe('Editor close protection', () => {
  it('keeps both pristine and dirty editors open during save', () => {
    expect(closeIntent(false, true)).toBe('stay');
    expect(closeIntent(true, true)).toBe('stay');
    expect(closeIntent(false, false)).toBe('close');
    expect(closeIntent(true, false)).toBe('confirm');
  });
  it('detects avatar, recurrence and scope edits while treating weekday order as equivalent', () => {
    expect(formSnapshot({ avatar: 'old' })).not.toBe(formSnapshot({ avatar: 'new' }));
    const schedule = { recurring: false, scope: 'one', weekdays: [1, 3], endDate: '2026-12-01' };
    expect(formSnapshot(schedule)).toBe(formSnapshot({ ...schedule, weekdays: [3, 1] }));
    expect(formSnapshot(schedule)).not.toBe(formSnapshot({ ...schedule, recurring: true }));
    expect(formSnapshot(schedule)).not.toBe(formSnapshot({ ...schedule, scope: 'series' }));
  });
});

describe('Errors at the fields that need correction', () => {
  const pupil = { name: 'An', grade: '10', subject: 'Toán', rate: 150000, parentPhone: '' };
  it('returns all missing pupil fields so a submit can focus the first and show every correction', () => {
    const errors = validateStudentFields({ ...pupil, name: '  ', grade: '', subject: '' });
    expect(Object.keys(errors)).toEqual(['name', 'grade', 'subject']);
    expect(validateStudentFields(pupil)).toEqual({});
  });
  it('keeps existing integer fee and optional phone rules', () => {
    expect(Object.keys(validateStudentFields({ ...pupil, rate: 0, parentPhone: '+84 123 456' }))).toEqual([]);
    expect(Object.keys(validateStudentFields({ ...pupil, rate: 1.5, parentPhone: 'abc' }))).toEqual(['rate', 'parentPhone']);
  });
  const lesson = { subject: 'Toán', startTime: '18:00', endTime: '19:30', date: '2026-10-01', endDate: '2026-11-01', weekdays: [4], actualMinutes: '' };
  it('identifies invalid time range and actual duration without modifying lesson rules', () => {
    expect(Object.keys(validateSessionFields({ ...lesson, endTime: '17:00', actualMinutes: '0' }, true, false))).toEqual(['endTime', 'actualMinutes']);
    expect(validateSessionFields({ ...lesson, startTime: '06:00', endTime: '18:00', actualMinutes: '1440' }, true, false)).toEqual({});
  });
  it('validates recurrence only when active and marks missing weekdays and the ending date separately', () => {
    const invalid = { ...lesson, weekdays: [], endDate: '2026-09-30' };
    expect(validateSessionFields(invalid, true, false)).toEqual({});
    expect(Object.keys(validateSessionFields(invalid, true, true))).toEqual(['weekdays', 'endDate']);
    expect(Object.keys(validateSessionFields({ ...lesson, endDate: '2029-01-01' }, true, true))).toEqual(['endDate']);
  });
});
