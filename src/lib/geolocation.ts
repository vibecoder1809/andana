'use client'

import { useState, useCallback } from 'react'

export type GeoError = 'denied' | 'unavailable'

// Thin wrapper over the browser Geolocation API. `locate` asks for a one-shot
// position and hands the coordinates to a callback; `locating` drives a
// spinner and `error` distinguishes a denied permission from an unavailable
// sensor so the UI can message each. Deliberately no watchPosition — a single
// fix is all the "near me" features need, and it avoids a battery-draining
// subscription.
export function useGeolocation() {
  const [locating, setLocating] = useState(false)
  const [error, setError]       = useState<GeoError | null>(null)

  const locate = useCallback((onFound: (lat: number, lng: number) => void) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setError('unavailable')
      return
    }
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false)
        onFound(pos.coords.latitude, pos.coords.longitude)
      },
      err => {
        setLocating(false)
        setError(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }, [])

  return { locate, locating, error }
}
