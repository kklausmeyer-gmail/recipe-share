import { Star } from 'lucide-react'

interface Props {
  value: number | null
  onChange?: (stars: number) => void
  size?: number
  className?: string
}

export default function Stars({ value, onChange, size = 16, className = '' }: Props) {
  const v = value ?? 0
  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`} aria-label={value ? `${value.toFixed(1)} stars` : 'Not rated'}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = v >= n - 0.25 ? 1 : v >= n - 0.75 ? 0.5 : 0
        const icon = (
          <span className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute text-line" fill="currentColor" strokeWidth={0} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: fill === 1 ? '100%' : '50%' }}>
                <Star size={size} className="text-amber-500" fill="currentColor" strokeWidth={0} />
              </span>
            )}
          </span>
        )
        return onChange ? (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="p-0.5 transition-transform active:scale-90"
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            {icon}
          </button>
        ) : (
          <span key={n}>{icon}</span>
        )
      })}
    </div>
  )
}
