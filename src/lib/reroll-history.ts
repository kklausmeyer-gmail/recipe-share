type Choice = { recipe_id?: string | null; label?: string | null }
type Seen = { recipes: Set<string>; labels: Set<string> }

/** Per-day choices already shown during this planner visit. */
export class RerollHistory {
  private days = new Map<string, Seen>()

  get(date: string): Seen | undefined { return this.days.get(date) }

  remember(date: string, choices: Choice[]) {
    const seen = this.days.get(date) ?? { recipes: new Set<string>(), labels: new Set<string>() }
    for (const choice of choices) {
      if (choice.recipe_id) seen.recipes.add(choice.recipe_id)
      if (choice.label) seen.labels.add(choice.label.toLowerCase())
    }
    this.days.set(date, seen)
  }
}
