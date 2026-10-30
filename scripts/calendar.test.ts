import assert from 'node:assert/strict'
import { eventOccursOn, eventsOn, eventTimeLabel, suggestionDates, validateCalendarEvent, visiblePlanDays } from '../src/lib/calendar.ts'
import type { CalendarEvent, CalendarEventInput, PlanEntry } from '../src/lib/types.ts'

const event: CalendarEventInput = {
  title: 'Practice', start_date: '2026-10-30', recurrence: 'weekly', end_date: '2026-11-13',
  start_time: '17:00', end_time: '18:00', notes: null,
}
assert.equal(eventOccursOn(event, '2026-10-23'), false)
assert.equal(eventOccursOn(event, '2026-10-30'), true)
assert.equal(eventOccursOn(event, '2026-11-06'), true) // Across daylight-saving change.
assert.equal(eventOccursOn(event, '2026-11-07'), false)
assert.equal(eventOccursOn(event, '2026-11-13'), true) // Inclusive end.
assert.equal(eventOccursOn(event, '2026-11-20'), false)
assert.equal(eventOccursOn({ ...event, end_date: null }, '2027-01-01'), true)
assert.equal(eventOccursOn({ ...event, recurrence: 'none' }, '2026-11-06'), false)
assert.equal(eventOccursOn({ ...event, recurrence: 'none' }, '2026-10-30'), true)
assert.equal(eventOccursOn({ ...event, start_date: '2026-10-31' }, '2026-11-06'), false)
assert.equal(eventOccursOn({ ...event, start_date: '2026-10-31' }, '2026-11-07'), true)
assert.equal(eventTimeLabel(event), '5:00 PM–6:00 PM')
assert.equal(eventTimeLabel({ ...event, start_time: '00:00:00', end_time: '12:00:00' }), '12:00 AM–12:00 PM')
assert.equal(eventTimeLabel({ ...event, start_time: null, end_time: null }), 'All day')
assert.equal(validateCalendarEvent(event), null)
assert.notEqual(validateCalendarEvent({ ...event, title: '   ' }), null)
assert.notEqual(validateCalendarEvent({ ...event, end_date: '2026-10-29' }), null)
assert.notEqual(validateCalendarEvent({ ...event, end_time: null }), null)
assert.notEqual(validateCalendarEvent({ ...event, end_time: '16:59' }), null)
const late = { ...event, id: 'late' }
const early = { ...event, id: 'early', start_time: '09:00', end_time: '10:00' }
const once = { ...event, id: 'once', recurrence: 'none' as const }
assert.deepEqual(eventsOn([late, once, early] as CalendarEvent[], '2026-11-06').map((e) => e.id), ['early', 'late'])

const collapsed = visiblePlanDays('2026-10-26', false)
const expanded = visiblePlanDays('2026-10-26', true)
assert.equal(collapsed.length, 7)
assert.equal(expanded.length, 14)
assert.equal(expanded[13], '2026-11-08')
const entries: PlanEntry[] = [
  { id: 'a', plan_date: '2026-10-31', meal: 'dinner', label: 'Dinner', recipe_id: null, status: 'planned' },
  { id: 'b', plan_date: '2026-11-02', meal: 'dinner', label: 'Suggestion', recipe_id: null, status: 'suggested' },
  { id: 'c', plan_date: '2026-11-03', meal: 'dinner', label: 'Dinner', recipe_id: null, status: 'cooked' },
  { id: 'd', plan_date: '2026-11-04', meal: 'dinner', label: 'Skipped', recipe_id: null, status: 'skipped' },
]
assert.deepEqual(suggestionDates(collapsed, entries, ['2026-11-01'], '2026-10-30'), ['2026-10-30'])
assert.deepEqual(suggestionDates(expanded, entries, ['2026-11-01'], '2026-10-30'), ['2026-10-30', '2026-11-02', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'])
console.log('Calendar recurrence and visible-day suggestion checks passed')
