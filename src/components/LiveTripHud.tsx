'use client'

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import type { Journey, Train } from '@/types'
import { LINE_COLORS, getStationCode } from '@/lib/constants'
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
  const [notifsEnabled, setNotifsEnabled] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const notifiedMilestonesRef = useRef<Set<string>>(new Set())

  // Detect offline mode (e.g. traveling through tunnels)
  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsOffline(!window.navigator.onLine)
    const onOnline = () => setIsOffline(false)
    const onOffline = () => setIsOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Persist active trip for cross-tab synchronization
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
    if (!settings.enabled || !settings.liveTrip) {
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
    const curNow = (journey.depTime >= 86400 && now < 4 * 3600) ? now + 86400 : now
    const isBefore = curNow < journey.depTime
    const isAfter = curNow > journey.arrTime

    let activeLegIndex = 0
    for (let i = 0; i < journey.legs.length; i++) {
      const leg = journey.legs[i]
      if (curNow >= leg.depTime && curNow <= leg.arrTime) {
        activeLegIndex = i
        break
      }
      if (curNow < leg.depTime) {
        activeLegIndex = i
        break
      }
    }

    const curLeg = journey.legs[activeLegIndex]
    let nextStop: { name: string; time: number } | null = null

    if (curLeg && curLeg.stops) {
      for (const s of curLeg.stops) {
        if (s.arrTime > curNow) {
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
    if (!settings.enabled || !settings.liveTrip) return

    const notified = notifiedMilestonesRef.current

    // 1. Incoming train alert for the current leg (within 3 minutes of departure)
    if (!isWalk && curLeg.line) {
      const curNow = (curLeg.depTime >= 86400 && now < 4 * 3600) ? now + 86400 : now
      const timeToDep = curLeg.depTime - curNow

      if (timeToDep <= 180 && timeToDep >= -30) {
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
    if (settings.alightAlarm !== false && activeLegIndex < journey.legs.length - 1 && curLeg.arrTime - now <= 120 && curLeg.arrTime - now >= 0) {
      const nextLeg = journey.legs[activeLegIndex + 1]
      const key = `transfer_leg_${activeLegIndex}_${curLeg.toName}`
      if (!notified.has(key)) {
        notified.add(key)
        sendAppNotification({
          title: t('transferApproachingTitle', curLeg.toName),
          body: t('transferApproachingDesc', nextLeg.operator === 'walk' ? 'a peu' : nextLeg.line),
          type: 'warning',
          tag: key,
        })
      }
    }

    // 3. Final destination approaching alert (wake-up alight alarm)
    if (settings.alightAlarm !== false && activeLegIndex === journey.legs.length - 1 && curLeg.arrTime - now <= 120 && curLeg.arrTime - now >= 0) {
      const key = `destination_arrival_${curLeg.toName}`
      if (!notified.has(key)) {
        notified.add(key)
        sendAppNotification({
          title: t('destinationApproachingTitle', curLeg.toName),
          body: t('destinationApproachingDesc'),
          type: 'warning',
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

  const originLeg = journey.legs[0]
  const destLeg = journey.legs[journey.legs.length - 1]
  const fromAbbr = getStationCode(originLeg?.fromCode || '', originLeg?.fromName)
  const toAbbr = getStationCode(destLeg?.toCode || '', destLeg?.toName)

  const curNow = (journey.depTime >= 86400 && now < 4 * 3600) ? now + 86400 : now
  const isDeparted = curNow >= journey.depTime
  const remainingSec = isDeparted ? (journey.arrTime - curNow) : (journey.depTime - curNow)
  const remainingMin = Math.max(0, Math.ceil(remainingSec / 60))
  const totalDuration = Math.max(1, journey.arrTime - journey.depTime)
  const elapsed = curNow - journey.depTime
  const rawProgress = curNow < journey.depTime ? 0 : Math.min(100, Math.max(0, (elapsed / totalDuration) * 100))
  const progressPercent = Math.round(rawProgress)
  const timeText = isDeparted && remainingMin === 0
    ? (lang === 'ca' ? 'Arribat' : lang === 'es' ? 'Llegado' : 'Arrived')
    : `${remainingMin} min`

  const statusSummary = isBefore
    ? (lang === 'ca' ? `Sortida ${fmtClock(journey.depTime)}` : lang === 'es' ? `Salida ${fmtClock(journey.depTime)}` : `Departs ${fmtClock(journey.depTime)}`)
    : isAfter
    ? (lang === 'ca' ? 'Has arribat!' : lang === 'es' ? '¡Has llegado!' : 'Arrived!')
    : nextStop
    ? (lang === 'ca' ? `Proper: ${nextStop.name}` : lang === 'es' ? `Próximo: ${nextStop.name}` : `Next: ${nextStop.name}`)
    : (lang === 'ca' ? `Cap a ${curLeg?.toName}` : lang === 'es' ? `Hacia ${curLeg?.toName}` : `To ${curLeg?.toName}`)

  // ── 1. Default: Sleek, thin rectangle docked directly to the bottom edge ──
  if (!expanded) {
    return (
      <div
        role="region"
        aria-label={`${t('currentTrip')}: ${fromAbbr} → ${toAbbr}`}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          background: 'var(--bg2)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(59, 130, 246, 0.45)',
          borderBottom: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          borderRadius: 0,
          boxShadow: '0 -2px 14px rgba(59, 130, 246, 0.22), 0 -1px 3px rgba(0, 0, 0, 0.35)',
          zIndex: 950,
          padding: '6px 14px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          userSelect: 'none',
          animation: 'hudGlow 3s infinite alternate ease-in-out',
        }}
      >
        {/* Slender visual progress bar flush along the top edge */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2.5,
            background: 'rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${isDeparted ? Math.max(2, progressPercent) : 0}%`,
              background: isDeparted
                ? `linear-gradient(90deg, ${color}, var(--green))`
                : color,
              boxShadow: isDeparted ? `0 0 6px ${color}` : 'none',
              transition: 'width 1s linear',
            }}
          />
        </div>
        {/* Left: Indicator, line badge, route abbreviation, current status */}
        <div
          onClick={() => setExpanded(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            minWidth: 0,
            flex: 1,
            cursor: 'pointer',
          }}
        >
          {/* Pulsing live dot */}
          <span
            style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isDeparted ? 'var(--green)' : 'var(--accent)',
              boxShadow: isDeparted ? '0 0 6px var(--green)' : '0 0 6px var(--accent)',
              flexShrink: 0,
              animation: 'pulse 1.5s infinite',
            }}
          />

          {/* Line Pill (or walk icon) */}
          {isWalk ? (
            <span style={{ fontSize: 12, flexShrink: 0 }}>🚶</span>
          ) : curLeg?.line ? (
            <span
              style={{
                background: color,
                color: '#fff',
                fontWeight: 800,
                fontSize: 10.5,
                padding: '1.5px 5px',
                borderRadius: 4,
                fontFamily: 'var(--font-space-grotesk), sans-serif',
                flexShrink: 0,
                lineHeight: 1.15,
              }}
            >
              {curLeg.line}
            </span>
          ) : null}

          {/* Label: Viatge actual */}
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--muted)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {t('currentTrip')}:
          </span>

          {/* Station Path: PC → VP */}
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              fontFamily: 'var(--font-space-grotesk), sans-serif',
              color: 'var(--text)',
              letterSpacing: '0.3px',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {fromAbbr} → {toAbbr}
          </span>

          {/* Subtitle / Next stop / status summary (truncated gracefully) */}
          <span
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              opacity: 0.85,
            }}
          >
            · {statusSummary}
          </span>

          {isOffline && (
            <span
              title={t('tunnelModeNotice')}
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: 'var(--yellow)',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '1px 5px',
                borderRadius: 4,
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontFamily: 'inherit',
              }}
            >
              <span>🚇</span>
              <span>{t('tunnelMode')}</span>
            </span>
          )}
        </div>

        {/* Right: Countdown time, expand chevron, center & close buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Time Countdown */}
          <span
            onClick={() => setExpanded(true)}
            style={{
              fontSize: 12.5,
              fontWeight: 800,
              fontFamily: 'var(--font-space-grotesk), sans-serif',
              color: isDeparted ? 'var(--green)' : 'var(--accent)',
              fontVariantNumeric: 'tabular-nums',
              cursor: 'pointer',
              paddingRight: 2,
            }}
          >
            {timeText}
          </span>

          {/* Center on map button */}
          {onCenter && (
            <button
              type="button"
              onClick={onCenter}
              title={lang === 'ca' ? 'Centra al mapa' : lang === 'es' ? 'Centrar en el mapa' : 'Center on map'}
              aria-label="Centra al mapa"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text)',
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: 11,
                padding: 0,
              }}
            >
              📍
            </button>
          )}

          {/* Expand Details button */}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            title={t('maximize')}
            aria-label={t('maximize')}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--muted)',
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>

          {/* Close / End Trip button */}
          <button
            type="button"
            onClick={handleClose}
            title={lang === 'ca' ? 'Finalitzar ruta' : lang === 'es' ? 'Finalizar ruta' : 'End trip'}
            aria-label="Finalitzar ruta"
            style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 6,
              color: 'var(--red)',
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 11,
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  // ── 2. Expanded Drawer: Docked to bottom, slides up smoothly ──
  return (
    <div
      role="dialog"
      aria-label={t('modeEnMarxa')}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        maxHeight: '65vh',
        overflowY: 'auto',
        background: 'var(--bg2)',
        borderTop: '1px solid var(--accent)',
        borderBottom: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        borderRadius: '16px 16px 0 0',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
        zIndex: 960,
        padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        animation: 'slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--accent)' }}>
            {t('modeEnMarxa')}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            ({activeLegIndex + 1}/{journey.legs.length} {lang === 'ca' ? 'trams' : lang === 'es' ? 'tramos' : 'legs'})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Incoming train notifications toggle button */}
          <button
            type="button"
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

          {onCenter && (
            <button
              type="button"
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

          {/* Collapse button to return to thin docked bar */}
          <button
            type="button"
            onClick={() => setExpanded(false)}
            title={t('minimize')}
            aria-label={t('minimize')}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--muted)',
              width: 26,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            title={lang === 'ca' ? 'Finalitzar ruta' : lang === 'es' ? 'Finalizar ruta' : 'End trip'}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--muted)',
              width: 26,
              height: 26,
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

      {/* Visual Journey Progress Bar */}
      <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '7px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
              {t('tripProgress', progressPercent)}
            </span>
            {isOffline && (
              <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--yellow)', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '1px 5px', borderRadius: 4 }}>
                🚇 {t('tunnelMode')}
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, color: isDeparted ? 'var(--green)' : 'var(--accent)' }}>
            {timeText}
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${isDeparted ? Math.max(2, progressPercent) : 0}%`,
              background: isDeparted ? `linear-gradient(90deg, ${color}, var(--green))` : color,
              transition: 'width 1s linear',
            }}
          />
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
