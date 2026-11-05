/**
 * Google Calendar & iCalendar (.ics) integration service for bq-health
 */

export interface CalendarEventParams {
  title: string;
  startDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  durationMinutes?: number;
  details?: string;
  location?: string;
}

/**
 * Formats a Date to Google Calendar UTC string: YYYYMMDDTHHmmSSZ
 */
function formatGoogleDate(date: Date): string {
  return date.toISOString().replace(/-|:|\.\d\d\d/g, '');
}

/**
 * Builds a direct Google Calendar web URL that opens the event pre-filled in a new tab
 */
export function getGoogleCalendarUrl(params: CalendarEventParams): string {
  const { title, startDate, startTime, durationMinutes = 45, details = '', location = '' } = params;

  let start: Date;
  let end: Date;

  if (startTime && startTime.includes(':')) {
    const [h, m] = startTime.split(':').map(Number);
    start = new Date(`${startDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
    end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  } else {
    // All day event
    const parts = startDate.split('-').map(Number);
    start = new Date(parts[0], parts[1] - 1, parts[2], 9, 0, 0);
    end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  }

  const startUtc = formatGoogleDate(start);
  const endUtc = formatGoogleDate(end);

  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startUtc}/${endUtc}`,
    details: details,
    location: location
  });

  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}

/**
 * Generates and triggers download of a universal .ics iCalendar file
 */
export function downloadIcsFile(params: CalendarEventParams, fileNamePrefix = 'rdv-sante'): void {
  const { title, startDate, startTime, durationMinutes = 45, details = '', location = '' } = params;

  let start: Date;
  let end: Date;

  if (startTime && startTime.includes(':')) {
    const [h, m] = startTime.split(':').map(Number);
    start = new Date(`${startDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
    end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  } else {
    const parts = startDate.split('-').map(Number);
    start = new Date(parts[0], parts[1] - 1, parts[2], 9, 0, 0);
    end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  }

  const startStr = formatGoogleDate(start);
  const endStr = formatGoogleDate(end);
  const nowStr = formatGoogleDate(new Date());

  const cleanText = (str: string) => str.replace(/\n/g, '\\n').replace(/,/g, '\\,');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BQ-Hub//BQ-Health//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:bq-health-${Date.now()}-${Math.random().toString(36).substring(2, 8)}@bq-hub`,
    `DTSTAMP:${nowStr}`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:${cleanText(title)}`,
    details ? `DESCRIPTION:${cleanText(details)}` : '',
    location ? `LOCATION:${cleanText(location)}` : '',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileNamePrefix}-${startDate}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
