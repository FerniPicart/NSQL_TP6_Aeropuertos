import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8000')

interface PopularItem {
  iata: string
  name: string
  lat: number
  lng: number
  visits: number
}

interface PopularSidebarProps {
  onSelectAirport: (airport: { iata: string; name: string; lat: number; lng: number }) => void
}

export default function PopularSidebar({ onSelectAirport }: PopularSidebarProps) {
  const { data: popular = [] } = useQuery<PopularItem[]>({
    queryKey: ['popular'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/airports/popular`, {
        params: { limit: 10 }
      })
      return res.data
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true
  })

  return (
    <div className="p-6 border-l border-gray-200 bg-white h-full overflow-auto">
      <h2 className="text-xl font-bold mb-6">🔥 Top 10 más visitados</h2>
      {popular.length === 0 && (
        <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-4">
          Todavia no hay visitas registradas. Hace click en un aeropuerto para generar popularidad.
        </div>
      )}
      <ul className="space-y-4">
        {popular.map((item, index) => (
          <li key={item.iata}>
            <button
              type="button"
              onClick={() => onSelectAirport(item)}
              className="w-full text-left flex justify-between items-center bg-gray-50 p-4 rounded-xl hover:bg-blue-50 transition-colors"
            >
              <div className="font-medium min-w-0 pr-3">
                <div className="text-xs text-gray-500">#{index + 1}</div>
                <div className="font-bold truncate">{item.name}</div>
                <div className="text-sm text-gray-600">{item.iata}</div>
              </div>
              <div className="text-gray-600 whitespace-nowrap">{item.visits} visitas</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}