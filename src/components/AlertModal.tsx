'use client'

import { useEffect } from 'react'
import type { Alert } from '@/types'
import { useI18n } from '@/lib/i18n'
import { formatAlertDateTime } from '@/lib/alertTime'
import { LINE_COLORS } from '@/lib/constants'

interface AlertModalProps {
  alert: Alert | null
  onClose: () => void
  lineColors?: Record<string, string>
}

export function AlertModal({ alert, onClose, lineColors = {} }: AlertModalProps) {
  const { t, lang } = useI18n()

  // Close on Escape key
  useEffect(() => {
    if (!alert) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [alert, onClose])

  if (!alert) return null

  const isRenfe = alert.operator === 'renfe'
  const isBus = alert.header.toLowerCase().includes('autobús') || alert.header.toLowerCase().includes('autobus')
  const isCars = alert.header.toLowerCase().includes('primer') && alert.header.toLowerCase().includes('cotxe')

  // Resolve explanation only when it provides genuine additional context
  const explanation = alert.explanation || (isBus ? t('busReplacementNotice') : isCars ? t('carsRestrictionNotice') : undefined)
  const alertTime = formatAlertDateTime(alert.start, lang, t)
  const validUntilTime = formatAlertDateTime(alert.end, lang, t)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 16,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Header strip */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              background: 'var(--yellow)',
              color: '#000',
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.5px',
            }}>
              ⚠ {t('alert')}
            </span>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: 6,
              background: isRenfe ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 140, 0, 0.15)',
              color: isRenfe ? '#ef4444' : '#ff8c00',
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
            }}>
              {isRenfe ? 'Rodalies' : 'FGC'}
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
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

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Title */}
          <div>
            <h2 style={{ fontFamily: 'var(--font-space-grotesk)', fontSize: 18, color: 'var(--yellow)', margin: '0 0 6px 0', lineHeight: 1.3 }}>
              {alert.header}
            </h2>
            {alert.description && alert.description !== alert.header && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', opacity: 0.9 }}>
                {alert.description}
              </p>
            )}
          </div>

          {/* Alert publication date & validity */}
          {(alertTime || validUntilTime) && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              alignItems: 'center',
              padding: '10px 14px',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              fontSize: 12,
            }}>
              {alertTime && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
                  <span style={{ fontSize: 13 }}>🕒</span>
                  <span>
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{t('alertIssuedAt')}</span>{' '}
                    <strong style={{ fontWeight: 700 }}>{alertTime.full}</strong>
                  </span>
                </div>
              )}
              {validUntilTime && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
                  <span style={{ fontSize: 13 }}>📅</span>
                  <span>
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{t('alertValidUntil')}</span>{' '}
                    <strong style={{ fontWeight: 700 }}>{validUntilTime.full}</strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Context explanation */}
          {explanation && explanation !== alert.description && explanation !== alert.header && (
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>
                {t('whatIsThisAlert')}
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: 'var(--text)' }}>
                {explanation}
              </p>
            </div>
          )}

          {/* Affected routes / lines */}
          {alert.routes && alert.routes.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                {t('affectedLines')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {alert.routes.map(l => {
                  const color = lineColors[l] || LINE_COLORS[l] || '#7a82a0'
                  return (
                    <span
                      key={l}
                      style={{
                        padding: '3px 9px',
                        borderRadius: 6,
                        background: `${color}25`,
                        color,
                        fontWeight: 700,
                        fontSize: 12,
                        fontFamily: 'var(--font-space-grotesk)',
                      }}
                    >
                      {l}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Affected stations */}
          {alert.stops && alert.stops.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                {t('affectedStations')} ({alert.stops.length})
              </div>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 5,
                maxHeight: 140,
                overflowY: 'auto',
                padding: '10px',
                background: 'var(--bg3)',
                borderRadius: 10,
                border: '1px solid var(--border)',
              }}>
                {alert.stops.map(st => (
                  <span
                    key={st}
                    style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: 'var(--bg2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                    }}
                  >
                    {st}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Official channels to check */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
              {t('officialSources')}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {isRenfe ? (
                <>
                  {/* Rodalies official alteracions */}
                  <a
                    href="https://rodalies.gencat.cat/ca/alteracions_del_servei/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--bg3)',
                      border: '1px solid var(--border2)',
                      borderRadius: 10,
                      color: 'var(--text)',
                      textDecoration: 'none',
                      fontSize: 12.5,
                      fontWeight: 600,
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>🚆</span>
                      <span>{t('officialRodaliesAlteracions')}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>↗</span>
                  </a>

                  {/* Rodalies twitter */}
                  <a
                    href="https://twitter.com/rodalies"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--bg3)',
                      border: '1px solid var(--border2)',
                      borderRadius: 10,
                      color: 'var(--text)',
                      textDecoration: 'none',
                      fontSize: 12.5,
                      fontWeight: 600,
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>🐦</span>
                      <span>{t('officialRodaliesTwitter')}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>↗</span>
                  </a>
                </>
              ) : (
                <>
                  {/* FGC official avisos */}
                  <a
                    href="https://www.fgc.cat/avisos/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--bg3)',
                      border: '1px solid var(--border2)',
                      borderRadius: 10,
                      color: 'var(--text)',
                      textDecoration: 'none',
                      fontSize: 12.5,
                      fontWeight: 600,
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>🌐</span>
                      <span>{t('officialFgcAvisos')}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>↗</span>
                  </a>

                  {/* FGC twitter */}
                  <a
                    href="https://twitter.com/FGC"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--bg3)',
                      border: '1px solid var(--border2)',
                      borderRadius: 10,
                      color: 'var(--text)',
                      textDecoration: 'none',
                      fontSize: 12.5,
                      fontWeight: 600,
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>🐦</span>
                      <span>{t('officialFgcTwitter')}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>↗</span>
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
