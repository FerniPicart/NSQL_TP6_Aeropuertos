export interface Airport {
  iata?: string | null
  icao?: string | null
  name: string
  city: string | null
  lat: number
  lng: number
  alt: number
  tz?: string
  distance_km?: number
}

export interface NearbySearch {
  lat: number
  lng: number
  radius: number
}