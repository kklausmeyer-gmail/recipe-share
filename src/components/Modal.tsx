import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

let openModals = 0
let unlockPage: (() => void) | undefined

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

export default function Modal({ title, onClose, children, wide }: Props) {
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current()
    window.addEventListener('keydown', onKey)
    if (openModals++ === 0) {
      const x = window.scrollX
      const y = window.scrollY
      const body = document.body
      const previous = { position: body.style.position, top: body.style.top, left: body.style.left, width: body.style.width, overflow: body.style.overflow }
      Object.assign(body.style, { position: 'fixed', top: `-${y}px`, left: `-${x}px`, width: '100%', overflow: 'hidden' })
      unlockPage = () => {
        Object.assign(body.style, previous)
        window.scrollTo({ left: x, top: y, behavior: 'instant' })
      }
    }
    return () => {
      window.removeEventListener('keydown', onKey)
      if (--openModals === 0) { unlockPage?.(); unlockPage = undefined }
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-none bg-ink/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-cream shadow-xl sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-cream/95 px-5 py-3 backdrop-blur">
          <h2 className="font-serif text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-line" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}
