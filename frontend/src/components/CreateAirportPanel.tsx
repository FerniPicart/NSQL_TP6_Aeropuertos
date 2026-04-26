import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import { useQueryClient } from '@tanstack/react-query'
import Modal from './Modal'

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8000')
const MAP_MIN_LAT = -60
const MAP_MAX_LAT = 85

interface CreateAirportFormData {
  iata: string
  icao: string
  name: string
  city: string
  lat: string
  lng: string
  alt: string
  tz: string
}

const initialFormData: CreateAirportFormData = {
  iata: '',
  icao: '',
  name: '',
  city: '',
  lat: '',
  lng: '',
  alt: '',
  tz: ''
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export default function CreateAirportPanel() {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<CreateAirportFormData>(initialFormData)
  const [error, setError] = useState<string | null>(null)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const hasAnyCode = useMemo(() => {
    return formData.iata.trim().length > 0 || formData.icao.trim().length > 0
  }, [formData.iata, formData.icao])

  const onChangeField = (field: keyof CreateAirportFormData, value: string) => {
    setFormData((previous) => ({ ...previous, [field]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!hasAnyCode) {
      setError('Debe completar IATA o ICAO para crear el aeropuerto.')
      return
    }

    if (!formData.name.trim() || !formData.city.trim() || !formData.alt.trim() || !formData.lat.trim() || !formData.lng.trim()) {
      setError('Completa todos los campos obligatorios: nombre, ciudad, latitud, longitud y altitud.')
      return
    }

    const parsedLat = Number(formData.lat)
    const parsedLng = Number(formData.lng)
    const parsedAlt = Number(formData.alt)

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng) || !Number.isFinite(parsedAlt)) {
      setError('Latitud, longitud y altitud deben ser numericas.')
      return
    }

    const clampedLat = clamp(parsedLat, MAP_MIN_LAT, MAP_MAX_LAT)
    const clampedLng = clamp(parsedLng, -180, 180)

    setFormData((previous) => ({
      ...previous,
      lat: String(clampedLat),
      lng: String(clampedLng)
    }))

    setIsSubmitting(true)

    try {
      await axios.post(`${API_URL}/airports`, {
        iata: formData.iata.trim() || null,
        icao: formData.icao.trim() || null,
        name: formData.name.trim(),
        city: formData.city.trim(),
        lat: clampedLat,
        lng: clampedLng,
        alt: Math.round(parsedAlt),
        tz: formData.tz.trim() || null
      })

      setIsSuccessModalOpen(true)
      setFormData(initialFormData)
      await queryClient.invalidateQueries({ queryKey: ['popular'] })
      await queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'airports-bbox'
      })
      await queryClient.invalidateQueries({ queryKey: ['airports-delete-list'] })
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        const detail = requestError.response?.data?.detail
        if (typeof detail === 'string') {
          setError(detail)
        } else {
          setError('No se pudo crear el aeropuerto.')
        }
      } else {
        setError('No se pudo crear el aeropuerto.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-gray-900">Agregar aeropuerto</h2>
      <p className="mt-1 text-sm text-gray-600">
        Debe tener IATA o ICAO. Los codigos son unicos.
      </p>

      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <label className="text-sm text-gray-700">
          IATA
          <input
            value={formData.iata}
            onChange={(event) => onChangeField('iata', event.target.value.toUpperCase())}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="Ej: EZE"
            maxLength={8}
          />
        </label>

        <label className="text-sm text-gray-700">
          ICAO
          <input
            value={formData.icao}
            onChange={(event) => onChangeField('icao', event.target.value.toUpperCase())}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="Ej: SAEZ"
            maxLength={8}
          />
        </label>

        <label className="text-sm text-gray-700 md:col-span-2">
          Nombre *
          <input
            required
            value={formData.name}
            onChange={(event) => onChangeField('name', event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="Nombre del aeropuerto"
          />
        </label>

        <label className="text-sm text-gray-700 md:col-span-2">
          Ciudad *
          <input
            required
            value={formData.city}
            onChange={(event) => onChangeField('city', event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="Ciudad"
          />
        </label>

        <label className="text-sm text-gray-700">
          Latitud *
          <input
            required
            type="number"
            min={MAP_MIN_LAT}
            max={MAP_MAX_LAT}
            step="0.00001"
            value={formData.lat}
            onChange={(event) => onChangeField('lat', event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="text-sm text-gray-700">
          Longitud *
          <input
            required
            type="number"
            min={-180}
            max={180}
            step="0.00001"
            value={formData.lng}
            onChange={(event) => onChangeField('lng', event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>

        <p className="md:col-span-2 -mt-1 text-xs text-gray-500">
          Limites permitidos: latitud entre {MAP_MIN_LAT} y {MAP_MAX_LAT}, longitud entre -180 y 180.
        </p>

        <label className="text-sm text-gray-700">
          Altitud (ft) *
          <input
            required
            type="number"
            step="1"
            value={formData.alt}
            onChange={(event) => onChangeField('alt', event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="text-sm text-gray-700">
          TZ
          <input
            value={formData.tz}
            onChange={(event) => onChangeField('tz', event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="America/Argentina/Buenos_Aires"
          />
        </label>

        <div className="md:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {isSubmitting ? 'Guardando...' : 'Crear aeropuerto'}
          </button>

          {!hasAnyCode && (
            <span className="text-xs text-amber-700">Completa IATA o ICAO</span>
          )}
        </div>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <Modal
        isOpen={isSuccessModalOpen}
        title="Éxito"
        message="Aeropuerto creado correctamente."
        type="success"
        onClose={() => setIsSuccessModalOpen(false)}
      />
    </section>
  )
}
