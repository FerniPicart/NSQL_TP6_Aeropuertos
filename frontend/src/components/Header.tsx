import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import useDebounce from '../hooks/useDebounce'

const MAP_MIN_LAT = -60
const MAP_MAX_LAT = 85

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

interface HeaderProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
  nearbyLimit: number | null
  onApplyNearbyLimit: (limit: number) => void
  onCenterMap: (location: { lat: number; lng: number }) => void
}

export default function Header({
  searchTerm,
  setSearchTerm,
  nearbyLimit,
  onApplyNearbyLimit,
  onCenterMap
}: HeaderProps) {
  const [inputValue, setInputValue] = useState(searchTerm)
  const debouncedInput = useDebounce(inputValue, 300)
  const [lat, setLat] = useState('-6.08')
  const [lng, setLng] = useState('145.39')
  const [count, setCount] = useState('100')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setInputValue(searchTerm)
  }, [searchTerm])

  useEffect(() => {
    setSearchTerm(debouncedInput)
  }, [debouncedInput, setSearchTerm])

  const handleNearbyFromInputs = () => {
    const parsedCount = Number(count)

    if (!Number.isFinite(parsedCount) || parsedCount <= 0) {
      setError('La cantidad debe ser mayor a 0.')
      return
    }

    setError(null)
    onApplyNearbyLimit(Math.floor(parsedCount))
  }

  const handleCenterMap = () => {
    const parsedLat = Number(lat)
    const parsedLng = Number(lng)

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      setError('Latitud y longitud deben ser numericas.')
      return
    }

    const clampedLat = clamp(parsedLat, MAP_MIN_LAT, MAP_MAX_LAT)
    const clampedLng = clamp(parsedLng, -180, 180)

    if (clampedLat !== parsedLat) {
      setLat(String(clampedLat))
    }
    if (clampedLng !== parsedLng) {
      setLng(String(clampedLng))
    }

    setError(null)
    onCenterMap({ lat: clampedLat, lng: clampedLng })
  }

  return (
    <header className="bg-white border-b px-6 py-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:gap-6">
        <div className="flex items-center gap-2 shrink-0 pt-1">
          ✈️ <span className="text-2xl font-bold text-blue-700">Aeropuertos</span>
        </div>

        <div className="flex-1 flex flex-col gap-3">
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Filtrar por nombre, ciudad o IATA..."
              className="w-full pl-12 pr-6 py-3 border border-gray-300 rounded-3xl text-lg focus:outline-none focus:border-blue-500"
            />
          </div>

        </div>

        <div className="shrink-0 xl:pt-2 font-semibold tracking-wide text-blue-700 font-serif">
          TP6 - Bases de Datos NoSQL
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">Cercanos visibles</div>
              <div className="text-xs text-gray-500">Filtra los N aeropuertos más cercanos al centro del mapa.</div>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 border border-gray-200">
              {nearbyLimit ?? 'todos'} visibles
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="100"
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            />

            <button
              type="button"
              onClick={handleNearbyFromInputs}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-black"
            >
              Filtrar cercanos
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">Ir a coordenadas</div>
              <div className="text-xs text-gray-500">Solo centra el mapa en el punto indicado.</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="Lat"
              min={MAP_MIN_LAT}
              max={MAP_MAX_LAT}
              step="0.00001"
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            />
            <input
              type="number"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="Lng"
              min={-180}
              max={180}
              step="0.00001"
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            />

            <button
              type="button"
              onClick={handleCenterMap}
              className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-medium hover:bg-blue-800"
            >
              Centrar mapa
            </button>
          </div>
        </section>
      </div>

      {error && (
        <div className="mt-2 text-sm text-red-600">{error}</div>
      )}
    </header>
  )
}