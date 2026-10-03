'use client'

import { useState, useMemo, useEffect } from 'react'
import type { Train, Stop, Journey } from '@/types'
import { LINE_COLORS } from '@/lib/constants'
import { TrainCard } from './TrainCard'
import { TripPlanner } from './TripPlanner'
import { isPlannerLink } from '@/lib/urlState'
import { useI18n, type TransKey } from '@/lib/i18n'

type Tab = 'trains' | 'stations' | 'plan'

interface SidebarProps {
  trains: Train[]
  stops: Stop[]
  lines: string[]
  lineColors: Record<string, string>
  activeLines: Set<string>
  selectedTrain: Train | null
  selectedStop: Stop | null
  onToggleLine: (line: string) => void
  onSelectTrain: (train: Train) => void
  onSelectStop: (stop: Stop) => void
  selectedJourney: Journey | null
  onSelectJourney: (journey: Journey | null) => void
}

const LINE_GROUPS: { key: string; labelKey: TransKey; prefix: RegExp }[] = [
  { key: 'L',          labelKey: 'groupUrban',     prefix: /^L\d/ },
  { key: 'S',          labelKey: 'groupValles',    prefix: /^S\d/ },
  { key: 'R-fgc',      labelKey: 'groupRegional',  prefix: /^R(5|6|50|53|60|63)$/ },
  { key: 'R-rodalies', labelKey: 'groupRodalies',  prefix: /^R([1-478]|2[NS]|2Nord|2Sud)$/ },
  { key: 'R-regional', labelKey: 'groupRegionals', prefix: /^(R1[1-7]|R[LGT]\d+)$/ },
  { key: 'Other',      labelKey: 'groupOther',     prefix: /^(?!L|S|R)/ },
]

export function Sidebar({ trains, stops, lines, lineColors, activeLines, selectedTrain, selectedStop, onToggleLine, onSelectTrain, onSelectStop, selectedJourney, onSelectJourney }: SidebarProps) {
  const { t } = useI18n()
  const [activeTab, setActiveTab]           = useState<Tab>('trains')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [filterOpen, setFilterOpen]         = useState(true)
  const [stationQuery, setStationQuery]     = useState('')

  // Open the Plan tab on load when arriving via a shared planner link. Done in
  // an effect (not the initial state) to avoid an SSR/hydration mismatch.
  useEffect(() => {
    if (isPlannerLink()) setActiveTab('plan')
  }, [])

  const displayStops = useMemo(() => {
    const uniqueMap = new Map<string, Stop>()
    for (const s of stops) {
      if (!uniqueMap.has(s.name)) {
        uniqueMap.set(s.name, s)
      }
    }
    const all = Array.from(uniqueMap.values())
    if (!stationQuery.trim()) {
      return all.sort((a, b) => a.name.localeCompare(b.name))
    }
    const q = stationQuery.toLowerCase().trim()
    return all
      .filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.stopId.toLowerCase().includes(q) ||
        (s.lines && s.lines.some(l => l.toLowerCase().includes(q)))
      )
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q)
        const bStarts = b.name.toLowerCase().startsWith(q)
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1
        return a.name.localeCompare(b.name)
      })
  }, [stops, stationQuery])

  const lineGroups = useMemo(() =>
    LINE_GROUPS.map(g => ({
      ...g,
      members: lines.filter(l => g.prefix.test(l)),
    })).filter(g => g.members.length > 0),
    [lines],
  )

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
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
            {tab === 'trains' ? t('tabTrains') : tab === 'stations' ? t('tabStations') : t('tabPlan')}
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
              <span style={{ flex: 1, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'left' }}>{t('filterByLine')}</span>
              <span style={{ fontSize: 9, opacity: 0.6 }}>{filterOpen ? '▲' : '▼'}</span>
            </button>
            {filterOpen && <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span
                onClick={() => onToggleLine('ALL')}
                style={{ alignSelf: 'flex-start', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${activeLines.has('ALL') ? 'var(--text)' : 'transparent'}`, background: 'var(--bg3)', color: 'var(--text)', opacity: activeLines.has('ALL') ? 1 : 0.45, transition: 'all 0.15s', fontFamily: 'var(--font-space-grotesk), sans-serif' }}
              >
                {t('all')}
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
                      <span style={{ flex: 1 }}>{t(g.labelKey)}</span>
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

          {/* Train list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 8px 4px' }}>
            {trains.length === 0
              ? <p style={{ textAlign: 'center', padding: 30, color: 'var(--muted)', fontSize: 12 }}>{t('noActiveTrains')}</p>
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
          {/* Station search bar */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
              {t('searchStation')}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={stationQuery}
                onChange={e => setStationQuery(e.target.value)}
                placeholder={t('searchStationPlaceholder')}
                style={{
                  width: '100%',
                  padding: '9px 30px 9px 12px',
                  background: 'var(--bg3)',
                  border: '1px solid var(--border2)',
                  borderRadius: 8,
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              {stationQuery && (
                <button
                  onClick={() => setStationQuery('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    fontSize: 12,
                    padding: 4,
                    lineHeight: 1,
                  }}
                  title="Clear"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Stations directory list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
            {displayStops.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)', fontSize: 13 }}>
                {t('noStationFound')}
              </div>
            ) : (
              displayStops.map(s => {
                const isSelected = selectedStop?.stopId === s.stopId || selectedStop?.name === s.name
                const isRenfe = s.operator === 'renfe' || /^\d+$/.test(s.stopId)
                return (
                  <div
                    key={s.stopId}
                    onClick={() => onSelectStop(s)}
                    style={{
                      padding: '10px 12px',
                      marginBottom: 6,
                      borderRadius: 8,
                      cursor: 'pointer',
                      background: isSelected ? 'var(--accent)18' : 'var(--bg3)',
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                      <span style={{
                        fontFamily: 'var(--font-space-grotesk)',
                        fontWeight: isSelected ? 700 : 600,
                        fontSize: 13,
                        color: isSelected ? 'var(--accent)' : 'var(--text)',
                      }}>
                        {s.name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {s.wheelchairBoarding && (
                          <span style={{ fontSize: 11, color: 'var(--accent)' }} title={t('accessible')}>♿</span>
                        )}
                        <span style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 5px',
                          borderRadius: 4,
                          background: isRenfe ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 140, 0, 0.15)',
                          color: isRenfe ? '#ef4444' : '#ff8c00',
                          letterSpacing: '0.4px',
                        }}>
                          {isRenfe ? 'Rodalies' : 'FGC'}
                        </span>
                      </div>
                    </div>

                    {s.lines && s.lines.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {s.lines.slice(0, 8).map(l => {
                          const c = lineColors[l] || LINE_COLORS[l] || '#7a82a0'
                          return (
                            <span
                              key={l}
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: 3,
                                background: `${c}20`,
                                color: c,
                                fontFamily: 'var(--font-space-grotesk)',
                              }}
                            >
                              {l}
                            </span>
                          )
                        })}
                        {s.lines.length > 8 && (
                          <span style={{ fontSize: 9, color: 'var(--muted)', alignSelf: 'center' }}>
                            +{s.lines.length - 8}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ── Plan tab ── */}
      {activeTab === 'plan' && (
        <TripPlanner
          lineColors={lineColors}
          selectedJourney={selectedJourney}
          onSelectJourney={onSelectJourney}
          stops={stops}
        />
      )}
    </aside>
  )
}
