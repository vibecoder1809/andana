'use client'
 
import { useEffect, useState, useMemo } from 'react'
import type { Departure, Train } from '@/types'
import { LINE_COLORS } from '@/lib/constants'
import { useI18n } from '@/lib/i18n'

// Seconds since local midnight (matches the server's depTime units).
function nowSecondsOfDay(): number {
  const n = new Date()
  return n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds()
}

function fmtClock(sec: number): string {
  const h = Math.floor(sec / 3600) % 24
  const m = Math.floor(sec / 60) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const MAX_SHOWN  = 6
const REFRESH_MS = 60_000   // re-pull schedule + live delays as time passes
const IMMINENT_S = 30       // within this many seconds → show "now"

export interface DeparturesBoardProps {
  stationCode: string
  lineColors: Record<string, string>
  weatherAlertActive?: boolean
  passingTrains?: Array<{ train: Train; here: boolean; dist: number }>
}

// Live next-departures board for a station. Scheduled times come from the GTFS
// timetable (via /api/departures) and are pushed later by each line's current
// median delay; a per-second countdown ticks client-side.
export function DeparturesBoard({ stationCode, lineColors, weatherAlertActive = false, passingTrains }: DeparturesBoardProps) {
  const { t } = useI18n()
  const [departures, setDepartures] = useState<Departure[] | null>(null)
  const [now, setNow]               = useState(nowSecondsOfDay())
  const [lineFilter, setLineFilter] = useState<string>('ALL')

  // Fetch + periodically refresh the departures for this station.
  useEffect(() => {
    if (!stationCode) return
    setLineFilter('ALL')
    let active = true
    const load = () => {
      fetch(`/api/departures?station=${encodeURIComponent(stationCode)}`)
        .then(r => r.json())
        .then((d: { departures?: Departure[] }) => { if (active) setDepartures(d.departures ?? []) })
        .catch(() => { if (active) setDepartures([]) })
    }
    setDepartures(null)
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => { active = false; clearInterval(id) }
  }, [stationCode])

  // Tick the countdown every second.
  useEffect(() => {
    const id = setInterval(() => setNow(nowSecondsOfDay()), 1000)
    return () => clearInterval(id)
  }, [])

  // Unique lines available in departures for this station
  const availableLines = useMemo(() => {
    return (departures ?? []).reduce<string[]>((acc, d) => {
      if (d.line && !acc.includes(d.line)) acc.push(d.line)
      return acc
    }, []).sort()
  }, [departures])

  // Effective departure = schedule + live delay; keep those still upcoming
  // (allow a 30s grace so a train "at the platform" doesn't vanish instantly).
  const upcoming = (departures ?? [])
    .filter(d => lineFilter === 'ALL' || d.line === lineFilter)
    .map(d => ({ ...d, eff: d.depTime + (d.delayMin > 0 ? d.delayMin * 60 : 0) }))
    .filter(d => d.eff - now >= -IMMINENT_S)
    .slice(0, MAX_SHOWN)

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          {t('departures')}
        </div>
        {availableLines.length > 1 && (
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', maxWidth: '75%', scrollbarWidth: 'none' }}>
            <span
              onClick={() => setLineFilter('ALL')}
              style={{
                padding: '2px 7px',
                borderRadius: 10,
                fontSize: 9.5,
                fontWeight: 700,
                cursor: 'pointer',
                background: lineFilter === 'ALL' ? 'var(--text)' : 'var(--bg3)',
                color: lineFilter === 'ALL' ? 'var(--bg)' : 'var(--muted)',
                border: '1px solid var(--border2)',
                fontFamily: 'var(--font-space-grotesk), sans-serif',
                flexShrink: 0,
              }}
            >
              {t('allLines')}
            </span>
            {availableLines.map(l => {
              const active = lineFilter === l
              const color = lineColors[l] || LINE_COLORS[l] || '#7a82a0'
              return (
                <span
                  key={l}
                  onClick={() => setLineFilter(active ? 'ALL' : l)}
                  style={{
                    padding: '2px 7px',
                    borderRadius: 10,
                    fontSize: 9.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: active ? color : `${color}20`,
                    color: active ? '#fff' : color,
                    border: `1px solid ${active ? color : `${color}50`}`,
                    fontFamily: 'var(--font-space-grotesk), sans-serif',
                    flexShrink: 0,
                  }}
                >
                  {l}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {departures === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg3)',
                borderRadius: 8,
                padding: '8px 10px',
                opacity: 0.7,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            >
              <div style={{ width: 30, height: 18, borderRadius: 5, background: 'var(--border2)' }} />
              <div style={{ flex: 1, height: 14, borderRadius: 4, background: 'var(--border2)', maxWidth: '55%' }} />
              <div style={{ width: 44, height: 14, borderRadius: 4, background: 'var(--border2)', marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      ) : upcoming.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 0' }}>{t('noDepartures')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {weatherAlertActive && (
            <div style={{
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.25)',
              borderRadius: 8,
              padding: '6px 10px',
              color: 'var(--yellow)',
              fontSize: 11,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 4,
              lineHeight: 1.35,
            }}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>⚠️</span>
              <span>{t('theoreticalScheduleNotice')}</span>
            </div>
          )}
          {upcoming.some(d => d.isSuspended) && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 8,
              padding: '8px 12px',
              color: 'var(--red)',
              fontSize: 11.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
              lineHeight: 1.35,
            }}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>⚠️</span>
              <span>{t('serviceSuspendedNotice')}</span>
            </div>
          )}
          {upcoming.map((d, i) => {
            const color     = lineColors[d.line] || LINE_COLORS[d.line] || '#7a82a0'
            const remaining = d.eff - now
            const imminent  = remaining <= IMMINENT_S
            const isInactive = d.isSuspended || d.isCancelled
            const matchingLive = passingTrains?.find(p => p.train.line === d.line)

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--bg3)',
                  borderRadius: 8,
                  padding: '7px 10px',
                  opacity: isInactive ? 0.75 : 1,
                }}
              >
                <span style={{
                  background: color,
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 11,
                  padding: '2px 7px',
                  borderRadius: 6,
                  fontFamily: 'var(--font-space-grotesk), sans-serif',
                  flexShrink: 0,
                  minWidth: 30,
                  textAlign: 'center',
                }}>
                  {d.line}
                </span>
                <span style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textDecoration: isInactive ? 'line-through' : 'none',
                }}>
                  {d.headsign}
                </span>
                {matchingLive && !isInactive && (
                  matchingLive.here ? (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: 'rgba(34, 197, 94, 0.2)',
                        color: 'var(--green)',
                        border: '1px solid rgba(34, 197, 94, 0.35)',
                        flexShrink: 0,
                      }}
                      title={t('liveTrainAtPlatform')}
                    >
                      🟢 {t('liveTrainAtPlatform')}
                    </span>
                  ) : matchingLive.dist <= 3 ? (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: 'rgba(34, 197, 94, 0.15)',
                        color: 'var(--green)',
                        border: '1px solid rgba(34, 197, 94, 0.25)',
                        flexShrink: 0,
                      }}
                      title={t('liveTrainApproaching', matchingLive.dist)}
                    >
                      🟢 {t('liveTrainApproaching', matchingLive.dist)}
                    </span>
                  ) : null
                )}
                {d.isLastService && !isInactive && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: 'var(--yellow)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      flexShrink: 0,
                    }}
                    title={t('lastService')}
                  >
                    🌙 {t('lastServiceShort')}
                  </span>
                )}
                {d.accessible && (
                  <span style={{ fontSize: 11, color: 'var(--accent)', flexShrink: 0 }} title={t('accessibleTrain')}>♿</span>
                )}
                {d.track && !isInactive && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--muted)',
                    background: 'var(--bg2)',
                    padding: '1px 5px',
                    borderRadius: 4,
                    border: '1px solid var(--border2)',
                    flexShrink: 0,
                    fontFamily: 'var(--font-space-grotesk), monospace',
                  }}>
                    {t('trackLabel')} {d.track}
                  </span>
                )}
                {d.delayMin > 0 && !isInactive && (
                  <span style={{ color: 'var(--red)', fontWeight: 600, fontSize: 10, flexShrink: 0 }}>+{d.delayMin}m</span>
                )}
                {isInactive ? (
                  <span style={{
                    flexShrink: 0,
                    fontFamily: 'var(--font-space-grotesk), monospace',
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.4px',
                    color: 'var(--red)',
                    background: 'rgba(239, 68, 68, 0.15)',
                    padding: '2px 6px',
                    borderRadius: 4,
                    textTransform: 'uppercase',
                  }}>
                    {d.isCancelled ? t('cancelled') : t('suspended')}
                  </span>
                ) : (
                  <span style={{
                    flexShrink: 0,
                    fontFamily: 'var(--font-space-grotesk), monospace',
                    fontSize: 13,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: imminent ? 'var(--accent)' : 'var(--text)',
                    minWidth: 46,
                    textAlign: 'right',
                  }}>
                    {imminent
                      ? t('etaNow')
                      : remaining < 3600
                        ? t('minShort', Math.ceil(remaining / 60))
                        : fmtClock(d.depTime)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
