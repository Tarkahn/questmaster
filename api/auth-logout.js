// Ends the session on this device only: drops the cookie and leaves the shared
// refresh token alone, so signing out on a phone doesn't sign out a laptop.
//
// This deliberately no longer calls Google's revoke endpoint. Revoking kills
// the whole grant for the account, which under the shared-token arrangement
// would end every other device's session too — the opposite of what tapping
// "Sign out" on one device should do. To cut off every device, remove
// QuestMaster's access under the Google account's own security settings.
import { clearRefreshCookie } from './_session.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  clearRefreshCookie(req, res)
  return res.status(200).json({ ok: true })
}
