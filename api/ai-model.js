import { authenticate } from './_auth.js'
import { getActiveModel } from './_ai.js'

// Lets the Settings UI show which provider/model the Scribe endpoints
// (theme/breakdown/habit) are actually calling — useful after flipping
// AI_PROVIDER for a rollback. Read-only, no AI cost, so no quota check.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = await authenticate(req)
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.message })
  }

  return res.status(200).json(getActiveModel())
}
