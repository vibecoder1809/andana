'use client'

import { useState, useEffect } from 'react'
import type { Theme, NetworkMode } from '@/types'
import { useI18n, LANGS, type Lang } from '@/lib/i18n'
import { FeedbackModal } from './FeedbackModal'
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  getNotificationSettings,
  saveNotificationSettings,
  sendAppNotification,
  type NotificationSettings,
} from '@/lib/notifications'

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
  onOpenTutorial?: () => void
  onOpenDonation?: () => void
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
  onOpenTutorial,
  onOpenDonation,
}: MobileSettingsModalProps) {
  const { t, lang, setLang } = useI18n()
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(getNotificationSettings)
  const [testSent, setTestSent] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setNotifPermission(getNotificationPermission())
    setNotifSettings(getNotificationSettings())
  }, [open])

  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission()
    setNotifPermission(perm)
  }

  const handleToggleSetting = (key: keyof NotificationSettings) => {
    const updated = saveNotificationSettings({ [key]: !notifSettings[key] })
    setNotifSettings(updated)
  }

  const handleTestNotification = async () => {
    await sendAppNotification({
      title: t('testNotificationSent'),
      body: t('testNotificationBody'),
      type: 'info',
    })
    setTestSent(true)
    setTimeout(() => setTestSent(false), 3000)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
    setIsStandalone(isStandaloneMode)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

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

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 640

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
        alignItems: isDesktop ? 'center' : 'flex-end',
        justifyContent: 'center',
        padding: isDesktop ? 16 : 0,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          maxHeight: isDesktop ? '80vh' : '85vh',
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: isDesktop ? 22 : '22px 22px 0 0',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: isDesktop ? 16 : 'calc(16px + env(safe-area-inset-bottom, 0px))',
          animation: isDesktop ? 'fade-in 0.2s ease-out' : 'slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
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

          {/* Notifications Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                🔔 {t('notifications')}
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 10,
                background: notifPermission === 'granted' ? 'rgba(34,197,94,0.15)' : notifPermission === 'denied' ? 'rgba(239,68,68,0.15)' : 'var(--bg3)',
                color: notifPermission === 'granted' ? 'var(--green)' : notifPermission === 'denied' ? 'var(--red)' : 'var(--muted)',
                border: `1px solid ${notifPermission === 'granted' ? 'rgba(34,197,94,0.3)' : notifPermission === 'denied' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
              }}>
                {notifPermission === 'granted' ? t('permissionGranted') : notifPermission === 'denied' ? t('permissionDenied') : t('permissionDefault')}
              </span>
            </div>

            <div style={{
              background: 'var(--bg3)',
              borderRadius: 12,
              padding: '12px 14px',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              {notifPermission !== 'granted' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.3 }}>
                    {notifPermission === 'denied' ? t('permissionDenied') : t('enableNotifications')}
                  </div>
                  {notifPermission !== 'denied' && (
                    <button
                      onClick={handleRequestPermission}
                      style={{
                        background: 'var(--accent)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {t('enableNotifications')}
                    </button>
                  )}
                </div>
              )}

              {/* Toggle: Favorite Station Warnings */}
              <label style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, cursor: 'pointer' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                    ⭐ {t('notifFavStations')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.3 }}>
                    {t('notifFavStationsDesc')}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifSettings.favStations}
                  onChange={() => handleToggleSetting('favStations')}
                  style={{ accentColor: 'var(--accent)', width: 16, height: 16, marginTop: 2, cursor: 'pointer' }}
                />
              </label>

              {/* Toggle: Live Trip Incoming Train */}
              <label style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, cursor: 'pointer' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                    🚂 {t('notifLiveTrip')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.3 }}>
                    {t('notifLiveTripDesc')}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifSettings.liveTrip}
                  onChange={() => handleToggleSetting('liveTrip')}
                  style={{ accentColor: 'var(--accent)', width: 16, height: 16, marginTop: 2, cursor: 'pointer' }}
                />
              </label>

              {/* Toggle: Sound & Vibration */}
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                  🔊 {t('notifSound')}
                </div>
                <input
                  type="checkbox"
                  checked={notifSettings.sound}
                  onChange={() => handleToggleSetting('sound')}
                  style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer' }}
                />
              </label>

              {/* Test Notification Button */}
              <button
                onClick={handleTestNotification}
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border2)',
                  borderRadius: 8,
                  padding: '7px 12px',
                  color: 'var(--text)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontFamily: 'inherit',
                  marginTop: 2,
                }}
              >
                <span>🧪</span>
                <span>{testSent ? t('testNotificationSent') : t('testNotification')}</span>
              </button>
            </div>
          </div>

          {/* 5. PWA Installation */}
          <div style={{
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: 12,
            padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 13, color: 'var(--accent)', marginBottom: 4 }}>
              <span>📲</span>
              <span>{t('installApp')}</span>
              {isStandalone && (
                <span style={{ marginLeft: 'auto', background: 'var(--accent)', color: '#fff', fontSize: 10, padding: '2px 7px', borderRadius: 10 }}>
                  ✓ PWA
                </span>
              )}
            </div>
            <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--text)', opacity: 0.85, lineHeight: 1.4 }}>
              {t('installAppDesc')}
            </p>
            {!isStandalone && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5, color: 'var(--text)', opacity: 0.9 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <span>🍏</span>
                  <span>{t('installInstructionsIos')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <span>🤖</span>
                  <span>{t('installInstructionsAndroid')}</span>
                </div>
                {deferredPrompt && (
                  <button
                    onClick={async () => {
                      deferredPrompt.prompt()
                      const { outcome } = await deferredPrompt.userChoice
                      if (outcome === 'accepted') setDeferredPrompt(null)
                    }}
                    style={{
                      marginTop: 6,
                      background: 'var(--accent)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 14px',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <span>⬇</span>
                    <span>{t('installButton')}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 6. About Andana & Support */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>
              {t('aboutApp')}
            </div>
            <p style={{ margin: '0 0 10px 0', fontSize: 12, color: 'var(--text)', opacity: 0.8, lineHeight: 1.4 }}>
              {t('aboutDescription')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {onOpenTutorial && (
                <button
                  onClick={() => {
                    onClose()
                    onOpenTutorial()
                  }}
                  style={{
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '9px 12px',
                    color: 'var(--text)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontFamily: 'inherit',
                  }}
                >
                  <span>📖</span>
                  <span>{t('viewTutorialAgain')}</span>
                </button>
              )}

              {onOpenDonation && (
                <button
                  onClick={() => {
                    onClose()
                    onOpenDonation()
                  }}
                  style={{
                    background: 'rgba(234,179,8,0.12)',
                    border: '1px solid rgba(234,179,8,0.3)',
                    borderRadius: 10,
                    padding: '9px 12px',
                    color: 'var(--yellow)',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontFamily: 'inherit',
                  }}
                >
                  <span>☕</span>
                  <span>{t('supportAndana')}</span>
                </button>
              )}

              <button
                onClick={() => setFeedbackOpen(true)}
                style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '9px 12px',
                  color: 'var(--text)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: 'inherit',
                }}
              >
                <span>💡</span>
                <span>{t('feedbackOrBugReport')}</span>
              </button>
            </div>

            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              Andana · Open Data FGC & Rodalies de Catalunya
            </div>
          </div>

        </div>
      </div>

      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        networkMode={networkMode}
        theme={theme}
      />
    </div>
  )
}
