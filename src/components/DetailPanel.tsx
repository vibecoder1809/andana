'use client'
 
import { useState, useEffect } from 'react'
import type { Train } from '@/types'
import { LINE_COLORS, WAGON_LABELS } from '@/lib/constants'
import { useI18n } from '@/lib/i18n'

function occColor(pct: number) {
  if (pct > 70) return 'var(--red)'
  if (pct > 40) return 'var(--yellow)'
  return 'var(--green)'
}

function formatEta(etaEpoch?: number, nowMs: number = Date.now()): string {
  if (!etaEpoch || !Number.isFinite(etaEpoch)) return '—'
  const diffSec = Math.round((etaEpoch * 1000 - nowMs) / 1000)
  const d = new Date(etaEpoch * 1000)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const timeStr = `${hh}:${mm}`
  if (diffSec <= 0) return `0s (${timeStr})`
  if (diffSec < 60) return `${diffSec}s (${timeStr})`
  const diffMin = Math.floor(diffSec / 60)
  return `${diffMin} min (${timeStr})`
}

interface DetailPanelProps {
  train: Train | null
  lineColors: Record<string, string>
  onClose: () => void
  /** Render as in-flow content inside the mobile bottom sheet (no absolute
      desktop positioning, no close button — the sheet handle handles closing). */
  mobile?: boolean
}

