/**
 * Google Calendar & iCalendar (.ics) integration service for bq-health
 * Re-exports shared calendar service from @bq/theme/calendar
 */

export {
  type CalendarEventParams,
  getGoogleCalendarUrl,
  openGoogleCalendar,
  downloadIcsFile
} from '@bq/theme/calendar';

