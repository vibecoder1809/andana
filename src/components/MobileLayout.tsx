'use client'

import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { Train, Stop, Alert, Route, Theme, Journey, NetworkMode, OutageStatus } from '@/types'
import { LINE_COLORS } from '@/lib/constants'
import { buildJourneyPath } from '@/lib/journeyPath'
import { TrainCard } from './TrainCard'
import { DetailPanel } from './DetailPanel'
import { StopPanel } from './StopPanel'
import { TripPlanner } from './TripPlanner'
import { NearMeButton } from './NearMeButton'
import { NetworkSwitch } from './Header'
import { isPlannerLink } from '@/lib/urlState'
import { useI18n, type TransKey } from '@/lib/i18n'
import { AlertModal } from './AlertModal'
import { formatAlertDateTime } from '@/lib/alertTime'
import { MobileSettingsModal } from './MobileSettingsModal'
import { useFavoriteStations } from '@/lib/savedStations'
import { NetworkStatusModal } from './NetworkStatusModal'
import { LiveTripHud } from './LiveTripHud'
import { OnboardingModal } from './OnboardingModal'
import { DonationModal } from './DonationModal'
import { useUserEngagement } from '@/lib/userEngagement'
import { matchesSearch, startsWithSearch } from '@/lib/searchUtils'
import { useStationAlertNotifier } from '@/lib/useStationAlertNotifier'
import { useLineAlertNotifier } from '@/lib/useLineAlertNotifier'
import { NotificationToast } from './NotificationToast'
import { NightRestCard } from './NightRestCard'
import { isNightRestHours } from '@/lib/serviceTime'
import { useFontSize } from '@/lib/fontSize'

const LINE_GROUPS: { key: string; labelKey: TransKey; prefix: RegExp }[] = [
  { key: 'L',          labelKey: 'groupUrbanShort',     prefix: /^L\d/ },
  { key: 'S',          labelKey: 'groupVallesShort',    prefix: /^S\d/ },
  { key: 'R-fgc',      labelKey: 'groupRegionalShort',  prefix: /^R(5|6|50|53|60|63)$/ },
  { key: 'R-rodalies',   labelKey: 'groupRodaliesShort',  prefix: /^R([1-478]|2[NS]|2Nord|2Sud)$/ },
  { key: 'R-regional',   labelKey: 'groupRegionalsShort', prefix: /^(R1[1-7]|R[LGT]\d+)$/ },
  { key: 'M-cremallera', labelKey: 'groupCremalleraShort',prefix: /^(M\d?|MM)$/ },
  { key: 'Other',        labelKey: 'groupOther',          prefix: /^(?!L|S|R|M)/ },
]

const MapView = dynamic(() => import('./MapView'), { ssr: false })

interface MobileLayoutProps {
  trains: Train[]
  mapTrains?: Train[]
  allTrains?: Train[]
  stops: Stop[]
  routes: Route[]
  alerts: Alert[]
  allAlerts?: Alert[]
  lines: string[]
  lineColors: Record<string, string>
  activeLines: Set<string>
  selectedTrain: Train | null
  selectedStop: Stop | null
  refreshing: boolean
  lastUpdate: Date | null
  apiError: string | null
  outages?: OutageStatus
  theme: Theme
  networkMode: NetworkMode
  onNetworkChange: (m: NetworkMode) => void
  onToggleLine: (line: string) => void
  onSelectTrain: (train: Train) => void
  onSelectStop: (stop: Stop) => void
  onCloseTrain: () => void
  onCloseStop: () => void
  onRefresh: () => void
  onThemeToggle: () => void
}

// ── Bottom-sheet drag physics ─────────────────────────────────────────────
const SNAP_PEEK = 0.16  // handle + tabs
const SNAP_HALF = 0.48  // half screen: map visible in top half, content in bottom
const SNAP_FULL = 0.90  // almost full screen
const SNAPS = [SNAP_PEEK, SNAP_HALF, SNAP_FULL]

// Velocity-aware snap: a fast flick jumps a step in its direction, otherwise we
// settle to the nearest snap point. `velocity` is in ratio-units per second
// (positive = expanding upward); `ceiling` is the ceiling from `useSheetCeiling`.
function resolveSnap(ratio: number, velocity: number, ceiling = SNAP_FULL): number {
  const FLICK = 0.6
  const snaps = [SNAP_PEEK, SNAP_HALF, ceiling]
  const nearestIdx = snaps.reduce(
    (best, _, i) => (Math.abs(snaps[i] - ratio) < Math.abs(snaps[best] - ratio) ? i : best),
    0,
  )
  if (velocity > FLICK && nearestIdx < snaps.length - 1) return snaps[nearestIdx + 1]
  if (velocity < -FLICK && nearestIdx > 0) return snaps[nearestIdx - 1]
  return snaps[nearestIdx]
}

// ── Sheet ceiling ────────────────────────────────────────────────────────
// The floating top bar is painted *over* the sheets (zIndex 35 vs 10), so a
// sheet tall enough to reach it tucks its own grab handle behind the pills —
// and the pills swallow the touch, so the sheet can't be dragged back down.
// How far down the bar reaches depends on the notch inset, so measure it
// instead of guessing a snap fraction, and cap every sheet just below it.
const SHEET_TOP_GAP = 10

