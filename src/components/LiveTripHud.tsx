'use client'

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import type { Journey, Train } from '@/types'
import { LINE_COLORS } from '@/lib/constants'
import { useI18n } from '@/lib/i18n'
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  getNotificationSettings,
  sendAppNotification,
} from '@/lib/notifications'
import { normalizeSearchText } from '@/lib/searchUtils'

interface LiveTripHudProps {
  journey: Journey
  trains?: Train[]
  lineColors: Record<string, string>
  onClose: () => void
  onCenter?: () => void
}

const ACTIVE_TRIP_KEY = 'andana-active-trip'

function fmtClock(sec: number): string {
  const h = Math.floor(sec / 3600) % 24
  const m = Math.floor(sec / 60) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function nowSeconds(): number {
  const d = new Date()
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
}

export function LiveTripHud({
  journey,
  trains,
  lineColors,
  onClose,
  onCenter,
}: LiveTripHudProps) {
  const { lang, t } = useI18n()
  const [now, setNow] = useState(nowSeconds)
  const [isWidgetMode, setIsWidgetMode] = useState(false)
  const [notifsEnabled, setNotifsEnabled] = useState(true)
  const notifiedMilestonesRef = useRef<Set<string>>(new Set())

  // Persist active trip for standalone widget / cross-tab synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(journey))
      window.dispatchEvent(new Event('andana:active-trip-change'))
    } catch {}
    return () => {
      try {
        window.localStorage.removeItem(ACTIVE_TRIP_KEY)
        window.dispatchEvent(new Event('andana:active-trip-change'))
      } catch {}
    }
  }, [journey])

  // Request notifications permission on HUD activation if user preference has liveTrip enabled
  useEffect(() => {
    if (!isNotificationSupported()) return
    const settings = getNotificationSettings()
    if (!settings.liveTrip) {
      setNotifsEnabled(false)
      return
    }

    if (getNotificationPermission() === 'default') {
      // Prompt user for notification permission upon activating Live HUD
      requestNotificationPermission().then(perm => {
        setNotifsEnabled(perm === 'granted')
      })
    } else {
      setNotifsEnabled(getNotificationPermission() === 'granted')
    }
  }, [])

  // Live second ticker
  useEffect(() => {
    const id = setInterval(() => setNow(nowSeconds()), 1000)
    return () => clearInterval(id)
  }, [])

  // Determine current active leg & next stop
  const { activeLegIndex, nextStop, isBefore, isAfter } = useMemo(() => {
    const isBefore = now < journey.depTime
    const isAfter = now > journey.arrTime

    let activeLegIndex = 0
    for (let i = 0; i < journey.legs.length; i++) {
      const leg = journey.legs[i]
      if (now >= leg.depTime && now <= leg.arrTime) {
        activeLegIndex = i
        break
      }
      if (now < leg.depTime) {
        activeLegIndex = i
        break
      }
    }

    const curLeg = journey.legs[activeLegIndex]
    let nextStop: { name: string; time: number } | null = null

    if (curLeg && curLeg.stops) {
      for (const s of curLeg.stops) {
        if (s.arrTime > now) {
          nextStop = { name: s.name, time: s.arrTime }
          break
        }
      }
    }

    return { activeLegIndex, nextStop, isBefore, isAfter }
  }, [journey, now])

  const curLeg = journey.legs[activeLegIndex]
  const isWalk = curLeg?.operator === 'walk'
  const color = isWalk ? '#f59e0b' : (lineColors[curLeg?.line ?? ''] || LINE_COLORS[curLeg?.line ?? ''] || '#7a82a0')

  // Notification dispatcher for incoming train & trip milestones
  useEffect(() => {
    if (!notifsEnabled || !curLeg) return
    const settings = getNotificationSettings()
    if (!settings.liveTrip) return

    const notified = notifiedMilestonesRef.current

    // 1. Incoming train alert for the current leg
    if (!isWalk && curLeg.line) {
      const timeToDep = curLeg.depTime - now

      // Check if real-time train is approaching or stationed at the departure station
      let isLiveTrainApproaching = false
      if (trains && trains.length > 0) {
        const normFrom = normalizeSearchText(curLeg.fromName)
        const matchedTrain = trains.find(tr => {
          if (tr.line.toLowerCase() !== curLeg.line.toLowerCase()) return false
          const curr = tr.currentStop ? normalizeSearchText(tr.currentStop) : ''
          const next = tr.nextStop ? normalizeSearchText(tr.nextStop) : ''
          const upcomingFirst = tr.upcomingStops?.[0] ? normalizeSearchText(tr.upcomingStops[0]) : ''
          return curr === normFrom || next === normFrom || upcomingFirst === normFrom
        })
        if (matchedTrain) {
          isLiveTrainApproaching = true
        }
      }

      // Trigger incoming train alert when train is arriving (within 3 minutes or approaching by live telemetry)
      if ((timeToDep <= 180 && timeToDep >= -30) || isLiveTrainApproaching) {
        const key = `incoming_leg_${activeLegIndex}_${curLeg.line}_${curLeg.fromName}`
        if (!notified.has(key)) {
          notified.add(key)
          sendAppNotification({
            title: t('trainIncomingTitle', curLeg.line, curLeg.fromName),
            body: t('trainIncomingDesc', fmtClock(curLeg.depTime)),
            type: 'train',
            tag: key,
          })
        }
      }
    }

    // 2. Transfer alert approaching
    if (activeLegIndex < journey.legs.length - 1 && curLeg.arrTime - now <= 120 && curLeg.arrTime - now >= 0) {
      const nextLeg = journey.legs[activeLegIndex + 1]
      const key = `transfer_leg_${activeLegIndex}_${curLeg.toName}`
      if (!notified.has(key)) {
        notified.add(key)
        sendAppNotification({
          title: t('transferApproachingTitle', curLeg.toName),
          body: t('transferApproachingDesc', nextLeg.operator === 'walk' ? 'a peu' : nextLeg.line),
          type: 'info',
          tag: key,
        })
      }
    }

    // 3. Final destination approaching alert
    if (activeLegIndex === journey.legs.length - 1 && curLeg.arrTime - now <= 120 && curLeg.arrTime - now >= 0) {
      const key = `destination_arrival_${curLeg.toName}`
      if (!notified.has(key)) {
        notified.add(key)
        sendAppNotification({
          title: t('destinationApproachingTitle', curLeg.toName),
          body: t('destinationApproachingDesc'),
          type: 'info',
          tag: key,
        })
      }
    }
  }, [curLeg, activeLegIndex, now, trains, isWalk, notifsEnabled, journey.legs, t])

  const handleToggleNotifications = useCallback(async () => {
    if (!isNotificationSupported()) return
    const currentPerm = getNotificationPermission()
    if (currentPerm === 'default') {
      const perm = await requestNotificationPermission()
      setNotifsEnabled(perm === 'granted')
      return
    }
    setNotifsEnabled(prev => !prev)
  }, [])

  const handleClose = useCallback(() => {
    try {
      window.localStorage.removeItem(ACTIVE_TRIP_KEY)
      window.dispatchEvent(new Event('andana:active-trip-change'))
    } catch {}
    onClose()
  }, [onClose])

  // Mini-HUD Floating Widget Mode
  if (isWidgetMode) {
    return (
      <div
        onClick={() => setIsWidgetMode(false)}
        title={t('expandFromWidget')}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 20,
          left: 'auto',
          background: 'var(--bg2)',
          border: '1.5px solid var(--accent)',
          borderRadius: 24,
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          zIndex: 920,
          padding: '8px 14px',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          animation: 'fade-in 0.2s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 1.5s infinite' }} />
          {isWalk ? (
            <span style={{ background: '#f59e0b25', border: '1px dashed #f59e0b', color: '#f59e0b', fontWeight: 700, fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>
              🚶
            </span>
          ) : (
            <span style={{ background: color, color: '#fff', fontWeight: 700, fontSize: 11, padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-space-grotesk)' }}>
              {curLeg?.line}
            </span>
          )}
        </div>

        <div style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
            {nextStop ? nextStop.name : curLeg?.toName}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 5 }}>
            {fmtClock(nextStop ? nextStop.time : journey.arrTime)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsWidgetMode(false)
            }}
            title={t('expandFromWidget')}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text)',
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            🗖
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleClose()
            }}
            title={lang === 'ca' ? 'Finalitzar ruta' : lang === 'es' ? 'Finalizar ruta' : 'End trip'}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--muted)',
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: 520,
        background: 'var(--bg2)',
        border: '1px solid var(--accent)',
        borderRadius: 14,
        boxShadow: '0 12px 35px rgba(0,0,0,0.45)',
        zIndex: 900,
        padding: '12px 16px',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--accent)' }}>
            {lang === 'ca' ? 'En ruta' : lang === 'es' ? 'En ruta' : 'Live tracking'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            ({activeLegIndex + 1}/{journey.legs.length} {lang === 'ca' ? 'trams' : lang === 'es' ? 'tramos' : 'legs'})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Incoming train notifications toggle button */}
          <button
            onClick={handleToggleNotifications}
            title={notifsEnabled ? t('hudNotificationsActive') : t('hudNotificationsEnable')}
            aria-label={notifsEnabled ? t('hudNotificationsActive') : t('hudNotificationsEnable')}
            style={{
              background: notifsEnabled ? 'rgba(59,130,246,0.18)' : 'var(--bg3)',
              border: `1px solid ${notifsEnabled ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 6,
              color: notifsEnabled ? 'var(--accent)' : 'var(--muted)',
              padding: '3px 7px',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'inherit',
            }}
          >
            <span>{notifsEnabled ? '🔔' : '🔕'}</span>
            <span style={{ fontSize: 10, fontWeight: 600 }}>
              {notifsEnabled ? (lang === 'ca' ? 'Avisos actius' : lang === 'es' ? 'Avisos activos' : 'Alerts on') : (lang === 'ca' ? 'Avisos off' : lang === 'es' ? 'Avisos off' : 'Alerts off')}
            </span>
          </button>

          {/* Minimize into widget button */}
          <button
            onClick={() => setIsWidgetMode(true)}
            title={t('minimizeToWidget')}
            aria-label={t('minimizeToWidget')}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text)',
              padding: '3px 7px',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            🗕
          </button>

          {onCenter && (
            <button
              onClick={onCenter}
              title={lang === 'ca' ? 'Centra al mapa' : lang === 'es' ? 'Centrar en el mapa' : 'Center on map'}
              style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text)',
                padding: '3px 8px',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              📍
            </button>
          )}

          <button
            onClick={handleClose}
            title={lang === 'ca' ? 'Finalitzar ruta' : lang === 'es' ? 'Finalizar ruta' : 'End trip'}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--muted)',
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main status info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {isWalk ? (
            <span style={{ background: '#f59e0b25', border: '1px dashed #f59e0b', color: '#f59e0b', fontWeight: 700, fontSize: 12, padding: '3px 8px', borderRadius: 6 }}>
              🚶 {Math.round((curLeg.arrTime - curLeg.depTime) / 60)} min
            </span>
          ) : (
            <span style={{ background: color, color: '#fff', fontWeight: 700, fontSize: 12, padding: '3px 8px', borderRadius: 6, fontFamily: 'var(--font-space-grotesk)' }}>
              {curLeg?.line}
            </span>
          )}

          <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isBefore ? (
                <span>
                  {lang === 'ca' ? `Sortida a les ${fmtClock(journey.depTime)} de ${journey.legs[0].fromName}` : lang === 'es' ? `Salida a las ${fmtClock(journey.depTime)} de ${journey.legs[0].fromName}` : `Departs at ${fmtClock(journey.depTime)} from ${journey.legs[0].fromName}`}
                </span>
              ) : isAfter ? (
                <span>
                  🎉 {lang === 'ca' ? 'Has arribat a la teva destinació!' : lang === 'es' ? '¡Has llegado a tu destino!' : 'You have arrived at your destination!'}
                </span>
              ) : nextStop ? (
                <span>
                  {lang === 'ca' ? 'Pròxima parada:' : lang === 'es' ? 'Próxima parada:' : 'Next stop:'}{' '}
                  <strong>{nextStop.name}</strong> ({fmtClock(nextStop.time)})
                </span>
              ) : (
                <span>
                  {lang === 'ca' ? `Arribant a ${curLeg.toName}` : lang === 'es' ? `Llegando a ${curLeg.toName}` : `Arriving at ${curLeg.toName}`}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
              {curLeg?.headsign ? `→ ${curLeg.headsign}` : `${curLeg?.fromName} → ${curLeg?.toName}`}
            </div>
          </div>
        </div>

        {/* ETA */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-space-grotesk)' }}>
            {fmtClock(journey.arrTime)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
            {lang === 'ca' ? 'arribada' : lang === 'es' ? 'llegada' : 'arrival'}
          </div>
        </div>
      </div>

      {/* Mini leg progress bar */}
      <div style={{ display: 'flex', gap: 4, height: 4, borderRadius: 2, overflow: 'hidden', background: 'var(--bg3)' }}>
        {journey.legs.map((leg, i) => {
          const lColor = leg.operator === 'walk' ? '#f59e0b' : (lineColors[leg.line] || LINE_COLORS[leg.line] || '#7a82a0')
          const isDone = i < activeLegIndex
          const isCur = i === activeLegIndex
          return (
            <div
              key={i}
              style={{
                flex: leg.arrTime - leg.depTime,
                background: isDone ? lColor : isCur ? lColor : 'var(--border2)',
                opacity: isDone ? 0.45 : isCur ? 1 : 0.25,
                borderRadius: 2,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
