import assert from 'node:assert/strict'
import { withJwtRetry } from '../src/lib/retry-fetch.ts'

const originalTimer = globalThis.setTimeout
globalThis.setTimeout = ((callback: () => void) => originalTimer(callback, 0)) as typeof setTimeout
try {
  let calls = 0
  const bodies: string[] = []
  const recovered = withJwtRetry(async (input) => {
    calls++
    bodies.push(await (input as Request).text())
    return calls === 1
      ? Response.json({ code: 'PGRST303', message: 'JWT issued at future' }, { status: 401 })
      : Response.json({ saved: true })
  })
  assert.equal((await recovered('https://example.com/rest/v1/meal_plan', { method: 'POST', body: '{"label":"Dinner"}' })).status, 200)
  assert.deepEqual(bodies, ['{"label":"Dinner"}', '{"label":"Dinner"}'])
  for (const [status, code, message, expected] of [
    [401, 'PGRST303', 'JWT issued at future', 4],
    [401, 'PGRST303', 'JWT expired', 1],
    [403, '42501', 'permission denied', 1],
    [500, 'XX000', 'server error', 1],
  ] as const) {
    calls = 0
    const fetcher = withJwtRetry(async () => {
      calls++
      return Response.json({ code, message }, { status })
    })
    assert.equal((await fetcher('https://example.com')).status, status)
    assert.equal(calls, expected)
  }
  console.log('JWT retry checks passed')
} finally {
  globalThis.setTimeout = originalTimer
}
