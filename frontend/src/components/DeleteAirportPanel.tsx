import { useMemo, useState } from 'react'
import axios from 'axios'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Airport } from '../types'
import Modal from './Modal'

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8000')

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

export default function DeleteAirportPanel() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)

  const {
    data: airports = [],
    isLoading,
    isError
  } = useQuery<Airport[]>({
    queryKey: ['airports-delete-list'],
    queryFn: async () => {
      const response = await axios.get<Airport[]>(`${API_URL}/airports`)
      return response.data
    }
  })

  const filteredAirports = useMemo(() => {
    return airports.filter((airport) => matchesAirportSearch(airport, searchTerm))
  }, [airports, searchTerm])

  const selectedAirport = useMemo(() => {
    if (!selectedCode) {
      return null
    }

    return airports.find((airport) => {
      const airportCode = airport.iata ?? airport.icao
      return airportCode === selectedCode
    }) ?? null
  }, [airports, selectedCode])

  const handleDelete = async () => {
    if (!selectedAirport) {
      return
    }

    const identifier = selectedAirport.iata ?? selectedAirport.icao
    if (!identifier) {
      setError('El aeropuerto seleccionado no tiene IATA/ICAO para eliminar.')
      return
    }

    setIsConfirmModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedAirport) {
      return
    }

    const identifier = selectedAirport.iata ?? selectedAirport.icao
    if (!identifier) {
      setError('El aeropuerto seleccionado no tiene IATA/ICAO para eliminar.')
      setIsConfirmModalOpen(false)
      return
    }

    setIsConfirmModalOpen(false)
    setError(null)
    setIsDeleting(true)

    try {
      await axios.delete(`${API_URL}/airports/${encodeURIComponent(identifier)}`)
      setSelectedCode(null)

      await queryClient.invalidateQueries({ queryKey: ['airports-delete-list'] })
      await queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'airports-bbox'
      })
      await queryClient.invalidateQueries({ queryKey: ['popular'] })

      setIsSuccessModalOpen(true)
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        const detail = requestError.response?.data?.detail
        if (typeof detail === 'string') {
          setError(detail)
        } else {
          setError('No se pudo eliminar el aeropuerto.')
        }
      } else {
        setError('No se pudo eliminar el aeropuerto.')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-gray-900">Eliminar aeropuerto</h2>
      <p className="mt-1 text-sm text-gray-600">
        Filtra y selecciona un aeropuerto para eliminarlo.
      </p>

      <div className="mt-4">
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
          placeholder="Filtrar por nombre, ciudad, IATA o ICAO..."
        />
      </div>

      <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-gray-200">
        {isLoading && <p className="p-3 text-sm text-gray-500">Cargando aeropuertos...</p>}
        {isError && <p className="p-3 text-sm text-red-600">No se pudo cargar la lista.</p>}
        {!isLoading && !isError && filteredAirports.length === 0 && (
          <p className="p-3 text-sm text-gray-500">No hay resultados para ese filtro.</p>
        )}

        {!isLoading && !isError && filteredAirports.length > 0 && (
          <ul>
            {filteredAirports.slice(0, 500).map((airport) => {
              const identifier = airport.iata ?? airport.icao ?? `airport-${airport.name}`
              const isSelected = selectedCode === (airport.iata ?? airport.icao ?? null)

              return (
                <li key={identifier}>
                  <button
                    type="button"
                    onClick={() => setSelectedCode(airport.iata ?? airport.icao ?? null)}
                    className={`w-full border-b border-gray-100 px-3 py-2 text-left hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    <div className="font-medium text-gray-900">{airport.name}</div>
                    <div className="text-xs text-gray-600">
                      {airport.city ?? 'Ciudad N/A'} - {airport.iata ?? 'IATA N/A'} / {airport.icao ?? 'ICAO N/A'}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {selectedAirport && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">
            Seleccionado: <strong>{selectedAirport.name}</strong> ({selectedAirport.iata ?? selectedAirport.icao})
          </p>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
          >
            {isDeleting ? 'Eliminando...' : 'Eliminar aeropuerto'}
          </button>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <Modal
        isOpen={isConfirmModalOpen}
        title="Confirmar eliminación"
        message={
          selectedAirport
            ? `¿Estás seguro de que deseas eliminar ${selectedAirport.name} (${selectedAirport.iata ?? selectedAirport.icao})?`
            : '¿Estás seguro de que deseas eliminar este aeropuerto?'
        }
        type="confirm"
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={handleConfirmDelete}
        onClose={() => setIsConfirmModalOpen(false)}
      />

      <Modal
        isOpen={isSuccessModalOpen}
        title="Éxito"
        message="Aeropuerto eliminado correctamente."
        type="success"
        onClose={() => setIsSuccessModalOpen(false)}
      />
    </section>
  )
}
