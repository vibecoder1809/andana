'use client'

import { useEffect } from 'react'

// Registers the service worker (offline shell + data caching) after load.
// Production only: a caching SW in front of the Turbopack dev server serves
// stale build assets and breaks HMR.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    let registration: ServiceWorkerRegistration | null = null
    let refreshing = false

    // When a new service worker takes control (via skipWaiting), reload the page once
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    const checkForUpdate = () => {
      if (registration) {
        registration.update().catch(() => {})
      }
    }

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          registration = reg

          // If a worker is already waiting, trigger skipWaiting immediately
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' })
          }

          // If an incoming update is installed, activate it
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' })
                }
              })
            }
          })
        })
        .catch(() => {})
    }

    // Hydration normally finishes *after* window.load has already fired.
    if (document.readyState === 'complete') {
      onLoad()
    } else {
      window.addEventListener('load', onLoad, { once: true })
    }

    // Check for updates periodically (every 10 minutes)
    const interval = setInterval(checkForUpdate, 10 * 60 * 1000)

    // Check for updates when user returns to the app / opens tab
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])
  return null
}
