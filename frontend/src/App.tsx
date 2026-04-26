import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MapView from './components/MapView'
import PopularSidebar from './components/PopularSidebar'
import Header from './components/Header'
import { useState } from 'react'
import CreateAirportPanel from './components/CreateAirportPanel'
import DeleteAirportPanel from './components/DeleteAirportPanel'

interface FocusAirport {
  iata: string
  name: string
  lat: number
  lng: number
}

interface MapLocation {
  lat: number
  lng: number
}

type ViewMode = 'map' | 'create' | 'delete'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

function App() {
  const [searchTerm, setSearchTerm] = useState('')
  const [nearbyLimit, setNearbyLimit] = useState<number | null>(100)
  const [focusAirport, setFocusAirport] = useState<FocusAirport | null>(null)
  const [focusLocation, setFocusLocation] = useState<MapLocation | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('map')

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col h-screen">
        <div className="border-b bg-white px-6 py-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${viewMode === 'map'
                ? 'bg-blue-700 text-white'
                : 'bg-gray-100/60 text-blue-700 hover:bg-blue-600 hover:text-white'
              }`}
            >
              Mapa
            </button>
            <button
              type="button"
              onClick={() => setViewMode('create')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${viewMode === 'create'
                ? 'bg-green-700 text-white'
                : 'bg-gray-100/60 text-green-700 hover:bg-green-600 hover:text-white'
              }`}
            >
              Agregar aeropuerto
            </button>
            <button
              type="button"
              onClick={() => setViewMode('delete')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${viewMode === 'delete'
                ? 'bg-red-700 text-white'
                : 'bg-gray-100/60 text-red-700 hover:bg-red-600 hover:text-white'
              }`}
            >
              Eliminar aeropuerto
            </button>
          </div>
        </div>

        {viewMode === 'map' && (
          <>
            <Header
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              nearbyLimit={nearbyLimit}
              onApplyNearbyLimit={(limit) => {
                setNearbyLimit(limit)
              }}
              onCenterMap={(location) => {
                setFocusLocation(location)
              }}
            />

            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1">
                <MapView
                  searchTerm={searchTerm}
                  nearbyLimit={nearbyLimit}
                  focusAirport={focusAirport}
                  focusLocation={focusLocation}
                  onFocusHandled={() => setFocusAirport(null)}
                  onLocationHandled={() => setFocusLocation(null)}
                />
              </div>
              <div className="w-80 bg-white border-l shadow-xl overflow-auto">
                <PopularSidebar onSelectAirport={(airport) => setFocusAirport(airport)} />
              </div>
            </div>
          </>
        )}

        {viewMode === 'create' && (
          <div className="flex-1 overflow-auto bg-gray-50 p-6">
            <CreateAirportPanel />
          </div>
        )}

        {viewMode === 'delete' && (
          <div className="flex-1 overflow-auto bg-gray-50 p-6">
            <DeleteAirportPanel />
          </div>
        )}
      </div>
    </QueryClientProvider>
  )
}

export default App