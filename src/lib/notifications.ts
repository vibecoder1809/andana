'use client'

// Notification subsystem for Andana
// Handles Web Notifications API, Service Worker background notifications,
// Web Audio synthesized chimes, haptic vibration, and in-app toast events.

export type NotificationType = 'train' | 'warning' | 'info'

export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  tag?: string
  url?: string
  type?: NotificationType
  playSound?: boolean
}

export interface NotificationSettings {
  enabled: boolean
  favStations: boolean
  favLines: boolean
  liveTrip: boolean
  alightAlarm: boolean
  sound: boolean
}

const SETTINGS_KEY = 'andana-notification-settings'
const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  favStations: true,
  favLines: true,
  liveTrip: true,
  alightAlarm: true,
  sound: true,
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported'
  try {
    const permission = await Notification.requestPermission()
    return permission
  } catch {
    return 'denied'
  }
}

export function getNotificationSettings(): NotificationSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    return {
      enabled: parsed.enabled !== false,
      favStations: parsed.favStations !== false,
      favLines: parsed.favLines !== false,
      liveTrip: parsed.liveTrip !== false,
      alightAlarm: parsed.alightAlarm !== false,
      sound: parsed.sound !== false,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveNotificationSettings(settings: Partial<NotificationSettings>): NotificationSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  const current = getNotificationSettings()
  const next: NotificationSettings = { ...current, ...settings }
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent('andana:notification-settings-change', { detail: next }))
  } catch {}
  return next
}

/**
 * Web Audio pleasant chime synthesizer (no external audio assets required).
 */
export function playNotificationSound(type: NotificationType = 'info'): void {
  if (typeof window === 'undefined') return
  const settings = getNotificationSettings()
  if (!settings.sound) return

  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    const now = ctx.currentTime

    if (type === 'train') {
      // Pleasant railway ascending three-tone chime (C5 -> E5 -> G5)
      const freqs = [523.25, 659.25, 783.99]
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + idx * 0.12)

        gain.gain.setValueAtTime(0, now + idx * 0.12)
        gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.12 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + idx * 0.12)
        osc.stop(now + idx * 0.12 + 0.36)
      })
    } else if (type === 'warning') {
      // Attention alert two-tone chime (F5 -> Db5)
      const freqs = [698.46, 554.37]
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now + idx * 0.15)

        gain.gain.setValueAtTime(0, now + idx * 0.15)
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.15 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.4)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + idx * 0.15)
        osc.stop(now + idx * 0.15 + 0.42)
      })
    } else {
      // Simple neutral notification beep
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, now)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.26)
    }

    // Auto close audio context after playing
    setTimeout(() => {
      ctx.close().catch(() => {})
    }, 1000)
  } catch {}
}

/**
 * Triggers subtle haptic feedback on supported mobile devices.
 */
export function triggerHaptic(type: NotificationType = 'info'): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  try {
    if (type === 'warning') {
      navigator.vibrate([150, 70, 150])
    } else if (type === 'train') {
      navigator.vibrate([80, 50, 120])
    } else {
      navigator.vibrate(80)
    }
  } catch {}
}

/**
 * Dispatches an in-app visual toast, system notification, and auditory/haptic feedback.
 */
export async function sendAppNotification(payload: NotificationPayload): Promise<void> {
  const settings = getNotificationSettings()
  if (!settings.enabled) return

  const { title, body, icon = '/icon-192.png', tag, url = '/', type = 'info', playSound = true } = payload

  // 1. Always dispatch in-app toast event for reactive UI presentation
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('andana:in-app-toast', {
        detail: { title, body, url, type, tag },
      })
    )
  }

  // 2. Play sound & haptics
  if (playSound) {
    playNotificationSound(type)
    triggerHaptic(type)
  }

  // 3. Dispatch system notification if granted
  if (isNotificationSupported() && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        const reg = await navigator.serviceWorker.ready
        if (reg && reg.showNotification) {
          await reg.showNotification(title, {
            body,
            icon,
            badge: icon,
            tag,
            data: { url },
          })
          return
        }
      }
    } catch {}

    try {
      const n = new Notification(title, {
        body,
        icon,
        tag,
        data: { url },
      })
      n.onclick = () => {
        window.focus()
        if (url && url !== '/') {
          window.location.href = url
        }
        n.close()
      }
    } catch {}
  }
}
