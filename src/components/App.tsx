'use client'

import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react'
import dynamic from 'next/dynamic'
import type { Train, Stop, Alert, Route, Theme, Journey, NetworkMode } from '@/types'
import { LINE_COLORS } from '@/lib/constants'
import { buildJourneyPath } from '@/lib/journeyPath'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { DetailPanel } from './DetailPanel'
import { StopPanel } from './StopPanel'
import { NearMeButton } from './NearMeButton'
import { MobileLayout } from './MobileLayout'
import { useInterpolatedTrains } from '@/lib/interpolate'
import { I18nProvider, useI18n } from '@/lib/i18n'
import { readParam, updateParams } from '@/lib/urlState'

import { AlertModal } from './AlertModal'
import { formatAlertDateTime } from '@/lib/alertTime'
import { NetworkStatusModal } from './NetworkStatusModal'
import { LiveTripHud } from './LiveTripHud'
import { OnboardingModal } from './OnboardingModal'
import { DonationModal } from './DonationModal'
import { MobileSettingsModal } from './MobileSettingsModal'
import { useUserEngagement } from '@/lib/userEngagement'

const MapView = dynamic(() => import('./MapView'), { ssr: false })

const ROTATION_MS = 10_000

function AlertBanner({ alerts, onSelectAlert, networkMode }: { alerts: Alert[]; onSelectAlert: (a: Alert) => void; networkMode?: NetworkMode }) {
  const { t, lang } = useI18n()
  const [idx, setIdx]           = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [fade, setFade]         = useState(true)
  const timerRef                = useRef<ReturnType<typeof setTimeout> | null>(null)

  const count = alerts.length

  const rotate = useCallback(() => {
    if (count <= 1) return
    setFade(false)
    setTimeout(() => {
      setIdx(i => (i + 1) % count)
      setFade(true)
    }, 250)
  }, [count])

  useEffect(() => {
    if (expanded || count <= 1) return
    timerRef.current = setInterval(rotate, ROTATION_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [expanded, count, rotate])

  // reset index when alerts count or network mode changes
  useLayoutEffect(() => { setIdx(0) }, [alerts.length, networkMode])

  const visible = alerts[idx % (count || 1)]
  const visibleTime = formatAlertDateTime(visible?.start, lang, t)

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        background: 'rgba(234,179,8,0.1)',
        borderBottom: '1px solid rgba(234,179,8,0.2)',
        color: 'var(--yellow)',
        fontSize: 12,
        fontWeight: 500,
        userSelect: 'none',
      }}
    >
      {/* rotating single-line preview */}
      <div
        onClick={() => {
          if (count > 1) {
            setExpanded(exp => !exp)
          } else if (visible) {
            onSelectAlert(visible)
          }
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 20px',
          opacity: fade ? 1 : 0, transition: 'opacity 0.25s', cursor: 'pointer',
        }}
      >
        <span style={{ background: 'var(--yellow)', color: '#000', padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
          {t('alert')}
        </span>
        {networkMode === 'both' && visible?.operator && (
          <span style={{
            fontSize: 9.5,
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 4,
            background: visible.operator === 'renfe' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 140, 0, 0.2)',
            color: visible.operator === 'renfe' ? '#ef4444' : '#ff8c00',
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
            flexShrink: 0,
          }}>
            {visible.operator === 'renfe' ? 'Rodalies' : 'FGC'}
          </span>
        )}
        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {visible?.header}
        </span>
        {visibleTime && (
          <span style={{ fontSize: 10, opacity: 0.9, flexShrink: 0, background: 'rgba(234,179,8,0.18)', padding: '2px 7px', borderRadius: 4, display: 'inline-flex', alignItems: 'center' }}>
            {visibleTime.compact}
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={e => {
              e.stopPropagation()
              if (visible) onSelectAlert(visible)
            }}
            style={{
              background: 'rgba(234,179,8,0.2)',
              border: '1px solid rgba(234,179,8,0.35)',
              color: 'var(--yellow)',
              padding: '3px 9px',
              borderRadius: 6,
              fontSize: 10.5,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {t('viewMoreInfo')}
          </button>

          {count > 1 && (
            <button
              onClick={e => {
                e.stopPropagation()
                setExpanded(exp => !exp)
              }}
              title={expanded ? t('collapseAlerts') : t('viewAllAlerts', count)}
              style={{
                background: expanded ? 'rgba(234,179,8,0.32)' : 'rgba(234,179,8,0.16)',
                border: '1px solid rgba(234,179,8,0.35)',
                color: 'var(--yellow)',
                padding: '3px 9px',
                borderRadius: 6,
                fontSize: 10.5,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'background 0.15s',
              }}
            >
              {expanded ? t('collapseAlerts') : t('viewAllAlerts', count)}
            </button>
          )}
        </div>
      </div>

      {/* expanded compact list */}
      {expanded && (
        <div style={{
          borderTop: '1px solid rgba(234,179,8,0.15)',
          padding: '4px 16px 8px',
          maxHeight: 260,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          {alerts.map((a, i) => {
            const aTime = formatAlertDateTime(a.start, lang, t)
            return (
              <div
                key={a.id || i}
                onClick={() => onSelectAlert(a)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(234,179,8,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  {networkMode === 'both' && a.operator && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: a.operator === 'renfe' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 140, 0, 0.2)',
                      color: a.operator === 'renfe' ? '#ef4444' : '#ff8c00',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                      flexShrink: 0,
                    }}>
                      {a.operator === 'renfe' ? 'Rodalies' : 'FGC'}
                    </span>
                  )}
                  {a.routes && a.routes.length > 0 && a.routes.length <= 3 && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, opacity: 0.85, flexShrink: 0 }}>
                      {a.routes.join(' ')}
                    </span>
                  )}
                  <span style={{
                    fontWeight: 600,
                    fontSize: 12,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {a.header}
                  </span>
                  {aTime && (
                    <span style={{
                      fontSize: 10,
                      color: 'var(--muted)',
                      flexShrink: 0,
                      background: 'rgba(234,179,8,0.12)',
                      padding: '2px 7px',
                      borderRadius: 4,
                      display: 'inline-flex',
                      alignItems: 'center',
                      whiteSpace: 'nowrap',
                    }}>
                      {aTime.full}
                    </span>
                  )}
                </div>

                <button
                  onClick={e => {
                    e.stopPropagation()
                    onSelectAlert(a)
                  }}
                  style={{
                    background: 'rgba(234,179,8,0.18)',
                    border: '1px solid rgba(234,179,8,0.3)',
                    padding: '3px 9px',
                    borderRadius: 6,
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: 'var(--yellow)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t('viewMoreInfo')}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  )
}

function AppInner() {
  const { t } = useI18n()
  const [trains, setTrains]               = useState<Train[]>([])
  const [stops, setStops]                 = useState<Stop[]>([])
  const [routes, setRoutes]               = useState<Route[]>([])
  const [alerts, setAlerts]               = useState<Alert[]>([])
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [selectedTrain, setSelectedTrain] = useState<Train | null>(null)
  const [selectedStop, setSelectedStop]   = useState<Stop | null>(null)
  const [activeLines, setActiveLines]     = useState<Set<string>>(new Set(['ALL']))
  const [theme, setTheme]                 = useState<Theme>('dark')
  const [refreshing, setRefreshing]       = useState(false)
  const [lastUpdate, setLastUpdate]       = useState<Date | null>(null)
  const [apiError, setApiError]           = useState<string | null>(null)
  const [isMobile, setIsMobile]           = useState(false)
  const [networkMode, setNetworkModeState] = useState<NetworkMode>('both')
  // Journey whose path is drawn on the map (from the Plan tab). Null = none.
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null)
  const [focusedLine, setFocusedLine] = useState<string | null>(null)
  const [activeTrip, setActiveTrip] = useState<Journey | null>(null)
  const [networkStatusOpen, setNetworkStatusOpen] = useState(false)
  const [settingsOpen, setSettingsOpen]           = useState(false)

  const {
    showTutorial,
    openTutorial,
    dismissTutorial,
    showDonationPrompt,
    openDonation,
    snoozeDonation,
    SUPPORT_SNOOZE_DAYS,
  } = useUserEngagement()

  const prevDataRef = useRef<string>('')

  // Hydrate network mode from localStorage after mount
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('andana-network-mode') as NetworkMode | null : null
    if (saved === 'fgc' || saved === 'renfe' || saved === 'both') {
      setNetworkModeState(saved)
    }
  }, [])

  const setNetworkMode = useCallback((mode: NetworkMode) => {
    setNetworkModeState(mode)
    try { window.localStorage.setItem('andana-network-mode', mode) } catch {}
    setActiveLines(new Set(['ALL']))
    if (mode === 'fgc') {
      setSelectedTrain(curr => curr?.operator === 'renfe' ? null : curr)
      setSelectedStop(curr => curr?.operator === 'renfe' || (curr && /^\d+$/.test(curr.stopId)) ? null : curr)
    } else if (mode === 'renfe') {
      setSelectedTrain(curr => curr?.operator !== 'renfe' ? null : curr)
      setSelectedStop(curr => curr?.operator !== 'renfe' && (curr && !/^\d+$/.test(curr.stopId)) ? null : curr)
    }
  }, [])

  const visibleRoutes = useMemo(() => {
    if (networkMode === 'both') return routes
    if (networkMode === 'renfe') return routes.filter(r => r.operator === 'renfe')
    return routes.filter(r => r.operator !== 'renfe')
  }, [routes, networkMode])

  const visibleStops = useMemo(() => {
    if (networkMode === 'both') return stops
    if (networkMode === 'renfe') return stops.filter(s => s.operator === 'renfe' || /^\d+$/.test(s.stopId))
    return stops.filter(s => s.operator !== 'renfe' && !/^\d+$/.test(s.stopId))
  }, [stops, networkMode])

  const visibleTrains = useMemo(() => {
    if (networkMode === 'both') return trains
    if (networkMode === 'renfe') return trains.filter(t => t.operator === 'renfe')
    return trains.filter(t => t.operator !== 'renfe')
  }, [trains, networkMode])

  const lineColors = useMemo<Record<string, string>>(
    () => routes.length > 0
      ? routes.reduce((acc, r) => ({ ...acc, [r.shortName]: r.color }), {} as Record<string, string>)
      : LINE_COLORS,
    [routes],
  )

  const lines = useMemo(
    () => [...new Set(visibleRoutes.map(r => r.shortName))].sort(),
    [visibleRoutes],
  )

  const interpolatedTrains = useInterpolatedTrains(visibleTrains, routes, stops)

  // Drawable path for the selected journey, recomputed when the journey or the
  // underlying route/stop data changes.
  const journeyPath = useMemo(
    () => selectedJourney && stops.length > 0
      ? buildJourneyPath(selectedJourney, routes, stops, lineColors)
      : null,
    [selectedJourney, routes, stops, lineColors],
  )

  const filteredTrains = useMemo(
    () => activeLines.has('ALL') ? interpolatedTrains : interpolatedTrains.filter(t => activeLines.has(t.line)),
    [interpolatedTrains, activeLines],
  )

  const fetchTrains = useCallback(async (showLoader = false) => {
    if (showLoader) setRefreshing(true)
    try {
      const res = await fetch('/api/trains')
      if (!res.ok) {
        // /api/trains returns a machine-readable error code, not user-facing
        // prose (see the route handler) — show the existing translated
        // "can't reach the trains API" message rather than the raw code.
        setApiError(t('apiConnectError'))
        return
      }
      const data: Train[] = await res.json()
      setApiError(null)
      setTrains(data)
      const fingerprint = JSON.stringify(data.map(t => ({ id: t.id, lat: t.lat, lng: t.lng, delay: t.delayMinutes })))
      if (fingerprint !== prevDataRef.current) {
        prevDataRef.current = fingerprint
        setLastUpdate(new Date())
      }
    } catch (e) {
      console.error('Failed to fetch trains:', e)
      setApiError(t('apiConnectError'))
    } finally {
      if (showLoader) setRefreshing(false)
    }
  }, [t])

  const handleSelectTrain = useCallback((t: Train) => {
    setSelectedTrain(t)
    setSelectedStop(null)
  }, [])

  const handleSelectStop = useCallback((s: Stop) => {
    setSelectedStop({ ...s })
    setSelectedTrain(null)
  }, [])

  const handleCloseTrain = useCallback(() => setSelectedTrain(null), [])
  const handleCloseStop  = useCallback(() => setSelectedStop(null), [])
  const handleRefresh    = useCallback(() => fetchTrains(true), [fetchTrains])

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      return next
    })
  }, [])

  const toggleLine = useCallback((line: string) => {
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
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
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

  // ── Deep-link restore & sync (train / stop) ──
  // Restore a shared selection once the matching dataset has loaded; a planner
  // link (from&to) is handled by TripPlanner, so we skip train/stop then.
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    if (readParam('from') && readParam('to')) { restoredRef.current = true; return }
    const trainId = readParam('train')
    const stopId = readParam('stop')
    if (!trainId && !stopId) { restoredRef.current = true; return }
    if (trainId) {
      if (trains.length === 0) return // wait for the trains feed
      const tr = trains.find(t => t.id === trainId)
      if (tr) handleSelectTrain(tr)
      restoredRef.current = true
      return
    }
    if (stopId) {
      if (stops.length === 0) return // wait for stops
      const s = stops.find(x => x.stopId === stopId)
      if (s) handleSelectStop(s)
      restoredRef.current = true
    }
  }, [trains, stops, handleSelectTrain, handleSelectStop])

  // Mirror the current selection into the URL (only after restore, so we don't
  // wipe a shared link before it's applied).
  useEffect(() => {
    if (!restoredRef.current) return
    updateParams({ train: selectedTrain?.id ?? null, stop: selectedStop?.stopId ?? null })
  }, [selectedTrain, selectedStop])

  const lineCount = useMemo(() => new Set(visibleTrains.map(t => t.line)).size, [visibleTrains])

  const visibleAlerts = useMemo(() => {
    if (networkMode === 'fgc') return alerts.filter(a => a.operator === 'fgc')
    if (networkMode === 'renfe') return alerts.filter(a => a.operator === 'renfe')
    return alerts
  }, [alerts, networkMode])

  if (isMobile) {
    return (
      <div data-theme={theme}>
        <MobileLayout
          trains={filteredTrains}
          stops={visibleStops}
          routes={visibleRoutes}
          alerts={visibleAlerts}
          lines={lines}
          lineColors={lineColors}
          activeLines={activeLines}
          selectedTrain={selectedTrain}
          selectedStop={selectedStop}
          refreshing={refreshing}
          lastUpdate={lastUpdate}
          apiError={apiError}
          theme={theme}
          networkMode={networkMode}
          onNetworkChange={setNetworkMode}
          onToggleLine={toggleLine}
          onSelectTrain={handleSelectTrain}
          onSelectStop={handleSelectStop}
          onCloseTrain={handleCloseTrain}
          onCloseStop={handleCloseStop}
          onRefresh={handleRefresh}
          onThemeToggle={toggleTheme}
        />
      </div>
    )
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
        trainCount={visibleTrains.length}
        lineCount={lineCount}
        lastUpdate={lastUpdate}
        refreshing={refreshing}
        networkMode={networkMode}
        onNetworkChange={setNetworkMode}
        onThemeToggle={toggleTheme}
        onRefresh={handleRefresh}
        onOpenNetworkStatus={() => setNetworkStatusOpen(true)}
        alertCount={visibleAlerts.length}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenDonation={openDonation}
        theme={theme}
      />

      {apiError && (
        <div style={{ gridColumn: '1 / -1', background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.2)', color: 'var(--red)', padding: '6px 20px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
          <span style={{ background: 'var(--red)', color: '#fff', padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>ERROR</span>
          {apiError}
        </div>
      )}

      {!apiError && visibleAlerts.length > 0 && (
        <AlertBanner alerts={visibleAlerts} onSelectAlert={setSelectedAlert} networkMode={networkMode} />
      )}

      <Sidebar
        trains={filteredTrains}
        stops={visibleStops}
        lines={lines}
        lineColors={lineColors}
        activeLines={activeLines}
        selectedTrain={selectedTrain}
        selectedStop={selectedStop}
        onToggleLine={toggleLine}
        onSelectTrain={handleSelectTrain}
        onSelectStop={handleSelectStop}
        selectedJourney={selectedJourney}
        onSelectJourney={setSelectedJourney}
        onStartLiveTrip={(j) => {
          setActiveTrip(j)
          setSelectedJourney(j)
        }}
      />

      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <MapView
          trains={filteredTrains}
          stops={visibleStops}
          routes={visibleRoutes}
          lineColors={lineColors}
          selectedTrain={selectedTrain}
          selectedStop={selectedStop}
          onSelectTrain={handleSelectTrain}
          onSelectStop={handleSelectStop}
          journeyPath={journeyPath}
          theme={theme}
          focusedLine={focusedLine}
          onClearFocusedLine={() => setFocusedLine(null)}
        />
        {/* Nearest-station shortcut → opens its live departures. */}
        <NearMeButton stops={visibleStops} onPick={handleSelectStop} style={{ position: 'absolute', left: 16, bottom: 16, zIndex: 3 }} />
        <DetailPanel train={selectedTrain} lineColors={lineColors} onClose={handleCloseTrain} />
        <StopPanel stop={selectedStop} onClose={handleCloseStop} lineColors={lineColors} trains={filteredTrains} onSelectTrain={handleSelectTrain} />
      </div>

      {activeTrip && (
        <LiveTripHud
          journey={activeTrip}
          trains={trains}
          lineColors={lineColors}
          onClose={() => setActiveTrip(null)}
        />
      )}

      <NetworkStatusModal
        open={networkStatusOpen}
        onClose={() => setNetworkStatusOpen(false)}
        alerts={alerts}
        trains={trains}
        lineColors={lineColors}
        onSelectLine={(line) => {
          setFocusedLine(line)
          setNetworkStatusOpen(false)
        }}
      />

      <AlertModal
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        lineColors={lineColors}
      />

      <MobileSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeToggle={toggleTheme}
        trainCount={filteredTrains.length}
        lineCount={lines.length}
        lastUpdate={lastUpdate}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        networkMode={networkMode}
        onNetworkChange={setNetworkMode}
        onOpenTutorial={openTutorial}
        onOpenDonation={openDonation}
      />

      <OnboardingModal
        open={showTutorial}
        onClose={dismissTutorial}
      />

      <DonationModal
        open={showDonationPrompt}
        onClose={() => snoozeDonation(14)}
        onSnooze={snoozeDonation}
        onSupport={() => snoozeDonation(SUPPORT_SNOOZE_DAYS)}
      />
    </div>
  )
}
