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

import { normalizeSearchText } from '@/lib/searchUtils'

export function getBaseStationCode(stopId: string, operator?: string): string {
  if (!stopId) return ''
  if (operator === 'renfe' || /^\d+$/.test(stopId)) return stopId
  return stopId.replace(/\d+$/, '')
}

export function normalizeStationName(name?: string): string {
  if (!name) return ''
  const cleaned = name.replace(/^barcelona\s*[-–—]\s*/i, '')
  return normalizeSearchText(cleaned)
}

export function matchStation(
  a: { stopId?: string; name?: string; code?: string; operator?: string } | string | null | undefined,
  b: { stopId?: string; name?: string; code?: string; operator?: string } | string | null | undefined,
): boolean {
  if (!a || !b) return false

  const idA = typeof a === 'string' ? a : a.stopId ?? ''
  const idB = typeof b === 'string' ? b : b.stopId ?? ''
  if (idA && idB && idA.toLowerCase() === idB.toLowerCase()) return true

  const codeA = typeof a === 'string' ? getBaseStationCode(a) : a.code || getBaseStationCode(a.stopId ?? '', a.operator)
  const codeB = typeof b === 'string' ? getBaseStationCode(b) : b.code || getBaseStationCode(b.stopId ?? '', b.operator)
  if (codeA && codeB && codeA.toLowerCase() === codeB.toLowerCase()) return true

  const nameA = typeof a === 'string' ? a : a.name
  const nameB = typeof b === 'string' ? b : b.name
  if (nameA && nameB) {
    if (nameA.toLowerCase() === nameB.toLowerCase()) return true
    const normA = normalizeStationName(nameA)
    const normB = normalizeStationName(nameB)
    if (normA && normB && normA === normB) return true
  }

  // Cross-check: check if stopId or code matches the other's name or code
  if (codeA && nameB && codeA.toLowerCase() === normalizeStationName(nameB)) return true
  if (codeB && nameA && codeB.toLowerCase() === normalizeStationName(nameA)) return true

  return false
}

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

export function useFavoriteStations() {
  const [favorites, setFavorites] = useState<SavedStation[]>([])

  const refresh = useCallback(() => {
    setFavorites(read())
  }, [])

  useEffect(() => {
    refresh()
    const handleSync = () => refresh()
    window.addEventListener(SYNC_EVENT, handleSync)
    window.addEventListener('storage', handleSync)
    return () => {
      window.removeEventListener(SYNC_EVENT, handleSync)
      window.removeEventListener('storage', handleSync)
    }
  }, [refresh])

  const isFavorite = useCallback(
    (target: string | Stop | SavedStation | null | undefined): boolean => {
      if (!target) return false
      return favorites.some(f => matchStation(f, target))
    },
    [favorites],
  )

  const toggleFavorite = useCallback((station: Stop | SavedStation | null | undefined) => {
    if (!station || !station.stopId) return
    const isRenfe = station.operator === 'renfe' || /^\d+$/.test(station.stopId)
    const baseCode = station.code || (isRenfe ? station.stopId : station.stopId.replace(/\d+$/, ''))
    const normalized: SavedStation = {
      stopId: station.stopId,
      name: station.name,
      code: baseCode,
      operator: station.operator,
      lines: station.lines,
    }

    setFavorites(prev => {
      const exists = prev.some(f => matchStation(f, normalized))
      const next = exists
        ? prev.filter(f => !matchStation(f, normalized))
        : [normalized, ...prev]

      try {
        window.localStorage.setItem(FAV_STATIONS_KEY, JSON.stringify(next))
      } catch {}

      // Defer event dispatch out of the state updater so it doesn't cause recursive React updates
      setTimeout(() => {
        window.dispatchEvent(new Event(SYNC_EVENT))
      }, 0)

      return next
    })
  }, [])

  return { favorites, isFavorite, toggleFavorite }
}
