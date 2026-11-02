import { FETCH_HEADERS, parseRecipeHtml } from '../supabase/functions/_shared/recipe-parse.ts'

export async function retryLink(url: string, fetchPage: typeof fetch = fetch) {
  const response = await fetchPage(url, { headers: FETCH_HEADERS, redirect: 'follow', signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const draft = parseRecipeHtml(await response.text(), url)
  if (!draft?.ingredients.length || !draft.steps.length) throw new Error('no complete recipe data on the page')
  return draft
}