function useSheetCeiling(
  rootRef: React.RefObject<HTMLDivElement | null>,
  barRef: React.RefObject<HTMLDivElement | null>,
): number {
  const [ceiling, setCeiling] = useState(SNAP_FULL)

  useLayoutEffect(() => {
    const root = rootRef.current
    const bar = barRef.current
    if (!root || !bar) return

    const measure = () => {
      const vh = root.clientHeight
      if (!vh) return
      const rootTop = root.getBoundingClientRect().top
      // Only the bar's pills are opaque and clickable — its own bottom padding
      // is a transparent gradient tail the sheet may safely slide under.
      const pillsBottom = Array.from(bar.children).reduce(
        (bottom, el) => Math.max(bottom, el.getBoundingClientRect().bottom - rootTop),
        0,
      )
      setCeiling(Math.max(SNAP_HALF, Math.min(SNAP_FULL, 1 - (pillsBottom + SHEET_TOP_GAP) / vh)))
    }

    measure()
    // The bar grows with the safe-area inset on rotation, and the root resizes
    // whenever mobile browser chrome (URL bar) slides in or out. Watch the
    // *border* box: the inset lands on the bar's padding, which leaves its
    // content box (and so a default ResizeObserver) completely unmoved.
    const ro = new ResizeObserver(measure)
    ro.observe(root, { box: 'border-box' })
    ro.observe(bar, { box: 'border-box' })
    return () => ro.disconnect()
  }, [rootRef, barRef])

  return ceiling
}

function useVerticalDrag(onMove: (deltaY: number) => void, onEnd: (deltaY: number, velocityPxPerS: number) => void) {
  const state = useRef<{ startY: number; lastY: number; lastT: number; vel: number } | null>(null)

  const begin = useCallback((clientY: number) => {
    state.current = { startY: clientY, lastY: clientY, lastT: performance.now(), vel: 0 }
  }, [])

  useEffect(() => {
    const move = (clientY: number) => {
      const s = state.current
      if (!s) return
      const now = performance.now()
      const dt = now - s.lastT
      if (dt > 0) s.vel = ((clientY - s.lastY) / dt) * 1000
      s.lastY = clientY
      s.lastT = now
      onMove(clientY - s.startY)
    }
    const end = () => {
      const s = state.current
      if (!s) return
      state.current = null
      onEnd(s.lastY - s.startY, s.vel)
    }
    const mm = (e: MouseEvent) => move(e.clientY)
    const tm = (e: TouchEvent) => { if (state.current) { e.preventDefault(); move(e.touches[0].clientY) } }
    window.addEventListener('mousemove', mm)
    window.addEventListener('mouseup', end)
    window.addEventListener('touchmove', tm, { passive: false })
    window.addEventListener('touchend', end)
    return () => {
      window.removeEventListener('mousemove', mm)
      window.removeEventListener('mouseup', end)
      window.removeEventListener('touchmove', tm)
      window.removeEventListener('touchend', end)
    }
  }, [onMove, onEnd])

  return begin
}

const ROTATION_MS   = 10_000

