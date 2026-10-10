'use client'

import { useState, useEffect, useRef } from 'react'
import { useI18n, LANGS, type Lang } from '@/lib/i18n'

function useRelativeTime(lastUpdate: Date | null): string {
  const { t } = useI18n()
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])
  if (!lastUpdate) return '—'
  const secs = Math.round((Date.now() - lastUpdate.getTime()) / 1000)
  if (secs < 5) return t('justNow')
  if (secs < 60) return t('secsAgo', secs)
  const mins = Math.floor(secs / 60)
  return t('minsAgo', mins)
}

export function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const current = LANGS.find(l => l.code === lang)!

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={compact
          ? { background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--muted)', height: 38, padding: '0 12px', borderRadius: 12, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }
          : {
              background: 'var(--bg3)',
              border: '1px solid var(--border2)',
              color: 'var(--text)',
              height: 34,
              padding: '0 12px',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              transition: 'background 0.15s, border-color 0.15s',
            }}
        onMouseEnter={e => {
          if (!compact) {
            e.currentTarget.style.background = 'var(--bg2)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }
        }}
        onMouseLeave={e => {
          if (!compact) {
            e.currentTarget.style.background = 'var(--bg3)'
            e.currentTarget.style.borderColor = 'var(--border2)'
          }
        }}
      >
        {!compact && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8, flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        )}
        {compact ? current.label : (
          <>
            <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{t('language')}:</span>{' '}
            <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{current.label}</strong>
          </>
        )}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none', marginLeft: 2 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: '100%',
          marginTop: 6,
          background: 'var(--bg2)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border2)',
          borderRadius: 10,
          padding: 4,
          zIndex: 50,
          boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
          minWidth: 130,
        }}>
          {LANGS.map(l => {
            const active = l.code === lang
            return (
              <div
                key={l.code}
                onClick={() => { setLang(l.code as Lang); setOpen(false) }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12.5,
                  color: active ? 'var(--accent)' : 'var(--text)',
                  fontWeight: active ? 700 : 500,
                  background: active ? 'var(--bg3)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg3)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span>{l.label}</span>
                {active && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>✓</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import type { NetworkMode, Theme } from '@/types'

export function NetworkSwitch({
  mode,
  onChange,
  compact = false,
}: {
  mode: NetworkMode
  onChange: (m: NetworkMode) => void
  compact?: boolean
}) {
  const { t } = useI18n()
  const options: { id: NetworkMode; label: string }[] = [
    { id: 'fgc', label: t('networkFgc') },
    { id: 'renfe', label: t('networkRenfe') },
    { id: 'both', label: t('networkBoth') },
  ]

  return (
    <div
      data-tour="network-switch"
      style={{
        display: 'inline-flex',
        background: 'var(--bg3)',
        borderRadius: compact ? 16 : 8,
        padding: 2,
        border: '1px solid var(--border2)',
        gap: 2,
      }}
    >
      {options.map(opt => {
        const active = mode === opt.id
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? '#fff' : 'var(--muted)',
              border: 'none',
              borderRadius: compact ? 13 : 6,
              padding: compact ? '4px 9px' : '5px 12px',
              fontSize: compact ? 11 : 12,
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s, color 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

interface HeaderProps {
  trainCount: number
  lineCount: number
  lastUpdate: Date | null
  refreshing: boolean
  networkMode: NetworkMode
  onNetworkChange: (m: NetworkMode) => void
  onThemeToggle: () => void
  onRefresh: () => void
  onOpenNetworkStatus?: () => void
  alertCount?: number
  onOpenSettings?: () => void
  onOpenDonation?: () => void
  theme?: Theme
}

export function Header({
  trainCount,
  lineCount,
  lastUpdate,
  refreshing,
  networkMode,
  onNetworkChange,
  onThemeToggle,
  onRefresh,
  onOpenNetworkStatus,
  alertCount,
  onOpenSettings,
  onOpenDonation,
  theme,
}: HeaderProps) {
  const { t } = useI18n()

  return (
    <header style={{
      background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 16,
      zIndex: 10,
      flexShrink: 0,
      height: 56,
    }}>
      {/* Logo */}
      <div style={{ fontFamily: 'var(--font-space-grotesk), sans-serif', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src="/logo.svg" alt="" style={{ width: 28, height: 28, borderRadius: 6 }} />
        Andana
      </div>

      {/* Live status badge + refresh button */}
      <button
        onClick={onRefresh}
        disabled={refreshing}
        title={t('refresh')}
        style={{
          background: 'rgba(34,197,94,0.12)',
          border: '1px solid rgba(34,197,94,0.25)',
          color: 'var(--green)',
          fontSize: 11.5,
          fontWeight: 600,
          padding: '4px 11px',
          borderRadius: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: refreshing ? 'default' : 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.15s ease',
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse-dot 1.5s infinite' }} />
        <span>{refreshing ? t('updatingData') : t('live')}</span>
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
            opacity: refreshing ? 1 : 0.7,
            marginLeft: 2,
            flexShrink: 0,
          }}
        >
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </button>

      {/* Network Switch: FGC | Rodalies | Ambdós */}
      <NetworkSwitch mode={networkMode} onChange={onNetworkChange} />

      {/* Right Controls: Service Status, Theme, Settings */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Network Status button */}
        {onOpenNetworkStatus && (
          <button
            data-tour="network-status"
            onClick={onOpenNetworkStatus}
            style={{
              background: alertCount && alertCount > 0 ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.12)',
              border: alertCount && alertCount > 0 ? '1px solid rgba(234,179,8,0.35)' : '1px solid rgba(34,197,94,0.25)',
              color: alertCount && alertCount > 0 ? 'var(--yellow)' : 'var(--green)',
              fontSize: 12,
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
          >
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: alertCount && alertCount > 0 ? 'var(--yellow)' : 'var(--green)',
              display: 'inline-block',
            }} />
            <span>{t('networkStatus')}</span>
            {alertCount && alertCount > 0 ? (
              <span style={{
                background: 'var(--yellow)',
                color: '#000',
                padding: '0 6px',
                borderRadius: 10,
                fontSize: 10,
                fontWeight: 800,
                marginLeft: 2,
              }}>
                {alertCount}
              </span>
            ) : null}
          </button>
        )}

        {/* Theme toggle */}
        <button
          onClick={onThemeToggle}
          title={theme === 'light' ? t('themeDark') : t('themeLight')}
          aria-label={theme === 'light' ? t('themeDark') : t('themeLight')}
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--border2)',
            color: 'var(--text)',
            width: 36,
            height: 36,
            borderRadius: 10,
            cursor: 'pointer',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--bg2)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--bg3)'
            e.currentTarget.style.borderColor = 'var(--border2)'
          }}
        >
          {theme === 'light' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--yellow)', opacity: 0.95 }}>
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}>
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Settings button */}
        {onOpenSettings && (
          <button
            data-tour="settings"
            onClick={onOpenSettings}
            title={t('settings')}
            aria-label={t('settings')}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border2)',
              color: 'var(--text)',
              height: 36,
              padding: '0 12px',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--bg2)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--bg3)'
              e.currentTarget.style.borderColor = 'var(--border2)'
            }}
          >
            <span style={{ fontSize: 13 }}>⚙️</span>
            <span>{t('settings')}</span>
          </button>
        )}
      </div>
    </header>
  )
}
