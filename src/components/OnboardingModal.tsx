'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useI18n, type TransKey } from '@/lib/i18n'

interface OnboardingModalProps {
  open: boolean
  onClose: () => void
  onOpenSettings?: () => void
}

type Stage = 'prompt' | 'tour'

interface TourStep {
  selector: string
  titleKey: TransKey
  descKey: TransKey
  preferredPlacement?: 'top' | 'bottom'
}

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="network-switch"]',
    titleKey: 'tourStepNetworkTitle',
    descKey: 'tourStepNetworkDesc',
    preferredPlacement: 'bottom',
  },
  {
    selector: '[data-tour="tab-trains"]',
    titleKey: 'tourStepTrainsTitle',
    descKey: 'tourStepTrainsDesc',
    preferredPlacement: 'bottom',
  },
  {
    selector: '[data-tour="tab-stations"]',
    titleKey: 'tourStepStationsTitle',
    descKey: 'tourStepStationsDesc',
    preferredPlacement: 'bottom',
  },
  {
    selector: '[data-tour="tab-plan"]',
    titleKey: 'tourStepPlanTitle',
    descKey: 'tourStepPlanDesc',
    preferredPlacement: 'bottom',
  },
  {
    selector: '[data-tour="network-status"]',
    titleKey: 'tourStepStatusTitle',
    descKey: 'tourStepStatusDesc',
    preferredPlacement: 'bottom',
  },
  {
    selector: '[data-tour="near-me"]',
    titleKey: 'tourStepNearMeTitle',
    descKey: 'tourStepNearMeDesc',
    preferredPlacement: 'top',
  },
  {
    selector: '[data-tour="settings"]',
    titleKey: 'tourStepSettingsTitle',
    descKey: 'tourStepSettingsDesc',
    preferredPlacement: 'bottom',
  },
]

