import { useEffect, useRef, useCallback } from 'react'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPES = [
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.appdata',
  'email',
  'profile',
].join(' ')

// Authorization-code flow. The popup hands back a one-time code rather than an
// access token; App trades it at /api/auth-exchange for an access token plus a
// refresh token that lives server-side. That refresh token is what keeps the
// session alive for weeks — the old token flow (initTokenClient) could only
// ever issue 1-hour access tokens with no way to renew them off-session.
export default function useGoogleAuth({ onCode, onError }) {
  const clientRef = useRef(null)
  const onCodeRef = useRef(onCode)
  const onErrorRef = useRef(onError)
  onCodeRef.current = onCode
  onErrorRef.current = onError

  useEffect(() => {
    function initClient() {
      clientRef.current = window.google.accounts.oauth2.initCodeClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        ux_mode: 'popup',
        // Forces the consent screen, which is what makes Google return a
        // refresh token. Without it a returning user gets a code that
        // exchanges into an access token only, and the long session is lost.
        prompt: 'consent',
        callback: (response) => {
          if (response.code) {
            onCodeRef.current(response.code)
          } else {
            onErrorRef.current?.(response.error_description || response.error || 'Sign-in failed')
          }
        },
        // The old hook had no error handler at all, so a failed sign-in did
        // nothing visible and the app just sat there.
        error_callback: (err) => {
          if (err?.type === 'popup_closed') return
          onErrorRef.current?.(
            err?.type === 'popup_failed_to_open'
              ? 'Your browser blocked the sign-in popup. Allow popups for this site and try again.'
              : 'Sign-in failed. Please try again.'
          )
        },
      })
    }

    if (window.google?.accounts?.oauth2) {
      initClient()
      return
    }
    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(interval)
        initClient()
      }
    }, 100)
    return () => clearInterval(interval)
  }, [])

  return useCallback(() => {
    if (!clientRef.current) {
      onErrorRef.current?.('Google sign-in is still loading. Try again in a moment.')
      return
    }
    clientRef.current.requestCode()
  }, [])
}
