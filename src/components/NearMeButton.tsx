'use client'

import { useState, useEffect, type CSSProperties } from 'react'
import type { Stop } from '@/types'
import { nearestByLatLng } from '@/lib/geometry'
import { useGeolocation } from '@/lib/geolocation'
import { useI18n } from '@/lib/i18n'

// Floating "near me" control: gets the user's position, finds the nearest
// station and hands it to `onPick` (which opens the stop panel → live
// departures). Self-contained so App (desktop) and MobileLayout wire the exact
// same behaviour; only placement differs via `style`.
export function NearMeButton({
  stops, onPick, style, compact = false,
}: {
  stops: Stop[]
  onPick: (stop: Stop) => void
  style?: CSSProperties
  compact?: boolean
}) {
  const { t } = useI18n()
  const { locate, locating, error } = useGeolocation()
  // Error surfaces briefly, then fades — the browser owns the permission UI.
  const [showError, setShowError] = useState(false)
  useEffect(() => {
    if (!error) return
    setShowError(true)
    const id = setTimeout(() => setShowError(false), 4000)
    return () => clearTimeout(id)
  }, [error])

  const onClick = () => {
    locate((lat, lng) => {
      const nearest = nearestByLatLng(lat, lng, stops)
      if (nearest) onPick(nearest)
    })
  }

  return (
    <div style={{ position: 'relative', ...style }}>
      <button
        onClick={onClick}
        disabled={locating || stops.length === 0}
        aria-label={t('nearMe')}
        title={t('nearMe')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg2)', border: '1px solid var(--border)',
          color: locating ? 'var(--accent)' : 'var(--text)',
          height: 38, padding: compact ? '0 0' : '0 13px',
          width: compact ? 38 : undefined,
          justifyContent: 'center',
          borderRadius: 12, cursor: locating ? 'default' : 'pointer',
          fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        }}
      >
        <span style={{ display: 'inline-block', fontSize: 15, animation: locating ? 'spin 0.8s linear infinite' : 'none' }}>
          {locating ? '◌' : '📍'}
        </span>
        {!compact && <span>{locating ? t('locating') : t('nearMe')}</span>}
      </button>

      {showError && error && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 40,
          background: 'rgba(239,68,68,0.95)', color: '#fff',
          fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 8,
          whiteSpace: 'nowrap', boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
        }}>
          {error === 'denied' ? t('locationDenied') : t('locationUnavailable')}
        </div>
      )}
    </div>
  )
}
