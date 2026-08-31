import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { readJson, writeJson } from '../utils/storage'

export const BUILDING_TYPES = [
  { id: 'tavern',      label: 'Tavern',       emoji: '🍺', desc: 'Restaurant, bar or café' },
  { id: 'keep',        label: 'Keep',         emoji: '🏰', desc: 'Home or headquarters' },
  { id: 'temple',      label: 'Temple',       emoji: '⛪', desc: 'Gym, hospital or place of worship' },
  { id: 'market',      label: 'Market',       emoji: '🛒', desc: 'Store or shopping' },
  { id: 'scriptorium', label: 'Scriptorium',  emoji: '📚', desc: 'Library or school' },
  { id: 'tower',       label: 'Mage Tower',   emoji: '🔮', desc: 'Office or place of learning' },
  { id: 'barracks',    label: 'Barracks',     emoji: '⚔️', desc: 'Training or workplace' },
  { id: 'grove',       label: 'Grove',        emoji: '🌳', desc: 'Park or outdoor area' },
  { id: 'docks',       label: 'Docks',        emoji: '⚓', desc: 'Transit or travel hub' },
  { id: 'waypoint',    label: 'Waypoint',     emoji: '🗺️', desc: 'Landmark or meeting point' },
  { id: 'forge',       label: 'Forge',        emoji: '🔨', desc: 'Hardware store, auto repair' },
  { id: 'apothecary',  label: 'Apothecary',   emoji: '⚗️', desc: 'Pharmacy or dispensary' },
  { id: 'guildhall',   label: 'Guild Hall',   emoji: '🏛️', desc: 'Community centre or co-working' },
  { id: 'citadel',     label: 'Citadel',      emoji: '🗼', desc: 'Government building or courthouse' },
  { id: 'inn',         label: "Wayfarer's Inn", emoji: '🛏️', desc: 'Hotel or lodging' },
  { id: 'stables',     label: 'Stables',      emoji: '🐎', desc: 'Parking garage or car dealership' },
]

const SIZE_TIERS = [
  { key: 'sm', label: 'Small',  hint: 'Cottage, corner shop',      dim: 40 },
  { key: 'md', label: 'Medium', hint: 'Neighbourhood landmark',    dim: 56 },
  { key: 'lg', label: 'Large',  hint: 'Grand civic building',      dim: 72 },
]

function getBuildingType(id) {
  return BUILDING_TYPES.find(b => b.id === id) ?? { id: 'waypoint', label: 'Location', emoji: '📍' }
}

function getPinDisplay(pin) {
  if (pin.buildingType) {
    const bt = getBuildingType(pin.buildingType)
    return { emoji: bt.emoji, name: pin.label || bt.label, typeLabel: bt.label }
  }
  // Backward-compat: old-format task/event pins
  return {
    emoji: pin.type === 'task' ? '⚔️' : '📅',
    name: pin.title || 'Location',
    typeLabel: pin.type === 'task' ? 'Quest' : 'Mission',
  }
}

// Building art is rendered as a georeferenced image (L.imageOverlay) bound to a
// small lat/lng box, NOT a screen-anchored marker icon. This is the difference
// between "a sticker floating over the map" and "an object that belongs to the
// map": an imageOverlay is projected and scaled by Leaflet's own tile-projection
// math on every pan/zoom frame — the exact same code path the base map tiles
// use — so it can never visibly desync from the ground beneath it. A marker's
// pixel position/size, by contrast, is only ever an approximation of that math
// computed separately in JS, which is what caused the "floating" feel before.
//
// REF_ZOOM is only used once, to convert a tier's pixel size into a real-world
// footprint (a fixed lat/lng box) — after that, Leaflet scales the box exactly
// like it scales a tile, with no ongoing JS involvement at all.
const REF_ZOOM = 16
const EARTH_CIRCUMFERENCE_M = 40075016.686

function metersPerPixel(lat, zoom) {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom + 8)
}

// Places `lat,lng` at the bottom-center of the box (like a building's footprint
// resting on its coordinate) and sizes the box so it renders `dimPx` wide at
// REF_ZOOM — at any other zoom it scales exactly as the map tiles do.
function boundsForPin(lat, lng, dimPx) {
  const meters = dimPx * metersPerPixel(lat, REF_ZOOM)
  const latPerMeter = 1 / 111320
  const lngPerMeter = 1 / (111320 * Math.cos((lat * Math.PI) / 180))
  const south = lat
  const north = lat + meters * latPerMeter
  const west = lng - (meters / 2) * lngPerMeter
  const east = lng + (meters / 2) * lngPerMeter
  return L.latLngBounds([south, west], [north, east])
}

