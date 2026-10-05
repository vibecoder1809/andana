'use client'

import { useState, useEffect } from 'react'

let sharedNow = Date.now()
const listeners = new Set<(now: number) => void>()
let timerId: ReturnType<typeof setInterval> | null = null

function notify() {
  sharedNow = Date.now()
  for (const l of listeners) l(sharedNow)
}

/**
 * Shared singleton clock hook that synchronises all subscribers to a single
 * background timer rather than spawning dozens of per-component setIntervals.
 */
export function useSharedNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(sharedNow)

  useEffect(() => {
    listeners.add(setNow)
    if (listeners.size === 1) {
      timerId = setInterval(notify, intervalMs)
    }
    return () => {
      listeners.delete(setNow)
      if (listeners.size === 0 && timerId !== null) {
        clearInterval(timerId)
        timerId = null
      }
    }
  }, [intervalMs])

  return now
}
