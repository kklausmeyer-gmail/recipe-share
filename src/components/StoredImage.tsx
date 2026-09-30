import { useCallback, useEffect, useState } from 'react'
import { cachedUrl, signedUrl } from '../lib/photos'

interface Props {
  path: string | null | undefined
  alt: string
  className?: string
  onClick?: () => void
}

/** An image from the private photo bucket. */
export default function StoredImage({ path, alt, className = '', onClick }: Props) {
  const [url, setUrl] = useState<string | null>(() => (path ? cachedUrl(path) : null))
  // Which URL has finished loading. Keyed by URL (not a true/false flag) so a
  // load event that arrives before or after a re-render can't leave it hidden.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    if (!path) {
      setUrl(null)
      return
    }
    const hit = cachedUrl(path)
    if (hit) setUrl(hit)
    else signedUrl(path).then((u) => live && setUrl(u))
    return () => {
      live = false
    }
  }, [path])

  // Images already in the browser cache can finish before onLoad is attached.
  const checkComplete = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) setLoadedUrl(img.getAttribute('src'))
  }, [])

  if (!path) return <Placeholder className={className} />
  const visible = url != null && loadedUrl === url
  return (
    <div className={`relative overflow-hidden bg-line/60 ${className}`} onClick={onClick}>
      {url && (
        <img
          ref={checkComplete}
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoadedUrl(url)}
          className={`h-full w-full object-cover transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  )
}

export function Placeholder({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-accent-soft to-sage-soft ${className}`}>
      <svg viewBox="0 0 24 24" className="h-10 w-10 text-accent/40" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
        <line x1="6" x2="18" y1="17" y2="17" />
      </svg>
    </div>
  )
}