export function DetailPanel({ train, lineColors, onClose, mobile = false }: DetailPanelProps) {
  const { t } = useI18n()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!train) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [train])

  const open = train !== null
  const isRenfe = train?.operator === 'renfe'
  const isCremallera = train?.line === 'M1' || train?.line === 'M2' || train?.line === 'MM'

  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    if (!train || typeof window === 'undefined') return
    const url = `${window.location.origin}${window.location.pathname}?train=${encodeURIComponent(train.id)}`
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${train.line} (${train.destination ?? ''}) · Andana`,
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

  const inner = train && (
        <>
          <div style={{ position: 'absolute', top: mobile ? 0 : 14, right: mobile ? 20 : 14, display: 'flex', alignItems: 'center', gap: 6, zIndex: 2 }}>
            <button
              onClick={handleShare}
              aria-label={t('shareTrain')}
              title={copied ? t('linkCopied') : t('shareTrain')}
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
            {!mobile && (
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

          {isRenfe ? (
            <>
              {/* Renfe header */}
              <div style={{ fontSize: 11, fontWeight: 700, color: lineColors[train.line] || LINE_COLORS[train.line] || '#FAB400', marginBottom: 4, fontFamily: 'var(--font-space-grotesk)' }}>
                {t('cercanias')} {train.trainNumber ? `· #${train.trainNumber}` : ''}
              </div>
              <h2 style={{ fontFamily: 'var(--font-space-grotesk), sans-serif', fontSize: 24, marginBottom: 4, color: lineColors[train.line] || LINE_COLORS[train.line] || 'var(--text)' }}>
                {train.line}
              </h2>

              {/* Route banner */}
              <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '10px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{train.origin}</span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>➔</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{train.destination}</span>
              </div>

              {/* Status + Accessible badges */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                {train.operationalStatus && (
                  <span style={{
                    background: train.operationalStatus === 'approaching' ? 'rgba(59,130,246,0.15)'
                      : train.operationalStatus === 'stationed' ? 'rgba(34,197,94,0.15)'
                      : 'var(--bg3)',
                    color: train.operationalStatus === 'approaching' ? 'var(--accent)'
                      : train.operationalStatus === 'stationed' ? 'var(--green)'
                      : 'var(--text)',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 20,
                    border: '1px solid currentColor',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                    {t(train.operationalStatus)}
                  </span>
                )}

                <span style={{
                  background: train.accessible ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                  color: train.accessible ? 'var(--green)' : 'var(--muted)',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 20,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}>
                  ♿ {t(train.accessible ? 'accessibleTrain' : 'inaccessibleTrain')}
                </span>
              </div>

              {/* Renfe Telemetry Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 14 }}>
                <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 2 }}>{t('prevStopLabel')}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-space-grotesk)', fontSize: 13, fontWeight: 600 }}>{train.prevStop ?? '—'}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>({t('trackLabel')}: <b style={{ color: 'var(--text)' }}>{train.prevTrack ?? '—'}</b>)</span>
                  </div>
                </div>

                <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 2 }}>{t('nextStopLabel')}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-space-grotesk)', fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{train.nextStop ?? '—'}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>({t('trackLabel')}: <b style={{ color: 'var(--text)' }}>{train.nextTrack ?? '—'}</b>)</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 2 }}>{t('expectedArrival')}</div>
                    <div style={{ fontFamily: 'var(--font-space-grotesk)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                      {formatEta(train.nextStopEta, now)}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 2 }}>{t('variation')}</div>
                    <div style={{ fontFamily: 'var(--font-space-grotesk)', fontSize: 14, fontWeight: 700, color: train.delayMinutes > 0 ? 'var(--red)' : 'var(--green)' }}>
                      {train.delayMinutes > 0 ? `+${train.delayMinutes} min` : t('onTime')}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* FGC / Cremallera service header */}
              <div style={{ fontSize: 11, fontWeight: 700, color: lineColors[train.line] || LINE_COLORS[train.line] || '#7a82a0', marginBottom: 4, fontFamily: 'var(--font-space-grotesk)' }}>
                {isCremallera ? t('cremalleraService') : t('activeService')}
              </div>
              <h2 style={{ fontFamily: 'var(--font-space-grotesk), sans-serif', fontSize: 24, marginBottom: 2 }}>
                {t('line')} {train.line}
              </h2>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 14 }}>
                {t('unit')} <b>#{train.id.split('|')[1]?.slice(-6) ?? train.id}</b>
              </p>

              {/* Depot notice for parked/inactive trains */}
              {train.operationalStatus === 'depot' && (
                <div style={{
                  background: 'rgba(100, 116, 139, 0.12)',
                  border: '1px solid var(--border2)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>💤</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                      {t('depot')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>
                      {t('depotNotice')}
                    </div>
                  </div>
                </div>
              )}

              {/* Mountain line GPS notice for Cremallera */}
              {isCremallera && (
                <div style={{
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.22)',
                  borderRadius: 10,
                  padding: '9px 12px',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  fontSize: 11,
                  color: 'var(--text)',
                  lineHeight: 1.4,
                }}>
                  <span style={{ fontSize: 13, flexShrink: 0, color: 'var(--green)', fontWeight: 700 }}>ℹ</span>
                  <span>{t('mountainLineNotice')}</span>
                </div>
              )}

              {/* Metrics grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {[
                  { label: t('finalDest'),   value: train.destination, size: 13 },
                  { label: t('punctuality'), value: train.delayMinutes > 0 ? `+${train.delayMinutes} min` : t('onTime'), color: train.delayMinutes > 0 ? 'var(--red)' : 'var(--green)', size: 18 },
                  { label: t('avgOccupancy'), value: train.occupancyPercent > 0 ? `${Math.round(train.occupancyPercent)}%` : '—', size: 18 },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--bg3)', borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 2 }}>{m.label}</div>
                    <div style={{ fontFamily: 'var(--font-space-grotesk)', fontSize: m.size, fontWeight: 600, color: m.color || 'var(--text)', paddingTop: m.size === 13 ? 4 : 0 }}>
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}


          {/* Per-wagon occupancy — rendered in physical composition order (M1 · Mi · Ri · M2).
              Cab noses at both ends make the row read as a train: outlined nose = head (M1), filled tail = rear. */}
          {train.wagons && train.wagons.some(w => w != null && w > 0) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  {t('occupancyPerCar')}
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--accent)',
                  background: 'rgba(59, 130, 246, 0.1)',
                  padding: '2px 8px',
                  borderRadius: 6,
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                }}>
                  <span style={{ fontSize: 9 }}>◀</span>
                  <span>{t('travelDirection')}</span>
                  <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {t('towards')} {train.destination}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                {/* Head — angled cab nose in front of car M1 */}
                <svg width="14" height="48" viewBox="0 0 14 48" preserveAspectRatio="none" style={{ flexShrink: 0 }} aria-hidden>
                  <path d="M13 1 V47 H1 V26 L9 1 Z" fill="var(--bg3)" stroke="var(--muted)" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
                {train.wagons.map((v, i) => {
                  if (v == null) return null // car not reported (3-car unit)
                  const label = WAGON_LABELS[i] ?? String(i + 1)
                  const pct = Math.round(v)
                  const c = occColor(v)
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ height: 48, borderRadius: 4, background: `${c}25`, border: `1px solid ${c}`, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 3 }}>
                        <div style={{ height: `${Math.max(6, Math.min(98, pct))}%`, borderRadius: 3, background: c, width: '70%' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: c }}>{pct}%</span>
                        <span style={{ fontSize: 8, color: 'var(--muted)' }}>{label}</span>
                      </div>
                    </div>
                  )
                })}
                {/* Rear — mirrored, filled, behind car M2 */}
                <svg width="14" height="48" viewBox="0 0 14 48" preserveAspectRatio="none" style={{ flexShrink: 0 }} aria-hidden>
                  <path d="M1 1 V47 H13 V26 L5 1 Z" fill="var(--border2)" stroke="var(--border2)" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          )}

          {/* Route: origin → current → upcoming stops */}
          <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>{t('upcomingStops')}</div>
          <div>
            {/* Origin */}
            <StopRow name={`${train.origin} (${t('origin2')})`} state="passed" />

            {/* Current stop if known */}
            {train.currentStop && (
              <StopRow name={train.currentStop} state="current" label={t('hereNowLabel')} />
            )}

            {/* Upcoming stops */}
            {train.upcomingStops.length === 0 && !train.currentStop && (
              <StopRow name={t('inTransit')} state="current" />
            )}
            {train.upcomingStops.map((stop, i) => (
              <StopRow
                key={i}
                name={stop === train.destination ? `${stop} (${t('terminal')})` : stop}
                state={i === 0 && !train.currentStop ? 'current' : 'next'}
                isLast={i === train.upcomingStops.length - 1}
              />
            ))}
          </div>
        </>
  )

  // Mobile: in-flow content inside the slide-up sheet (its wrapper handles the
  // panel chrome, scrim and dismiss gesture).
  if (mobile) {
    return <div style={{ padding: '0 20px 24px', position: 'relative' }}>{inner}</div>
  }

  // Desktop: absolutely positioned card sliding in from the right of the map.
  return (
    <div style={{
      position: 'absolute',
      right: 20,
      top: 20,
      width: 320,
      background: 'var(--bg2)',
      border: '1px solid var(--border2)',
      borderRadius: 16,
      padding: 20,
      transform: open ? 'translateX(0)' : 'translateX(360px)',
      transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      zIndex: 5,
      maxHeight: 'calc(100% - 40px)',
      overflowY: 'auto',
      boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
      pointerEvents: open ? 'auto' : 'none',
    }}>
      {inner}
    </div>
  )
}

function StopRow({ name, state, label, isLast }: { name: string; state: 'passed' | 'current' | 'next'; label?: string; isLast?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingBottom: 8, position: 'relative' }}>
      <div style={{ position: 'relative', zIndex: 2, marginTop: 4, flexShrink: 0 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: state === 'current' ? 'var(--accent)' : state === 'passed' ? 'var(--muted)' : 'var(--border2)',
          boxShadow: state === 'current' ? '0 0 0 3px rgba(59,130,246,0.3)' : 'none',
        }} />
        {!isLast && (
          <div style={{ position: 'absolute', left: 3.5, top: 8, width: 1, height: 18, background: 'var(--border)' }} />
        )}
      </div>
      <div style={{ flex: 1, fontSize: 12, color: state === 'passed' ? 'var(--muted)' : 'var(--text)', fontWeight: state === 'current' ? 600 : 400 }}>
        {name}
      </div>
      {label && <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>{label}</div>}
    </div>
  )
}
