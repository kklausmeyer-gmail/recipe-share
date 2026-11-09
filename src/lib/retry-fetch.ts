/** Retry only explicit JWT clock-skew rejections, before PostgREST runs the request. */
export function withJwtRetry(fetcher: typeof fetch): typeof fetch {
  return async (input, init) => {
    // Keep a replayable copy, including when the caller supplied a Request body.
    const request = new Request(input, init)
    for (let attempt = 0; ; attempt++) {
      const response = await fetcher(request.clone())
      if (response.status !== 401 || attempt >= 3) return response
      const body = await response.clone().json().catch(() => null)
      if (body?.code !== 'PGRST303' || !/JWT issued at future/i.test(body.message ?? '')) return response
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
    }
  }
}
