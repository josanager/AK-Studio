/** Bounded retries. Call POST only for endpoints with an idempotent job ID. */
export async function downloadFetch(url: string, init: RequestInit = {}, timeoutMs = 45_000): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 2) return response;
      await response.body?.cancel();
    } catch (error) {
      if (attempt === 2) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
  }
}