export function OnboardingModal({ open, onClose, onOpenSettings }: OnboardingModalProps) {
  const { t, lang, setLang } = useI18n()
  const [stage, setStage] = useState<Stage>('prompt')
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; arrowPlacement: 'top' | 'bottom' } | null>(null)

  // Reset when opened
  useEffect(() => {
    if (open) {
      setStage('prompt')
      setCurrentStepIdx(0)
    }
  }, [open])

  // Keydown Escape
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Update target coordinates
  const updateTargetPosition = useCallback(() => {
    if (stage !== 'tour' || !open) return

    const step = TOUR_STEPS[currentStepIdx]
    if (!step) return

    const el = document.querySelector(step.selector)
    if (!el) {
      setTargetRect(null)
      setTooltipPos(null)
      return
    }

    const rect = el.getBoundingClientRect()
    setTargetRect(rect)

    const vh = window.innerHeight
    const vw = window.innerWidth
    const tooltipWidth = Math.min(360, vw - 28)
    const tooltipHeight = 190

    // Determine placement: above or below
    let placement: 'top' | 'bottom' = step.preferredPlacement || 'bottom'
    if (placement === 'bottom' && rect.bottom + tooltipHeight + 20 > vh) {
      placement = 'top'
    } else if (placement === 'top' && rect.top - tooltipHeight - 20 < 0) {
      placement = 'bottom'
    }

    let top = placement === 'bottom' ? rect.bottom + 14 : rect.top - tooltipHeight - 14
    top = Math.max(16, Math.min(vh - tooltipHeight - 16, top))

    let left = rect.left + rect.width / 2 - tooltipWidth / 2
    left = Math.max(14, Math.min(vw - tooltipWidth - 14, left))

    setTooltipPos({ top, left, arrowPlacement: placement === 'bottom' ? 'top' : 'bottom' })
  }, [stage, open, currentStepIdx])

  useEffect(() => {
    if (stage === 'tour') {
      const step = TOUR_STEPS[currentStepIdx]
      if (step) {
        window.dispatchEvent(new CustomEvent('andana-tour-step', {
          detail: { selector: step.selector, idx: currentStepIdx }
        }))
      }
      updateTargetPosition()
      const onResize = () => updateTargetPosition()
      const onScroll = () => updateTargetPosition()
      window.addEventListener('resize', onResize)
      window.addEventListener('scroll', onScroll, true)
      const timer = setTimeout(updateTargetPosition, 80)
      const timer2 = setTimeout(updateTargetPosition, 260)
      return () => {
        window.removeEventListener('resize', onResize)
        window.removeEventListener('scroll', onScroll, true)
        clearTimeout(timer)
        clearTimeout(timer2)
      }
    }
  }, [stage, currentStepIdx, updateTargetPosition])

  if (!open) return null

  // ── 1. Initial Prompt Dialog ──────────────────────────────────────────
  if (stage === 'prompt') {
    return (
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(8px)',
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
            maxWidth: 420,
            background: 'var(--bg2)',
            border: '1px solid var(--border2)',
            borderRadius: 22,
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            padding: '20px 22px 24px',
            textAlign: 'center',
          }}
        >
          {/* Top bar inside prompt card: Brand left, Lang switch right */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            width: '100%',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <img src="/logo.svg" alt="" style={{ width: 22, height: 22, borderRadius: 5 }} />
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-space-grotesk)', color: 'var(--text)' }}>
                Andana
              </span>
            </div>

            {/* Quick language switch */}
            <div style={{
              display: 'flex',
              background: 'var(--bg3)',
              borderRadius: 8,
              padding: 2,
              border: '1px solid var(--border)',
            }}>
              {(['ca', 'es', 'en'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  style={{
                    border: 'none',
                    borderRadius: 6,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: lang === l ? 700 : 500,
                    background: lang === l ? 'var(--accent)' : 'transparent',
                    color: lang === l ? '#fff' : 'var(--muted)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textTransform: 'uppercase',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div style={{
            width: 58,
            height: 58,
            borderRadius: 18,
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            margin: '0 auto 14px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
          }}>
            👋
          </div>

          <h3 style={{
            fontSize: 19,
            fontWeight: 700,
            margin: '0 0 10px',
            fontFamily: 'var(--font-space-grotesk)',
            color: 'var(--text)',
            lineHeight: 1.3,
          }}>
            {t('tourFirstTimePrompt')}
          </h3>

          <p style={{
            fontSize: 13.5,
            lineHeight: 1.55,
            color: 'var(--muted)',
            margin: '0 0 24px',
          }}>
            {t('tourFirstTimeDesc')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => {
                setStage('tour')
                setCurrentStepIdx(0)
              }}
              style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                padding: '12px 18px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
              }}
            >
              <span>{t('tourStart')}</span>
              <span>→</span>
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'var(--bg3)',
                color: 'var(--muted)',
                border: '1px solid var(--border)',
                padding: '10px 18px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t('tourSkip')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── 2. Interactive Spotlight Tour ─────────────────────────────────────
  const step = TOUR_STEPS[currentStepIdx]
  const isLast = currentStepIdx === TOUR_STEPS.length - 1

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        pointerEvents: 'auto',
      }}
    >
      {/* Target spotlight cutout / highlight ring */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            borderRadius: 14,
            border: '2.5px solid var(--accent)',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.78)',
            pointerEvents: 'none',
            zIndex: 1001,
            transition: 'all 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      )}

      {/* Darkened backdrop fallback when element is not found */}
      {!targetRect && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            zIndex: 1001,
          }}
        />
      )}

      {/* Floating Tooltip with Arrow */}
      <div
        style={{
          position: 'fixed',
          top: tooltipPos ? tooltipPos.top : '50%',
          left: tooltipPos ? tooltipPos.left : '50%',
          transform: tooltipPos ? 'none' : 'translate(-50%, -50%)',
          width: 'calc(100vw - 28px)',
          maxWidth: 360,
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 16,
          boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
          padding: '16px 18px',
          zIndex: 1002,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          animation: 'fade-in 0.2s ease-out',
        }}
      >
        {/* Directional Pointer Arrow */}
        {tooltipPos && targetRect && (
          <div
            style={{
              position: 'absolute',
              [tooltipPos.arrowPlacement === 'top' ? 'top' : 'bottom']: -11,
              left: Math.max(20, Math.min(330, targetRect.left + targetRect.width / 2 - tooltipPos.left)),
              width: 0,
              height: 0,
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              [tooltipPos.arrowPlacement === 'top' ? 'borderBottom' : 'borderTop']: '11px solid var(--bg2)',
              filter: 'drop-shadow(0 0 1px var(--border2))',
              transform: 'translateX(-50%)',
            }}
          />
        )}

        {/* Header: step badge + skip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 10.5,
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: 8,
              fontFamily: 'var(--font-space-grotesk)',
            }}>
              {currentStepIdx + 1} / {TOUR_STEPS.length}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Tutorial
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label={t('skipTutorial')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: 6,
              fontFamily: 'inherit',
            }}
          >
            {t('skipTutorial')} ✕
          </button>
        </div>

        {/* Title & Desc */}
        <div>
          <h4 style={{
            margin: '2px 0 6px',
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--text)',
            fontFamily: 'var(--font-space-grotesk)',
          }}>
            {t(step.titleKey)}
          </h4>
          <p style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--muted)',
          }}>
            {t(step.descKey)}
          </p>
        </div>

        {/* Footer Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          {currentStepIdx > 0 ? (
            <button
              onClick={() => setCurrentStepIdx(i => i - 1)}
              style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ← {t('prevStep')}
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            {isLast && onOpenSettings && (
              <button
                onClick={() => {
                  onClose()
                  onOpenSettings()
                }}
                style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border2)',
                  color: 'var(--text)',
                  padding: '7px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span>{t('openSettingsNow')}</span>
              </button>
            )}

            <button
              onClick={() => {
                if (isLast) onClose()
                else setCurrentStepIdx(i => i + 1)
              }}
              style={{
                background: 'var(--accent)',
                border: 'none',
                color: '#fff',
                padding: '7px 16px',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
              }}
            >
              <span>{isLast ? t('tourFinish') : t('nextStep')}</span>
              <span>{isLast ? '✨' : '→'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
