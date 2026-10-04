'use client'

import { useRef, useEffect } from 'react'
import { Map, Marker, NavigationControl, Source, Layer } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Train, Stop, Route, Theme } from '@/types'
import type { JourneyPath } from '@/lib/journeyPath'
import { LINE_COLORS, getStationCode } from '@/lib/constants'

const MAP_STYLES: Record<Theme, string> = {
  dark:  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
}

interface MapViewProps {
  trains: Train[]
  stops: Stop[]
  routes: Route[]
  lineColors: Record<string, string>
  selectedTrain: Train | null
  selectedStop: Stop | null
  onSelectTrain: (train: Train) => void
  onSelectStop: (stop: Stop) => void
  onCloseStop?: () => void
  // Clicking (not dragging) empty map. Mobile wires this to deselect whatever
  // is focused — train or station. Falls back to onCloseStop when omitted.
  onBackgroundClick?: () => void
  journeyPath?: JourneyPath | null
  theme: Theme
  // fitBounds padding for framing a journey; mobile passes a bottom-heavy
  // object so the path clears the bottom sheet.
  fitPadding?: number | { top: number; bottom: number; left: number; right: number }
  focusedLine?: string | null
  onClearFocusedLine?: () => void
}

export default function MapView({ trains, stops, routes, lineColors, selectedTrain, selectedStop, onSelectTrain, onSelectStop, onCloseStop, onBackgroundClick, journeyPath, theme, fitPadding, focusedLine, onClearFocusedLine }: MapViewProps) {
  const mapRef = useRef<MapRef>(null)

  // Fly in when a train is first selected (uses the position at click time).
  useEffect(() => {
    if (!selectedTrain || !mapRef.current) return
    mapRef.current.flyTo({ center: [selectedTrain.lng, selectedTrain.lat], zoom: 14, duration: 1000 })
  }, [selectedTrain])

  // Follow the selected train as it moves. `trains` is the interpolated array
  // (updates ~10fps), so track the live position of the selected id and keep
  // the camera centred on it. We skip while the map isMoving() — that covers
  // both the fly-in above and an active user pan/zoom — and setCenter is an
  // instantaneous jump, so following doesn't fight either.
  const liveSelected = selectedTrain ? trains.find(t => t.id === selectedTrain.id) : undefined
  useEffect(() => {
    if (!liveSelected || !mapRef.current) return
    const map = mapRef.current.getMap()
    if (map.isMoving()) return
    map.setCenter([liveSelected.lng, liveSelected.lat])
  }, [liveSelected?.lng, liveSelected?.lat])

  useEffect(() => {
    if (!selectedStop || !mapRef.current) return
    mapRef.current.flyTo({ center: [selectedStop.lng, selectedStop.lat], zoom: 15, duration: 1000 })
  }, [selectedStop])

  // When a journey path is drawn, frame it: fit both endpoints (and the whole
  // travelled path) into view with padding so the full trip is visible.
  useEffect(() => {
    if (!journeyPath || !mapRef.current) return
    const coords = journeyPath.legs.flatMap(l => l.coords)
    if (coords.length === 0) return
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng
      if (lat < minLat) minLat = lat
      if (lng > maxLng) maxLng = lng
      if (lat > maxLat) maxLat = lat
    }
    mapRef.current.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: fitPadding ?? 80, maxZoom: 15, duration: 1000 },
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyPath])

  const routesGeoJson = {
    type: 'FeatureCollection' as const,
    features: routes
      .filter(r => r.geometry !== null)
      .map(r => ({
        type: 'Feature' as const,
        properties: { routeId: r.routeId, color: r.color, line: r.shortName },
        geometry: r.geometry!,
      })),
  }

  // The line of whatever is currently selected or focused — its route is drawn bold.
  const highlightedLine = focusedLine ?? selectedTrain?.line ?? null

  // Journey path: one colored LineString per leg (transfers => color changes).
  const journeyGeoJson = {
    type: 'FeatureCollection' as const,
    features: (journeyPath?.legs ?? []).map((leg, i) => ({
      type: 'Feature' as const,
      properties: { color: leg.color, line: leg.line, idx: i },
      geometry: { type: 'LineString' as const, coordinates: leg.coords },
    })),
  }

  const stopsGeoJson = {
    type: 'FeatureCollection' as const,
    features: stops.map(s => ({
      type: 'Feature' as const,
      properties: {
        stopId: s.stopId,
        name: s.name,
        code: s.code ?? getStationCode(s.stopId, s.name),
        wheelchair: s.wheelchairBoarding,
      },
      geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
    })),
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: 2.07, latitude: 41.43, zoom: 10.5 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLES[theme]}
      attributionControl={false}
      interactiveLayerIds={['stops-circles']}
      onClick={e => {
        const f = e.features?.[0]
        if (f?.layer?.id === 'stops-circles') {
          const hit = stops.find(s => s.stopId === (f.properties as { stopId: string }).stopId)
          if (hit) onSelectStop(hit)
        } else {
          // Genuine click on empty map (maplibre only fires onClick for a tap,
          // not a drag/pan) → deselect. onBackgroundClick clears train+station;
          // falls back to onCloseStop where not wired.
          (onBackgroundClick ?? onCloseStop)?.()
        }
      }}
    >
      <NavigationControl position="bottom-right" />

      {/* Route lines — drawn first so they appear below everything */}
      <Source id="routes" type="geojson" data={routesGeoJson}>
        <Layer
          id="routes-lines"
          type="line"
          layout={{ 'line-join': 'round', 'line-cap': 'round' }}
          paint={{
            'line-color': ['get', 'color'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 13, 2.2],
            'line-opacity': focusedLine ? 0.12 : ['interpolate', ['linear'], ['zoom'], 8, 0.35, 13, 0.45],
          }}
        />
        {/* Highlighted line — the focused/selected train's route, drawn bold on top */}
        <Layer
          id="routes-lines-highlight"
          type="line"
          layout={{ 'line-join': 'round', 'line-cap': 'round' }}
          filter={['==', ['get', 'line'], highlightedLine ?? ' ']}
          paint={{
            'line-color': ['get', 'color'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2.5, 13, 6],
            'line-opacity': 1,
          }}
        />
      </Source>

      {/* Stop circles + code labels — rendered before journey so beforeId="stops-circles" exists */}
      <Source id="stops" type="geojson" data={stopsGeoJson}>
        <Layer
          id="stops-circles"
          type="circle"
          paint={{
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 11, 7, 13, 11],
            'circle-color': '#12122a',
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#bbbbbb',
            // Fully opaque so the dots read as sitting on top of the drawn
            // journey line rather than the line bleeding through them.
            'circle-opacity': 1,
          }}
          minzoom={9}
        />
        <Layer
          id="stops-labels"
          type="symbol"
          layout={{
            'text-field': ['get', 'code'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 10, 6, 13, 9],
            'text-font': ['Open Sans Bold', 'Noto Sans Regular'],
            'text-allow-overlap': false,
          }}
          paint={{ 'text-color': '#ffffff' }}
          minzoom={10}
        />
      </Source>

      {/* Journey path — drawn above base routes, below stops/trains */}
      {journeyPath && journeyGeoJson.features.length > 0 && (
        <Source id="journey" type="geojson" data={journeyGeoJson}>
          {/* White casing for contrast against the basemap — inserted before the
              stop circles so stops always render on top of the journey line. */}
          <Layer
            id="journey-casing"
            type="line"
            beforeId="stops-circles"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{
              'line-color': theme === 'dark' ? '#000' : '#fff',
              'line-width': ['interpolate', ['linear'], ['zoom'], 8, 6, 14, 11],
              'line-opacity': 0.55,
            }}
          />
          {/* Colored line per leg */}
          <Layer
            id="journey-line"
            type="line"
            beforeId="stops-circles"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{
              'line-color': ['get', 'color'],
              'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 14, 6],
              'line-opacity': 1,
            }}
          />
        </Source>
      )}

      {/* Journey endpoint + transfer markers. Markers are HTML overlays, so they
          always render above the drawn line — the dots sit on top of the path.
          Origin is labelled "A", destination "B"; transfers stay as plain dots. */}
      {journeyPath?.stops.map((s, i, arr) => {
        const isOrigin = i === 0
        const isDest = i === arr.length - 1
        const isEnd = isOrigin || isDest
        const label = isOrigin ? 'A' : isDest ? 'B' : ''
        const size = isEnd ? 24 : 12
        return (
          <Marker key={`jp-${i}`} longitude={s.lng} latitude={s.lat}>
            <div
              title={s.name}
              style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: isEnd ? 'var(--accent)' : '#fff',
                border: `3px solid ${isEnd ? '#fff' : 'var(--accent)'}`,
                boxShadow: '0 0 0 2px rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                lineHeight: 1,
                fontFamily: 'var(--font-space-grotesk), sans-serif',
                userSelect: 'none',
              }}
            >
              {label}
            </div>
          </Marker>
        )
      })}

      {/* Train markers — rendered last so they float above lines and stops */}
      {trains.map(train => {
        const isSelected = selectedTrain?.id === train.id
        const isFocused = focusedLine === train.line
        const isDimmed = Boolean(focusedLine && !isFocused)
        const color = lineColors[train.line] || LINE_COLORS[train.line] || '#7a82a0'
        const isDepot = train.operationalStatus === 'depot'
        return (
          <Marker
            key={train.id}
            longitude={train.lng}
            latitude={train.lat}
            onClick={e => {
              e.originalEvent.stopPropagation()
              onSelectTrain(train)
            }}
          >
            <div
              title={`${train.line} → ${train.destination}${train.delayMinutes > 0 ? ` (+${train.delayMinutes}m)` : ''}${isDepot ? ' (💤 Cotxeres)' : ''}`}
              style={{
                width:          isSelected || isFocused ? 32 : 24,
                height:         isSelected || isFocused ? 32 : 24,
                borderRadius:   '50%',
                background:     color,
                border:         isSelected || isFocused
                  ? '2px solid #fff'
                  : isDepot
                  ? '2px dashed rgba(255,255,255,0.7)'
                  : '2px solid rgba(255,255,255,0.3)',
                boxShadow:      `0 0 0 ${isSelected || isFocused ? 6 : 3}px ${color}${isFocused ? '99' : isDepot ? '22' : '44'}`,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       isSelected || isFocused ? 9 : 8,
                fontWeight:     700,
                color:          'white',
                cursor:         'pointer',
                transition:     'all 0.2s',
                fontFamily:     'Space Grotesk, sans-serif',
                letterSpacing:  '-0.3px',
                userSelect:     'none',
                opacity:        isDimmed ? 0.22 : isDepot ? 0.6 : 1,
              }}
            >
              {train.line}
            </div>
          </Marker>
        )
      })}

      {/* Floating active line filter pill */}
      {focusedLine && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            zIndex: 30,
            background: 'var(--bg2)',
            border: '1px solid var(--accent)',
            borderRadius: 20,
            padding: '5px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 15px rgba(0,0,0,0.35)',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Filtre:</span>
          <span
            style={{
              background: lineColors[focusedLine] || LINE_COLORS[focusedLine] || '#7a82a0',
              color: '#fff',
              fontWeight: 700,
              fontSize: 11,
              padding: '2px 7px',
              borderRadius: 5,
              fontFamily: 'var(--font-space-grotesk)',
            }}
          >
            {focusedLine}
          </span>
          {onClearFocusedLine && (
            <button
              onClick={onClearFocusedLine}
              title="Treure filtre"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontSize: 13,
                lineHeight: 1,
                padding: 0,
                marginLeft: 2,
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}
    </Map>
  )
}
