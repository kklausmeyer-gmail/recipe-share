import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType, type Location } from 'react-router-dom'

const KEY = 'scroll-positions-v2'
const GRID_KEY = 'grid-search-v1'

function load(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

let lastGridSearch = (() => {
  try {
    return sessionStorage.getItem(GRID_KEY) ?? ''
  } catch {
    return ''
  }
})()

/** Link target for the Recipes tab: the grid with the search and filters you last used. */
export const gridHref = () => `/${lastGridSearch}`

const isGrid = (l: Pick<Location, 'pathname'>) => l.pathname === '/'
/** The grid remembers one position per search/filter combination; other pages per visit. */
const scrollKey = (l: Pick<Location, 'pathname' | 'search' | 'key'>) => (isGrid(l) ? `grid${l.search}` : l.key)

/**
 * Opens each new page at the top, and puts you back where you were on the
 * recipe grid, whether you return with Back or the Recipes tab.
 */
export default function ScrollManager() {
  const location = useLocation()
  const navType = useNavigationType()
  const positions = useRef(load())
  const current = useRef({ key: location.key, path: location.pathname, search: location.search, y: window.scrollY })

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
    if (isGrid(location)) {
      lastGridSearch = location.search
      try {
        sessionStorage.setItem(GRID_KEY, location.search)
      } catch {
        // ignore
      }
    }
    const prev = current.current
    if (prev.key === location.key) return
    // Remember where the page we're leaving was scrolled to.
    positions.current[scrollKey({ pathname: prev.path, search: prev.search, key: prev.key })] = prev.y
    try {
      sessionStorage.setItem(KEY, JSON.stringify(positions.current))
    } catch {
      // ignore
    }
    const pathChanged = prev.path !== location.pathname
    current.current = { key: location.key, path: location.pathname, search: location.search, y: prev.y }

    const saved = positions.current[scrollKey(location)]
    if (pathChanged && (isGrid(location) || navType === 'POP') && saved != null) {
      window.scrollTo(0, saved)
      // Once more after layout settles (fonts and images can shift things).
      requestAnimationFrame(() => window.scrollTo(0, saved))
    } else if (pathChanged) {
      // Search and filter changes on the grid keep the same page, so they don't jump.
      window.scrollTo(0, 0)
    }
  }, [location, navType])

  return null
}
