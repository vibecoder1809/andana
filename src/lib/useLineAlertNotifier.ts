'use client'

import { useEffect, useRef } from 'react'
import type { Alert } from '@/types'
import { useFavoriteLines } from '@/lib/savedLines'
import { getNotificationSettings, sendAppNotification } from '@/lib/notifications'
import { useI18n } from '@/lib/i18n'
import { isNightRestHours } from '@/lib/serviceTime'

const NOTIFIED_LINES_KEY = 'andana-notified-line-alerts'

function getNotifiedSet(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.sessionStorage.getItem(NOTIFIED_LINES_KEY)
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
    const arr = Array.from(set).slice(-100)
    window.sessionStorage.setItem(NOTIFIED_LINES_KEY, JSON.stringify(arr))
  } catch {}
}

export function useLineAlertNotifier(alerts: Alert[]) {
  const { favoriteLines } = useFavoriteLines()
  const { t } = useI18n()
  const notifiedSetRef = useRef<Set<string>>(getNotifiedSet())
  const isFirstRunRef = useRef(true)

  useEffect(() => {
    if (!alerts || alerts.length === 0 || favoriteLines.length === 0) return

    const settings = getNotificationSettings()
    if (!settings.enabled || settings.favLines === false) return

    // Suppress push/audio alerts during nighttime rest hours
    if (isNightRestHours()) return

    const notifiedSet = notifiedSetRef.current

    // On first run after app launch, mark current existing alerts as seen
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false
      for (const line of favoriteLines) {
        for (const a of alerts) {
          if (a.routes && a.routes.some((l: string) => l.toLowerCase() === line.toLowerCase())) {
            notifiedSet.add(`${line}:${a.id}`)
          }
        }
      }
      saveNotifiedSet(notifiedSet)
      return
    }

    // On subsequent alert updates, detect any new disruptions impacting favorite lines
    for (const a of alerts) {
      if (a.isInformational) continue // Skip non-disruptive school car reservations or links

      if (!a.routes || a.routes.length === 0) continue

      for (const line of favoriteLines) {
        const matches = a.routes.some((l: string) => l.toLowerCase() === line.toLowerCase())
        if (!matches) continue

        const key = `${line}:${a.id}`
        if (!notifiedSet.has(key)) {
          notifiedSet.add(key)
          saveNotifiedSet(notifiedSet)

          sendAppNotification({
            title: t('lineAlertTitle', line),
            body: a.header,
            type: 'warning',
            tag: `line-alert-${line}-${a.id}`,
            url: '/',
          })
          break
        }
      }
    }
  }, [alerts, favoriteLines, t])
}
