'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import type { Stop, StopDetail, Train, Alert } from '@/types'
import { LINE_COLORS, STATION_CODES } from '@/lib/constants'
import { useI18n, type TransKey } from '@/lib/i18n'
import { useFavoriteStations } from '@/lib/savedStations'
import { getStationZone } from '@/lib/fares'
import { getMetroInterchanges } from '@/lib/metroInterchanges'
import { normalizeSearchText } from '@/lib/searchUtils'
import { DeparturesBoard } from './DeparturesBoard'

interface StopPanelProps {
  stop: Stop | null
  onClose: () => void
  lineColors?: Record<string, string>
  mobile?: boolean
  // Live trains for a "passing through here" section. Mobile passes these
  // (its only extended station view); desktop omits them — the sidebar's
  // Stations tab already shows the same list.
  trains?: Train[]
  alerts?: Alert[]
  onSelectTrain?: (train: Train) => void
  onOpenLineStrip?: (line: string) => void
}

const SKY_ICONS: Record<string, string> = {
  'sol': '☀️',
  'sol i núvols alts': '🌤️',
  'entre poc i mig ennuvolat': '⛅',
  'ennuvolat': '☁️',
  'ruixat': '🌦️',
  'xàfec amb tempesta': '⛈️',
  'neu': '🌨️',
  'boira': '🌫️',
}

