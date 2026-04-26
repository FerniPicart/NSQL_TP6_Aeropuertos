import { MapContainer, TileLayer } from 'react-leaflet'
import { useMap, useMapEvents } from 'react-leaflet'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import type { Map as LeafletMap } from 'leaflet'
import type { Airport } from '../types'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8000')
const MAP_MIN_LAT = -60
const MAP_MAX_LAT = 85
const WORLD_BOUNDS: [[number, number], [number, number]] = [[MAP_MIN_LAT, -180], [MAP_MAX_LAT, 180]]

interface MapViewProps {
  searchTerm: string
  nearbyLimit: number | null
  focusAirport: { iata: string; name: string; lat: number; lng: number } | null
  focusLocation: { lat: number; lng: number } | null
  onFocusHandled: () => void
  onLocationHandled: () => void
}

interface BBox {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

interface BoundsListenerProps {
  onBoundsChange: (bbox: BBox) => void
}

interface AirportsClusterLayerProps {
  airports: Airport[]
  focusAirport: { iata: string; name: string; lat: number; lng: number } | null
  onFocusHandled: () => void
}

interface CenterTrackerProps {
  onCenterChange: (lat: number, lng: number, zoom: number) => void
}

interface MapLocationFocusProps {
  location: { lat: number; lng: number } | null
  onHandled: () => void
}

interface MarkerClusterGroupLike extends L.Layer {
  addLayer: (layer: L.Layer) => MarkerClusterGroupLike
  clearLayers: () => MarkerClusterGroupLike
}

interface MarkerClusterFactory {
  markerClusterGroup: (options?: {
    showCoverageOnHover?: boolean
    spiderfyOnMaxZoom?: boolean
  }) => MarkerClusterGroupLike
}

function renderAirportPopup(airport: Airport) {
  const airportCode = airport.iata ?? airport.icao ?? 'N/A'

  return `
    <div style="font-size: 0.875rem; line-height: 1.25rem;">
      <strong style="font-size: 1.125rem;">${airport.name}</strong><br />
      <strong>Ciudad:</strong> ${airport.city ?? 'N/A'}<br />
      <strong>IATA:</strong> ${airport.iata ?? 'N/A'}<br />
      <strong>ICAO:</strong> ${airport.icao ?? 'N/A'}<br />
      <strong>Codigo usado:</strong> ${airportCode}<br />
      <strong>Lat/Lng:</strong> ${airport.lat.toFixed(5)}, ${airport.lng.toFixed(5)}<br />
      ${airport.distance_km !== undefined ? `<strong>Distancia:</strong> ${airport.distance_km.toFixed(2)} km<br />` : ''}
      <strong>Altitud:</strong> ${airport.alt} ft
    </div>
  `
}

function normalizeBbox(targetMap: LeafletMap): BBox {
  const bounds = targetMap.getBounds()
  const northEast = bounds.getNorthEast()
  const southWest = bounds.getSouthWest()

  const minLat = Math.max(MAP_MIN_LAT, southWest.lat)
  const maxLat = Math.min(MAP_MAX_LAT, northEast.lat)

  const clampedMinLng = Math.max(-180, southWest.lng)
  const clampedMaxLng = Math.min(180, northEast.lng)

  if (clampedMinLng > clampedMaxLng) {
    return {
      minLng: -180,
      minLat,
      maxLng: 180,
      maxLat
    }
  }

  return {
    minLng: clampedMinLng,
    minLat,
    maxLng: clampedMaxLng,
    maxLat
  }
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().toLowerCase()
}

function matchesAirportSearch(airport: Airport, searchTerm: string) {
  const normalizedSearch = normalizeText(searchTerm)
  if (!normalizedSearch) {
    return true
  }

  return [airport.name, airport.city, airport.iata, airport.icao ?? '']
    .some((field) => normalizeText(field).includes(normalizedSearch))
}

function distanceKmBetweenPoints(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadiusKm = 6371
  const deltaLat = toRadians(lat2 - lat1)
  const deltaLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRadians(value: number) {
  return value * Math.PI / 180
}

function BoundsListener({ onBoundsChange }: BoundsListenerProps) {
  const map = useMap()

  const emitBounds = useCallback((targetMap: LeafletMap) => {
    onBoundsChange(normalizeBbox(targetMap))
  }, [onBoundsChange])

  useMapEvents({
    moveend: (event) => emitBounds(event.target),
    zoomend: (event) => emitBounds(event.target)
  })

  useEffect(() => {
    emitBounds(map)
  }, [map, emitBounds])

  return null
}

function CenterTracker({ onCenterChange }: CenterTrackerProps) {
  const map = useMap()

  const emitCenter = useCallback((targetMap: LeafletMap) => {
    const center = targetMap.getCenter()
    onCenterChange(center.lat, center.lng, targetMap.getZoom())
  }, [onCenterChange])

  useMapEvents({
    moveend: (event) => emitCenter(event.target),
    zoomend: (event) => emitCenter(event.target)
  })

  useEffect(() => {
    emitCenter(map)
  }, [map, emitCenter])

  return null
}

function MapLocationFocus({ location, onHandled }: MapLocationFocusProps) {
  const map = useMap()
  const lastLocationKey = useRef<string | null>(null)

  useEffect(() => {
    if (!location) {
      lastLocationKey.current = null
      return
    }

    const locationKey = `${location.lat},${location.lng}`
    if (lastLocationKey.current === locationKey) {
      return
    }

    map.setView([location.lat, location.lng], 4, { animate: false })
    lastLocationKey.current = locationKey
    onHandled()
  }, [location, map, onHandled])

  return null
}

function AirportsClusterLayer({ airports, focusAirport, onFocusHandled }: AirportsClusterLayerProps) {
  const map = useMap()
  const queryClient = useQueryClient()

  useEffect(() => {
    const markerClusterGroup = (L as unknown as MarkerClusterFactory).markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true
    })

    airports.forEach((airport) => {
      const marker = L.marker([airport.lat, airport.lng], { icon: createAirportIcon() })
      marker.bindPopup('<div style="font-size: 0.875rem;">Cargando detalle...</div>')

      marker.on('click', async () => {
        const identifier = airport.iata ?? airport.icao

        if (!identifier) {
          marker.setPopupContent('<div style="font-size: 0.875rem; color: #b91c1c;">Aeropuerto sin IATA/ICAO para consultar detalle.</div>')
          marker.openPopup()
          return
        }

        map.setView([airport.lat, airport.lng], Math.max(map.getZoom(), 10), { animate: false })
        marker.setPopupContent('<div style="font-size: 0.875rem;">Cargando detalle...</div>')
        marker.openPopup()

        try {
          const res = await axios.get<Airport>(`${API_URL}/airports/${identifier}`)
          queryClient.invalidateQueries({ queryKey: ['popular'] })
          const airportDetail: Airport = {
            ...res.data,
            distance_km: airport.distance_km
          }
          marker.setPopupContent(renderAirportPopup(airportDetail))
          marker.openPopup()
        } catch {
          marker.setPopupContent('<div style="font-size: 0.875rem; color: #b91c1c;">No se pudo cargar el detalle del aeropuerto.</div>')
          marker.openPopup()
        }
      })

      markerClusterGroup.addLayer(marker)
    })

    map.addLayer(markerClusterGroup)

    if (focusAirport) {
      const target = airports.find((airport) => airport.iata === focusAirport.iata) ?? focusAirport
      map.setView([target.lat, target.lng], Math.max(map.getZoom(), 11), { animate: false })
      onFocusHandled()
    }

    return () => {
      markerClusterGroup.clearLayers()
      map.removeLayer(markerClusterGroup)
    }
  }, [airports, focusAirport, map, onFocusHandled, queryClient])

