export type CalendarView = '30' | 'month' | 'list';
export type CalendarViewStorage = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): CalendarViewStorage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; }
  catch { return null; }
}

function preferenceKey(mobile: boolean) {
  return `tutorspace.calendar.view.${mobile ? 'mobile' : 'desktop'}`;
}

export function initialCalendarView(mobile: boolean, storage = browserStorage()): CalendarView {
  try {
    const stored = storage?.getItem(preferenceKey(mobile));
    if (stored === '30' || stored === 'month' || stored === 'list') return stored;
  } catch { /* Browsers may block access to local storage. */ }
  return mobile ? 'list' : '30';
}

export function saveCalendarView(mobile: boolean, view: CalendarView, storage = browserStorage()) {
  try { storage?.setItem(preferenceKey(mobile), view); }
  catch { /* The current selection still works when storage is unavailable. */ }
}
