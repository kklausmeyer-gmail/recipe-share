// Edge Function: fetches a recipe web page (or its photo) on behalf of the app,
// because browsers can't read other sites directly. Members only.
//
//   POST { url, mode: 'recipe' } -> RecipeDraft JSON
//   POST { url, mode: 'image' }  -> image bytes (application/octet-stream)

import { createClient } from 'npm:@supabase/supabase-js@2'
import { FETCH_HEADERS, parseRecipeHtml } from '../_shared/recipe-parse.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: member } = await supabase.rpc('is_member')
  if (member !== true) return json({ error: 'Not a member' }, 403)

  let url: string
  let mode: string
  try {
    const body = await req.json()
    url = new URL(body.url).toString()
    mode = body.mode ?? 'recipe'
    if (!/^https?:/.test(url)) throw new Error('bad scheme')
  } catch {
    return json({ error: 'Send { url, mode }' }, 400)
  }

  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' })
    if (!res.ok) return json({ error: `The site responded ${res.status}` }, 502)

    if (mode === 'image') {
      const type = res.headers.get('content-type') ?? ''
      if (!type.startsWith('image/')) return json({ error: 'Not an image' }, 400)
      return new Response(await res.arrayBuffer(), {
        headers: { ...cors, 'Content-Type': 'application/octet-stream' },
      })
    }

    const draft = parseRecipeHtml(await res.text(), res.url || url)
    if (!draft) return json({ error: "Couldn't find a recipe on that page" }, 422)
    return json(draft)
  } catch (e) {
    return json({ error: `Fetch failed: ${(e as Error).message}` }, 502)
  }
})