  return null
}

export default function MapView({
  searchTerm,
  nearbyLimit,
  focusAirport,
  focusLocation,
  onFocusHandled,
  onLocationHandled
}: MapViewProps) {
  const [bbox, setBbox] = useState<BBox | null>(null)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number; zoom: number }>({
    lat: -6.08,
    lng: 145.39,
    zoom: 8
  })

  const handleCenterChange = useCallback((lat: number, lng: number, zoom: number) => {
    setMapCenter({ lat, lng, zoom })
  }, [])

  const handleBoundsChange = useCallback((nextBbox: BBox) => {
    setBbox(nextBbox)
  }, [])

  const bboxParam = useMemo(() => {
    if (!bbox) return null
    return `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`
  }, [bbox])

  const { data: airports = [], isLoading, isFetching } = useQuery<Airport[]>({
    queryKey: ['airports-bbox', bboxParam],
    enabled: Boolean(bboxParam),
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/airports`, {
        params: {
          bbox: bboxParam
        }
      })

      return res.data
    },
    placeholderData: (previousData) => previousData
  })

  const filteredAirports = useMemo(() => {
    let nextAirports = airports.filter((airport) => matchesAirportSearch(airport, searchTerm))

    if (nearbyLimit !== null) {
      nextAirports = [...nextAirports]
        .sort((leftAirport, rightAirport) => {
          const leftDistance = distanceKmBetweenPoints(
            mapCenter.lat,
            mapCenter.lng,
            leftAirport.lat,
            leftAirport.lng
          )
          const rightDistance = distanceKmBetweenPoints(
            mapCenter.lat,
            mapCenter.lng,
            rightAirport.lat,
            rightAirport.lng
          )

          return leftDistance - rightDistance
        })
        .slice(0, nearbyLimit)
    }

    return nextAirports
  }, [airports, mapCenter.lat, mapCenter.lng, nearbyLimit, searchTerm])

  const searchKey = useMemo(() => searchTerm.trim().length > 0 ? searchTerm.trim() : null, [searchTerm])
  const filterSummary = useMemo(() => {
    const pieces: string[] = []

    if (searchKey) {
      pieces.push(`Texto: ${searchKey}`)
    }

    if (nearbyLimit !== null) {
      pieces.push(`Cercanos: ${nearbyLimit}`)
    }

    if (pieces.length === 0) {
      pieces.push('Mostrando todos los aeropuertos visibles')
    }

    return pieces
  }, [nearbyLimit, searchKey])

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[-6.08, 145.39]}
        zoom={8}
        className="h-full w-full"
        scrollWheelZoom
        inertia={false}
        zoomAnimation={false}
        maxBounds={WORLD_BOUNDS}
        maxBoundsViscosity={1.0}
        worldCopyJump={false}
      >
        <CenterTracker onCenterChange={handleCenterChange} />
        <BoundsListener onBoundsChange={handleBoundsChange} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          noWrap
        />
        <MapLocationFocus location={focusLocation} onHandled={onLocationHandled} />
        <AirportsClusterLayer airports={filteredAirports} focusAirport={focusAirport} onFocusHandled={onFocusHandled} />
      </MapContainer>

      <div className="absolute bottom-3 left-3 z-[1000] rounded-md bg-white/95 px-3 py-2 text-xs shadow-md border border-gray-200">
        <div><strong>Centro</strong></div>
        <div>Lat: {mapCenter.lat.toFixed(5)}</div>
        <div>Lng: {mapCenter.lng.toFixed(5)}</div>
        <div>Zoom: {mapCenter.zoom}</div>
        <div className="mt-2 text-gray-600">
          {filterSummary.map((item) => (
            <div key={item}>{item}</div>
          ))}
        </div>
      </div>

      {(isLoading || isFetching) && (
        <div className="pointer-events-none absolute top-3 right-3 z-[1000] rounded-md bg-white/95 px-3 py-2 text-xs shadow-md border border-gray-200">
          Cargando aeropuertos...
        </div>
      )}
    </div>
  )
}

function createAirportIcon() {
  return L.divIcon({
    className: 'airport-div-icon',
    html: '<div style="width:30px;height:30px;border-radius:9999px;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.25);border:2px solid #fff;font-size:16px;">✈</div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -12]
  })
}