import { Redis } from '@upstash/redis'

// Leading underscore keeps Vercel from turning this into its own route.
//
// One shared daily budget across theme/habit/breakdown per signed-in Google
// user, so a buggy client looping on any single endpoint can't burn the
// whole Anthropic budget alone. This is a backstop behind the auth check in
// _auth.js, not the primary defense — an unauthenticated caller is already
// rejected before this ever runs.
const DAILY_LIMIT = 50

// Env var names match what the Upstash-for-Redis Vercel Marketplace
// integration injects (KV_REST_API_URL / KV_REST_API_TOKEN) — a naming
// holdover from when Vercel's own KV product used this convention, now
// reused by the Upstash integration. KV_REST_API_READ_ONLY_TOKEN, KV_URL,
// and REDIS_URL are also injected but unused here (REST client only).
let redis = null
if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  })
}

export async function checkQuota(userId) {
  if (!redis) {
    // Store not configured yet — fail open rather than break the app for
    // every signed-in user. Set KV_REST_API_URL/TOKEN to activate.
    console.warn('Rate limit store not configured — skipping quota check')
    return { allowed: true }
  }

  const day = new Date().toISOString().slice(0, 10) // YYYY-MM-DD, UTC
  const key = `qm:aicalls:${userId}:${day}`

  const count = await redis.incr(key)
  if (count === 1) {
    // First hit of the day for this user — expire a bit past 24h so the key
    // self-cleans after the day rolls over with no separate cleanup job.
    await redis.expire(key, 26 * 60 * 60)
  }

  return { allowed: count <= DAILY_LIMIT, count, limit: DAILY_LIMIT }
}