const IQAM_CONFIG: Record<string, { labelKey: TransKey; color: string; bg: string }> = {
  'BO':      { labelKey: 'airGood',     color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  'MODERAT': { labelKey: 'airModerate', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  'DOLENT':  { labelKey: 'airBad',      color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

function Metric({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px', flex: 1 }}>
      <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-space-grotesk)', fontSize: 16, fontWeight: 600 }}>
        {value != null ? `${value}` : '—'}
        {value != null && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 2 }}>{unit}</span>}
      </div>
    </div>
  )
}

function StopContent({ stop, detail, loading, onClose, showCloseButton, lineColors, trains, alerts, onSelectTrain, onOpenLineStrip }: {
  stop: Stop
  detail: StopDetail | null
  loading: boolean
  onClose: () => void
  showCloseButton: boolean
  lineColors: Record<string, string>
  trains?: Train[]
  alerts?: Alert[]
  onSelectTrain?: (train: Train) => void
  onOpenLineStrip?: (line: string) => void
}) {
  const { t } = useI18n()
  const { isFavorite, toggleFavorite } = useFavoriteStations()
  const favorited = isFavorite(stop)
  const air     = detail?.air ?? null
  const weather = detail?.weather ?? null
  const iqam    = air?.iqam ? IQAM_CONFIG[air.iqam] : null

  // Live trains at / heading toward this station, nearest first. Train feeds
  // reference stations by display name, so resolve the parent-station name
  // from the stop code.
  const isRenfe = stop.operator === 'renfe' || /^\d+$/.test(stop.stopId)
  const stationCode = isRenfe ? stop.stopId : stop.stopId.replace(/\d+$/, '').replace(/bus\d*$/i, '')
  const stationName = isRenfe ? stop.name : (STATION_CODES[stationCode] ?? stop.name.replace(/bus\d*$/i, ''))

  const normTarget1 = useMemo(() => normalizeSearchText(stationName), [stationName])
  const normTarget2 = useMemo(() => normalizeSearchText(stop.name), [stop.name])

  const matchesStation = useCallback((name: string | null | undefined): boolean => {
    if (!name) return false
    const n = normalizeSearchText(name)
    return (
      n === normTarget1 ||
      n === normTarget2 ||
      (normTarget1.length >= 4 && (n.startsWith(normTarget1) || normTarget1.startsWith(n))) ||
      (normTarget2.length >= 4 && (n.startsWith(normTarget2) || normTarget2.startsWith(n)))
    )
  }, [normTarget1, normTarget2])

  const passing = useMemo(() =>
    (trains ?? [])
      .map(tr => {
        if (matchesStation(tr.currentStop)) return { train: tr, here: true, dist: 0 }
        if (tr.operator === 'renfe') {
          // Renfe telemetry only reports nextStop and destination, not intermediate stops.
          // Only match when this station is the verified next stop.
          if (matchesStation(tr.nextStop)) return { train: tr, here: false, dist: 1 }
          return null
        }
        // FGC provides full authentic properes_parades sequence from vehicle telemetry
        const idx = tr.upcomingStops.findIndex(s => matchesStation(s))
        return idx !== -1 ? { train: tr, here: false, dist: idx + 1 } : null
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 6),
    [trains, matchesStation])

  const stationAlerts = useMemo(() => {
    if (!alerts || alerts.length === 0) return []
    const linesSet = new Set(stop.lines ?? [])
    return alerts.filter(a => {
      if (a.stops && a.stops.some(s => matchesStation(s))) return true
      if (a.stopCodes && a.stopCodes.some(c => c.replace(/\d+$/, '') === stationCode)) return true
      if (linesSet.size > 0 && a.routes.some(r => linesSet.has(r))) return true
      return false
    })
  }, [alerts, matchesStation, stationCode, stop.lines])

  const weatherAlert = useMemo(() => {
    return stationAlerts.find(a => {
      const text = (a.header + ' ' + (a.description ?? '')).toLowerCase()
      return text.includes('meteorol') || text.includes('freqüència') || text.includes('frequencia') || text.includes('inclemències') || text.includes('temporal')
    })
  }, [stationAlerts])

  const accessibilityAlert = useMemo(() => {
    return stationAlerts.find(a => {
      const text = ((a.header || '') + ' ' + (a.description || '') + ' ' + (a.explanation || '')).toLowerCase()
      return (
        text.includes('ascensor') ||
        text.includes('escala mecànica') ||
        text.includes('escales mecàniques') ||
        text.includes('escalas mecánicas') ||
        text.includes('mobilitat reduïda') ||
        text.includes('movilidad reducida') ||
        text.includes('rampa') ||
        text.includes('pmr')
      )
    })
  }, [stationAlerts])

  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    if (typeof window === 'undefined') return
    const url = `${window.location.origin}${window.location.pathname}?stop=${encodeURIComponent(stop.stopId)}`
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${stop.name} · Andana`,
          url,
        })
        return
      } catch (err: any) {
        if (err?.name === 'AbortError') return
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        // clipboard unavailable
      }
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>
            {isRenfe ? t('stationRenfe') : t('stationFgc')}
          </div>
          <h2 style={{ fontFamily: 'var(--font-space-grotesk)', fontSize: 20, margin: 0, lineHeight: 1.25, wordBreak: 'break-word' }}>
            {stop.name}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 2 }}>
          {/* 1. Compartir */}
          <button
            onClick={handleShare}
            aria-label={t('shareStation')}
            title={copied ? t('linkCopied') : t('shareStation')}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: copied ? 'rgba(34,197,94,0.18)' : 'var(--bg3)',
              border: `1px solid ${copied ? 'rgba(34,197,94,0.45)' : 'var(--border)'}`,
              color: copied ? 'var(--green)' : 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              padding: 0,
            }}
          >
            {copied ? (
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>✓</span>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            )}
          </button>

          {/* 2. Estrella */}
          <button
            onClick={() => toggleFavorite(stop)}
            aria-label={favorited ? t('removeFavorite') : t('addFavorite')}
            title={favorited ? t('removeFavorite') : t('addFavorite')}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: favorited ? 'rgba(234,179,8,0.18)' : 'var(--bg3)',
              border: `1px solid ${favorited ? 'rgba(234,179,8,0.45)' : 'var(--border)'}`,
              color: favorited ? '#eab308' : 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              padding: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={favorited ? '#eab308' : 'none'} stroke={favorited ? '#eab308' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>

          {/* 3. Creu */}
          {showCloseButton && (
            <button
              onClick={onClose}
              aria-label={t('close')}
              title={t('close')}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                color: 'var(--muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: 12,
                transition: 'all 0.15s ease',
                padding: 0,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>{stop.stopId}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
          Zona {getStationZone(stationCode)}
        </span>
        {stop.wheelchairBoarding && <span style={{ color: 'var(--accent)' }}>♿ {t('accessible')}</span>}
        {getMetroInterchanges(stationCode).length > 0 && (
          <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            {getMetroInterchanges(stationCode).map(m => (
              <span
                key={m.line}
                title={m.type === 'metro' ? `Metro ${m.line}` : `Tram ${m.line}`}
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: 4,
                  background: m.color,
                  color: '#fff',
                  fontFamily: 'var(--font-space-grotesk)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <span>{m.type === 'metro' ? 'M' : 'T'}</span>
                <span>{m.line}</span>
              </span>
            ))}
          </div>
        )}
        {stop.lines && stop.lines.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {stop.lines.map(l => {
              const c = lineColors[l] || LINE_COLORS[l] || '#7a82a0'
              return (
                <button
                  key={l}
                  type="button"
                  onClick={onOpenLineStrip ? () => onOpenLineStrip(l) : undefined}
                  title={onOpenLineStrip ? `${t('viewLineStrip')}: ${l}` : undefined}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: `${c}25`,
                    color: c,
                    border: onOpenLineStrip ? `1px solid ${c}40` : 'none',
                    fontFamily: 'var(--font-space-grotesk)',
                    cursor: onOpenLineStrip ? 'pointer' : 'default',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <span>{l}</span>
                  {onOpenLineStrip && <span style={{ fontSize: 8.5, opacity: 0.75 }}>📊</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Real-time Accessibility Status */}
      <div
        style={{
          background: accessibilityAlert
            ? 'rgba(239, 68, 68, 0.1)'
            : stop.wheelchairBoarding
            ? 'rgba(34, 197, 94, 0.08)'
            : 'var(--bg3)',
          border: `1px solid ${
            accessibilityAlert
              ? 'rgba(239, 68, 68, 0.3)'
              : stop.wheelchairBoarding
              ? 'rgba(34, 197, 94, 0.22)'
              : 'var(--border)'
          }`,
          borderRadius: 8,
          padding: '8px 10px',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1.2, marginTop: 1, flexShrink: 0 }}>
          {accessibilityAlert ? '⚠️' : stop.wheelchairBoarding ? '♿' : '🚷'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: accessibilityAlert ? 'var(--red)' : stop.wheelchairBoarding ? 'var(--green)' : 'var(--muted)' }}>
            {accessibilityAlert
              ? t('accessibilityAlert')
              : stop.wheelchairBoarding
              ? t('accessibleStation')
              : t('notAccessibleStation')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.35 }}>
            {accessibilityAlert
              ? (accessibilityAlert.description || accessibilityAlert.header)
              : stop.wheelchairBoarding
              ? t('elevatorsOperating')
              : t('notAccessibleStation')}
          </div>
        </div>
      </div>

      {/* Trains passing now/soon — tap to jump to the train's detail */}
      {trains && passing.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
            {t('passingNowSoon')}
          </div>
          {passing.map(({ train, here, dist }) => {
            const color = lineColors[train.line] || LINE_COLORS[train.line] || '#7a82a0'
            return (
              <div
                key={train.id}
                onClick={onSelectTrain ? () => onSelectTrain(train) : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--bg3)', borderRadius: 8, marginBottom: 5, cursor: onSelectTrain ? 'pointer' : 'default' }}
              >
                <span style={{ fontWeight: 700, fontSize: 12, color, minWidth: 24, fontFamily: 'var(--font-space-grotesk)' }}>{train.line}</span>
                <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {train.destination}</span>
                {train.delayMinutes > 0 && <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600 }}>+{train.delayMinutes}m</span>}
                {here
                  ? <span style={{ background: color, color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>{t('hereNow')}</span>
                  : <span style={{ color: 'var(--muted)', fontSize: 10 }}>{t('stopsAway', dist)}</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Contextual Weather / Frequency Disruption Alert Banner */}
      {weatherAlert && (
        <div style={{
          background: 'rgba(234, 179, 8, 0.12)',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          fontSize: 11.5,
          lineHeight: 1.4,
          color: 'var(--yellow)',
        }}>
          <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>{t('weatherFrequencyAlertTitle')}</div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>{t('weatherFrequencyAlertDesc')}</div>
          </div>
        </div>
      )}

      {/* Live next-departures board */}
      <DeparturesBoard
        stationCode={stationCode}
        stationName={stop.name}
        lineColors={lineColors}
        weatherAlertActive={Boolean(weatherAlert)}
      />

      {loading && (
        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>{t('loadingData')}</div>
      )}

      {weather && !loading && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
            {t('weatherLabel')} · {weather.timeRange}
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>{SKY_ICONS[weather.sky] ?? '🌡️'}</span>
            <span style={{ fontSize: 13, color: 'var(--text)', textTransform: 'capitalize' }}>{weather.sky}</span>
          </div>
        </div>
      )}

      {air && !loading && (
        <div>
          <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
            {t('airQuality')}{air.stationName ? ` · ${air.stationName}` : ''}
          </div>
          {iqam && (
            <div style={{ background: iqam.bg, border: `1px solid ${iqam.color}40`, borderRadius: 10, padding: '8px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: iqam.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: iqam.color, fontFamily: 'var(--font-space-grotesk)' }}>{t(iqam.labelKey)}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{t('airQualityIndex')}</div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <Metric label="NO₂" value={air.no2} unit="µg/m³" />
            <Metric label="O₃" value={air.o3} unit="µg/m³" />
            <Metric label="PM10" value={air.pm10} unit="µg/m³" />
          </div>
        </div>
      )}

      {!loading && !air && !weather && (
        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 0' }}>
          {t('noEnvData')}
        </div>
      )}
    </>
  )
}

export function StopPanel({ stop, onClose, lineColors = {}, mobile = false, trains, alerts, onSelectTrain, onOpenLineStrip }: StopPanelProps) {
  const [detail, setDetail] = useState<StopDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!stop) { setDetail(null); return }
    const controller = new AbortController()
    setLoading(true)
    fetch(`/api/stop-info?stopId=${encodeURIComponent(stop.stopId)}`, { signal: controller.signal })
      .then(r => r.json())
      .then((d: StopDetail) => { setDetail(d); setLoading(false) })
      .catch(e => { if (e.name !== 'AbortError') setLoading(false) })
    return () => controller.abort()
  }, [stop?.stopId])

  // Mobile: no wrapper — parent slide-up div handles positioning
  if (mobile) {
    return (
      <div style={{ padding: '0 20px 20px' }}>
        {stop && <StopContent stop={stop} detail={detail} loading={loading} onClose={onClose} showCloseButton={false} lineColors={lineColors} trains={trains} alerts={alerts} onSelectTrain={onSelectTrain} onOpenLineStrip={onOpenLineStrip} />}
      </div>
    )
  }

  // Desktop: absolutely positioned panel sliding in from the right
  const open = stop !== null
  return (
    <div style={{
      position: 'absolute',
      right: 20,
      top: 20,
      width: 300,
      background: 'var(--bg2)',
      border: '1px solid var(--border2)',
      borderRadius: 16,
      padding: 20,
      transform: open ? 'translateX(0)' : 'translateX(340px)',
      transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      zIndex: 4,
      maxHeight: 'calc(100% - 40px)',
      overflowY: 'auto',
      boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
      pointerEvents: open ? 'auto' : 'none',
    }}>
      {stop && <StopContent stop={stop} detail={detail} loading={loading} onClose={onClose} showCloseButton lineColors={lineColors} trains={trains} alerts={alerts} onSelectTrain={onSelectTrain} onOpenLineStrip={onOpenLineStrip} />}
    </div>
  )
}
