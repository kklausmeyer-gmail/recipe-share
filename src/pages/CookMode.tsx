import { Check, ChevronLeft, ChevronRight, ListChecks, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import LogCookModal from '../components/LogCookModal'
import { headerText, isHeader, scaleLine } from '../lib/ingredients'
import { useData } from '../lib/store'

/** Distraction-free cooking: one big step at a time, the screen stays on. */
export default function CookMode() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const factor = Number(params.get('x')) || 1
  const navigate = useNavigate()
  const { recipeById } = useData()
  const recipe = recipeById(id)

  const steps = useMemo(() => recipe?.steps.filter((s) => !isHeader(s)) ?? [], [recipe])
  const [step, setStep] = useState(-1) // -1 = ingredients checklist
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [showIngredients, setShowIngredients] = useState(false)
  const [logging, setLogging] = useState(false)

  // Keep the screen awake while cooking.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const request = async () => {
      try {
        lock = await navigator.wakeLock?.request('screen')
      } catch {
        // Not supported or not allowed; cooking still works.
      }
    }
    request()
    const onVisible = () => document.visibilityState === 'visible' && request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') setStep((s) => Math.min(s + 1, steps.length - 1))
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(s - 1, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [steps.length])

  if (!recipe) return null

  const toggle = (i: number) => {
    const next = new Set(checked)
    next.has(i) ? next.delete(i) : next.add(i)
    setChecked(next)
  }

  const ingredientList = (
    <ul className="space-y-1">
      {recipe.ingredients.map((line, i) =>
        isHeader(line) ? (
          <li key={i} className="pt-4 text-sm font-semibold uppercase tracking-wide text-accent-dark">
            {headerText(line)}
          </li>
        ) : (
          <li key={i}>
            <button
              onClick={() => toggle(i)}
              className={`flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left text-lg transition ${
                checked.has(i) ? 'text-muted line-through' : ''
              }`}
            >
              <span
                className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                  checked.has(i) ? 'border-sage bg-sage text-white' : 'border-line'
                }`}
              >
                {checked.has(i) && <Check size={16} />}
              </span>
              {scaleLine(line, factor)}
            </button>
          </li>
        ),
      )}
    </ul>
  )

  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <header className="flex items-center gap-2 border-b border-line px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button className="btn-ghost !px-2" onClick={() => navigate(-1)} aria-label="Exit cook mode">
          <X />
        </button>
        <h1 className="line-clamp-1 flex-1 font-serif text-lg font-semibold">{recipe.title}</h1>
        {step >= 0 && (
          <button className="btn-ghost !px-2" onClick={() => setShowIngredients(true)} aria-label="Ingredients">
            <ListChecks />
          </button>
        )}
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-5 py-6">
        {step === -1 ? (
          <>
            <h2 className="mb-2 font-serif text-2xl font-semibold">Gather ingredients</h2>
            {factor !== 1 && <p className="mb-2 text-sm text-muted">Scaled ×{Math.round(factor * 100) / 100}</p>}
            {ingredientList}
          </>
        ) : (
          <div className="flex min-h-full flex-col justify-center">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent">
              Step {step + 1} of {steps.length}
            </p>
            <p className="font-serif text-2xl leading-relaxed md:text-3xl">{steps[step]}</p>
          </div>
        )}
      </main>

      <footer className="border-t border-line px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button className="btn h-14 flex-1" onClick={() => setStep((s) => Math.max(s - 1, -1))} disabled={step === -1}>
            <ChevronLeft /> Back
          </button>
          {step < steps.length - 1 ? (
            <button className="btn-primary h-14 flex-[2] text-base" onClick={() => setStep((s) => s + 1)}>
              {step === -1 ? 'Start cooking' : 'Next'} <ChevronRight />
            </button>
          ) : (
            <button className="btn-primary h-14 flex-[2] text-base" onClick={() => setLogging(true)}>
              Done, log it! <Check />
            </button>
          )}
        </div>
      </footer>

      {showIngredients && (
        <div className="fixed inset-0 z-40 flex flex-col bg-cream">
          <div className="flex items-center justify-between border-b border-line px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <h2 className="font-serif text-xl font-semibold">Ingredients</h2>
            <button className="btn-ghost !px-2" onClick={() => setShowIngredients(false)} aria-label="Close">
              <X />
            </button>
          </div>
          <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-5 py-4">{ingredientList}</div>
        </div>
      )}
      {logging && <LogCookModal recipe={recipe} onClose={() => setLogging(false)} onLogged={() => navigate(`/r/${recipe.id}`)} />}
    </div>
  )
}