// ── Floating Alert Pill ───────────────────────────────────────────────────
function MobileAlertBanner({ alerts, onSelectAlert, top, networkMode }: { alerts: Alert[]; onSelectAlert: (a: Alert) => void; top: string; networkMode?: NetworkMode }) {
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

  const fingerprint = alerts.map(a => a.header).join('|')
  useLayoutEffect(() => { setIdx(0) }, [fingerprint, networkMode])

  const visible = alerts[idx % (count || 1)]
  const visibleTime = formatAlertDateTime(visible?.start, lang, t)

  return (
    <div
      style={{
        position: 'absolute', top, left: 12, right: 12, zIndex: 20,
        background: 'rgba(234,179,8,0.96)',
        color: '#000',
        borderRadius: expanded ? 16 : 22,
        boxShadow: '0 4px 18px rgba(0,0,0,0.28)',
        userSelect: 'none',
        backdropFilter: 'blur(10px)',
        transition: 'border-radius 0.2s',
      }}
    >
      <div
        onClick={() => {
          if (count > 1) {
            setExpanded(exp => !exp)
          } else if (visible) {
            onSelectAlert(visible)
          }
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          padding: '8px 12px',
          opacity: fade ? 1 : 0,
          transition: 'opacity 0.25s',
          cursor: 'pointer',
        }}
      >
        {/* Top row: tags, timestamp, action button, counter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontWeight: 800, fontSize: 11, background: '#000', color: '#eab308', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>
              ⚠
            </span>
            {networkMode === 'both' && visible?.operator && (
              <span style={{
                fontSize: 9,
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: 4,
                background: visible.operator === 'renfe' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(234, 88, 12, 0.25)',
                color: visible.operator === 'renfe' ? '#991b1b' : '#9a3412',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
                flexShrink: 0,
              }}>
                {visible.operator === 'renfe' ? 'Rodalies' : 'FGC'}
              </span>
            )}
            {visibleTime && (
              <span style={{ fontSize: 9.5, opacity: 0.85, background: 'rgba(0,0,0,0.1)', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>
                {visibleTime.compact}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <button
              onClick={e => {
                e.stopPropagation()
                if (visible) onSelectAlert(visible)
              }}
              style={{
                background: 'rgba(0,0,0,0.18)',
                border: '1px solid rgba(0,0,0,0.2)',
                color: '#000',
                padding: '2.5px 7px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              + info ↗
            </button>

            {count > 1 && (
              <button
                onClick={e => {
                  e.stopPropagation()
                  setExpanded(exp => !exp)
                }}
                title={expanded ? t('collapseAlerts') : t('viewAlertsList', count)}
                style={{
                  background: expanded ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.14)',
                  border: '1px solid rgba(0,0,0,0.22)',
                  color: '#000',
                  padding: '2.5px 7px',
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  whiteSpace: 'nowrap',
                }}
              >
                {expanded ? t('collapseAlerts') : t('viewAlertsList', count)}
              </button>
            )}
          </div>
        </div>

        {/* Bottom row: Full alert headline */}
        <div style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: '#000',
          lineHeight: 1.35,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          wordBreak: 'break-word',
        }}>
          {visible?.header}
        </div>
      </div>

      {expanded && (
        <div style={{
          borderTop: '1px solid rgba(0,0,0,0.15)',
          padding: '6px 8px 10px',
          maxHeight: 220,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}>
          {alerts.map((a, i) => {
            const aTime = formatAlertDateTime(a.start, lang, t)
            return (
              <div
                key={a.id || i}
                onClick={() => onSelectAlert(a)}
                style={{
                  padding: '7px 8px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  background: 'rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {networkMode === 'both' && a.operator && (
                    <span style={{
                      fontSize: 8.5,
                      fontWeight: 800,
                      padding: '1px 4px',
                      borderRadius: 3,
                      background: a.operator === 'renfe' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(234, 88, 12, 0.25)',
                      color: a.operator === 'renfe' ? '#991b1b' : '#9a3412',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                      flexShrink: 0,
                    }}>
                      {a.operator === 'renfe' ? 'Rodalies' : 'FGC'}
                    </span>
                  )}
                  <span style={{
                    fontWeight: 700,
                    fontSize: 11.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: '1 1 120px',
                  }}>
                    {a.header}
                  </span>
                  {aTime && (
                    <span style={{
                      fontSize: 9.5,
                      opacity: 0.85,
                      fontWeight: 600,
                      background: 'rgba(0,0,0,0.1)',
                      padding: '1px 5px',
                      borderRadius: 4,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}>
                      {aTime.compact}
                    </span>
                  )}
                </div>

                <button
                  onClick={e => {
                    e.stopPropagation()
                    onSelectAlert(a)
                  }}
                  style={{
                    background: 'rgba(0,0,0,0.18)',
                    border: '1px solid rgba(0,0,0,0.15)',
                    color: '#000',
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  + info ↗
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function MobileLayout({
  trains, mapTrains, allTrains, stops, routes, alerts, allAlerts, lines, lineColors,
  activeLines, selectedTrain, selectedStop,
  refreshing, lastUpdate, apiError, outages, theme,
  networkMode, onNetworkChange,
  onToggleLine, onSelectTrain, onSelectStop,
  onCloseTrain, onCloseStop, onRefresh, onThemeToggle,
}: MobileLayoutProps) {
  const { t } = useI18n()
  useFontSize()
  const rootRef = useRef<HTMLDivElement>(null)
  const topBarRef = useRef<HTMLDivElement>(null)
  // Tallest the sheet may grow without hiding its handle under the top bar.
  const sheetCeiling = useSheetCeiling(rootRef, topBarRef)
  const [sheetRatio, setSheetRatio]       = useState(SNAP_PEEK)
  const [sheetDragging, setSheetDragging] = useState(false)
  const [activeTab, setActiveTab]         = useState<'trains' | 'stations' | 'plan'>('trains')
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null)
  const [selectedAlert, setSelectedAlert]     = useState<Alert | null>(null)
  const [settingsOpen, setSettingsOpen]       = useState(false)
  const [focusedLine, setFocusedLine]         = useState<string | null>(null)
  const [activeTrip, setActiveTrip]           = useState<Journey | null>(null)
  const [networkStatusOpen, setNetworkStatusOpen] = useState(false)
  const [viewportHeight, setViewportHeight] = useState<number | null>(null)

  // Keep window.scrollY locked to 0 and adapt layout height to visualViewport when virtual keyboard opens
  useEffect(() => {
    const handleViewport = () => {
      if (typeof window !== 'undefined') {
        if (window.visualViewport) {
          setViewportHeight(window.visualViewport.height)
        }
        if (window.scrollY !== 0 || window.scrollX !== 0) {
          window.scrollTo(0, 0)
        }
      }
    }

    if (typeof window !== 'undefined') {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height)
        window.visualViewport.addEventListener('resize', handleViewport)
        window.visualViewport.addEventListener('scroll', handleViewport)
      }
      window.addEventListener('scroll', handleViewport, { passive: true })
      window.addEventListener('resize', handleViewport, { passive: true })
    }

    return () => {
      if (typeof window !== 'undefined') {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', handleViewport)
          window.visualViewport.removeEventListener('scroll', handleViewport)
        }
        window.removeEventListener('scroll', handleViewport)
        window.removeEventListener('resize', handleViewport)
      }
    }
  }, [])

  const activeOutageMessage = useMemo(() => {
    if (networkMode === 'renfe' && outages?.renfe) return t('renfeOutageError')
    if (networkMode === 'fgc' && outages?.fgc) return t('fgcOutageError')
    if (networkMode === 'both') {
      if (outages?.renfe && outages?.fgc) return `${t('renfeOutageError')} • ${t('fgcOutageError')}`
      if (outages?.renfe) return t('renfeOutageError')
      if (outages?.fgc) return t('fgcOutageError')
    }
    return null
  }, [networkMode, outages, t])

  const {
    showTutorial,
    openTutorial,
    dismissTutorial,
    showDonationPrompt,
    openDonation,
    snoozeDonation,
    SUPPORT_SNOOZE_DAYS,
  } = useUserEngagement()

  useStationAlertNotifier(allAlerts ?? alerts)
  useLineAlertNotifier(allAlerts ?? alerts)

  const handleToastNavigate = useCallback((url: string) => {
    try {
      const parsed = new URL(url, window.location.origin)
      const stopParam = parsed.searchParams.get('stop')
      if (stopParam) {
        const found = stops.find(s => s.stopId === stopParam || s.code === stopParam || s.name.toLowerCase() === stopParam.toLowerCase())
        if (found) {
          onSelectStop(found)
          return
        }
      }
    } catch {}
    if (typeof window !== 'undefined') {
      window.location.href = url
    }
  }, [stops, onSelectStop])

  const journeyPath = useMemo(
    () => selectedJourney && stops.length > 0
      ? buildJourneyPath(selectedJourney, routes, stops, lineColors)
      : null,
    [selectedJourney, routes, stops, lineColors],
  )

  const handleSelectJourney = useCallback((j: Journey | null) => {
    setSelectedJourney(j)
    if (j) setSheetRatio(SNAP_HALF)
  }, [])

  const { favorites, isFavorite, toggleFavorite } = useFavoriteStations()
  const [stationQuery, setStationQuery] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const dragBase = useRef(SNAP_PEEK)

  const favoriteStops = useMemo(() => {
    if (favorites.length === 0) return []
    const favSet = new Set(favorites.map(f => f.stopId))
    const favNameSet = new Set(favorites.map(f => f.name.toLowerCase()))
    return stops
      .filter(s => favSet.has(s.stopId) || favNameSet.has(s.name.toLowerCase()))
      .filter((s, idx, arr) => arr.findIndex(x => x.name.toLowerCase() === s.name.toLowerCase()) === idx)
  }, [stops, favorites])

  // Arriving via shared planner link
  useEffect(() => {
    if (isPlannerLink()) { setActiveTab('plan'); setSheetRatio(SNAP_HALF) }
  }, [])

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const lineGroups = LINE_GROUPS.map(g => ({
    ...g,
    members: lines.filter(l => g.prefix.test(l)),
  })).filter(g => g.members.length > 0)

  const filteredTrains = useMemo(() => (
    activeLines.has('ALL')
      ? trains
      : trains.filter(t => activeLines.has(t.line))
  ), [trains, activeLines])

  const filteredMapTrains = useMemo(() => {
    const src = mapTrains ?? trains
    return activeLines.has('ALL') ? src : src.filter(t => activeLines.has(t.line))
  }, [mapTrains, trains, activeLines])

  const sortedTrains = useMemo(() => {
    return [...filteredTrains].sort((a, b) => {
      const aDepot = a.operationalStatus === 'depot' ? 1 : 0
      const bDepot = b.operationalStatus === 'depot' ? 1 : 0
      return aDepot - bDepot
    })
  }, [filteredTrains])

  const filteredStops = stationQuery.trim()
    ? Array.from(
        new Map(
          stops
            .filter(s => matchesSearch(s.name, stationQuery) || matchesSearch(s.stopId, stationQuery))
            .sort((a, b) => {
              const aStarts = startsWithSearch(a.name, stationQuery)
              const bStarts = startsWithSearch(b.name, stationQuery)
              if (aStarts && !bStarts) return -1
              if (!aStarts && bStarts) return 1
              return a.name.localeCompare(b.name, 'ca')
            })
            .map(s => [s.name, s]),
        ).values(),
      ).slice(0, 15)
    : []

  // Major station hub suggestions when search is empty
  const majorHubs = useMemo(() => {
    const hubNames = networkMode === 'fgc'
      ? ['Pl. Catalunya', 'Provença', 'Gràcia', 'Sarrià', 'Sant Cugat', 'Pl. Espanya', 'Martorell Enllaç']
      : networkMode === 'renfe'
      ? ['Barcelona-Sants', 'Passeig de Gràcia', 'Arc de Triomf', 'El Clot-Aragó', 'Estació de França', 'Plaça de Catalunya', 'Sagrera-Meridiana']
      : ['Barcelona-Sants', 'Pl. Catalunya', 'Provença', 'Passeig de Gràcia', 'Arc de Triomf', 'Pl. Espanya', 'Sarrià', 'Sant Cugat']

    const found: Stop[] = []
    const seen = new Set<string>()
    for (const name of hubNames) {
      const match = stops.find(s => matchesSearch(s.name, name))
      if (match && !seen.has(match.name)) {
        seen.add(match.name)
        found.push(match)
      }
    }
    return found
  }, [stops, networkMode])

  // Seamless item selection handlers that update the unified bottom sheet
  const handleSelectTrain = useCallback((t: Train) => {
    onSelectTrain(t)
    setSheetRatio(SNAP_HALF)
  }, [onSelectTrain])

  const handleSelectStop = useCallback((s: Stop) => {
    onSelectStop(s)
    setSheetRatio(SNAP_HALF)
  }, [onSelectStop])

  const handleDismissDetail = useCallback(() => {
    onCloseTrain()
    onCloseStop()
    setFocusedLine(null)
  }, [onCloseTrain, onCloseStop])

  // ── Sheet drag tracking ──
  const viewH = () => rootRef.current?.clientHeight || window.innerHeight
  const sheetMoved = useRef(false)

  const onSheetMove = useCallback((deltaY: number) => {
    const vh = viewH()
    // Dragging up (negative deltaY) raises the sheet, but never past the
    // ceiling — the handle has to stay below the top bar to stay grabbable.
    const next = Math.max(SNAP_PEEK - 0.03, Math.min(sheetCeiling, dragBase.current - deltaY / vh))
    setSheetRatio(next)
  }, [sheetCeiling])

  const onSheetEnd = useCallback((deltaY: number, velocityPxPerS: number) => {
    const vh = viewH()
    sheetMoved.current = Math.abs(deltaY) > 6
    setSheetDragging(false)
    const ratioVel = -velocityPxPerS / vh
    const landed = dragBase.current - deltaY / vh

    // Downward swipe when an item is open at peek dismisses it
    if (landed < SNAP_PEEK * 0.7 && (selectedTrain || selectedStop)) {
      handleDismissDetail()
      setSheetRatio(SNAP_PEEK)
      return
    }

    setSheetRatio(resolveSnap(landed, ratioVel, sheetCeiling))
  }, [selectedTrain, selectedStop, handleDismissDetail, sheetCeiling])

  const beginSheetDrag = useVerticalDrag(onSheetMove, onSheetEnd)
  const startSheetDrag = useCallback((clientY: number) => {
    dragBase.current = sheetRatio
    sheetMoved.current = false
    setSheetDragging(true)
    beginSheetDrag(clientY)
  }, [sheetRatio, beginSheetDrag])

  const toggleSheet = useCallback(() => {
    if (sheetMoved.current) return
    setSheetRatio(r => (r < SNAP_HALF ? SNAP_HALF : SNAP_PEEK))
  }, [])

  const expandSheet = useCallback(() => {
    setSheetRatio(r => (r < SNAP_HALF ? SNAP_HALF : r))
  }, [])

  // Typing needs the keyboard *and* the results visible: raise the sheet as
  // high as it goes whenever any input inside it gains focus, and prevent window scroll.
  const onSheetFocus = useCallback((e: React.FocusEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') {
      setSheetRatio(sheetCeiling)
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0)
      }
    }
  }, [sheetCeiling])

  useEffect(() => {
    function handleTourStep(e: Event) {
      const custom = e as CustomEvent<{ selector: string; idx: number }>
      if (!custom.detail) return
      const sel = custom.detail.selector
      if (sel === '[data-tour="tab-trains"]') {
        setActiveTab('trains')
        setSheetRatio(SNAP_HALF)
      } else if (sel === '[data-tour="tab-stations"]') {
        setActiveTab('stations')
        setSheetRatio(SNAP_HALF)
      } else if (sel === '[data-tour="tab-plan"]') {
        setActiveTab('plan')
        setSheetRatio(SNAP_HALF)
      } else if (sel === '[data-tour="near-me"]') {
        setSheetRatio(SNAP_PEEK)
      } else if (sel === '[data-tour="network-switch"]' || sel === '[data-tour="network-status"]' || sel === '[data-tour="settings"]') {
        setSheetRatio(SNAP_PEEK)
      }
    }
    window.addEventListener('andana-tour-step', handleTourStep)
    return () => window.removeEventListener('andana-tour-step', handleTourStep)
  }, [])

  // Global Escape key handler to dismiss active selections, modals, or filters
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (selectedAlert) { setSelectedAlert(null); return }
        if (networkStatusOpen) { setNetworkStatusOpen(false); return }
        if (settingsOpen) { setSettingsOpen(false); return }
        if (selectedTrain || selectedStop) { handleDismissDetail(); return }
        if (focusedLine) { setFocusedLine(null); return }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedAlert, networkStatusOpen, settingsOpen, selectedTrain, selectedStop, focusedLine, handleDismissDetail])

  const fitPadding = useMemo(() => ({
    top: 90, left: 40, right: 40,
    bottom: Math.round((typeof window === 'undefined' ? 800 : window.innerHeight) * (SNAP_HALF + 0.06)),
  }), [])

  const sheetHeight = `${(sheetRatio * 100).toFixed(2)}%`

  const TABS = [
    { key: 'trains'   as const, label: `${t('tabTrains')}` },
    { key: 'stations' as const, label: t('tabStations') },
    { key: 'plan'     as const, label: t('tabPlan') },
  ]

  const isItemSelected = selectedTrain !== null || selectedStop !== null

  return (
    <div
      ref={rootRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: viewportHeight ? `${viewportHeight}px` : '100dvh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >

      {/* ── Floating Top Bar (Clean, Uncluttered & Spaced) ── */}
      <div ref={topBarRef} style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 35,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 12px 16px',
        background: 'linear-gradient(to bottom, var(--bg) 60%, transparent)',
        pointerEvents: 'none',
      }}>
        {/* Left: Brand + Network Switch */}
        <div style={{
          pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg2)', border: '1px solid var(--border)',
          padding: '3px 6px', borderRadius: 20,
          boxShadow: '0 2px 12px rgba(0,0,0,0.22)',
        }}>
          <img src="/logo.svg" alt="" style={{ width: 22, height: 22, borderRadius: 5, marginLeft: 2 }} />
          <NetworkSwitch compact mode={networkMode} onChange={onNetworkChange} />
        </div>

        {/* Right utility buttons: NetworkStatus, Refresh, Settings */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 7, pointerEvents: 'auto' }}>
          <button
            data-tour="network-status"
            onClick={() => setNetworkStatusOpen(true)}
            aria-label={t('networkStatus')}
            title={t('networkStatus')}
            style={{
              background: alerts.length > 0 ? 'rgba(234,179,8,0.2)' : (outages?.renfe || outages?.fgc) ? 'rgba(245,158,11,0.18)' : 'var(--bg2)',
              border: alerts.length > 0 ? '1px solid rgba(234,179,8,0.4)' : (outages?.renfe || outages?.fgc) ? '1px solid rgba(245,158,11,0.35)' : '1px solid var(--border)',
              color: alerts.length > 0 || (outages?.renfe || outages?.fgc) ? 'var(--yellow)' : 'var(--green)',
              width: 38,
              height: 38,
              borderRadius: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 16 }}>🚦</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={t('refresh')}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              color: refreshing ? 'var(--accent)' : 'var(--text)',
              width: 38,
              height: 38,
              borderRadius: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 16, display: 'inline-block', animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>↻</span>
          </button>

          <button
            data-tour="settings"
            onClick={() => setSettingsOpen(true)}
            aria-label={t('settings')}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              width: 38,
              height: 38,
              borderRadius: 12,
              cursor: 'pointer',
              fontSize: 15,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
              fontFamily: 'inherit',
            }}
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* ── Floating Alert Pill ── */}
      <div style={{
        position: 'relative', zIndex: 20,
        opacity: sheetRatio > 0.65 ? 0 : 1,
        pointerEvents: sheetRatio > 0.65 ? 'none' : 'auto',
        transition: 'opacity 0.25s',
      }}>
        {apiError && (
          <div style={{
            position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 56px)', left: 12, right: 12,
            background: 'rgba(239,68,68,0.95)', borderRadius: 14,
            color: '#fff', fontSize: 11.5, fontWeight: 600, padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
          }}>
            <span style={{ fontWeight: 800, fontSize: 10 }}>ERROR</span>
            {apiError}
          </div>
        )}
        {!apiError && activeOutageMessage && (
          <div style={{
            position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 56px)', left: 12, right: 12,
            background: 'rgba(245,158,11,0.96)', borderRadius: 14,
            color: '#000', fontSize: 11.5, fontWeight: 600, padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
          }}>
            <span style={{ fontWeight: 800, fontSize: 10, background: '#000', color: '#fff', padding: '1px 5px', borderRadius: 4 }}>AVÍS</span>
            <span style={{ flex: 1, lineHeight: 1.3 }}>{activeOutageMessage}</span>
          </div>
        )}
        {!apiError && alerts.length > 0 && (
          <MobileAlertBanner alerts={alerts} onSelectAlert={setSelectedAlert} top={activeOutageMessage ? 'calc(env(safe-area-inset-top, 0px) + 110px)' : 'calc(env(safe-area-inset-top, 0px) + 56px)'} networkMode={networkMode} />
        )}
      </div>

      {/* ── Full-Screen Map ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapView
          trains={filteredMapTrains}
          stops={stops}
          routes={routes}
          lineColors={lineColors}
          selectedTrain={selectedTrain}
          selectedStop={selectedStop}
          onSelectTrain={handleSelectTrain}
          onSelectStop={handleSelectStop}
          onCloseStop={onCloseStop}
          onBackgroundClick={handleDismissDetail}
          journeyPath={journeyPath}
          theme={theme}
          fitPadding={fitPadding}
          focusedLine={focusedLine}
          filterPillTop={
            activeOutageMessage && alerts.length > 0
              ? 'calc(env(safe-area-inset-top, 0px) + 168px)'
              : (activeOutageMessage || alerts.length > 0)
                ? 'calc(env(safe-area-inset-top, 0px) + 112px)'
                : 'calc(env(safe-area-inset-top, 0px) + 60px)'
          }
          onClearFocusedLine={() => setFocusedLine(null)}
        />

        {/* Floating location shortcut: sits above sheet peek on map, fades away smoothly when sheet is raised */}
        <div
          style={{
            position: 'absolute',
            right: 14,
            bottom: `calc(${sheetHeight} + 12px)`,
            zIndex: 25,
            opacity: sheetRatio > 0.32 ? 0 : 1,
            pointerEvents: sheetRatio > 0.32 ? 'none' : 'auto',
            transition: sheetDragging ? 'opacity 0.15s' : 'bottom 0.32s cubic-bezier(0.32,1.2,0.5,1), opacity 0.22s',
          }}
        >
          <NearMeButton stops={stops} onPick={handleSelectStop} compact />
        </div>
      </div>

      {/* ── Unified Bottom Sheet (One-Sheet Architecture) ── */}
      <div
        onFocusCapture={onSheetFocus}
        style={{
          position: 'absolute',
          left: 0, right: 0, bottom: 0,
          height: sheetHeight,
          background: 'var(--bg2)',
          borderRadius: '22px 22px 0 0',
          boxShadow: '0 -8px 36px rgba(0,0,0,0.45)',
          border: '1px solid var(--border)',
          borderBottom: 'none',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 30,
          transition: sheetDragging ? 'none' : 'height 0.32s cubic-bezier(0.32,1.2,0.5,1)',
          willChange: 'height',
        }}
      >
        {/* Grab zone: handle + navigation or tabs */}
        <div
          style={{ flexShrink: 0, touchAction: 'none', cursor: 'grab' }}
          onMouseDown={e => startSheetDrag(e.clientY)}
          onTouchStart={e => startSheetDrag(e.touches[0].clientY)}
        >
          {/* Grabbable handle */}
          <div onClick={toggleSheet} style={{ padding: '7px 0 5px' }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '0 auto' }} />
          </div>

          {/* Conditional Navigation Header */}
          {isItemSelected ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              margin: '0 12px 8px', padding: '6px 10px', background: 'var(--bg3)', borderRadius: 12,
              gap: 8,
            }}>
              <button
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                onClick={handleDismissDetail}
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '5px 10px',
                  color: 'var(--text)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontFamily: 'inherit',
                  flexShrink: 0,
                }}
              >
                <span>←</span>
                <span>{selectedTrain ? t('tabTrains') : t('tabStations')}</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1, justifyContent: 'center' }}>
                {selectedTrain && (
                  <span style={{
                    background: `${lineColors[selectedTrain.line] || '#7a82a0'}25`,
                    color: lineColors[selectedTrain.line] || '#7a82a0',
                    fontWeight: 800,
                    fontSize: 12,
                    padding: '2px 7px',
                    borderRadius: 6,
                    fontFamily: 'var(--font-space-grotesk)',
                    flexShrink: 0,
                  }}>
                    {selectedTrain.line}
                  </span>
                )}
                <span style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedTrain
                    ? (selectedTrain.destination ? `${t('towards')} ${selectedTrain.destination}` : selectedTrain.line)
                    : selectedStop?.name}
                </span>
              </div>

              <button
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                onClick={handleDismissDetail}
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  color: 'var(--muted)',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            /* Segmented Tabs Control */
            <div data-tour="tabs" style={{ display: 'flex', gap: 4, margin: '0 10px 6px', padding: 2.5, background: 'var(--bg3)', borderRadius: 12 }}>
              {TABS.map(tab => {
                const active = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    data-tour={`tab-${tab.key}`}
                    onMouseDown={e => e.stopPropagation()}
                    onTouchStart={e => e.stopPropagation()}
                    onClick={() => { setActiveTab(tab.key); expandSheet(); if (tab.key === 'trains') setStationQuery('') }}
                    style={{
                      flex: 1, padding: '6px 0', border: 'none', borderRadius: 9, cursor: 'pointer',
                      background: active ? 'var(--accent)' : 'transparent',
                      color: active ? '#fff' : 'var(--muted)',
                      fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
                      letterSpacing: '0.2px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {tab.label}
                    {tab.key === 'trains' && (
                      <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.85, background: active ? 'rgba(255,255,255,0.22)' : 'var(--bg2)', padding: '1px 6px', borderRadius: 8 }}>
                        {filteredTrains.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Scrollable sheet content */}
        <div style={{
          flex: 1,
          overflowY: activeTab === 'plan' && !isItemSelected ? 'hidden' : 'auto',
          display: activeTab === 'plan' && !isItemSelected ? 'flex' : 'block',
          flexDirection: 'column',
          padding: isItemSelected
            ? '6px 12px calc(24px + env(safe-area-inset-bottom, 0px))'
            : activeTab === 'plan'
            ? '0 0 env(safe-area-inset-bottom, 0px)'
            : '8px 12px calc(28px + env(safe-area-inset-bottom, 0px))',
          overscrollBehavior: 'contain',
        }}>
          {selectedTrain ? (
            <DetailPanel train={selectedTrain} lineColors={lineColors} onClose={onCloseTrain} mobile />
          ) : selectedStop ? (
            <StopPanel stop={selectedStop} onClose={onCloseStop} lineColors={lineColors} mobile trains={filteredTrains} alerts={alerts} onSelectTrain={handleSelectTrain} />
          ) : activeTab === 'plan' ? (
            <TripPlanner
              lineColors={lineColors}
              selectedJourney={selectedJourney}
              onSelectJourney={handleSelectJourney}
              stops={stops}
              onStartLiveTrip={(j) => {
                setActiveTrip(j)
                setSelectedJourney(j)
                setSheetRatio(SNAP_PEEK)
              }}
            />
          ) : activeTab === 'trains' ? (
            <div>
              {/* Line filter chips (scrolls away naturally with trains list) */}
              <div style={{ padding: '0 0 8px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
                {focusedLine && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: 8,
                    marginBottom: 8,
                  }}>
                    <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                      {t('activeFilter', focusedLine)}
                    </span>
                    <button
                      onClick={() => setFocusedLine(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--red)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '2px 6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontFamily: 'inherit',
                      }}
                    >
                      ✕ {t('clearFilter')}
                    </button>
                  </div>
                )}
                <div style={{ overflowX: 'auto', display: 'flex', gap: 6, paddingBottom: expandedGroups.size ? 6 : 0, scrollbarWidth: 'none' }}>
                  <span
                    onClick={() => {
                      setFocusedLine(null)
                      onToggleLine('ALL')
                    }}
                    style={{ flexShrink: 0, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${activeLines.has('ALL') && !focusedLine ? 'var(--text)' : 'transparent'}`, background: 'var(--bg3)', color: 'var(--text)', opacity: activeLines.has('ALL') && !focusedLine ? 1 : 0.5, fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                  >
                    {t('all')}
                  </span>
                  {lineGroups.map(g => {
                    const expanded = expandedGroups.has(g.key)
                    const anyActive = !activeLines.has('ALL') && g.members.some(l => activeLines.has(l))
                    return (
                      <span
                        key={g.key}
                        onClick={() => toggleGroup(g.key)}
                        style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${anyActive ? 'var(--accent)' : expanded ? 'var(--border2)' : 'transparent'}`, background: anyActive ? 'rgba(59,130,246,0.14)' : 'var(--bg3)', color: anyActive ? 'var(--accent)' : 'var(--muted)', fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                      >
                        {t(g.labelKey)} {expanded ? '▲' : '▼'}
                      </span>
                    )
                  })}
                </div>
                {lineGroups.filter(g => expandedGroups.has(g.key)).map(g => (
                  <div key={g.key} style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingTop: 6, paddingBottom: 4 }}>
                    {g.members.map(l => {
                      const active = activeLines.has(l)
                      const color = lineColors[l] || LINE_COLORS[l] || '#7a82a0'
                      return (
                        <span
                          key={l}
                          onClick={() => {
                            setFocusedLine(null)
                            onToggleLine(l)
                          }}
                          style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${active ? color : 'transparent'}`, background: `${color}20`, color, opacity: active ? 1 : 0.5, fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                        >
                          {l}
                        </span>
                      )
                    })}
                  </div>
                ))}
              </div>

              {sortedTrains.length === 0 ? (
                isNightRestHours() && activeLines.has('ALL') ? (
                  <NightRestCard />
                ) : (networkMode === 'renfe' || networkMode === 'both') && outages?.renfe && activeLines.has('ALL') ? (
                  <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--muted)' }}>
                    <span style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>⚠️</span>
                    <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13, margin: '0 0 6px' }}>{t('renfeOutageError')}</p>
                    <p style={{ fontSize: 11.5, margin: 0, lineHeight: 1.4 }}>{t('telemetryUnavailableDesc')}</p>
                  </div>
                ) : (networkMode === 'fgc' || networkMode === 'both') && outages?.fgc && activeLines.has('ALL') ? (
                  <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--muted)' }}>
                    <span style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>⚠️</span>
                    <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13, margin: '0 0 6px' }}>{t('fgcOutageError')}</p>
                    <p style={{ fontSize: 11.5, margin: 0, lineHeight: 1.4 }}>{t('telemetryUnavailableDesc')}</p>
                  </div>
                ) : (
                  <p style={{ textAlign: 'center', padding: 30, color: 'var(--muted)', fontSize: 12 }}>{t('noActiveTrains')}</p>
                )
              ) : sortedTrains.map(t => (
                    <TrainCard
                      key={t.id}
                      train={t}
                      selected={false}
                      onClick={() => { handleSelectTrain(t); setStationQuery('') }}
                      lineColors={lineColors}
                    />
                  ))}
            </div>
          ) : (
            /* Estacions Tab with instant major hubs */
            <div>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <input
                  type="text"
                  value={stationQuery}
                  onChange={e => setStationQuery(e.target.value)}
                  onFocus={() => {
                    if (typeof window !== 'undefined') {
                      window.scrollTo(0, 0)
                    }
                  }}
                  placeholder={t('searchStationShort')}
                  style={{
                    width: '100%',
                    padding: '11px 36px 11px 13px',
                    background: 'var(--bg3)',
                    border: '1px solid var(--border2)',
                    borderRadius: 12,
                    color: 'var(--text)',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                {stationQuery && (
                  <button
                    onClick={() => setStationQuery('')}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--muted)',
                      cursor: 'pointer',
                      fontSize: 14,
                      padding: 4,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {stationQuery ? (
                <>
                  {filteredStops.map(s => {
                    const favorited = isFavorite(s)
                    return (
                      <div
                        key={s.stopId}
                        onClick={() => { handleSelectStop(s); setStationQuery('') }}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 10,
                          marginBottom: 6,
                          cursor: 'pointer',
                          background: 'var(--bg3)',
                          fontSize: 14,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'background 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                          {s.code && (
                            <span style={{ fontSize: 10, opacity: 0.6, background: 'var(--bg2)', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>
                              {s.code}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          {s.wheelchairBoarding && <span style={{ fontSize: 13, color: 'var(--accent)' }}>♿</span>}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleFavorite(s)
                            }}
                            aria-label={favorited ? t('removeFavorite') : t('addFavorite')}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 14,
                              padding: '2px 4px',
                              color: favorited ? '#eab308' : 'var(--muted)',
                              opacity: favorited ? 1 : 0.4,
                            }}
                          >
                            {favorited ? '⭐' : '☆'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {filteredStops.length === 0 && (
                    <p style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 2px', textAlign: 'center' }}>
                      {t('noStationFound')}
                    </p>
                  )}
                </>
              ) : (
                <div>
                  {/* Favorite Stations Section */}
                  {favoriteStops.length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>⭐</span>
                        <span>{t('favoriteStations')}</span>
                        <span style={{ fontSize: 9.5, background: 'rgba(234,179,8,0.2)', padding: '1px 6px', borderRadius: 4 }}>{favoriteStops.length}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {favoriteStops.map(s => {
                          const isRenfe = s.operator === 'renfe' || /^\d+$/.test(s.stopId)
                          return (
                            <div
                              key={`fav-${s.stopId}`}
                              onClick={() => handleSelectStop(s)}
                              style={{
                                padding: '11px 14px',
                                borderRadius: 10,
                                cursor: 'pointer',
                                background: 'var(--bg3)',
                                border: '1px solid rgba(234,179,8,0.3)',
                                fontSize: 13.5,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'background 0.15s',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                                {s.code && (
                                  <span style={{ fontSize: 10, opacity: 0.7, background: 'var(--bg2)', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>
                                    {s.code}
                                  </span>
                                )}
                                <span style={{
                                  fontSize: 8.5,
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background: isRenfe ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 140, 0, 0.15)',
                                  color: isRenfe ? '#ef4444' : '#ff8c00',
                                  flexShrink: 0,
                                }}>
                                  {isRenfe ? 'Rodalies' : 'FGC'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                {s.wheelchairBoarding && <span style={{ fontSize: 12, color: 'var(--accent)' }}>♿</span>}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleFavorite(s)
                                  }}
                                  aria-label={t('removeFavorite')}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 14,
                                    padding: '2px 4px',
                                    color: '#eab308',
                                  }}
                                >
                                  ⭐
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Major Hubs Section */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span>📍</span>
                      <span>{t('majorHubs')}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {majorHubs.map(s => {
                        const favorited = isFavorite(s)
                        return (
                          <div
                            key={s.stopId}
                            onClick={() => handleSelectStop(s)}
                            style={{
                              padding: '11px 14px',
                              borderRadius: 10,
                              cursor: 'pointer',
                              background: 'var(--bg3)',
                              border: '1px solid var(--border)',
                              fontSize: 13.5,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'background 0.15s',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                              {s.code && (
                                <span style={{ fontSize: 10, opacity: 0.6, background: 'var(--bg2)', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>
                                  {s.code}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                              {s.wheelchairBoarding && <span style={{ fontSize: 12, color: 'var(--accent)' }}>♿</span>}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleFavorite(s)
                                }}
                                aria-label={favorited ? t('removeFavorite') : t('addFavorite')}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  padding: '2px 4px',
                                  color: favorited ? '#eab308' : 'var(--muted)',
                                  opacity: favorited ? 1 : 0.4,
                                }}
                              >
                                {favorited ? '⭐' : '☆'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Settings Modal ── */}
      <MobileSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeToggle={onThemeToggle}
        trainCount={filteredTrains.length}
        lineCount={lines.length}
        lastUpdate={lastUpdate}
        refreshing={refreshing}
        onRefresh={onRefresh}
        networkMode={networkMode}
        onNetworkChange={onNetworkChange}
        onOpenTutorial={openTutorial}
        onOpenDonation={openDonation}
      />

      {/* ── Live Trip HUD ── */}
      {activeTrip && (
        <LiveTripHud
          journey={activeTrip}
          trains={trains}
          lineColors={lineColors}
          onClose={() => setActiveTrip(null)}
        />
      )}

      {/* ── Network Status Modal ── */}
      <NetworkStatusModal
        open={networkStatusOpen}
        onClose={() => setNetworkStatusOpen(false)}
        alerts={allAlerts ?? alerts}
        trains={allTrains ?? trains}
        lineColors={lineColors}
        focusedLine={focusedLine}
        outages={outages}
        onSelectLine={(line) => {
          if (line) {
            const isFgc = /^(S|L)\d/i.test(line) || ['R5', 'R6', 'R50', 'R60'].includes(line)
            if (isFgc && networkMode === 'renfe') {
              onNetworkChange('both')
            } else if (!isFgc && networkMode === 'fgc') {
              onNetworkChange('both')
            }
          }
          setFocusedLine(line)
          setNetworkStatusOpen(false)
        }}
      />

      {/* ── Alert Detail Modal ── */}
      <AlertModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} lineColors={lineColors} />

      {/* ── Onboarding / Tutorial Modal ── */}
      <OnboardingModal
        open={showTutorial}
        onClose={dismissTutorial}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* ── Donation / Support Modal ── */}
      <DonationModal
        open={showDonationPrompt}
        onClose={() => snoozeDonation(14)}
        onSnooze={snoozeDonation}
        onSupport={() => snoozeDonation(SUPPORT_SNOOZE_DAYS)}
      />

      <NotificationToast onNavigate={handleToastNavigate} />
    </div>
  )
}
