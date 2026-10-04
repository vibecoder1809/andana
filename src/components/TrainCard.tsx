'use client'

import { useEffect, useState } from 'react'
import type { Train } from '@/types'
import { LINE_COLORS } from '@/lib/constants'
import { useI18n } from '@/lib/i18n'

interface TrainCardProps {
  train: Train
  selected: boolean
  onClick: () => void
  lineColors?: Record<string, string>
}

function occStyle(pct: number) {
  if (pct > 70) return { bg: 'rgba(239,68,68,0.12)', color: 'var(--status-red)' }
  if (pct > 40) return { bg: 'rgba(234,179,8,0.12)',  color: 'var(--status-yellow)' }
  return             { bg: 'rgba(34,197,94,0.12)',   color: 'var(--status-green)' }
}

export function TrainCard({ train, selected, onClick, lineColors }: TrainCardProps) {
  const { t } = useI18n()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const colors = lineColors ?? LINE_COLORS
  const color  = colors[train.line] || '#7a82a0'
  const occ    = Math.round(train.occupancyPercent)
  const oStyle = occStyle(occ)
  const delayed = train.delayMinutes > 0
  const nextStop = train.upcomingStops[0]
  const etaLabel = (etaUnix: number | undefined): string | null => {
    if (etaUnix == null || !Number.isFinite(etaUnix)) return null
    const mins = Math.round((etaUnix * 1000 - now) / 60000)
    if (!Number.isFinite(mins)) return null
    if (mins <= 0) return t('etaNow')
    return t('etaIn', mins)
  }
  const eta = etaLabel(train.nextStopEta)

  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 14px 10px 18px',
        borderRadius: 10,
        border: `1px solid ${selected ? color + '55' : 'var(--border)'}`,
        boxShadow: 'var(--card-shadow)',
        marginBottom: 5,
        cursor: 'pointer',
        background: selected ? `${color}0d` : 'transparent',
        position: 'relative',
        transition: 'background 0.15s, border-color 0.15s, opacity 0.15s',
        opacity: train.operationalStatus === 'depot' ? 0.68 : 1,
      }}
    >
      {/* Left accent bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color, borderRadius: '3px 0 0 3px', opacity: train.operationalStatus === 'depot' ? 0.5 : 1 }} />

      {/* Top row: line badge + train number + accessibility + status/delay */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-space-grotesk), sans-serif', fontSize: 12, fontWeight: 700, color, letterSpacing: '0.3px' }}>
            {train.line}
          </span>
          {train.trainNumber && (
            <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-space-grotesk), monospace' }}>
              #{train.trainNumber}
            </span>
          )}
          {train.accessible && (
            <span style={{ fontSize: 11, color: 'var(--accent)' }} title={t('accessibleTrain')}>♿</span>
          )}
        </div>

        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
          background: delayed
            ? 'rgba(239,68,68,0.12)'
            : train.operationalStatus === 'depot'
            ? 'rgba(100,116,139,0.16)'
            : train.operationalStatus
            ? 'rgba(59,130,246,0.12)'
            : oStyle.bg,
          color: delayed
            ? 'var(--status-red)'
            : train.operationalStatus === 'depot'
            ? 'var(--muted)'
            : train.operationalStatus
            ? 'var(--accent)'
            : oStyle.color,
        }}>
          {delayed
            ? `+${train.delayMinutes} min`
            : train.operationalStatus === 'depot'
              ? t('depotShort')
              : train.operationalStatus
                ? t(train.operationalStatus)
                : occ > 0
                  ? `${occ}% ${t('occupied')}`
                  : t('onTime')}
        </span>
      </div>

      {/* Destination */}
      <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        → {train.destination}
      </div>

      {/* Previous stop (for Renfe) */}
      {train.prevStop && (
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
          <span>{t('prevStopLabel')}: <span style={{ color: 'var(--text)' }}>{train.prevStop}</span></span>
          {train.prevTrack && <span style={{ color: 'var(--muted)' }}>{t('trackLabel')}: {train.prevTrack}</span>}
        </div>
      )}

      {/* Current stop if known */}
      {train.currentStop && !train.prevStop && (
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
          {t('nowAt')} <span style={{ color: 'var(--text)' }}>{train.currentStop}</span>
        </div>
      )}

      {/* Next stop + track + ETA */}
      {(train.nextStop || nextStop) && (
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t('nextStop')}: <span style={{ color: 'var(--text)' }}>{train.nextStop || nextStop}</span></span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {train.nextTrack && <span style={{ color: 'var(--muted)', fontSize: 9 }}>{t('trackLabel')}: {train.nextTrack}</span>}
            {eta && <span style={{ color: color, fontWeight: 600 }}>{eta}</span>}
          </div>
        </div>
      )}

      {/* Wagon occupancy percentages, in physical order — tiny cab noses mark
          the head (outlined) and rear (filled) of the unit. */}
      {train.wagons && train.wagons.some(w => w != null && w > 0) && (
        <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 6, display: 'flex', gap: 3, alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 9 }}>{t('carsShort')}:</span>
          <svg width="7" height="15" viewBox="0 0 7 15" preserveAspectRatio="none" style={{ flexShrink: 0 }} aria-hidden>
            <path d="M6 1 V14 H1 V8 L4.5 1 Z" fill="none" stroke="var(--muted)" strokeWidth="1" strokeLinejoin="round" />
          </svg>
          {train.wagons.map((v, i) => {
            if (v == null) return null // car not reported (3-car unit)
            const pct = Math.round(v)
            const wColor = pct > 70 ? 'var(--status-red)' : pct > 40 ? 'var(--status-yellow)' : 'var(--status-green)'
            const wBg = pct > 70 ? 'rgba(239,68,68,0.12)' : pct > 40 ? 'rgba(234,179,8,0.12)' : 'rgba(34,197,94,0.12)'
            return (
              <span key={i} style={{ fontSize: 9, fontWeight: 700, color: wColor, padding: '1px 5px', borderRadius: 4, background: wBg }}>
                {pct}%
              </span>
            )
          })}
          <svg width="7" height="15" viewBox="0 0 7 15" preserveAspectRatio="none" style={{ flexShrink: 0 }} aria-hidden>
            <path d="M1 1 V14 H6 V8 L2.5 1 Z" fill="var(--muted)" stroke="var(--muted)" strokeWidth="1" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  )
}
