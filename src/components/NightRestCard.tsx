'use client'

import { useI18n } from '@/lib/i18n'

export function NightRestCard({ compact }: { compact?: boolean }) {
  const { t } = useI18n()

  return (
    <div
      style={{
        margin: compact ? '16px 4px' : '24px 12px',
        padding: compact ? '16px 14px' : '20px 18px',
        background: 'var(--bg3)',
        border: '1px solid var(--border2)',
        borderRadius: 14,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      }}
    >
      <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden>🌙</span>
      <div
        style={{
          fontFamily: 'var(--font-space-grotesk), sans-serif',
          fontWeight: 700,
          fontSize: 13.5,
          color: 'var(--text)',
          letterSpacing: '-0.2px',
        }}
      >
        {t('nightRestTitle')}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: 'var(--muted)',
          lineHeight: 1.5,
          maxWidth: 320,
        }}
      >
        {t('nightRestDesc')}
      </p>
    </div>
  )
}
