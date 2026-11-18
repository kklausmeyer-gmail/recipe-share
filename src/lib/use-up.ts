import { isHeader, parseIngredient } from './ingredients'
import { weekStart } from './dates'
import type { PlanEntry } from './types'

export interface UseUpItem {
  id: string
  week_start: string
  ingredient: string
  added_on: string
  completed: boolean
}

export function canCoverIngredient(item: UseUpItem, entry: PlanEntry): boolean {
  return weekStart(entry.plan_date) === item.week_start && entry.plan_date >= item.added_on &&
    (entry.status === 'planned' || entry.status === 'cooked')
}

const singular = (word: string) => {
  if (word.endsWith('oes')) return word.slice(0, -2)
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y'
  if (/(ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2)
  return word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word
}
const words = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+/g)?.map(singular) ?? []


/** Match whole ingredient words, ignoring quantities, case, and simple plurals. */
export function usesIngredient(lines: string[], ingredient: string): boolean {
  const wanted = words(ingredient)
  return wanted.length > 0 && lines.some((line) => {
    if (isHeader(line)) return false
    const actual = words(parseIngredient(line).item)
    return wanted.every((word) => actual.includes(word))
  })
}
