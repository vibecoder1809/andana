'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { Departure, Journey, Alert, Stop } from '@/types'
import { LINE_COLORS } from '@/lib/constants'
import { I18nProvider, useI18n } from '@/lib/i18n'
import { useFavoriteStations, type SavedStation, matchStation } from '@/lib/savedStations'

// Major hubs offered when no favorites have been saved yet
const SUGGESTED_HUBS: SavedStation[] = [
  { stopId: 'PC', name: 'Pl. Catalunya', code: 'PC', operator: 'fgc', lines: ['L6', 'L7', 'S1', 'S2'] },
  { stopId: '71801', name: 'Barcelona-Sants', code: '71801', operator: 'renfe', lines: ['R1', 'R2', 'R3', 'R4'] },
  { stopId: 'PR', name: 'Provença', code: 'PR', operator: 'fgc', lines: ['L6', 'L7', 'S1', 'S2'] },
  { stopId: '71802', name: 'Passeig de Gràcia', code: '71802', operator: 'renfe', lines: ['R2', 'R2N', 'R2S'] },
  { stopId: 'GR', name: 'Gràcia', code: 'GR', operator: 'fgc', lines: ['L6', 'L7', 'S1', 'S2'] },
]

function fmtClock(sec: number): string {
  const h = Math.floor(sec / 3600) % 24
  const m = Math.floor(sec / 60) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function nowSeconds(): number {
  const d = new Date()
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
}

function WidgetInner() {
  const { t, lang } = useI18n()
  const { favorites, isFavorite, toggleFavorite } = useFavoriteStations()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [now, setNow] = useState(nowSeconds)

  // Selected station
  const [selectedStation, setSelectedStation] = useState<SavedStation | null>(null)
  const [departures, setDepartures] = useState<Departure[]>([])
  const [loadingDepartures, setLoadingDepartures] = useState(false)

  // Alerts
  const [alerts, setAlerts] = useState<Alert[]>([])

  // Active Trip HUD synchronization
  const [activeTrip, setActiveTrip] = useState<Journey | null>(null)

  // Load theme and listen for changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedTheme = window.localStorage.getItem('andana-theme')
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    }
  }, [])

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      window.localStorage.setItem('andana-theme', next)
      document.documentElement.setAttribute('data-theme', next)
    } catch {}
  }, [theme])

  // Sync active trip from localStorage
  const syncActiveTrip = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem('andana-active-trip')
      if (raw) {
        setActiveTrip(JSON.parse(raw))
      } else {
        setActiveTrip(null)
      }
    } catch {
      setActiveTrip(null)
    }
  }, [])

  useEffect(() => {
    syncActiveTrip()
    window.addEventListener('andana:active-trip-change', syncActiveTrip)
    window.addEventListener('storage', syncActiveTrip)
    return () => {
      window.removeEventListener('andana:active-trip-change', syncActiveTrip)
      window.removeEventListener('storage', syncActiveTrip)
    }
  }, [syncActiveTrip])

  // Update second counter
  useEffect(() => {
    const id = setInterval(() => setNow(nowSeconds()), 1000)
    return () => clearInterval(id)
  }, [])

  // Fetch alerts
  useEffect(() => {
    fetch('/api/alerts')
      .then(r => r.json())
      .then(setAlerts)
      .catch(() => {})
  }, [])

  // Stations available in the selector
  const availableStations = useMemo(() => {
    if (favorites.length > 0) return favorites
    return SUGGESTED_HUBS
  }, [favorites])

  // Pick initial station based on URL param or first available
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const stationParam = params.get('station')
    if (stationParam) {
      const found = availableStations.find(
        s => s.stopId === stationParam || s.code === stationParam || s.name.toLowerCase() === stationParam.toLowerCase()
      )
      if (found) {
        setSelectedStation(found)
        return
      }
    }
    if (!selectedStation && availableStations.length > 0) {
      setSelectedStation(availableStations[0])
    }
  }, [availableStations, selectedStation])

  // Fetch departures for current station
  const fetchDepartures = useCallback(() => {
    if (!selectedStation) return
    setLoadingDepartures(true)
    const code = selectedStation.code || selectedStation.stopId
    const op = selectedStation.operator || (/^\d+$/.test(code) ? 'renfe' : 'fgc')
    fetch(`/api/departures?station=${encodeURIComponent(code)}&operator=${encodeURIComponent(op)}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.departures)) {
          setDepartures(data.departures)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingDepartures(false))
  }, [selectedStation])

  useEffect(() => {
    fetchDepartures()
    const timer = setInterval(fetchDepartures, 30_000)
    return () => clearInterval(timer)
  }, [fetchDepartures])

  // Active warnings impacting selected station
  const stationAlerts = useMemo(() => {
    if (!selectedStation || alerts.length === 0) return []
    const baseCode = selectedStation.code || selectedStation.stopId.replace(/\d+$/, '')
    const linesSet = new Set(selectedStation.lines ?? [])

    return alerts.filter(a => {
      if (a.stops && a.stops.some(s => matchStation(s, selectedStation))) return true
      if (a.stopCodes && a.stopCodes.some(c => c.replace(/\d+$/, '') === baseCode)) return true
      if (linesSet.size > 0 && a.routes.some(r => linesSet.has(r))) return true
      return false
    })
  }, [selectedStation, alerts])

  // Compute countdown for active trip if present
  const tripNextStop = useMemo(() => {
    if (!activeTrip) return null
    for (const leg of activeTrip.legs) {
      if (leg.stops) {
        for (const s of leg.stops) {
          if (s.arrTime > now) {
            return { name: s.name, time: s.arrTime, line: leg.line }
          }
        }
      }
    }
    return null
  }, [activeTrip, now])

  return (
    <div
      data-theme={theme}
      style={{
        width: '100%',
        maxWidth: 420,
        margin: '0 auto',
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        padding: '14px 16px',
        overflowX: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 18 }}>🚆</span>
          <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-space-grotesk)', letterSpacing: '-0.3px' }}>
            Andana
          </span>
          <span style={{ fontSize: 11, background: 'var(--accent)', color: '#fff', padding: '1px 6px', borderRadius: 6, fontWeight: 700 }}>
            Widget
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={fetchDepartures}
            title={t('refresh')}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text)',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            <span style={{ animation: loadingDepartures ? 'spin 0.8s linear infinite' : 'none' }}>↻</span>
          </button>

          <button
            onClick={toggleTheme}
            title={t('theme')}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text)',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            title={t('openFullApp')}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--muted)',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              fontSize: 12,
            }}
          >
            ↗
          </a>
        </div>
      </div>

      {/* Active Trip Card (if any active trip is currently in HUD) */}
      {activeTrip && (
        <div
          style={{
            background: 'var(--bg2)',
            border: '1.5px solid var(--accent)',
            borderRadius: 14,
            padding: '10px 12px',
            marginBottom: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)' }}>
                {t('widgetActiveTrip')}
              </span>
            </div>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-space-grotesk)', fontWeight: 700 }}>
              ETA {fmtClock(activeTrip.arrTime)}
            </span>
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{activeTrip.legs[0]?.fromName}</span>
            <span style={{ color: 'var(--muted)' }}>→</span>
            <span>{activeTrip.legs[activeTrip.legs.length - 1]?.toName}</span>
          </div>

          {tripNextStop && (
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {lang === 'ca' ? 'Pròxima parada:' : lang === 'es' ? 'Próxima parada:' : 'Next stop:'}{' '}
              <strong style={{ color: 'var(--text)' }}>{tripNextStop.name}</strong> ({fmtClock(tripNextStop.time)})
            </div>
          )}
        </div>
      )}

      {/* Favorite Stations Tabs */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)' }}>
            ⭐ {t('favoriteStations')}
          </div>
          {favorites.length === 0 && (
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>
              {lang === 'ca' ? 'Suggeriments' : lang === 'es' ? 'Sugerencias' : 'Suggestions'}
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 4,
            scrollbarWidth: 'none',
          }}
        >
          {availableStations.map(s => {
            const isSelected = selectedStation?.stopId === s.stopId
            return (
              <button
                key={s.stopId}
                onClick={() => setSelectedStation(s)}
                style={{
                  padding: '5px 11px',
                  borderRadius: 20,
                  border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--accent)' : 'var(--bg2)',
                  color: isSelected ? '#fff' : 'var(--text)',
                  fontSize: 11.5,
                  fontWeight: isSelected ? 700 : 500,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                <span>{s.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected Station Card Header */}
      {selectedStation && (
        <div
          style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border2)',
            borderRadius: 14,
            padding: '12px 14px',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-space-grotesk)' }}>
              {selectedStation.name}
            </div>
            <button
              onClick={() => toggleFavorite(selectedStation)}
              title={isFavorite(selectedStation) ? t('removeFavorite') : t('addFavorite')}
              style={{
                background: 'transparent',
                border: 'none',
                color: isFavorite(selectedStation) ? 'var(--yellow)' : 'var(--muted)',
                cursor: 'pointer',
                fontSize: 16,
                padding: 0,
              }}
            >
              {isFavorite(selectedStation) ? '★' : '☆'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                padding: '2px 5px',
                borderRadius: 4,
                background: selectedStation.operator === 'renfe' ? '#e11d48' : '#eab308',
                color: '#fff',
                textTransform: 'uppercase',
              }}
            >
              {selectedStation.operator === 'renfe' ? 'Rodalies' : 'FGC'}
            </span>
            {selectedStation.lines?.map(l => (
              <span
                key={l}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: LINE_COLORS[l] || '#64748b',
                  color: '#fff',
                  fontFamily: 'var(--font-space-grotesk)',
                }}
              >
                {l}
              </span>
            ))}
          </div>

          {/* Warning banner for station if any alert impacts it */}
          {stationAlerts.length > 0 && (
            <div
              style={{
                marginTop: 10,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(234,179,8,0.12)',
                border: '1px solid rgba(234,179,8,0.35)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 13, flexShrink: 0 }}>⚠️</span>
              <div style={{ fontSize: 11, color: 'var(--yellow)', lineHeight: 1.3 }}>
                <strong>{stationAlerts[0].header}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Departures List */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: 2 }}>
          {lang === 'ca' ? 'Properes sortides' : lang === 'es' ? 'Próximas salidas' : 'Upcoming departures'}
        </div>

        {departures.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
            {loadingDepartures ? t('loading') : (lang === 'ca' ? 'Sense sortides immediates' : lang === 'es' ? 'Sin salidas inmediatas' : 'No upcoming departures')}
          </div>
        ) : (
          departures.slice(0, 6).map((dep, idx) => {
            const diffSec = dep.depTime - now
            const diffMin = Math.round(diffSec / 60)
            const color = LINE_COLORS[dep.line] || '#64748b'

            return (
              <div
                key={idx}
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '9px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span
                    style={{
                      background: color,
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontFamily: 'var(--font-space-grotesk)',
                      flexShrink: 0,
                    }}
                  >
                    {dep.line}
                  </span>

                  <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dep.headsign}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{fmtClock(dep.depTime)}</span>
                      {dep.track && (
                        <span>
                          {lang === 'ca' ? `Via ${dep.track}` : lang === 'es' ? `Vía ${dep.track}` : `Track ${dep.track}`}
                        </span>
                      )}
                      {dep.isLastService && <span>🌙</span>}
                    </div>
                  </div>
                </div>

                {/* Countdown & Delay */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-space-grotesk)', color: diffMin <= 2 ? 'var(--green)' : 'var(--text)' }}>
                    {diffSec <= 30
                      ? (lang === 'ca' ? 'Ara' : lang === 'es' ? 'Ahora' : 'Now')
                      : diffMin < 60
                      ? `${diffMin} min`
                      : fmtClock(dep.depTime)}
                  </div>
                  {dep.delayMin > 0 ? (
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--yellow)' }}>
                      +{dep.delayMin}m
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: 'var(--green)' }}>
                      {lang === 'ca' ? "A l'hora" : lang === 'es' ? 'A la hora' : 'On time'}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>
          {lang === 'ca' ? 'Dades en directe' : lang === 'es' ? 'Datos en directo' : 'Live data'} • FGC & Rodalies
        </span>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--accent)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>{t('openFullApp')}</span>
          <span>→</span>
        </a>
      </div>
    </div>
  )
}

export default function WidgetPage() {
  return (
    <I18nProvider>
      <WidgetInner />
    </I18nProvider>
  )
}
