import { addDays, parseISODate, weekStart } from './dates'
import type { CalendarEvent, CalendarEventInput, PlanEntry } from './types'

export function eventOccursOn(event: CalendarEventInput, date: string): boolean {
  if (date < event.start_date || (event.end_date && date > event.end_date)) return false
  if (event.recurrence === 'none') return date === event.start_date
  return parseISODate(event.start_date).getDay() === parseISODate(date).getDay()
}

export function eventsOn(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events.filter((event) => eventOccursOn(event, date)).sort((a, b) =>
    (a.start_time ?? '').localeCompare(b.start_time ?? '') || a.title.localeCompare(b.title),
  )
}

export function eventTimeLabel(event: CalendarEventInput): string {
  const format = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`
  }
  return event.start_time && event.end_time ? `${format(event.start_time)}–${format(event.end_time)}` : 'All day'
}

export function validateCalendarEvent(event: CalendarEventInput): string | null {
  if (!event.title.trim() || event.title.trim().length > 200) return 'Enter an event title (up to 200 characters).'
  if (!event.start_date) return 'Choose a start date.'
  if (event.end_date && event.end_date < event.start_date) return 'End date must be on or after the start date.'
  if (!!event.start_time !== !!event.end_time) return 'Enter both start and end times, or leave both empty for an all-day event.'
  if (event.start_time && event.end_time && event.end_time <= event.start_time) return 'End time must be after the start time on the same day.'
  if ((event.notes?.length ?? 0) > 5000) return 'Notes must be at most 5,000 characters.'
  return null
}

export function visiblePlanDays(start: string, expanded: boolean): string[] {
  return Array.from({ length: expanded ? 14 : 7 }, (_, i) => addDays(start, i))
}

export function shouldExpandNextWeek(start: string, now: string): boolean {
  return start === weekStart(now) && now >= addDays(start, 2)
}

export function defaultEventEndTime(start: string | null): string | null {
  if (!start) return null
  const [hours, minutes] = start.split(':').map(Number)
  // Events currently end on the same day; don't silently wrap into an invalid range.
  if (hours >= 23) return null
  return `${String(hours + 1).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function suggestionDates(days: string[], entries: PlanEntry[], cookedDates: string[], now: string): string[] {
  return days.filter((date) => date >= now && !entries.some((entry) => entry.plan_date === date && entry.status !== 'suggested') && !cookedDates.includes(date))
}
