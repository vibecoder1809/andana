'use client'

import { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import { EXTERNAL_HOOKS } from '@/lib/externalLinks'
import type { NetworkMode, Theme } from '@/types'

interface FeedbackModalProps {
  open: boolean
  onClose: () => void
  networkMode?: NetworkMode
  theme?: Theme
}

type FeedbackType = 'bug' | 'feature' | 'other'

export function FeedbackModal({
  open,
  onClose,
  networkMode = 'both',
  theme = 'dark',
}: FeedbackModalProps) {
  const { t } = useI18n()
  const [type, setType] = useState<FeedbackType>('bug')
  const [message, setMessage] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [attachDiagnostics, setAttachDiagnostics] = useState(true)
  const [copied, setCopied] = useState(false)
  const [sentSuccess, setSentSuccess] = useState(false)

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Reset states when opened
  useEffect(() => {
    if (open) {
      setCopied(false)
      setSentSuccess(false)
    }
  }, [open])

  if (!open) return null

  const getDiagnostics = () => {
    if (typeof window === 'undefined') return ''
    return [
      '--- Diagnostic Info ---',
      `App: Andana Web`,
      `Date: ${new Date().toISOString()}`,
      `Screen: ${window.innerWidth}x${window.innerHeight} (pixelRatio: ${window.devicePixelRatio || 1})`,
      `UserAgent: ${navigator.userAgent}`,
      `NetworkMode: ${networkMode}`,
      `Theme: ${theme}`,
    ].join('\n')
  }

  const formatReportText = () => {
    const typeLabel = type === 'bug' ? 'BUG REPORT' : type === 'feature' ? 'FEATURE REQUEST' : 'FEEDBACK'
    let body = `[Andana - ${typeLabel}]\n\n${message.trim()}\n`
    if (contactEmail.trim()) {
      body += `\nContact Email: ${contactEmail.trim()}\n`
    }
    if (attachDiagnostics) {
      body += `\n${getDiagnostics()}\n`
    }
    return body
  }

  const handleSendMail = () => {
    if (!message.trim()) return
    const typeSubject = type === 'bug' ? 'Andana: Informe d\'error' : type === 'feature' ? 'Andana: Suggeriment de funció' : 'Andana: Comentaris'
    const body = encodeURIComponent(formatReportText())
    const subject = encodeURIComponent(`[${typeSubject}]`)
    
    // Fallback or primary action: Open user's email client
    const mailtoUrl = `mailto:${EXTERNAL_HOOKS.feedbackEmail}?subject=${subject}&body=${body}`
    window.location.href = mailtoUrl
    setSentSuccess(true)
  }

  const handleCopyClipboard = async () => {
    if (!message.trim()) return
    try {
      await navigator.clipboard.writeText(formatReportText())
      setCopied(true)
      setTimeout(() => setCopied(false), 3500)
    } catch {
      // ignore
    }
  }

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 640

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(8px)',
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
          maxWidth: 480,
          maxHeight: isDesktop ? '85vh' : '90vh',
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
            <span>💬</span>
            <span>{t('feedbackTitle')}</span>
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

        {/* Content */}
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Type selector */}
          <div style={{ display: 'flex', gap: 6, background: 'var(--bg3)', padding: 4, borderRadius: 12, border: '1px solid var(--border)' }}>
            <button
              onClick={() => setType('bug')}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 8,
                border: 'none',
                background: type === 'bug' ? 'rgba(239,68,68,0.2)' : 'transparent',
                color: type === 'bug' ? 'var(--red)' : 'var(--muted)',
                fontWeight: type === 'bug' ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
            >
              <span>🐛</span>
              <span>{t('feedbackTypeBug')}</span>
            </button>
            <button
              onClick={() => setType('feature')}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 8,
                border: 'none',
                background: type === 'feature' ? 'rgba(59,130,246,0.2)' : 'transparent',
                color: type === 'feature' ? 'var(--accent)' : 'var(--muted)',
                fontWeight: type === 'feature' ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
            >
              <span>💡</span>
              <span>{t('feedbackTypeFeature')}</span>
            </button>
            <button
              onClick={() => setType('other')}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 8,
                border: 'none',
                background: type === 'other' ? 'var(--bg2)' : 'transparent',
                color: type === 'other' ? 'var(--text)' : 'var(--muted)',
                fontWeight: type === 'other' ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
            >
              <span>❓</span>
              <span>{t('feedbackTypeOther')}</span>
            </button>
          </div>

          {/* Message Textarea */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
              {t('feedbackDescriptionLabel')}
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={t('feedbackPlaceholder')}
              style={{
                width: '100%',
                background: 'var(--bg3)',
                border: '1px solid var(--border2)',
                borderRadius: 10,
                padding: '10px 12px',
                color: 'var(--text)',
                fontFamily: 'inherit',
                fontSize: 13,
                lineHeight: 1.4,
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>

          {/* Contact email (optional) */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
              {t('feedbackEmailLabel')}
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              placeholder="el-teu-correu@exemple.cat"
              style={{
                width: '100%',
                background: 'var(--bg3)',
                border: '1px solid var(--border2)',
                borderRadius: 10,
                padding: '9px 12px',
                color: 'var(--text)',
                fontFamily: 'inherit',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          {/* Diagnostic checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11.5, color: 'var(--muted)', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={attachDiagnostics}
              onChange={e => setAttachDiagnostics(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
            />
            <span>{t('feedbackAttachDiagnostics')}</span>
          </label>

          {/* Notice about destination */}
          <div style={{
            background: 'var(--bg3)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 11,
            color: 'var(--muted)',
            lineHeight: 1.4,
          }}>
            <span>📬 {t('feedbackRecipientNote')}: </span>
            <strong style={{ color: 'var(--text)' }}>{EXTERNAL_HOOKS.feedbackEmail}</strong>
          </div>

          {/* Success banner if sent/copied */}
          {copied && (
            <div style={{
              background: 'rgba(34,197,94,0.15)',
              border: '1px solid rgba(34,197,94,0.3)',
              color: 'var(--green)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span>✓</span>
              <span>{t('feedbackCopiedSuccess')}</span>
            </div>
          )}

          {sentSuccess && (
            <div style={{
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.3)',
              color: 'var(--accent)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span>✓</span>
              <span>{t('feedbackClientOpened')}</span>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              onClick={handleCopyClipboard}
              disabled={!message.trim()}
              title={t('feedbackCopy')}
              style={{
                flex: 1,
                background: 'var(--bg3)',
                border: '1px solid var(--border2)',
                color: 'var(--text)',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                cursor: message.trim() ? 'pointer' : 'default',
                fontFamily: 'inherit',
                opacity: message.trim() ? 1 : 0.5,
                transition: 'background 0.15s',
              }}
            >
              {copied ? `✓ ${t('copied')}` : t('feedbackCopy')}
            </button>

            <button
              onClick={handleSendMail}
              disabled={!message.trim()}
              style={{
                flex: 2,
                background: 'var(--accent)',
                border: 'none',
                color: '#fff',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                cursor: message.trim() ? 'pointer' : 'default',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                opacity: message.trim() ? 1 : 0.5,
                boxShadow: '0 2px 10px rgba(37,99,235,0.3)',
                transition: 'transform 0.1s, opacity 0.15s',
              }}
            >
              <span>✉️</span>
              <span>{t('feedbackSendEmail')}</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
