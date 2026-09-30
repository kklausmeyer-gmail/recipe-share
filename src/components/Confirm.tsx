import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import Modal from './Modal'

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false))

/**
 * In-app replacement for window.confirm(), which Safari can silently block
 * (for example after "Block dialogs from this site" or in home-screen apps).
 */
export const useConfirm = () => useContext(ConfirmContext)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((ok: boolean) => void) | undefined>(undefined)

  const confirm = useCallback<ConfirmFn>(
    (o) =>
      new Promise((resolve) => {
        resolver.current = resolve
        setOpts(o)
      }),
    [],
  )

  const close = (ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = undefined
    setOpts(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <Modal title={opts.title} onClose={() => close(false)}>
          {opts.message && <p className="text-muted">{opts.message}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn" onClick={() => close(false)}>
              Cancel
            </button>
            <button className="btn-primary !bg-red-700 hover:!bg-red-800" onClick={() => close(true)} autoFocus>
              {opts.confirmLabel ?? 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  )
}
