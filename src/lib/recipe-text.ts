export interface TextRecipe {
  title: string
  servings: string | null
  prep_minutes: number | null
  cook_minutes: number | null
  total_minutes: number | null
  ingredients: string[]
  steps: string[]
}

const heading = (line: string) => line.replace(/^#+\s*/, '').replace(/[:：]\s*$/, '').trim()
const ingredientHeading = /^(?:ingredients|what you(?:’|')?ll need)(?:\s*\([^)]*\))?$/i
const stepHeading = /^(?:instructions|directions|method|preparation|steps)(?:\s*\([^)]*\))?$/i
const endHeading = /^(?:notes?|recipe notes?|nutrition(?:al)?(?: information| facts)?|storage|reviews?|comments?)(?:\s*\([^)]*\))?$/i
const bullet = /^[•●▪◦‣*–—-]\s*/
const number = /^(?:step\s+\d+[.)：:]?|\d+[.)：:])\s+/i

function minutes(text: string): number | null {
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i)
  const mins = text.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i)
  if (hours || mins) return Math.round(Number(hours?.[1] ?? 0) * 60 + Number(mins?.[1] ?? 0))
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : null
}

/** Conservative, local extraction: keep quantities and words as pasted. */
export function parseRecipeText(text: string): TextRecipe {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map(l => l.trim()).filter(Boolean)
  const result: TextRecipe = { title: '', servings: null, prep_minutes: null, cook_minutes: null, total_minutes: null, ingredients: [], steps: [] }
  let section: 'intro' | 'ingredients' | 'steps' | 'end' = 'intro'
  let numberedSteps = false
  let nextStep = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const label = heading(line)
    if (ingredientHeading.test(label)) { section = 'ingredients'; continue }
    if (stepHeading.test(label)) { section = 'steps'; numberedSteps = false; continue }
    if (endHeading.test(label) && section !== 'intro') { section = 'end'; continue }
    if (section === 'intro') {
      const time = label.match(/^(prep(?:aration)?|cook(?:ing)?|total)(?:\s+time)?\s*:?\s*(.*)$/i)
      if (time) {
        const value = minutes(time[2] || lines[i + 1] || '')
        if (value !== null) {
          const field = /^prep/i.test(time[1]) ? 'prep_minutes' : /^cook/i.test(time[1]) ? 'cook_minutes' : 'total_minutes'
          result[field] = value
          if (!time[2]) i++
          continue
        }
      }
      const servings = label.match(/^(?:servings?|serves|yield)\s*:?\s*(.*)$/i)
      if (servings) {
        const value = servings[1] || lines[i + 1] || ''
        if (/\d/.test(value)) { result.servings = value; if (!servings[1]) i++; continue }
      }
      if (!result.title && !/^https?:\/\//i.test(line)) result.title = line.replace(/^#+\s*/, '')
    } else if (section === 'ingredients') {
      const clean = line.replace(bullet, '').replace(/^\[\s*\]\s*/, '')
      result.ingredients.push(/[:：]$/.test(clean) ? `# ${heading(clean)}` : clean)
    } else if (section === 'steps') {
      if (/^(?:step\s+)?\d+[.)：:]?$/i.test(line)) { nextStep = true; numberedSteps = true; continue }
      const numbered = nextStep || number.test(line)
      nextStep = false
      const clean = line.replace(bullet, '').replace(number, '')
      if (/[:：]$/.test(clean) && clean.length < 80 && !numbered) {
        result.steps.push(`# ${heading(clean)}`)
      } else if (numberedSteps && !numbered && !bullet.test(line) && result.steps.length && !result.steps[result.steps.length - 1].startsWith('# ')) {
        result.steps[result.steps.length - 1] += ` ${clean}`
      } else result.steps.push(clean)
      if (numbered) numberedSteps = true
    }
  }
  return result
}
