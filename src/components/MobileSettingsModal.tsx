'use client'

import { useEffect } from 'react'
import type { Theme, NetworkMode } from '@/types'
import { useI18n, LANGS, type Lang } from '@/lib/i18n'

interface MobileSettingsModalProps {
  open: boolean
  onClose: () => void
  theme: Theme
  onThemeToggle: () => void
  trainCount: number
  lineCount: number
  lastUpdate: Date | null
  refreshing: boolean
  onRefresh: () => void
  networkMode: NetworkMode
  onNetworkChange: (m: NetworkMode) => void
}

export function MobileSettingsModal({
  open,
  onClose,
  theme,
  onThemeToggle,
  trainCount,
  lineCount,
  lastUpdate,
  refreshing,
  onRefresh,
  networkMode,
  onNetworkChange,
}: MobileSettingsModalProps) {
  const { t, lang, setLang } = useI18n()

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const secsAgo = lastUpdate ? Math.max(0, Math.round((Date.now() - lastUpdate.getTime()) / 1000)) : null
  const relativeText = secsAgo == null ? '—' : secsAgo < 5 ? t('justNow') : secsAgo < 60 ? t('secsAgo', secsAgo) : t('minsAgo', Math.floor(secsAgo / 60))

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          maxHeight: '85vh',
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: '22px 22px 0 0',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          animation: 'slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-space-grotesk)' }}>
            <span>⚙️</span>
            <span>{t('settings')}</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
              width: 30,
              height: 30,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>

        {/* Settings Body */}
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* 1. Language Picker */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
              🌐 {t('language')}
            </div>
            <div style={{ display: 'flex', gap: 6, background: 'var(--bg3)', padding: 4, borderRadius: 12, border: '1px solid var(--border)' }}>
              {LANGS.map(l => {
                const active = lang === l.code
                return (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code as Lang)}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: 8,
                      border: 'none',
                      background: active ? 'var(--accent)' : 'transparent',
                      color: active ? '#fff' : 'var(--muted)',
                      fontWeight: active ? 700 : 500,
                      fontSize: 12.5,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {l.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Theme / Appearance */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
              🌓 {t('appearance')}
            </div>
            <div style={{ display: 'flex', gap: 6, background: 'var(--bg3)', padding: 4, borderRadius: 12, border: '1px solid var(--border)' }}>
              <button
                onClick={() => { if (theme !== 'dark') onThemeToggle() }}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 8,
                  border: 'none',
                  background: theme === 'dark' ? 'var(--accent)' : 'transparent',
                  color: theme === 'dark' ? '#fff' : 'var(--muted)',
                  fontWeight: theme === 'dark' ? 700 : 500,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <span>🌙</span>
                <span>{t('themeDark')}</span>
              </button>
              <button
                onClick={() => { if (theme !== 'light') onThemeToggle() }}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 8,
                  border: 'none',
                  background: theme === 'light' ? 'var(--accent)' : 'transparent',
                  color: theme === 'light' ? '#fff' : 'var(--muted)',
                  fontWeight: theme === 'light' ? 700 : 500,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <span>☀️</span>
                <span>{t('themeLight')}</span>
              </button>
            </div>
          </div>

          {/* 3. Network Selection */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
              🚆 {t('networkMode')}
            </div>
            <div style={{ display: 'flex', gap: 6, background: 'var(--bg3)', padding: 4, borderRadius: 12, border: '1px solid var(--border)' }}>
              {(['fgc', 'renfe', 'both'] as const).map(mode => {
                const active = networkMode === mode
                const label = mode === 'fgc' ? t('networkFgc') : mode === 'renfe' ? t('networkRenfe') : t('networkBoth')
                return (
                  <button
                    key={mode}
                    onClick={() => onNetworkChange(mode)}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: 8,
                      border: 'none',
                      background: active ? 'var(--accent)' : 'transparent',
                      color: active ? '#fff' : 'var(--muted)',
                      fontWeight: active ? 700 : 500,
                      fontSize: 12,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 4. Service status & refresh */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
              ⚡ {t('networkStatus')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>{t('trains')}</div>
                <div style={{ fontFamily: 'var(--font-space-grotesk)', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                  {trainCount}
                </div>
              </div>
              <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>{t('lines')}</div>
                <div style={{ fontFamily: 'var(--font-space-grotesk)', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                  {lineCount}
                </div>
              </div>
            </div>

            <div style={{
              background: 'var(--bg3)',
              borderRadius: 10,
              padding: '10px 12px',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {t('updatedShort')} <strong style={{ color: 'var(--text)' }}>{relativeText}</strong>
              </div>
              <button
                onClick={onRefresh}
                disabled={refreshing}
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border2)',
                  borderRadius: 8,
                  padding: '5px 12px',
                  color: refreshing ? 'var(--accent)' : 'var(--text)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>↻</span>
                <span>{refreshing ? t('loading') : t('refresh')}</span>
              </button>
            </div>
          </div>

          {/* 5. About Andana */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>
              {t('aboutApp')}
            </div>
            <p style={{ margin: '0 0 6px 0', fontSize: 12, color: 'var(--text)', opacity: 0.8, lineHeight: 1.4 }}>
              {t('aboutDescription')}
            </p>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              Andana · Open Data FGC & Rodalies de Catalunya
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
