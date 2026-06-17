'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import type { Train, Stop } from '@/types'
import { LINE_COLORS, STATION_CODES } from '@/lib/constants'
import { TrainCard } from './TrainCard'
import { TripPlanner } from './TripPlanner'

type Tab = 'trains' | 'stations' | 'plan'

interface SidebarProps {
  trains: Train[]
  stops: Stop[]
  lines: string[]
  lineColors: Record<string, string>
  activeLines: Set<string>
  selectedTrain: Train | null
  selectedStop: Stop | null
  dailyPunctuality: Record<string, { onTime: number; total: number }>
  onToggleLine: (line: string) => void
  onSelectTrain: (train: Train) => void
  onSelectStop: (stop: Stop) => void
}

const LINE_GROUPS: { key: string; label: string; prefix: RegExp }[] = [
  { key: 'L',     label: 'L — Barcelona urbà',           prefix: /^L/ },
  { key: 'S',     label: 'S — Vallès',                   prefix: /^S/ },
  { key: 'R',     label: 'R — Llobregat-Anoia regional', prefix: /^R/ },
  { key: 'Other', label: 'Altres',                       prefix: /^(?!L|S|R)/ },
]

export function Sidebar({ trains, stops, lines, lineColors, activeLines, selectedTrain, selectedStop, dailyPunctuality, onToggleLine, onSelectTrain, onSelectStop }: SidebarProps) {
  const [activeTab, setActiveTab]           = useState<Tab>('trains')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [filterOpen, setFilterOpen]         = useState(true)
  const [punctualityOpen, setPunctualityOpen] = useState(false)
  const [stationQuery, setStationQuery]     = useState('')
  const [showDropdown, setShowDropdown]     = useState(false)
  const dropdownRef                         = useRef<HTMLDivElement>(null)

  // Sync station query label when parent's selectedStop changes (e.g. map click)
  useEffect(() => {
    if (selectedStop) {
      setStationQuery(selectedStop.name)
      setActiveTab('stations')
    }
  }, [selectedStop?.stopId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredStops = useMemo(() =>
    stationQuery
      ? Array.from(
          new Map(
            stops
              .filter(s => s.name.toLowerCase().includes(stationQuery.toLowerCase()))
              .map(s => [s.name, s]),
          ).values(),
        ).slice(0, 10)
      : [],
    [stops, stationQuery],
  )

  // Trains report stops by their canonical name (resolved via STATION_CODES),
  // which differs from the stop's raw API name (e.g. "Barcelona - Plaça
  // Catalunya" vs "Pl. Catalunya"). Resolve the selected stop the same way the
  // map popup does so the two panels agree.
  const selectedStationName = useMemo(() => {
    if (!selectedStop) return null
    const code = selectedStop.stopId.replace(/\d+$/, '')
    return STATION_CODES[code] ?? selectedStop.name
  }, [selectedStop])

  const passingTrains = useMemo(() =>
    selectedStationName
      ? trains.filter(t =>
          t.currentStop === selectedStationName ||
          t.upcomingStops.includes(selectedStationName)
        )
      : [],
    [trains, selectedStationName],
  )

  const punctuality = useMemo(() =>
    lines
      .map(line => {
        const tally = dailyPunctuality[line]
        if (!tally || tally.total === 0) return null
        return { line, pct: Math.round((tally.onTime / tally.total) * 100), total: tally.total }
      })
      .filter((d): d is { line: string; pct: number; total: number } => d !== null),
    [lines, dailyPunctuality],
  )

  const lineGroups = useMemo(() =>
    LINE_GROUPS.map(g => ({
      ...g,
      members: lines.filter(l => g.prefix.test(l)),
    })).filter(g => g.members.length > 0),
    [lines],
  )

  function selectStop(stop: Stop) {
    setStationQuery(stop.name)
    setShowDropdown(false)
    onSelectStop(stop)
  }

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function groupActive(members: string[]) {
    if (activeLines.has('ALL')) return false
    return members.some(l => activeLines.has(l))
  }

  const tabStyle = (tab: Tab) => ({
    flex: 1, padding: 12, border: 'none', background: 'none',
    color: activeTab === tab ? 'var(--accent)' : 'var(--muted)',
    fontWeight: 600, fontSize: 12, cursor: 'pointer',
    borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
    textTransform: 'uppercase' as const, letterSpacing: '0.5px', fontFamily: 'inherit',
    transition: 'color 0.15s',
  })

  return (
    <aside style={{ background: 'var(--bg2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tab buttons */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.05)' }}>
        {(['trains', 'stations', 'plan'] as Tab[]).map(tab => (
          <button key={tab} style={tabStyle(tab)} onClick={() => setActiveTab(tab)}>
            {tab === 'trains' ? 'Trens' : tab === 'stations' ? 'Estacions' : 'Anar a…'}
          </button>
        ))}
      </div>

      {/* ── Trains tab ── */}
      {activeTab === 'trains' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Line filters */}
          <div style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <button
              onClick={() => setFilterOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontFamily: 'inherit' }}
            >
              <span style={{ flex: 1, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'left' }}>Filtre per Línia</span>
              <span style={{ fontSize: 9, opacity: 0.6 }}>{filterOpen ? '▲' : '▼'}</span>
            </button>
            {filterOpen && <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span
                onClick={() => onToggleLine('ALL')}
                style={{ alignSelf: 'flex-start', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${activeLines.has('ALL') ? 'var(--text)' : 'transparent'}`, background: 'var(--bg3)', color: 'var(--text)', opacity: activeLines.has('ALL') ? 1 : 0.45, transition: 'all 0.15s', fontFamily: 'var(--font-space-grotesk), sans-serif' }}
              >
                Tots
              </span>

              {lineGroups.map(g => {
                const expanded = expandedGroups.has(g.key)
                const anyActive = groupActive(g.members)
                return (
                  <div key={g.key}>
                    <button
                      onClick={() => toggleGroup(g.key)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: anyActive ? 'var(--accent)10' : 'var(--bg3)', border: `1px solid ${anyActive ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 7, padding: '5px 10px', cursor: 'pointer', color: anyActive ? 'var(--accent)' : 'var(--muted)', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-space-grotesk), sans-serif', textAlign: 'left', transition: 'all 0.15s' }}
                    >
                      <span style={{ flex: 1 }}>{g.label}</span>
                      <span style={{ fontSize: 9, opacity: 0.6 }}>{expanded ? '▲' : '▼'}</span>
                    </button>

                    {expanded && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '6px 4px 2px 4px' }}>
                        {g.members.map(l => {
                          const active = activeLines.has(l)
                          const color = lineColors[l] || LINE_COLORS[l] || '#7a82a0'
                          return (
                            <span
                              key={l}
                              onClick={() => onToggleLine(l)}
                              style={{ padding: '4px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${active ? color : 'transparent'}`, background: `${color}20`, color, opacity: active ? 1 : 0.45, transition: 'all 0.15s', fontFamily: 'var(--font-space-grotesk), sans-serif' }}
                            >
                              {l}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>}
          </div>

          {/* Punctuality chart */}
          <div style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <button
              onClick={() => setPunctualityOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontFamily: 'inherit' }}
            >
              <span style={{ flex: 1, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'left' }}>Puntualitat Avui (%)</span>
              <span style={{ fontSize: 9, opacity: 0.6 }}>{punctualityOpen ? '▲' : '▼'}</span>
            </button>
            {punctualityOpen && <div style={{ padding: '0 16px 12px' }}>
              <div style={{ background: 'var(--bg3)', padding: 8, borderRadius: 8 }}>
                {punctuality.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', padding: '4px 0' }}>Acumulant dades…</div>
                )}
                {punctuality.map(d => (
                  <div key={d.line} title={`${d.total} observacions avui`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 20, fontWeight: 600, fontSize: 11, fontFamily: 'var(--font-space-grotesk)' }}>{d.line}</span>
                    <div style={{ flex: 1, height: 8, background: 'var(--border2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${d.pct}%`, background: d.pct > 95 ? 'var(--green)' : d.pct > 75 ? 'var(--yellow)' : 'var(--red)', borderRadius: 4 }} />
                    </div>
                    <span style={{ color: 'var(--muted)', fontSize: 10 }}>{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>}
          </div>

          {/* Train list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 8px 4px' }}>
            {trains.length === 0
              ? <p style={{ textAlign: 'center', padding: 30, color: 'var(--muted)', fontSize: 12 }}>Cap tren actiu.</p>
              : trains.map(t => (
                  <TrainCard key={t.id} train={t} selected={selectedTrain?.id === t.id} onClick={() => onSelectTrain(t)} lineColors={lineColors} />
                ))
            }
          </div>
        </div>
      )}

      {/* ── Stations tab ── */}
      {activeTab === 'stations' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div ref={dropdownRef} style={{ padding: 16, borderBottom: '1px solid var(--border)', flexShrink: 0, position: 'relative' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
              Cerca Estació
            </div>
            <input
              type="text"
              value={stationQuery}
              onChange={e => { setStationQuery(e.target.value); setShowDropdown(true) }}
              onKeyDown={e => { if (e.key === 'Enter' && filteredStops.length > 0) selectStop(filteredStops[0]) }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Ex: Sant Cugat, Provença…"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, outline: 'none' }}
            />
            {showDropdown && filteredStops.length > 0 && (
              <div style={{ position: 'absolute', left: 16, right: 16, top: '100%', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, marginTop: 4, maxHeight: 200, overflowY: 'auto', zIndex: 30, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                {filteredStops.map(s => (
                  <div key={s.stopId} onClick={() => selectStop(s)} style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {s.name}
                    {s.wheelchairBoarding && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)' }}>♿</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {selectedStop ? (
              <>
                <h3 style={{ fontFamily: 'var(--font-space-grotesk)', fontSize: 15, marginBottom: 4, color: 'var(--accent)' }}>
                  {selectedStop.name}
                </h3>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
                  Trens passant ara o pròximament
                </p>
                {passingTrains.length > 0 ? passingTrains.map(t => {
                  const color = lineColors[t.line] || LINE_COLORS[t.line] || '#7a82a0'
                  const isHere = t.currentStop === selectedStationName
                  const stopsAway = isHere ? 0 : t.upcomingStops.indexOf(selectedStationName!) + 1
                  return (
                    <div
                      key={t.id}
                      onClick={() => onSelectTrain(t)}
                      style={{ border: `1px solid ${isHere ? color : 'var(--border)'}`, padding: 10, borderRadius: 8, marginBottom: 6, background: isHere ? `${color}12` : 'rgba(0,0,0,0.1)', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <b style={{ color, fontSize: 13 }}>{t.line}</b>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {t.delayMinutes > 0 && <span style={{ color: 'var(--red)', fontWeight: 600, fontSize: 11 }}>+{t.delayMinutes}m</span>}
                          {isHere
                            ? <span style={{ background: color, color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>ARA AQUÍ</span>
                            : <span style={{ color: 'var(--muted)', fontSize: 10 }}>{stopsAway} parada{stopsAway !== 1 ? 'es' : ''}</span>
                          }
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        cap a <b style={{ color: 'var(--text)' }}>{t.destination}</b> · {Math.round(t.occupancyPercent)}% ocupació
                      </div>
                    </div>
                  )
                }) : (
                  <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
                    Cap tren detectat passant per aquesta estació.
                  </p>
                )}
              </>
            ) : (
              <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 20, fontSize: 13 }}>
                Cerca una estació per veure els trens.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Plan tab ── */}
      {activeTab === 'plan' && <TripPlanner lineColors={lineColors} />}
    </aside>
  )
}
