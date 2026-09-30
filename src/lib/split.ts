// Splitting one recipe with variations (e.g. overnight oats with six flavor
// add-ins) into one recipe per variation.

import { headerText, isHeader } from './ingredients'

export interface Section {
  /** Heading text, or null for the lines before the first heading. */
  title: string | null
  lines: string[]
}

/** Groups lines into sections by their "#" headings. */
export function toSections(lines: string[]): Section[] {
  const sections: Section[] = []
  let current: Section = { title: null, lines: [] }
  for (const line of lines) {
    if (isHeader(line)) {
      if (current.title !== null || current.lines.length) sections.push(current)
      current = { title: headerText(line), lines: [] }
    } else {
      current.lines.push(line)
    }
  }
  if (current.title !== null || current.lines.length) sections.push(current)
  return sections
}

const fromSections = (sections: Section[]): string[] =>
  sections.flatMap((s) => (s.title === null ? s.lines : [`# ${s.title}`, ...s.lines]))

const same = (a: string | null, b: string) => a?.trim().toLowerCase() === b.trim().toLowerCase()

export interface Variation {
  name: string
  title: string
  ingredients: string[]
  steps: string[]
}

/**
 * Builds one recipe per chosen ingredient section. Every other ingredient
 * section is shared. Steps under a heading that matches a variation's name go
 * only to that variation; all other steps are shared.
 */
export function buildVariations(
  baseTitle: string,
  ingredients: string[],
  steps: string[],
  variationNames: string[],
): Variation[] {
  const ing = toSections(ingredients)
  const st = toSections(steps)
  return variationNames.map((name) => {
    const keepIng = ing.filter((s) => !variationNames.some((v) => same(s.title, v)) || same(s.title, name))
    const keepSteps = st.filter((s) => !variationNames.some((v) => same(s.title, v)) || same(s.title, name))
    return {
      name,
      title: `${baseTitle.trim()} - ${name.trim()}`,
      ingredients: fromSections(keepIng),
      steps: fromSections(keepSteps),
    }
  })
}
