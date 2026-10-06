'use client'

import { useState, useEffect, useCallback } from 'react'

const FAV_LINES_KEY = 'andana-fav-lines'
const SYNC_EVENT = 'andana:fav-lines-change'

const DEFAULT_POPULAR_LINES = ['S1', 'S2', 'R1', 'R4']

function read(): string[] {
  if (typeof window === 'undefined') return DEFAULT_POPULAR_LINES
  try {
    const raw = window.localStorage.getItem(FAV_LINES_KEY)
    if (!raw) return DEFAULT_POPULAR_LINES
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_POPULAR_LINES
    return parsed.filter((l): l is string => typeof l === 'string' && Boolean(l.trim()))
  } catch {
    return DEFAULT_POPULAR_LINES
  }
}

export function useFavoriteLines() {
  const [favoriteLines, setFavoriteLines] = useState<string[]>(read)

  const refresh = useCallback(() => {
    setFavoriteLines(read())
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

  const isFavoriteLine = useCallback(
    (line: string): boolean => {
      if (!line) return false
      return favoriteLines.some(l => l.toLowerCase() === line.toLowerCase())
    },
    [favoriteLines],
  )

  const toggleFavoriteLine = useCallback((line: string) => {
    if (!line) return
    const clean = line.trim()

    setFavoriteLines(prev => {
      const exists = prev.some(l => l.toLowerCase() === clean.toLowerCase())
      const next = exists
        ? prev.filter(l => l.toLowerCase() !== clean.toLowerCase())
        : [...prev, clean]

      try {
        window.localStorage.setItem(FAV_LINES_KEY, JSON.stringify(next))
      } catch {}

      setTimeout(() => {
        window.dispatchEvent(new Event(SYNC_EVENT))
      }, 0)

      return next
    })
  }, [])

  return { favoriteLines, isFavoriteLine, toggleFavoriteLine }
}
