'use client'

import { useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import { EXTERNAL_HOOKS } from '@/lib/externalLinks'

interface DonationModalProps {
  open: boolean
  onClose: () => void
  onSnooze: (days: number) => void
  onSupport: () => void
  donationUrl?: string
}

export function DonationModal({
  open,
  onClose,
  onSnooze,
  onSupport,
  donationUrl = EXTERNAL_HOOKS.donationUrl,
}: DonationModalProps) {
  const { t } = useI18n()

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const handleDonate = () => {
    onSupport()
    if (typeof window !== 'undefined' && donationUrl) {
      window.open(donationUrl, '_blank', 'noopener,noreferrer')
    }
  }

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
          maxWidth: 440,
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 20,
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fade-in 0.25s ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-space-grotesk)' }}>
            <span>☕</span>
            <span>{t('supportAndana')}</span>
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
        <div style={{ padding: '26px 22px 18px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: 'rgba(234,179,8,0.15)',
            border: '1px solid rgba(234,179,8,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            marginBottom: 16,
          }}>
            ☕
          </div>

          <h3 style={{
            fontSize: 19,
            fontWeight: 700,
            margin: '0 0 10px',
            fontFamily: 'var(--font-space-grotesk)',
            color: 'var(--text)',
          }}>
            {t('enjoyingAndana')}
          </h3>

          <p style={{
            fontSize: 13.5,
            lineHeight: 1.55,
            color: 'var(--muted)',
            margin: '0 0 20px',
          }}>
            {t('donationDesc')}
          </p>

          {/* Action buttons */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={handleDonate}
              style={{
                width: '100%',
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
              <span>{t('buyACoffee')}</span>
              <span>↗</span>
            </button>

            <button
              onClick={() => onSnooze(14)}
              style={{
                width: '100%',
                background: 'var(--bg3)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                padding: '10px 18px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t('remindMeLater')}
            </button>

            <button
              onClick={() => onSnooze(3650)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--muted)',
                padding: '6px 12px',
                fontSize: 11.5,
                cursor: 'pointer',
                fontFamily: 'inherit',
                opacity: 0.75,
              }}
            >
              {t('dontShowAgain')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
