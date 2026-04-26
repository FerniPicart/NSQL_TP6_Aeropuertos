from pydantic import BaseModel, root_validator
from typing import Optional

class AirportCreate(BaseModel):
    iata: Optional[str] = None
    icao: Optional[str] = None
    name: str
    city: str
    lat: float
    lng: float
    alt: int
    tz: Optional[str] = None

    @root_validator(pre=True)
    def validate_codes(cls, values):
        iata = values.get("iata")
        icao = values.get("icao")

        has_iata = isinstance(iata, str) and iata.strip() != ""
        has_icao = isinstance(icao, str) and icao.strip() != ""

        if not has_iata and not has_icao:
            raise ValueError("Debe enviar IATA o ICAO para crear un aeropuerto")

        return values

class AirportResponse(AirportCreate):
    pass

class AirportUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    alt: Optional[int] = None
    tz: Optional[str] = None