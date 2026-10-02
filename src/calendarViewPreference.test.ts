import { describe, expect, it } from 'vitest';
import { initialCalendarView, saveCalendarView, type CalendarViewStorage } from './calendarViewPreference';

function memoryStorage(values: Record<string, string> = {}): CalendarViewStorage {
  return { getItem: key => values[key] ?? null, setItem: (key, value) => { values[key] = value; } };
}

describe('Calendar view preferences', () => {
  it('defaults to list on mobile and a calendar grid on desktop', () => {
    const storage = memoryStorage();
    expect(initialCalendarView(true, storage)).toBe('list');
    expect(initialCalendarView(false, storage)).toBe('30');
  });
  it('remembers independent selections for mobile and desktop', () => {
    const storage = memoryStorage();
    saveCalendarView(true, 'month', storage);
    saveCalendarView(false, 'list', storage);
    expect(initialCalendarView(true, storage)).toBe('month');
    expect(initialCalendarView(false, storage)).toBe('list');
  });
  it('ignores invalid stored values and safely handles unavailable storage', () => {
    const storage = memoryStorage({ 'tutorspace.calendar.view.mobile': 'week' });
    expect(initialCalendarView(true, storage)).toBe('list');
    const blocked: CalendarViewStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
    expect(initialCalendarView(false, blocked)).toBe('30');
    expect(() => saveCalendarView(true, 'list', blocked)).not.toThrow();
    expect(initialCalendarView(true, null)).toBe('list');
  });
});
