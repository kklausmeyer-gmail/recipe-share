import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { CookEntry, Member, Photo, Rating, Recipe, Tag } from './types'
import type { RecipeStats } from './suggest'

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

interface AuthState {
  session: Session | null
  member: Member | null
  loading: boolean
  isOwner: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>(null!)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) {
        setMember(null)
        setLoading(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const email = session?.user.email?.toLowerCase()
  useEffect(() => {
    if (!userId || !email) return
    let cancelled = false
    ;(async () => {
      await supabase.rpc('claim_membership')
      const { data } = await supabase.from('members').select('*').eq('email', email).maybeSingle()
      if (!cancelled) {
        setMember((data as Member) ?? null)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, email])

  const value = useMemo<AuthState>(
    () => ({
      session,
      member,
      loading,
      isOwner: member?.role === 'owner',
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, member, loading],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ---------------------------------------------------------------------------
// Data: the whole recipe box is small enough to load at once, which makes
// search and filtering instant.
// ---------------------------------------------------------------------------

async function fetchAll<T>(table: string, columns = '*', order?: string): Promise<T[]> {
  const out: T[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    let q = supabase.from(table).select(columns).range(from, from + page - 1)
    if (order) q = q.order(order)
    const { data, error } = await q
    if (error) throw error
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < page) return out
  }
}

interface DataState {
  loaded: boolean
  error: string | null
  recipes: Recipe[]
  photos: Photo[]
  ratings: Rating[]
  cookLog: CookEntry[]
  members: Member[]
  tags: Tag[]
  photosByRecipe: Map<string, Photo[]>
  stats: Map<string, RecipeStats & { myRating: number | null }>
  nameOf: (userId: string | null | undefined) => string
  recipeById: (id: string | undefined) => Recipe | undefined
  refresh: () => Promise<void>
}

const DataContext = createContext<DataState>(null!)
export const useData = () => useContext(DataContext)

export function DataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const myId = session?.user.id
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [ratings, setRatings] = useState<Rating[]>([])
  const [cookLog, setCookLog] = useState<CookEntry[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [tags, setTags] = useState<Tag[]>([])

  const refresh = useCallback(async () => {
    try {
      const [r, p, ra, c, m, t] = await Promise.all([
        fetchAll<Recipe>('recipes', '*', 'title'),
        fetchAll<Photo>('recipe_photos', '*', 'created_at'),
        fetchAll<Rating>('ratings', 'recipe_id,user_id,stars'),
        fetchAll<CookEntry>('cook_log', '*', 'cooked_on'),
        fetchAll<Member>('members', '*', 'display_name'),
        fetchAll<Tag>('tags', '*', 'sort'),
      ])
      setRecipes(r)
      setPhotos(p)
      setRatings(ra)
      setCookLog(c)
      setMembers(m)
      setTags(t)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (myId) refresh()
  }, [myId, refresh])

  const photosByRecipe = useMemo(() => {
    const map = new Map<string, Photo[]>()
    for (const p of photos) {
      const list = map.get(p.recipe_id) ?? []
      list.push(p)
      map.set(p.recipe_id, list)
    }
    return map
  }, [photos])

  const stats = useMemo(() => {
    const map = new Map<string, RecipeStats & { myRating: number | null }>()
    const get = (id: string) => {
      let s = map.get(id)
      if (!s) {
        s = { avgRating: null, lastCooked: null, timesCooked: 0, myRating: null }
        map.set(id, s)
      }
      return s
    }
    const sums = new Map<string, [number, number]>()
    for (const r of ratings) {
      const [sum, n] = sums.get(r.recipe_id) ?? [0, 0]
      sums.set(r.recipe_id, [sum + r.stars, n + 1])
      if (r.user_id === myId) get(r.recipe_id).myRating = r.stars
    }
    for (const [id, [sum, n]] of sums) get(id).avgRating = sum / n
    for (const c of cookLog) {
      const s = get(c.recipe_id)
      s.timesCooked++
      if (!s.lastCooked || c.cooked_on > s.lastCooked) s.lastCooked = c.cooked_on
    }
    return map
  }, [ratings, cookLog, myId])

  const value = useMemo<DataState>(() => {
    const names = new Map(members.filter((m) => m.user_id).map((m) => [m.user_id!, m.display_name]))
    const byId = new Map(recipes.map((r) => [r.id, r]))
    return {
      loaded,
      error,
      recipes,
      photos,
      ratings,
      cookLog,
      members,
      tags,
      photosByRecipe,
      stats,
      nameOf: (id) => (id && names.get(id)) || 'Someone',
      recipeById: (id) => (id ? byId.get(id) : undefined),
      refresh,
    }
  }, [loaded, error, recipes, photos, ratings, cookLog, members, tags, photosByRecipe, stats, refresh])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
