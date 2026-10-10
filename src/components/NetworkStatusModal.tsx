'use client'

import { useMemo } from 'react'
import type { Alert, Train, FeedTimestamps } from '@/types'
import { LINE_COLORS } from '@/lib/constants'
import { useI18n } from '@/lib/i18n'

interface NetworkStatusModalProps {
  open: boolean
  onClose: () => void
  alerts: Alert[]
  trains: Train[]
  lineColors: Record<string, string>
  focusedLine?: string | null
  onSelectLine?: (line: string | null) => void
  onOpenLineStrip?: (line: string) => void
  outages?: { renfe: boolean; fgc: boolean }
  feedTimestamps?: FeedTimestamps
}

interface LineGroup {
  name: { ca: string; es: string; en: string }
  operator: 'fgc' | 'renfe'
  lines: string[]
}

const LINE_GROUPS: LineGroup[] = [
  {
    name: { ca: 'FGC — Barcelona-Vallès', es: 'FGC — Barcelona-Vallès', en: 'FGC — Barcelona-Vallès' },
    operator: 'fgc',
    lines: ['S1', 'S2', 'L6', 'L7', 'L12'],
  },
  {
    name: { ca: 'FGC — Llobregat-Anoia', es: 'FGC — Llobregat-Anoia', en: 'FGC — Llobregat-Anoia' },
    operator: 'fgc',
    lines: ['L8', 'S3', 'S4', 'S8', 'S9', 'R5', 'R6', 'R50', 'R60'],
  },
  {
    name: { ca: 'Rodalies de Catalunya', es: 'Rodalies de Catalunya', en: 'Rodalies de Catalunya' },
    operator: 'renfe',
    lines: ['R1', 'R2', 'R2N', 'R2S', 'R3', 'R4', 'R7', 'R8', 'RG1'],
  },
  {
    name: { ca: 'Regionals de Catalunya', es: 'Regionales de Cataluña', en: 'Catalonia Regionals' },
    operator: 'renfe',
    lines: ['R11', 'R12', 'R13', 'R14', 'R15', 'R16', 'R17', 'RT1', 'RT2'],
  },
]

