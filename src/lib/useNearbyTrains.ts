'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { Train } from '@/types'
import { haversine } from './geometry'

export function useNearbyTrains(trains: Train[], maxDistKm = 6.5) {
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating]     = useState(false)

  // Silently check if permission was already granted in browser
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'granted') {
          navigator.geolocation.getCurrentPosition(
            pos => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => {},
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
          )
        }
      }).catch(() => {})
    }
  }, [])

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false)
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => { setLocating(false) },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }, [])

  const { nearTrains, otherTrains } = useMemo(() => {
    if (!userCoords) {
      return { nearTrains: [], otherTrains: trains }
    }
    const near: { train: Train; distKm: number }[] = []
    const other: Train[] = []

    for (const tr of trains) {
      if (tr.lat != null && tr.lng != null && tr.operationalStatus !== 'depot') {
        const distKm = haversine([userCoords.lng, userCoords.lat], [tr.lng, tr.lat]) / 1000
        if (distKm <= maxDistKm) {
          near.push({ train: tr, distKm })
          continue
        }
      }
      other.push(tr)
    }

    near.sort((a, b) => a.distKm - b.distKm)
    return {
      nearTrains: near.map(n => n.train),
      otherTrains: other,
    }
  }, [trains, userCoords, maxDistKm])

  return {
    userCoords,
    locating,
    requestLocation,
    nearTrains,
    otherTrains,
    hasNearTrains: nearTrains.length > 0,
  }
}
