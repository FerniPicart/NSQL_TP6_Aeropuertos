from pydantic import BaseModel
from typing import Optional

class Airport(BaseModel):
    iata: str
    icao: Optional[str] = None
    name: str
    city: str
    lat: float
    lng: float
    alt: int
    tz: Optional[str] = None