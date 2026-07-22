import { useEffect, useRef, useCallback } from 'react'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPES = [
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.appdata',
  'email',
  'profile',
].join(' ')

export default function useGoogleAuth(onToken) {
  const clientRef = useRef(null)
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useEffect(() => {
    function initClient() {
      clientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          if (response.access_token) {
            onTokenRef.current(response.access_token, response.expires_in)
          }
        },
      })
    }

    if (window.google) {
      initClient()
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval)
          initClient()
        }
      }, 100)
      return () => clearInterval(interval)
    }
  }, [])

  return useCallback((options = {}) => {
    clientRef.current?.requestAccessToken(options)
  }, [])
}
