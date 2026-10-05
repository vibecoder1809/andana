'use client'

import { useEffect, useRef } from 'react'
import type { Alert } from '@/types'
import { useFavoriteStations, matchStation } from '@/lib/savedStations'
import { getNotificationSettings, sendAppNotification } from '@/lib/notifications'
import { useI18n } from '@/lib/i18n'

const NOTIFIED_KEY = 'andana-notified-station-alerts'

function getNotifiedSet(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.sessionStorage.getItem(NOTIFIED_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function saveNotifiedSet(set: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    const arr = Array.from(set).slice(-100) // Keep last 100 notified alerts
    window.sessionStorage.setItem(NOTIFIED_KEY, JSON.stringify(arr))
  } catch {}
}

export function useStationAlertNotifier(alerts: Alert[]) {
  const { favorites } = useFavoriteStations()
  const { t } = useI18n()
  const notifiedSetRef = useRef<Set<string>>(getNotifiedSet())
  const isFirstRunRef = useRef(true)

  useEffect(() => {
    if (!alerts || alerts.length === 0 || favorites.length === 0) return

    const settings = getNotificationSettings()
    if (!settings.favStations) return

    const notifiedSet = notifiedSetRef.current

    // On the very first check after app launch, mark currently existing alerts as seen
    // so the user is not flooded with a backlog of old alerts. Future incoming alerts will notify.
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false
      for (const fav of favorites) {
        for (const a of alerts) {
          const key = `${fav.stopId}:${a.id}`
          notifiedSet.add(key)
        }
      }
      saveNotifiedSet(notifiedSet)
      return
    }

    let hasNew = false

    for (const fav of favorites) {
      const stationCode = fav.code || fav.stopId.replace(/\d+$/, '')
      const linesSet = new Set(fav.lines ?? [])

      const matchingAlerts = alerts.filter(a => {
        if (a.stops && a.stops.some(s => matchStation(s, fav))) return true
        if (a.stopCodes && a.stopCodes.some(c => c.replace(/\d+$/, '') === stationCode)) return true
        if (linesSet.size > 0 && a.routes.some(r => linesSet.has(r))) return true
        return false
      })

      for (const alert of matchingAlerts) {
        const key = `${fav.stopId}:${alert.id}`
        if (!notifiedSet.has(key)) {
          notifiedSet.add(key)
          hasNew = true

          sendAppNotification({
            title: t('stationAlertTitle', fav.name),
            body: alert.header,
            tag: `alert-${fav.stopId}-${alert.id}`,
            url: `/?stop=${encodeURIComponent(fav.stopId)}`,
            type: 'warning',
          })
        }
      }
    }

    if (hasNew) {
      saveNotifiedSet(notifiedSet)
    }
  }, [alerts, favorites, t])
}
