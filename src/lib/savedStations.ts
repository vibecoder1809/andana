'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Stop } from '@/types'

export interface SavedStation {
  stopId: string
  name: string
  code?: string
  operator?: 'fgc' | 'renfe'
  lines?: string[]
}

const FAV_STATIONS_KEY = 'andana-fav-stations'
const SYNC_EVENT = 'andana:fav-stations-change'

function read(): SavedStation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(FAV_STATIONS_KEY)
      ?? window.localStorage.getItem('geotren-fav-stations')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (s): s is SavedStation => s && typeof s.stopId === 'string' && typeof s.name === 'string',
    )
  } catch {
    return []
  }
}

function write(stations: SavedStation[]) {
  try {
    window.localStorage.setItem(FAV_STATIONS_KEY, JSON.stringify(stations))
    window.dispatchEvent(new Event(SYNC_EVENT))
  } catch {}
}

export function useFavoriteStations() {
  const [favorites, setFavorites] = useState<SavedStation[]>([])

  const refresh = useCallback(() => {
    setFavorites(read())
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener(SYNC_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(SYNC_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [refresh])

  const isFavorite = useCallback(
    (stopId: string) => favorites.some(f => f.stopId === stopId || f.name.toLowerCase() === stopId.toLowerCase()),
    [favorites],
  )

  const toggleFavorite = useCallback((station: Stop | SavedStation) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.stopId === station.stopId || f.name.toLowerCase() === station.name.toLowerCase())
      const next = exists
        ? prev.filter(f => f.stopId !== station.stopId && f.name.toLowerCase() !== station.name.toLowerCase())
        : [
            {
              stopId: station.stopId,
              name: station.name,
              code: station.code,
              operator: station.operator,
              lines: station.lines,
            },
            ...prev,
          ]
      write(next)
      return next
    })
  }, [])

  return { favorites, isFavorite, toggleFavorite }
}
