import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const KEY = 'scroll-positions-v1'

function load(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

/**
 * Opens each new page at the top, and puts you back where you were when you
 * go Back (so the recipe grid keeps its place).
 */
export default function ScrollManager() {
  const location = useLocation()
  const navType = useNavigationType()
  const positions = useRef(load())
  const current = useRef({ key: location.key, path: location.pathname, y: window.scrollY })

  // Track the scroll position of whatever page is showing.
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    const onScroll = () => {
      current.current.y = window.scrollY
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useLayoutEffect(() => {
    const prev = current.current
    if (prev.key === location.key) return
    // Remember where the page we're leaving was scrolled to.
    positions.current[prev.key] = prev.y
    try {
      sessionStorage.setItem(KEY, JSON.stringify(positions.current))
    } catch {
      // ignore
    }
    const pathChanged = prev.path !== location.pathname
    current.current = { key: location.key, path: location.pathname, y: prev.y }

    if (navType === 'POP' && positions.current[location.key] != null) {
      const y = positions.current[location.key]
      window.scrollTo(0, y)
      // Once more after layout settles (images and fonts can shift things).
      requestAnimationFrame(() => window.scrollTo(0, y))
    } else if (pathChanged) {
      // Search and filter changes on the grid keep the same page, so they don't jump.
      window.scrollTo(0, 0)
    }
  }, [location.key, location.pathname, navType])

  return null
}
