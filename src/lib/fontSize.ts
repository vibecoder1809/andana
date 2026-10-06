'use client'

import { useState, useEffect, useCallback } from 'react'

export type FontSize = 'small' | 'medium' | 'large'

const FONT_SIZE_KEY = 'andana-font-size'
const SYNC_EVENT = 'andana:font-size-change'

export function getStoredFontSize(): FontSize {
  if (typeof window === 'undefined') return 'medium'
  try {
    const saved = window.localStorage.getItem(FONT_SIZE_KEY)
    if (saved === 'small' || saved === 'medium' || saved === 'large') {
      return saved
    }
  } catch {}
  return 'medium'
}

export function applyFontSizeToHtml(size: FontSize) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-font', size)
}

export function useFontSize() {
  const [fontSize, setFontSizeState] = useState<FontSize>(getStoredFontSize)

  useEffect(() => {
    const current = getStoredFontSize()
    setFontSizeState(current)
    applyFontSizeToHtml(current)

    const onSync = () => {
      const updated = getStoredFontSize()
      setFontSizeState(updated)
      applyFontSizeToHtml(updated)
    }

    window.addEventListener(SYNC_EVENT, onSync)
    window.addEventListener('storage', onSync)
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync)
      window.removeEventListener('storage', onSync)
    }
  }, [])

  const setFontSize = useCallback((size: FontSize) => {
    setFontSizeState(size)
    applyFontSizeToHtml(size)
    try {
      window.localStorage.setItem(FONT_SIZE_KEY, size)
    } catch {}
    setTimeout(() => {
      window.dispatchEvent(new Event(SYNC_EVENT))
    }, 0)
  }, [])

  return { fontSize, setFontSize }
}
