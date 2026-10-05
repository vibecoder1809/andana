'use client'

import { useEffect, useState, useCallback } from 'react'
import type { NotificationType } from '@/lib/notifications'

interface ToastItem {
  id: string
  title: string
  body: string
  type: NotificationType
  url?: string
  timestamp: number
}

interface NotificationToastProps {
  onNavigate?: (url: string) => void
}

export function NotificationToast({ onNavigate }: NotificationToastProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleToastEvent = (e: Event) => {
      const custom = e as CustomEvent<{ title: string; body: string; url?: string; type?: NotificationType }>
      if (!custom.detail) return

      const newToast: ToastItem = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: custom.detail.title,
        body: custom.detail.body,
        type: custom.detail.type || 'info',
        url: custom.detail.url,
        timestamp: Date.now(),
      }

      setToasts(prev => [newToast, ...prev].slice(0, 3)) // Keep at most 3 toasts

      // Auto dismiss after 6 seconds
      setTimeout(() => {
        removeToast(newToast.id)
      }, 6000)
    }

    window.addEventListener('andana:in-app-toast', handleToastEvent)
    return () => window.removeEventListener('andana:in-app-toast', handleToastEvent)
  }, [removeToast])

  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 68px)',
        right: 16,
        left: 'auto',
        maxWidth: 380,
        width: 'calc(100vw - 32px)',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => {
        const isWarning = t.type === 'warning'
        const isTrain = t.type === 'train'
        const borderColor = isWarning ? 'var(--yellow)' : isTrain ? 'var(--accent)' : 'var(--border2)'
        const icon = isWarning ? '⚠️' : isTrain ? '🚂' : '🔔'

        return (
          <div
            key={t.id}
            onClick={() => {
              if (t.url) {
                if (onNavigate) {
                  onNavigate(t.url)
                } else if (typeof window !== 'undefined') {
                  window.location.href = t.url
                }
              }
              removeToast(t.id)
            }}
            style={{
              pointerEvents: 'auto',
              background: 'var(--bg2)',
              border: `1.5px solid ${borderColor}`,
              borderRadius: 12,
              padding: '12px 14px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              cursor: t.url ? 'pointer' : 'default',
              animation: 'slide-down 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icon}</span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: 2 }}>
                {t.title}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--muted)',
                  lineHeight: 1.35,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {t.body}
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation()
                removeToast(t.id)
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--muted)',
                fontSize: 14,
                cursor: 'pointer',
                padding: '0 4px',
                lineHeight: 1,
              }}
              aria-label="Tancar"
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
