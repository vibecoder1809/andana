'use client'

import { useMemo, useState, useEffect } from 'react'
import type { Stop, Route, Train } from '@/types'
import { LINE_COLORS } from '@/lib/constants'
import { useI18n } from '@/lib/i18n'
import { getMetroInterchanges } from '@/lib/metroInterchanges'
import { normalizeSearchText } from '@/lib/searchUtils'
import { getOrderedStopsForLine, normalizeLineCode } from '@/lib/lineStops'
import { haversine } from '@/lib/geometry'

interface LineStripModalProps {
  open: boolean
  line: string | null
  onClose: () => void
  stops: Stop[]
  routes: Route[]
  trains?: Train[]
  lineColors: Record<string, string>
  onSelectStop: (stop: Stop) => void
  onSelectTrain?: (train: Train) => void
}

export function LineStripModal({
  open,
  line,
  onClose,
  stops,
  routes,
  trains = [],
  lineColors,
  onSelectStop,
  onSelectTrain,
}: LineStripModalProps) {
  const { t } = useI18n()
  const [reverse, setReverse] = useState(false)

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Reset reverse order when line changes
  useEffect(() => {
    setReverse(false)
  }, [line])

  // Ordered sequence of stations along the selected line
  const orderedStops = useMemo(() => {
    if (!line) return []
    return getOrderedStopsForLine(line, stops, routes)
  }, [line, stops, routes])

  const displayedStops = useMemo(() => {
    return reverse ? [...orderedStops].reverse() : orderedStops
  }, [orderedStops, reverse])

  const cleanLine = useMemo(() => (line ? normalizeLineCode(line) : ''), [line])

  // Real-time trains circulating on this specific line
  const lineTrains = useMemo(() => {
    if (!cleanLine) return []
    return trains.filter(tr => normalizeLineCode(tr.line) === cleanLine)
  }, [cleanLine, trains])

  // Map trains to stations (stationed or approaching)
  const trainsByStation = useMemo(() => {
    const map = new Map<string, { stationed: Train[]; approaching: Train[] }>()

    for (const s of displayedStops) {
      map.set(s.stopId, { stationed: [], approaching: [] })
    }

    const norm = (str?: string | null) =>
      str ? normalizeSearchText(str).replace(/^(barcelona|bcn|estacio)\s+/g, '') : ''

    for (const tr of lineTrains) {
      const cur = norm(tr.currentStop)
      const next = norm(tr.nextStop || tr.upcomingStops?.[0])

      let matchedStationed = false
      let matchedApproaching = false

      for (const s of displayedStops) {
        const sNorm = norm(s.name)
        const bucket = map.get(s.stopId)!

        const isCurMatch =
          cur &&
          (cur === sNorm ||
            (cur.length >= 4 && (cur.includes(sNorm) || sNorm.includes(cur))))

        const isNextMatch =
          next &&
          (next === sNorm ||
            (next.length >= 4 && (next.includes(sNorm) || sNorm.includes(next))))

        // Physical proximity fallback when train is stopped near a station (< 350m)
        const isNear =
          tr.lat != null &&
          tr.lng != null &&
          s.lat != null &&
          s.lng != null &&
          haversine([tr.lng, tr.lat], [s.lng, s.lat]) < 350

        if ((isCurMatch || (isNear && tr.operationalStatus === 'stationed')) && !matchedStationed) {
          bucket.stationed.push(tr)
          matchedStationed = true
        } else if (isNextMatch && !matchedStationed && !matchedApproaching) {
          bucket.approaching.push(tr)
          matchedApproaching = true
        }
      }
    }

    return map
  }, [lineTrains, displayedStops])

  if (!open || !line) return null

  const color = lineColors[line] || LINE_COLORS[line] || '#3b82f6'
  const originStation = displayedStops[0]?.name ?? ''
  const termStation = displayedStops[displayedStops.length - 1]?.name ?? ''

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 580,
          maxHeight: '88vh',
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          boxShadow: '0 20px 45px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {/* Line Pill */}
            <span
              style={{
                background: color,
                color: '#fff',
                fontFamily: 'var(--font-space-grotesk), sans-serif',
                fontWeight: 800,
                fontSize: 14,
                padding: '3px 8px',
                borderRadius: 6,
                letterSpacing: '0.4px',
                flexShrink: 0,
              }}
            >
              {line}
            </span>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {t('lineStrip')} {line}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>{t('stationsCount', displayedStops.length)}</span>
                <span>·</span>
                <span>
                  {lineTrains.length} {t('trainsOnLine').toLowerCase()}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Direction reverse toggle */}
            <button
              type="button"
              onClick={() => setReverse(v => !v)}
              title={`${t('direction')}: ${originStation} → ${termStation}`}
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text)',
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontFamily: 'inherit',
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" />
              </svg>
              <span>{t('direction')}</span>
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              title={t('close')}
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--muted)',
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Direction Indicator Bar */}
        <div
          style={{
            padding: '7px 18px',
            background: 'rgba(59, 130, 246, 0.08)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--accent)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span>▶</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {originStation} → {termStation}
            </span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>
            {t('tapStationForDepartures')}
          </span>
        </div>

        {/* Scrollable schematic line diagram */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            overscrollBehavior: 'contain',
          }}
        >
          {displayedStops.map((stop, idx) => {
            const isFirst = idx === 0
            const isLast = idx === displayedStops.length - 1
            const isTerminus = isFirst || isLast
            const metroLinks = getMetroInterchanges(stop.stopId)
            const otherLines = (stop.lines ?? []).filter(
              l => normalizeLineCode(l) !== cleanLine,
            )
            const trainStatus = trainsByStation.get(stop.stopId)
            const stationedTrains = trainStatus?.stationed ?? []
            const approachingTrains = trainStatus?.approaching ?? []

            return (
              <div
                key={stop.stopId}
                onClick={() => {
                  onSelectStop(stop)
                  onClose()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  minHeight: 46,
                  position: 'relative',
                  cursor: 'pointer',
                  borderRadius: 8,
                  padding: '4px 6px',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Vertical Track Spine + Station Node */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    width: 22,
                    position: 'relative',
                    flexShrink: 0,
                    alignSelf: 'stretch',
                  }}
                >
                  {/* Top rail line */}
                  {!isFirst && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: '50%',
                        width: 4,
                        background: color,
                        borderRadius: 2,
                      }}
                    />
                  )}

                  {/* Bottom rail line */}
                  {!isLast && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        bottom: 0,
                        width: 4,
                        background: color,
                        borderRadius: 2,
                      }}
                    />
                  )}

                  {/* Station Node Circle */}
                  <div
                    style={{
                      width: isTerminus ? 16 : 13,
                      height: isTerminus ? 16 : 13,
                      borderRadius: '50%',
                      background: 'var(--bg2)',
                      border: `${isTerminus ? 3.5 : 2.5}px solid ${color}`,
                      boxShadow: stationedTrains.length > 0 ? `0 0 10px ${color}` : 'none',
                      zIndex: 2,
                      marginTop: 'auto',
                      marginBottom: 'auto',
                      flexShrink: 0,
                    }}
                  />
                </div>

                {/* Station Info + Interchanges + Real-time Trains */}
                <div style={{ flex: 1, minWidth: 0, paddingBottom: 6 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: isTerminus ? 13.5 : 12.5,
                          fontWeight: isTerminus ? 800 : 600,
                          color: 'var(--text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {stop.name}
                      </span>
                      {stop.wheelchairBoarding && (
                        <span
                          style={{ fontSize: 11, color: 'var(--accent)' }}
                          title={t('accessible')}
                        >
                          ♿
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Interchanges Row: Metro, Tram, other rail lines */}
                  {(metroLinks.length > 0 || otherLines.length > 0) && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        flexWrap: 'wrap',
                        marginTop: 3,
                      }}
                    >
                      {/* Metro & Tram */}
                      {metroLinks.map(m => (
                        <span
                          key={m.line}
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: m.color,
                            color: '#fff',
                            fontFamily: 'var(--font-space-grotesk)',
                            lineHeight: 1.15,
                          }}
                        >
                          {m.type === 'metro' ? 'M' : 'T'} {m.line}
                        </span>
                      ))}

                      {/* Other Rail Lines */}
                      {otherLines.slice(0, 5).map(l => {
                        const lc = lineColors[l] || LINE_COLORS[l] || '#7a82a0'
                        return (
                          <span
                            key={l}
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: `${lc}25`,
                              color: lc,
                              border: `1px solid ${lc}40`,
                              fontFamily: 'var(--font-space-grotesk)',
                              lineHeight: 1.15,
                            }}
                          >
                            {l}
                          </span>
                        )
                      })}
                      {otherLines.length > 5 && (
                        <span
                          style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600 }}
                        >
                          +{otherLines.length - 5}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Real-time trains stationed at this stop */}
                  {stationedTrains.map(tr => (
                    <div
                      key={`stationed-${tr.id}`}
                      onClick={e => {
                        if (onSelectTrain) {
                          e.stopPropagation()
                          onSelectTrain(tr)
                          onClose()
                        }
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 4,
                        padding: '2px 7px',
                        borderRadius: 6,
                        background: 'rgba(34, 197, 94, 0.15)',
                        border: '1px solid rgba(34, 197, 94, 0.35)',
                        color: 'var(--green)',
                        fontSize: 10.5,
                        fontWeight: 700,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: 'var(--green)',
                          animation: 'pulse 1.5s infinite',
                        }}
                      />
                      <span>{t('atPlatform')}:</span>
                      <span style={{ color: 'var(--text)' }}>→ {tr.destination}</span>
                      {tr.delayMinutes > 0 && (
                        <span style={{ color: 'var(--red)', fontWeight: 800 }}>
                          +{tr.delayMinutes}m
                        </span>
                      )}
                    </div>
                  ))}

                  {/* Real-time trains approaching this stop */}
                  {approachingTrains.map(tr => (
                    <div
                      key={`approaching-${tr.id}`}
                      onClick={e => {
                        if (onSelectTrain) {
                          e.stopPropagation()
                          onSelectTrain(tr)
                          onClose()
                        }
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 4,
                        padding: '2px 7px',
                        borderRadius: 6,
                        background: 'rgba(59, 130, 246, 0.12)',
                        border: '1px solid rgba(59, 130, 246, 0.28)',
                        color: 'var(--accent)',
                        fontSize: 10.5,
                        fontWeight: 600,
                      }}
                    >
                      <span>🚆 {t('approaching')}:</span>
                      <span style={{ color: 'var(--text)' }}>→ {tr.destination}</span>
                      {tr.delayMinutes > 0 && (
                        <span style={{ color: 'var(--red)', fontWeight: 800 }}>
                          +{tr.delayMinutes}m
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
