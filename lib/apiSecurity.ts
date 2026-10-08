const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>()

/** Best-effort per-instance limiter for public demo endpoints. Use a provider-level
 * firewall/rate limiter for production because serverless instances are ephemeral. */
export function checkRateLimit(request: Request, limit = 60, windowMs = 60_000) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const clientKey = forwarded || request.headers.get('x-real-ip') || 'anonymous'
  const now = Date.now()
  if (rateLimitBuckets.size > 10_000) {
    for (const [key, value] of rateLimitBuckets) {
      if (value.resetAt <= now) rateLimitBuckets.delete(key)
    }
  }
  const bucket = rateLimitBuckets.get(clientKey)

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(clientKey, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0 }
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }

  bucket.count += 1
  return { allowed: true, retryAfter: 0 }
}

export function hasBodyTooLarge(request: Request, maxBytes: number) {
  const length = Number(request.headers.get('content-length') || 0)
  return Number.isFinite(length) && length > maxBytes
}