// The label stays a small, fixed-size, always-legible marker — unlike the
// building art, text SHOULD stay readable at any zoom rather than shrinking
// into nothing, the same way place-name labels behave on any map.
function makeLabelIcon(name) {
  return L.divIcon({
    html: `<div class="map-building-pin-label">${name.slice(0, 16)}</div>`,
    className: '',
    iconSize: [90, 20],
    iconAnchor: [45, -6],
  })
}

// Chimney smoke — a small CSS particle overlay, NOT baked into the building's
// AI-animated video. rembg's segmentation (even with alpha matting) truncates
// a flowing smoke plume down to almost nothing, because it's built to isolate
// "the solid object" and treats faint/diffuse regions as background. A cheap,
// controllable CSS puff loop (same technique as the map's weather rain/snow
// particles) sidesteps that limitation entirely. Fixed screen-pixel size like
// the label — smoke doesn't need to track ground scale precisely.
const SMOKE_BUILDINGS = new Set(['tavern'])
function makeSmokeIcon(dimPx) {
  const puffs = [0, 1, 2, 3].map(i => {
    const delay = (i * 0.9).toFixed(1)
    const drift = 4 + i * 2
    return `<div class="qm-chimney-puff" style="animation-delay:${delay}s;--drift:${drift}px"></div>`
  }).join('')
  return L.divIcon({
    html: `<div class="qm-chimney-smoke">${puffs}</div>`,
    className: '',
    iconSize: [1, 1],
    // Anchored near the pin's base, offset up-and-right toward roughly where
    // a chimney sits on this building's art. Tune per-building if this set
    // grows beyond the tavern.
    iconAnchor: [-Math.round(dimPx * 0.18), Math.round(dimPx * 0.9)],
  })
}

