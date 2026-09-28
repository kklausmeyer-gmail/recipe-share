import { ChevronLeft, ChevronRight, ExternalLink, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { signedUrl } from '../lib/photos'
import type { Photo } from '../lib/types'

interface Props {
  photos: Photo[]
  start: number
  onClose: () => void
}

/** Full-screen viewer for original recipe pages and dish photos, with tap-to-zoom. */
export default function Lightbox({ photos, start, onClose }: Props) {
  const [i, setI] = useState(start)
  const [zoom, setZoom] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const photo = photos[i]

  useEffect(() => {
    let live = true
    setUrl(null)
    setZoom(false)
    signedUrl(photo.path_lg).then((u) => live && setUrl(u))
    return () => {
      live = false
    }
  }, [photo.path_lg])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, photos.length - 1))
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, photos.length])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Close">
          <X />
        </button>
        <span className="text-sm text-white/70">
          {i + 1} / {photos.length}
        </span>
        <div className="flex gap-1">
          <button onClick={() => setZoom((z) => !z)} className="rounded-full p-2 hover:bg-white/10" aria-label="Zoom">
            {zoom ? <ZoomOut /> : <ZoomIn />}
          </button>
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="rounded-full p-2 hover:bg-white/10" aria-label="Open full size">
              <ExternalLink />
            </a>
          )}
        </div>
      </div>
      <div className={`relative flex-1 ${zoom ? 'overflow-auto' : 'flex items-center justify-center overflow-hidden'}`}>
        {url && (
          <img
            src={url}
            alt=""
            onClick={() => setZoom((z) => !z)}
            className={zoom ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain'}
            style={zoom ? { width: '220%' } : undefined}
          />
        )}
      </div>
      {photos.length > 1 && !zoom && (
        <>
          <button
            onClick={() => setI((n) => Math.max(n - 1, 0))}
            disabled={i === 0}
            className="absolute left-2 top-1/2 rounded-full bg-black/40 p-2 disabled:opacity-20"
            aria-label="Previous"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            onClick={() => setI((n) => Math.min(n + 1, photos.length - 1))}
            disabled={i === photos.length - 1}
            className="absolute right-2 top-1/2 rounded-full bg-black/40 p-2 disabled:opacity-20"
            aria-label="Next"
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}
    </div>
  )
}