export function NetworkStatusModal({
  open,
  onClose,
  alerts,
  trains,
  lineColors,
  focusedLine,
  onSelectLine,
  onOpenLineStrip,
  outages,
  feedTimestamps,
}: NetworkStatusModalProps) {
  const { lang, t } = useI18n()

  const formatFeedTime = (ts?: number) => {
    if (!ts) return '—'
    const secs = Math.max(0, Math.round((Date.now() - ts) / 1000))
    if (secs < 5) return t('justNow')
    if (secs < 60) return t('secsAgo', secs)
    const mins = Math.floor(secs / 60)
    return t('minsAgo', mins)
  }

  const lineStatuses = useMemo(() => {
    const map = new Map<string, {
      status: 'normal' | 'delay' | 'disrupted' | 'outage'
      detail: string
      trainCount: number
      alertCount: number
    }>()

    for (const group of LINE_GROUPS) {
      const isOperatorOutage = group.operator === 'renfe' ? outages?.renfe : outages?.fgc

      for (const line of group.lines) {
        const lineAlerts = alerts.filter(a => a.routes.includes(line))
        const disruptiveAlerts = lineAlerts.filter(a => !a.isInformational)
        const lineTrains = trains.filter(t => t.line === line)
        const delays = lineTrains.map(t => t.delayMinutes).filter(d => d > 0)
        const avgDelay = delays.length > 0 ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 0

        let status: 'normal' | 'delay' | 'disrupted' | 'outage' = 'normal'
        let detail = lang === 'ca' ? 'Servei normal' : lang === 'es' ? 'Servicio normal' : 'Normal service'

        if (disruptiveAlerts.length > 0) {
          status = 'disrupted'
          detail = disruptiveAlerts[0].header.length > 35
            ? disruptiveAlerts[0].header.slice(0, 35) + '…'
            : disruptiveAlerts[0].header
        } else if (avgDelay >= 4) {
          status = 'delay'
          detail = `+${avgDelay} min`
        } else if (lineAlerts.length > 0) {
          // Informational notices (e.g. school reservations or links) keep status normal
          status = 'normal'
          detail = lineAlerts[0].header.length > 35
            ? lineAlerts[0].header.slice(0, 35) + '…'
            : lineAlerts[0].header
        } else if (lineTrains.length > 0) {
          detail = `${lineTrains.length} ${lineTrains.length === 1 ? 'tren' : 'trens'}`
        } else if (isOperatorOutage) {
          status = 'outage'
          detail = t('noLiveTelemetry')
        }

        map.set(line, {
          status,
          detail,
          trainCount: lineTrains.length,
          alertCount: lineAlerts.length,
        })
      }
    }
    return map
  }, [alerts, trains, lang, outages, t])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 14,
          width: '100%',
          maxWidth: 580,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🚦</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontFamily: 'var(--font-space-grotesk)', fontSize: 17, margin: 0, fontWeight: 700 }}>
                  {lang === 'ca' ? 'Estat del servei per línia' : lang === 'es' ? 'Estado del servicio por línea' : 'Line Service Status'}
                </h2>
                {focusedLine && (
                  <button
                    onClick={() => {
                      onSelectLine?.(null)
                      onClose()
                    }}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      color: 'var(--red)',
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontFamily: 'inherit',
                    }}
                    title={t('clearFilter')}
                  >
                    <span>✕ {t('clearFilter')} ({focusedLine})</span>
                  </button>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                {lang === 'ca' ? 'Clica sobre una línia per filtrar-la al mapa' : lang === 'es' ? 'Haz clic en una línea para filtrarla en el mapa' : 'Click a line to highlight it on the map'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border2)',
              color: 'var(--muted)',
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content list */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Telemetry freshness cards per operator */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            padding: '10px 12px',
            background: 'var(--bg3)',
            borderRadius: 12,
            border: '1px solid var(--border)',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: outages?.fgc ? 'var(--yellow)' : 'var(--green)' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>FGC</span>
                {feedTimestamps?.fgc && (
                  <span style={{ fontSize: 10.5, color: 'var(--muted)', marginLeft: 'auto' }}>
                    {formatFeedTime(feedTimestamps.fgc)}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>
                {t('feedCadenceFgc')}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: outages?.renfe ? 'var(--yellow)' : 'var(--green)' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>Rodalies</span>
                {feedTimestamps?.renfe && (
                  <span style={{ fontSize: 10.5, color: 'var(--muted)', marginLeft: 'auto' }}>
                    {formatFeedTime(feedTimestamps.renfe)}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>
                {t('feedCadenceRenfe')}
              </div>
            </div>
          </div>

          {LINE_GROUPS.map(group => {
            const isGroupOutage = group.operator === 'renfe' ? outages?.renfe : outages?.fgc

            return (
              <div key={group.name.ca}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    {group.name[lang] || group.name.ca}
                  </span>
                  {isGroupOutage && (
                    <span style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 12,
                      background: 'rgba(245, 158, 11, 0.14)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      color: 'var(--yellow)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <span>⚠️</span> {t('telemetryOutageBadge')}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                  {group.lines.map(line => {
                    const info = lineStatuses.get(line)
                    const color = lineColors[line] || LINE_COLORS[line] || '#7a82a0'
                    const isDisrupted = info?.status === 'disrupted'
                    const isDelay = info?.status === 'delay'
                    const isOutage = info?.status === 'outage'
                    const isSelected = focusedLine === line

                    return (
                      <div
                        key={line}
                        onClick={() => {
                          onSelectLine?.(isSelected ? null : line)
                          onClose()
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          background: isSelected ? 'rgba(59, 130, 246, 0.14)' : 'var(--bg3)',
                          border: isSelected
                            ? '1.5px solid var(--accent)'
                            : `1px solid ${isDisrupted ? 'rgba(239,68,68,0.4)' : isDelay || isOutage ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
                          borderRadius: 8,
                          cursor: 'pointer',
                          transition: 'background 0.15s, border-color 0.15s',
                          boxShadow: isSelected ? '0 0 0 1px var(--accent)' : 'none',
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg)' }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg3)' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <span
                            style={{
                              background: color,
                              color: '#fff',
                              fontWeight: 700,
                              fontSize: 11,
                              padding: '2px 7px',
                              borderRadius: 5,
                              fontFamily: 'var(--font-space-grotesk)',
                              flexShrink: 0,
                            }}
                          >
                            {line}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: isDisrupted ? 'var(--red)' : isDelay || isOutage ? 'var(--yellow)' : 'var(--muted)',
                              fontWeight: isDisrupted || isDelay ? 600 : 400,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {info?.detail}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {onOpenLineStrip && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onOpenLineStrip(line)
                                onClose()
                              }}
                              title={t('viewLineStrip')}
                              style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid var(--border)',
                                borderRadius: 5,
                                color: 'var(--text)',
                                padding: '2px 5px',
                                fontSize: 10,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                            >
                              <span>📊</span>
                            </button>
                          )}
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: isDisrupted ? 'var(--red)' : isDelay || isOutage ? 'var(--yellow)' : '#22c55e',
                              flexShrink: 0,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
