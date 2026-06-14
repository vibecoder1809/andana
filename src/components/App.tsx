'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { Train, Stop, Alert, Route, Theme } from '@/types'
import { LINE_COLORS } from '@/lib/constants'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { DetailPanel } from './DetailPanel'
import { StopPanel } from './StopPanel'

const MapView = dynamic(() => import('./MapView'), { ssr: false })

export function App() {
  const [trains, setTrains]             = useState<Train[]>([])
  const [stops, setStops]               = useState<Stop[]>([])
  const [routes, setRoutes]             = useState<Route[]>([])
  const [alerts, setAlerts]             = useState<Alert[]>([])
  const [selectedTrain, setSelectedTrain] = useState<Train | null>(null)
  const [selectedStop, setSelectedStop]   = useState<Stop | null>(null)
  const [activeLines, setActiveLines]   = useState<Set<string>>(new Set(['ALL']))
  const [theme, setTheme]               = useState<Theme>('dark')
  const [refreshing, setRefreshing]     = useState(false)
  const [lastUpdate, setLastUpdate]     = useState<Date | null>(null)
  const [apiError, setApiError]         = useState<string | null>(null)
  const [dailyPunctuality, setDailyPunctuality] = useState<Record<string, { onTime: number; total: number }>>({})

  // Accumulates per-line on-time tallies throughout the day; resets at midnight
  const tallyRef = useRef<{ date: string; data: Record<string, { onTime: number; total: number }> }>({
    date: new Date().toDateString(),
    data: {},
  })

  const lineColors: Record<string, string> = routes.length > 0
    ? routes.reduce((acc, r) => ({ ...acc, [r.shortName]: r.color }), {} as Record<string, string>)
    : LINE_COLORS

  const lines = [...new Set(routes.map(r => r.shortName))].sort()

  const filteredTrains = activeLines.has('ALL')
    ? trains
    : trains.filter(t => activeLines.has(t.line))

  const fetchTrains = useCallback(async (showLoader = false) => {
    if (showLoader) setRefreshing(true)
    try {
      const res  = await fetch('/api/trains')
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        setApiError(err.error ?? `Error ${res.status}`)
        return
      }
      const data: Train[] = await res.json()
      setApiError(null)
      setTrains(data)
      setLastUpdate(new Date())

      // Reset tally at midnight
      const today = new Date().toDateString()
      if (tallyRef.current.date !== today) {
        tallyRef.current = { date: today, data: {} }
      }

      // Accumulate per-line on-time observations
      const tally = tallyRef.current.data
      for (const train of data) {
        if (!tally[train.line]) tally[train.line] = { onTime: 0, total: 0 }
        tally[train.line].total++
        if (train.delayMinutes === 0) tally[train.line].onTime++
      }
      setDailyPunctuality({ ...tally })
    } catch (e) {
      console.error('Failed to fetch trains:', e)
      setApiError('No es pot connectar amb l\'API de trens')
    } finally {
      if (showLoader) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchTrains(true)
    const interval = setInterval(() => fetchTrains(false), 10_000)
    return () => clearInterval(interval)
  }, [fetchTrains])

  useEffect(() => {
    fetch('/api/stops').then(r => r.json()).then(setStops).catch(console.error)
    fetch('/api/routes').then(r => r.json()).then(setRoutes).catch(console.error)
    fetch('/api/alerts').then(r => r.json()).then(setAlerts).catch(console.error)
    const alertInterval = setInterval(() => {
      fetch('/api/alerts').then(r => r.json()).then(setAlerts).catch(console.error)
    }, 300_000)
    return () => clearInterval(alertInterval)
  }, [])

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const toggleLine = (line: string) => {
    setActiveLines(prev => {
      const next = new Set(prev)
      if (line === 'ALL') return new Set(['ALL'])
      next.delete('ALL')
      if (next.has(line)) {
        next.delete(line)
        if (next.size === 0) return new Set(['ALL'])
      } else {
        next.add(line)
      }
      return next
    })
  }

  return (
    <div
      data-theme={theme}
      style={{
        display: 'grid',
        gridTemplateRows: '56px auto 1fr',
        gridTemplateColumns: '360px 1fr',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <Header
        trainCount={trains.length}
        lineCount={new Set(trains.map(t => t.line)).size}
        lastUpdate={lastUpdate}
        refreshing={refreshing}
        onThemeToggle={toggleTheme}
        onRefresh={() => fetchTrains(true)}
      />

      {/* API error banner */}
      {apiError && (
        <div style={{ gridColumn: '1 / -1', background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.2)', color: 'var(--red)', padding: '6px 20px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
          <span style={{ background: 'var(--red)', color: '#fff', padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>ERROR</span>
          {apiError}
        </div>
      )}

      {/* Live alerts banner */}
      {!apiError && alerts.length > 0 && (
        <div style={{ gridColumn: '1 / -1', background: 'rgba(234,179,8,0.1)', borderBottom: '1px solid rgba(234,179,8,0.2)', color: 'var(--yellow)', padding: '6px 20px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
          <span style={{ background: 'var(--yellow)', color: '#000', padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>ALERTA</span>
          {alerts[0].header}
          {alerts.length > 1 && <span style={{ color: 'var(--muted)', fontSize: 10, marginLeft: 4 }}>+{alerts.length - 1} més</span>}
        </div>
      )}

      <Sidebar
        trains={filteredTrains}
        stops={stops}
        lines={lines}
        lineColors={lineColors}
        activeLines={activeLines}
        selectedTrain={selectedTrain}
        dailyPunctuality={dailyPunctuality}
        onToggleLine={toggleLine}
        onSelectTrain={t => { setSelectedTrain(t); setSelectedStop(null) }}
        onSelectStop={stop => { setSelectedStop({ ...stop }); setSelectedTrain(null) }}
      />

      {/* Map area */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <MapView
          trains={filteredTrains}
          stops={stops}
          routes={routes}
          lineColors={lineColors}
          selectedTrain={selectedTrain}
          selectedStop={selectedStop}
          onSelectTrain={t => { setSelectedTrain(t); setSelectedStop(null) }}
          onSelectStop={stop => { setSelectedStop({ ...stop }); setSelectedTrain(null) }}
          theme={theme}
        />
        <DetailPanel train={selectedTrain} lineColors={lineColors} onClose={() => setSelectedTrain(null)} />
        <StopPanel stop={selectedStop} onClose={() => setSelectedStop(null)} />
      </div>
    </div>
  )
}
