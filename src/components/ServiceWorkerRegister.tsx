'use client'

import { useEffect } from 'react'

// Registers the service worker (offline shell + data caching) after load.
// Production only: a caching SW in front of the Turbopack dev server serves
// stale build assets and breaks HMR.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    const onLoad = () => navigator.serviceWorker.register('/sw.js').catch(() => {})
    window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])
  return null
}