// Emoji fallback for building types without art yet (or if the PNG 404s) —
// a plain screen-anchored marker, same as any other simple map pin.
function makeEmojiIcon(emoji, dimPx = 40) {
  return L.divIcon({
    html: `<div class="map-building-pin"><span class="map-building-emoji" style="font-size:${Math.round(dimPx * 0.6)}px">${emoji}</span></div>`,
    className: '',
    iconSize: [dimPx + 16, dimPx + 16],
    iconAnchor: [(dimPx + 16) / 2, dimPx + 16],
  })
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`
}

// Night mode — 'auto' follows the device's local clock/timezone (new Date()
// is always local), 'day'/'night' pin it for dev testing regardless of the
// real time. No astronomical sunset/sunrise calc — a fixed hour band is
// simple, predictable, and good enough for the map's mood lighting.
const NIGHT_MODE_KEY = 'qm_map_night_mode' // 'auto' | 'day' | 'night'
function isNightNow(setting) {
  if (setting === 'day') return false
  if (setting === 'night') return true
  const hour = new Date().getHours()
  return hour < 6 || hour >= 19
}

// Weather — cached locally so leaving the map open doesn't re-hit the API
// every render; still refreshed periodically since conditions do change.
const WEATHER_CACHE_KEY = 'qm_weather_cache'
const WEATHER_TTL_MS = 20 * 60 * 1000
const WEATHER_EMOJI = {
  rain: '🌧️', snow: '🌨️', fog: '🌫️', storm: '⛈️',
  'partly-cloudy': '⛅', overcast: '☁️', clear: '☀️',
}

function makeParticles(count, durationRange, delayRange) {
  return Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    duration: durationRange[0] + Math.random() * (durationRange[1] - durationRange[0]),
    delay: Math.random() * delayRange,
  }))
}

// Asymmetric border-radius blob — the classic CSS trick for an irregular,
// organic outline instead of a circle/oval. Randomized per cloud so no two
// clusters share a silhouette, and re-randomized independently for the two
// radius axes so the shape doesn't come out symmetric either.
function randomBlobRadius() {
  const r = () => Math.round(35 + Math.random() * 35) // 35–70%
  return `${r()}% ${r()}% ${r()}% ${r()}% / ${r()}% ${r()}% ${r()}% ${r()}%`
}

// Cloud clusters for partly-cloudy/overcast — pale, variably translucent
// shapes drifting across the map, letting terrain show through unevenly.
// Overcast reuses the exact same shapes, just denser/larger/more opaque, so
// it reads as "the whole sky is this" rather than a different effect.
function makeCloudPatches(count, { minSize, maxSize, minOpacity, maxOpacity, minDuration, maxDuration }) {
  return Array.from({ length: count }, () => ({
    top: Math.random() * 80,
    size: minSize + Math.random() * (maxSize - minSize),
    duration: minDuration + Math.random() * (maxDuration - minDuration),
    delay: -Math.random() * maxDuration, // negative delay staggers starting positions
    opacity: minOpacity + Math.random() * (maxOpacity - minOpacity),
    borderRadius: randomBlobRadius(),
  }))
}
// Opacity ranges tuned 2026-07-04 — the originals (up to 0.85 for overcast)
// made the map underneath nearly unreadable on cloudy days, defeating the
// point of being able to work with the map without switching weather.
const CLOUD_DENSITY = {
  'partly-cloudy': { count: 8, minSize: 130, maxSize: 280, minOpacity: 0.20, maxOpacity: 0.38, minDuration: 40, maxDuration: 80 },
  overcast: { count: 12, minSize: 180, maxSize: 380, minOpacity: 0.28, maxOpacity: 0.48, minDuration: 60, maxDuration: 120 },
}

export default function WorldMap({ tasks = [], events = [], locations = {}, onPinAdded, onPinRemoved }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const heroMarkerRef = useRef(null)
  const pinMarkersRef = useRef({})
  const placingModeRef = useRef(false)

  const [mapReady, setMapReady] = useState(false)
  const [heroPos, setHeroPos] = useState(null)
  const [geoError, setGeoError] = useState(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [activePin, setActivePin] = useState(null)
  const geoRequestIdRef = useRef(0)

  // Placement flow
  const [placingMode, setPlacingMode] = useState(false)
  const [pendingLatLng, setPendingLatLng] = useState(null)
  const [placementStep, setPlacementStep] = useState(null) // 'type' | 'details'
  const [selectedType, setSelectedType] = useState(null)
  const [selectedSize, setSelectedSize] = useState('md')
  const [buildingLabel, setBuildingLabel] = useState('')
  const [linkedQuestId, setLinkedQuestId] = useState('')
  const [linkedQuestType, setLinkedQuestType] = useState('')

  const [showLabels, setShowLabels] = useState(true)

  // Night mode — see isNightNow() above for the 'auto' rule.
  const [nightModeSetting, setNightModeSetting] = useState(() => readJson(NIGHT_MODE_KEY, 'auto'))
  const [isNight, setIsNight] = useState(() => isNightNow(readJson(NIGHT_MODE_KEY, 'auto')))
  useEffect(() => {
    writeJson(NIGHT_MODE_KEY, nightModeSetting)
    setIsNight(isNightNow(nightModeSetting))
    if (nightModeSetting !== 'auto') return
    // Re-check periodically so a session left open across dusk/dawn still
    // transitions without needing a reload.
    const id = setInterval(() => setIsNight(isNightNow(nightModeSetting)), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [nightModeSetting])
  function cycleNightMode() {
    setNightModeSetting(m => (m === 'auto' ? 'day' : m === 'day' ? 'night' : 'auto'))
  }

  // Weather — only ever queried for wherever the hero actually is (not the
  // current map viewport), since that's the only location the player cares
  // about seeing reflected on their own map.
  const [weather, setWeather] = useState(() => readJson(WEATHER_CACHE_KEY, null))
  useEffect(() => {
    if (!heroPos) return
    let cancelled = false
    async function loadWeather() {
      const cached = readJson(WEATHER_CACHE_KEY, null)
      const fresh = cached
        && Date.now() - cached.fetchedAt < WEATHER_TTL_MS
        && Math.abs(cached.lat - heroPos.lat) < 0.05
        && Math.abs(cached.lng - heroPos.lng) < 0.05
      if (fresh) { setWeather(cached); return }
      try {
        const res = await fetch(`/api/weather?lat=${heroPos.lat}&lng=${heroPos.lng}`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled) return
        const entry = { condition: data.condition, isDay: data.isDay, lat: heroPos.lat, lng: heroPos.lng, fetchedAt: Date.now() }
        setWeather(entry)
        writeJson(WEATHER_CACHE_KEY, entry)
      } catch {}
    }
    loadWeather()
    const id = setInterval(loadWeather, WEATHER_TTL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [heroPos?.lat, heroPos?.lng])

  // Dev preview override — cycle through every condition on demand, since
  // waiting for actual rain/snow/storms to test the animations isn't
  // practical. 'auto' defers to the real fetched weather.
  const WEATHER_PREVIEW_OPTIONS = ['auto', 'clear', 'partly-cloudy', 'overcast', 'rain', 'snow', 'fog', 'storm']
  const [weatherPreview, setWeatherPreview] = useState('auto')
  const displayWeather = weatherPreview !== 'auto'
    ? { condition: weatherPreview, isDay: weather?.isDay ?? true }
    : weather
  function cycleWeatherPreview() {
    setWeatherPreview(p => WEATHER_PREVIEW_OPTIONS[(WEATHER_PREVIEW_OPTIONS.indexOf(p) + 1) % WEATHER_PREVIEW_OPTIONS.length])
  }

  const rainDrops = useMemo(() => makeParticles(70, [0.6, 1.1], 2), [displayWeather?.condition])
  const snowFlakes = useMemo(() => makeParticles(50, [4, 8], 5), [displayWeather?.condition])
  const cloudPatches = useMemo(() => {
    const density = CLOUD_DENSITY[displayWeather?.condition]
    return density ? makeCloudPatches(density.count, density) : []
  }, [displayWeather?.condition])

  // Lightning — irregular flashes, storm only. Timers, not CSS keyframes,
  // because real lightning doesn't repeat on a fixed beat.
  const [lightning, setLightning] = useState(false)
  useEffect(() => {
    if (displayWeather?.condition !== 'storm') return
    let flashTimeout, offTimeout
    function scheduleFlash() {
      flashTimeout = setTimeout(() => {
        setLightning(true)
        offTimeout = setTimeout(() => setLightning(false), 150)
        scheduleFlash()
      }, 4000 + Math.random() * 8000)
    }
    scheduleFlash()
    return () => { clearTimeout(flashTimeout); clearTimeout(offTimeout) }
  }, [displayWeather?.condition])

  // Address search
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Keep ref in sync so the Leaflet click handler always sees current value
  useEffect(() => { placingModeRef.current = placingMode }, [placingMode])

  // Initialize Leaflet map
  useEffect(() => {
    if (mapRef.current) return
    // zoomSnap/zoomDelta below 1 let scroll-wheel and +/- zoom move in fractional
    // steps instead of only whole integers, for a smoother overall feel closer
    // to pinch-zoom on mobile (building art itself now scales natively via
    // imageOverlay regardless of zoom granularity — see boundsForPin above).
    const map = L.map(containerRef.current, {
      center: [20, 0], zoom: 2, zoomControl: false,
      zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 100,
    })
    // Stadia auth is domain-based: the deployed domain is registered in the
    // Stadia dashboard and localhost is allowed keyless, so tile URLs normally
    // carry no credential at all. The key must only be appended when one is
    // actually set — an unconditional `?api_key=${KEY}` sent the literal string
    // "undefined" when unset, and an explicit bad key makes Stadia reject the
    // request outright rather than falling through to domain auth. That is what
    // turned a stale key into a hard 401 on every tile.
    const KEY = import.meta.env.VITE_STADIA_API_KEY
    const AUTH = KEY ? `?api_key=${KEY}` : ''

    map.createPane('tonerLabelsPane')
    map.getPane('tonerLabelsPane').style.zIndex = 300
    map.getPane('tonerLabelsPane').style.pointerEvents = 'none'

    const watercolor = L.tileLayer(
      `https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg${AUTH}`,
      {
        attribution: 'Map tiles by <a href="http://stamen.com" target="_blank">Stamen Design</a>, CC BY 3.0 — Data © <a href="http://openstreetmap.org" target="_blank">OpenStreetMap</a>',
        maxNativeZoom: 16, maxZoom: 19,
      }
    ).addTo(map)

    const tonerLines = L.tileLayer(
      `https://tiles.stadiamaps.com/tiles/stamen_toner_lines/{z}/{x}/{y}.png${AUTH}`,
      { opacity: 0.45, maxNativeZoom: 16, maxZoom: 19 }
    ).addTo(map)

    const tonerLabels = L.tileLayer(
      `https://tiles.stadiamaps.com/tiles/stamen_toner_labels/{z}/{x}/{y}.png${AUTH}`,
      { pane: 'tonerLabelsPane', opacity: 0.6, maxNativeZoom: 16, maxZoom: 19 }
    ).addTo(map)

    // A deployment on a domain that isn't registered with Stadia (and with no
    // key) gets 401s for every tile, which left a blank void. If Stadia errors
    // before a single tile has loaded, swap to plain OpenStreetMap so the map
    // always works; transient errors after a successful load don't trigger it.
    let stadiaLoaded = false
    let fellBack = false
    watercolor.on('tileload', () => { stadiaLoaded = true })
    watercolor.on('tileerror', () => {
      if (stadiaLoaded || fellBack) return
      fellBack = true
      console.warn('Stadia tiles unavailable (domain not registered with Stadia and no API key set) — falling back to OpenStreetMap.')
      ;[watercolor, tonerLines, tonerLabels].forEach(l => map.removeLayer(l))
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="http://openstreetmap.org" target="_blank">OpenStreetMap</a> contributors',
        maxNativeZoom: 19, maxZoom: 19,
      }).addTo(map)
    })

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    map.on('click', (e) => {
      if (!placingModeRef.current) return
      placingModeRef.current = false
      setPlacingMode(false)
      setPendingLatLng({ lat: e.latlng.lat, lng: e.latlng.lng })
      setPlacementStep('type')
    })

    // Leaflet initialises with the container at 0px height (flex: 1 child).
    // invalidateSize() alone isn't enough — we also need setView({reset:true})
    // to force tile layers to reload into the now-visible area.
    let ready = false
    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height ?? 0
      if (h <= 0) return
      map.invalidateSize()
      if (!ready) {
        // First time the container has real height: force a full tile reload
        // into the now-visible area, then mark the map usable.
        ready = true
        map.setView(map.getCenter(), map.getZoom(), { reset: true })
        setMapReady(true)
      }
    })
    observer.observe(containerRef.current)

    mapRef.current = map
    return () => { observer.disconnect(); map.remove(); mapRef.current = null }
  }, [])

  // Geolocation — desktop browsers resolve position via slower WiFi/IP-based
  // lookups (no GPS chip), which can take well over 10s; a short timeout here
  // reads as "centering is broken" when it's actually still working. A request
  // id guards against the auto-locate-on-mount call and a manual 📍 retry
  // racing each other and one clobbering the other's more recent result.
  //
  // macOS's location daemon can be flaky about producing a *fresh* fix on
  // demand — observed hanging the full timeout for both regular Chrome tabs
  // and installed Chrome PWAs alike, with no separate OS permission to grant
  // (a PWA runs as the same Chrome process, just a different launch mode).
  // Three-stage fallback: fresh fix → any cached fix, however old → IP-based
  // geolocation via /api/iplocate (city-level only, but doesn't touch the
  // flaky OS location daemon at all, so it works even when that's stuck).
  function runGeolocate() {
    if (!navigator.geolocation) { setGeoError('Location not supported in this browser'); return }
    const requestId = ++geoRequestIdRef.current
    setGeoLoading(true)
    setGeoError(null)

    const onSuccess = ({ coords: { latitude: lat, longitude: lng } }) => {
      if (requestId !== geoRequestIdRef.current) return
      setGeoLoading(false)
      setHeroPos({ lat, lng })
      mapRef.current?.flyTo([lat, lng], 16, { duration: 1.5 })
    }

    async function tryIpFallback() {
      try {
        const res = await fetch('/api/iplocate')
        if (!res.ok) throw new Error('iplocate failed')
        const { lat, lng } = await res.json()
        if (requestId !== geoRequestIdRef.current) return
        setGeoLoading(false)
        setHeroPos({ lat, lng })
        mapRef.current?.flyTo([lat, lng], 12, { duration: 1.5 })
      } catch {
        if (requestId !== geoRequestIdRef.current) return
        setGeoLoading(false)
        setGeoError('Location unavailable — tap 📍 to retry')
      }
    }

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (requestId !== geoRequestIdRef.current) return
        if (err.code === 1) {
          // Permission errors won't be fixed by a stale cache or IP lookup.
          setGeoLoading(false)
          setGeoError('Location permission denied — enable it in Settings')
          return
        }
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          () => tryIpFallback(),
          { timeout: 5000, maximumAge: Infinity }
        )
      },
      { timeout: 20000, maximumAge: 60000 }
    )
  }

  useEffect(() => { runGeolocate() }, [])

  // Hero marker
  useEffect(() => {
    if (!mapReady || !heroPos || !mapRef.current) return
    heroMarkerRef.current?.remove()
    heroMarkerRef.current = L.marker([heroPos.lat, heroPos.lng], {
      icon: L.divIcon({ html: '<div class="map-hero-marker">🧙</div>', className: '', iconSize: [32, 32], iconAnchor: [16, 32] })
    }).addTo(mapRef.current)
  }, [heroPos, mapReady])

  // Building markers — add new, remove stale
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    Object.keys(pinMarkersRef.current).forEach(id => {
      if (!locations[id]) {
        pinMarkersRef.current[id].art.remove()
        pinMarkersRef.current[id].label.remove()
        pinMarkersRef.current[id].smoke?.remove()
        delete pinMarkersRef.current[id]
      }
    })
    Object.entries(locations).forEach(([id, pin]) => {
      if (pinMarkersRef.current[id]) return
      if (!Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) {
        // A pin with missing/corrupt coordinates would otherwise throw
        // Leaflet's "Invalid LatLng object" synchronously inside this loop,
        // which — with no error boundary above WorldMap — unmounts the
        // entire React tree, not just the map. Skip it and keep going so one
        // bad pin can't take down the whole app.
        console.warn(`Skipping pin "${id}" — invalid coordinates (lat: ${pin.lat}, lng: ${pin.lng})`)
        return
      }
      const map = mapRef.current
      const { emoji, name } = getPinDisplay(pin)
      const tier = SIZE_TIERS.find(t => t.key === (pin.size || 'md')) ?? SIZE_TIERS[1]

      const onClick = (e) => {
        L.DomEvent.stopPropagation(e)
        cancelPlacement()
        setActivePin({ id, ...pin })
      }

      let art
      if (pin.buildingType) {
        // Georeferenced image, not a marker icon — see boundsForPin for why.
        // Always request the "sm" art file regardless of the pin's chosen
        // size tier: the on-screen footprint is entirely controlled by the
        // geo bounds below (Leaflet stretches whatever image loads to fill
        // them), so a single source image serves every tier.
        const type = pin.buildingType
        const bounds = boundsForPin(pin.lat, pin.lng, tier.dim)
        const artClass = `map-building-art map-building-art--${type}`

        // Tier 1: animated WebP (only exists for buildings run through
        // /animate-building-icon — most 404 here and fall through to tier 2,
        // so this is a no-op for every building that hasn't been animated).
        art = L.imageOverlay(`/buildings/${type}-sm.webp`, bounds, { className: artClass, interactive: true }).addTo(map)
        art.on('error', () => {
          // Tier 2: static PNG (today's existing art, unchanged). Guarded —
          // if the map/pane is no longer in a valid state (e.g. this pin's
          // own effect run already aborted once and got retried), don't let
          // a fallback-tier failure crash the whole tree; drop to tier 3.
          try {
            art.remove()
            art = L.imageOverlay(`/buildings/${type}-sm.png`, bounds, { className: artClass, interactive: true }).addTo(map)
            art.on('click', onClick)
            pinMarkersRef.current[id].art = art
            art.on('error', () => {
              // Tier 3: emoji marker — no art for this building type at all.
              try {
                art.remove()
                art = L.marker([pin.lat, pin.lng], { icon: makeEmojiIcon(emoji, tier.dim) }).addTo(map)
                art.on('click', onClick)
                pinMarkersRef.current[id].art = art
              } catch (e) {
                console.warn(`Building art tier 3 (emoji) failed for pin "${id}":`, e)
              }
            })
          } catch (e) {
            console.warn(`Building art tier 2 (png) failed for pin "${id}":`, e)
          }
        })
      } else {
        // Legacy task/event pin with no building art at all.
        art = L.marker([pin.lat, pin.lng], { icon: makeEmojiIcon(emoji, tier.dim) }).addTo(map)
      }
      art.on('click', onClick)

      const label = L.marker([pin.lat, pin.lng], { icon: makeLabelIcon(name), interactive: true }).addTo(map)
      label.on('click', onClick)

      let smoke = null
      if (pin.buildingType && SMOKE_BUILDINGS.has(pin.buildingType)) {
        smoke = L.marker([pin.lat, pin.lng], { icon: makeSmokeIcon(tier.dim), interactive: false }).addTo(map)
      }

      pinMarkersRef.current[id] = { art, label, smoke }
    })
  }, [locations, mapReady])

  // Address search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) setSearchResults(await res.json())
      } catch {}
      setSearchLoading(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  function locateUser() {
    runGeolocate()
  }

  function selectSearchResult(r) {
    const lat = parseFloat(r.lat)
    const lng = parseFloat(r.lon)
    mapRef.current?.flyTo([lat, lng], 17, { duration: 1.2 })
    setSearchOpen(false)
    setSearchQuery('')
    setSearchResults([])
    // Drop user straight into placement at that address
    setTimeout(() => {
      setPendingLatLng({ lat, lng })
      setPlacementStep('type')
    }, 400)
  }

  function cancelPlacement() {
    setPendingLatLng(null)
    setPlacementStep(null)
    setSelectedType(null)
    setSelectedSize('md')
    setBuildingLabel('')
    setLinkedQuestId('')
    setLinkedQuestType('')
    setPlacingMode(false)
    placingModeRef.current = false
  }

  function confirmPlacement() {
    if (!pendingLatLng || !selectedType) return
    const id = linkedQuestId || `bld_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    onPinAdded?.(id, {
      lat: pendingLatLng.lat,
      lng: pendingLatLng.lng,
      buildingType: selectedType.id,
      size: selectedSize,
      label: buildingLabel.trim() || selectedType.label,
      questId: linkedQuestId || null,
      questType: linkedQuestType || null,
    })
    cancelPlacement()
  }

  const unlinkableItems = [
    ...tasks.map(t => ({ id: t.id, title: t.title || '(unnamed quest)', type: 'task' })),
    ...events.map(e => ({ id: e.id, title: e.summary || '(unnamed mission)', type: 'event' })),
  ].filter(item => !locations[item.id])

  return (
    <div className={`world-map-container${showLabels ? '' : ' map-no-labels'}${isNight ? ' map-night' : ''}`}>
      {/* className must stay static — Leaflet mutates this element's classList
          (adds leaflet-container etc.); letting React rewrite it would strip
          those and break the map's overflow clipping. Toggle on the parent. */}
      <div ref={containerRef} className="map-gl-root" />
      <div className="map-paper-overlay" />
      <div className="map-night-overlay" />
      <div className="map-vignette" />

      {/* Weather — sits above everything (buildings included), same as real
          weather sits between the viewer and the whole scene. */}
      {displayWeather && displayWeather.condition !== 'clear' && (
        <div className={`map-weather-layer map-weather-layer--${displayWeather.condition}`}>
          {(displayWeather.condition === 'rain' || displayWeather.condition === 'storm') && rainDrops.map((d, i) => (
            <div key={i} className="qm-rain-drop"
              style={{ left: `${d.left}%`, animationDuration: `${d.duration}s`, animationDelay: `${d.delay}s` }} />
          ))}
          {displayWeather.condition === 'snow' && snowFlakes.map((f, i) => (
            <div key={i} className="qm-snow-flake"
              style={{ left: `${f.left}%`, animationDuration: `${f.duration}s`, animationDelay: `${f.delay}s` }} />
          ))}
          {displayWeather.condition === 'fog' && (
            <>
              <div className="qm-fog-band qm-fog-band--1" />
              <div className="qm-fog-band qm-fog-band--2" />
            </>
          )}
          {(displayWeather.condition === 'partly-cloudy' || displayWeather.condition === 'overcast') && cloudPatches.map((c, i) => (
            <div key={i} className="qm-cloud-patch"
              style={{
                top: `${c.top}%`, width: `${c.size}px`, height: `${c.size * 0.55}px`,
                opacity: c.opacity, borderRadius: c.borderRadius,
                animationDuration: `${c.duration}s`, animationDelay: `${c.delay}s`,
              }} />
          ))}
          {displayWeather.condition === 'storm' && lightning && <div className="qm-lightning-flash" />}
        </div>
      )}
      {displayWeather && (
        <button
          className={`map-weather-badge${weatherPreview !== 'auto' ? ' map-weather-badge--preview' : ''}`}
          onClick={cycleWeatherPreview}
          title={weatherPreview !== 'auto'
            ? `Previewing: ${weatherPreview} (tap to cycle, real weather: ${weather?.condition || '…'})`
            : `Weather: ${displayWeather.condition} (auto — tap to preview other conditions)`}
        >
          {WEATHER_EMOJI[displayWeather.condition] || '🌡️'}
          {weatherPreview === 'auto' && <span className="map-weather-badge-auto-pip">🔄</span>}
        </button>
      )}

      {/* Compass rose */}
      <svg className="map-compass" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
        <circle cx="40" cy="40" r="38" fill="rgba(30,16,64,0.72)" stroke="#b8922a" strokeWidth="1.5"/>
        <polygon points="40,4 44,36 40,42 36,36" fill="#d4a843"/>
        <polygon points="40,76 44,44 40,38 36,44" fill="#8a6520"/>
        <polygon points="76,40 44,44 38,40 44,36" fill="#8a6520"/>
        <polygon points="4,40 36,44 42,40 36,36" fill="#8a6520"/>
        <circle cx="40" cy="40" r="5" fill="#d4a843" stroke="#b8922a" strokeWidth="1"/>
        <text x="40" y="18" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold" fontFamily="serif">N</text>
      </svg>

      {/* Address search */}
      <div className={`map-search-bar${searchOpen ? ' map-search-bar--open' : ''}`}>
        {searchOpen ? (
          <>
            <div className="map-search-row">
              <input
                className="map-search-input"
                placeholder="Search for a place…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
              />
              <button className="map-search-close" onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]) }}>✕</button>
            </div>
            {searchLoading && <div className="map-search-hint">Searching…</div>}
            {!searchLoading && searchResults.length === 0 && searchQuery.length > 2 && (
              <div className="map-search-hint">No results found</div>
            )}
            {searchResults.map((r, i) => (
              <div key={i} className="map-search-result" onClick={() => selectSearchResult(r)}>
                {r.display_name}
              </div>
            ))}
          </>
        ) : (
          <button className="map-search-btn" onClick={() => { setSearchOpen(true); cancelPlacement() }}>
            🔍 Search address
          </button>
        )}
      </div>

      {/* Placement mode hint */}
      {placingMode && (
        <div className="map-placement-hint">
          Tap the map to place your building
          <button className="map-placement-hint-cancel" onClick={cancelPlacement}>Cancel</button>
        </div>
      )}

      {/* Add building + locate buttons */}
      <div className="map-action-btns">
        <button
          className={`map-add-btn${placingMode ? ' map-add-btn--active' : ''}`}
          onClick={() => {
            setActivePin(null)
            setPlacingMode(v => !v)
          }}
          title="Place a building"
        >
          🏗️
        </button>
        <button className="map-relocate-btn" onClick={locateUser} title="Find my location" disabled={geoLoading}>
          {geoLoading ? '⏳' : '📍'}
        </button>
        <button
          className={`map-labels-btn${showLabels ? '' : ' map-labels-btn--off'}`}
          onClick={() => setShowLabels(v => !v)}
          title={showLabels ? 'Hide labels' : 'Show labels'}
        >🏷️</button>
        <button
          className="map-night-btn"
          onClick={cycleNightMode}
          title={`Day/night: ${nightModeSetting} (tap to cycle)`}
        >{nightModeSetting === 'auto' ? '🌗' : nightModeSetting === 'night' ? '🌙' : '☀️'}</button>
      </div>

      {geoError && <div className="map-geo-error">{geoError}</div>}

      {/* Active building info card */}
      {activePin && (() => {
        const { emoji, name, typeLabel } = getPinDisplay(activePin)
        return (
          <div className="map-info-card">
            <div className="map-info-card-header">
              {activePin.buildingType
                ? <img src={`/buildings/${activePin.buildingType}-sm.webp`} alt={typeLabel} className="map-info-card-img"
                    onError={e => {
                      const img = e.currentTarget
                      if (!img.dataset.fallback) {
                        img.dataset.fallback = '1'
                        img.src = `/buildings/${activePin.buildingType}-sm.png`
                      } else {
                        img.style.display='none'; img.nextSibling.style.display='inline'
                      }
                    }} />
                : null}
              <span className="map-info-card-emoji" style={activePin.buildingType ? {display:'none'} : {}}>{emoji}</span>
              <div>
                <div className="map-info-card-title">{name}</div>
                <div className="map-info-card-meta">
                  {typeLabel}
                  {activePin.size && ` · ${SIZE_TIERS.find(t => t.key === activePin.size)?.label ?? ''}`}
                  {heroPos && ` · ${formatDistance(haversineKm(heroPos.lat, heroPos.lng, activePin.lat, activePin.lng))}`}
                </div>
              </div>
            </div>
            <div className="map-info-card-actions">
              <button className="map-info-card-btn map-info-card-btn--danger" onClick={() => { onPinRemoved?.(activePin.id); setActivePin(null) }}>
                Remove
              </button>
              <button className="map-info-card-btn" onClick={() => setActivePin(null)}>Close</button>
            </div>
          </div>
        )
      })()}

      {/* Placement sheets */}
      {placementStep && (
        <>
          <div className="map-picker-backdrop" onClick={cancelPlacement} />

          {placementStep === 'type' && (
            <div className="map-picker-sheet">
              <div className="map-picker-title">🏗️ Choose Building Type</div>
              <div className="map-building-grid">
                {BUILDING_TYPES.map(bt => (
                  <button
                    key={bt.id}
                    className="map-building-tile"
                    onClick={() => {
                      setSelectedType(bt)
                      setBuildingLabel(bt.label)
                      setPlacementStep('details')
                    }}
                  >
                    <img src={`/buildings/${bt.id}-sm.webp`} alt={bt.label} className="map-building-tile-img"
                      onError={e => {
                        const img = e.currentTarget
                        if (!img.dataset.fallback) {
                          img.dataset.fallback = '1'
                          img.src = `/buildings/${bt.id}-sm.png`
                        } else {
                          img.style.display='none'; img.nextSibling.style.display='inline'
                        }
                      }} />
                    <span className="map-building-tile-emoji" style={{display:'none'}}>{bt.emoji}</span>
                    <span className="map-building-tile-label">{bt.label}</span>
                  </button>
                ))}
              </div>
              <button className="map-picker-cancel" onClick={cancelPlacement}>Cancel</button>
            </div>
          )}

          {placementStep === 'details' && selectedType && (
            <div className="map-picker-sheet">
              <div className="map-picker-title">{selectedType.emoji} Name this {selectedType.label}</div>
              <div className="map-details-field">
                <input
                  className="map-details-input"
                  value={buildingLabel}
                  onChange={e => setBuildingLabel(e.target.value)}
                  placeholder={selectedType.label}
                />
              </div>
              <div className="map-details-section-label">Size</div>
              <div className="map-size-picker">
                {SIZE_TIERS.map(t => (
                  <button
                    key={t.key}
                    className={`map-size-tile${selectedSize === t.key ? ' map-size-tile--selected' : ''}`}
                    onClick={() => setSelectedSize(t.key)}
                  >
                    <span className="map-size-tile-label">{t.label}</span>
                    <span className="map-size-tile-hint">{t.hint}</span>
                  </button>
                ))}
              </div>
              <div className="map-details-section-label">Link to quest (optional)</div>
              <div className="map-quest-list">
                <div
                  className={`map-quest-item${!linkedQuestId ? ' map-quest-item--selected' : ''}`}
                  onClick={() => { setLinkedQuestId(''); setLinkedQuestType('') }}
                >
                  <span>🏛️</span> Standalone location
                </div>
                {unlinkableItems.map(item => (
                  <div
                    key={item.id}
                    className={`map-quest-item${linkedQuestId === item.id ? ' map-quest-item--selected' : ''}`}
                    onClick={() => { setLinkedQuestId(item.id); setLinkedQuestType(item.type) }}
                  >
                    <span>{item.type === 'task' ? '⚔️' : '📅'}</span> {item.title}
                  </div>
                ))}
              </div>
              <div className="map-details-actions">
                <button className="map-details-btn-back" onClick={() => setPlacementStep('type')}>← Back</button>
                <button className="map-details-btn-confirm" onClick={confirmPlacement}>Place Building</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
