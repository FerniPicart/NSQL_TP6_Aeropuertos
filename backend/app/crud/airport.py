from app.core.database import airports_collection, redis_geo, redis_pop, GEO_KEY, POP_KEY
from app.schemas.airport import AirportCreate, AirportUpdate
from typing import List, Optional, Tuple

# ====================== HELPER PARA SERIALIZAR _id ======================
def serialize_doc(doc: dict):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc

def serialize_list(docs: List[dict]):
    return [serialize_doc(doc) for doc in docs]

def normalize_code(code: Optional[str]) -> Optional[str]:
    if not isinstance(code, str):
        return None

    cleaned = code.strip().upper()
    return cleaned if cleaned else None

# ====================== CRUD ======================
async def create_airport(airport: AirportCreate):
    airport_dict = airport.dict()

    iata = normalize_code(airport_dict.get("iata"))
    icao = normalize_code(airport_dict.get("icao"))

    if not iata and not icao:
        raise ValueError("Debe enviar IATA o ICAO para crear un aeropuerto")

    airport_dict["iata"] = iata
    airport_dict["icao"] = icao

    duplicate_conditions = []
    if iata:
        duplicate_conditions.append({"iata": iata})
    if icao:
        duplicate_conditions.append({"icao": icao})

    existing = await airports_collection.find_one({"$or": duplicate_conditions})
    if existing:
        if iata and existing.get("iata") == iata:
            raise ValueError(f"El codigo IATA '{iata}' ya existe")
        if icao and existing.get("icao") == icao:
            raise ValueError(f"El codigo ICAO '{icao}' ya existe")
        raise ValueError("Ya existe un aeropuerto con ese identificador")

    result = await airports_collection.insert_one(airport_dict)

    if iata:
        await redis_geo.execute_command("GEOADD", GEO_KEY, airport.lng, airport.lat, iata)

    return {**airport_dict, "_id": str(result.inserted_id)}

async def get_all_airports(
    limit: Optional[int] = None,
    offset: int = 0,
    search: Optional[str] = None,
    bbox: Optional[Tuple[float, float, float, float]] = None
) -> List[dict]:
    filters = []

    if search:
        filters.append({
            "$or": [
                {"name": {"$regex": search, "$options": "i"}},
                {"city": {"$regex": search, "$options": "i"}}
            ]
        })

    if bbox:
        min_lng, min_lat, max_lng, max_lat = bbox
        filters.append({
            "lng": {"$gte": min_lng, "$lte": max_lng},
            "lat": {"$gte": min_lat, "$lte": max_lat}
        })

    if len(filters) == 0:
        query = {}
    elif len(filters) == 1:
        query = filters[0]
    else:
        query = {"$and": filters}

    cursor = airports_collection.find(query).skip(offset)
    if limit is not None:
        cursor = cursor.limit(limit)

    docs = await cursor.to_list(length=None)
    return serialize_list(docs)

async def get_airport_by_code(identifier: str):
    normalized_identifier = normalize_code(identifier)
    if not normalized_identifier:
        return None

    airport = await airports_collection.find_one({
        "$or": [
            {"iata": normalized_identifier},
            {"icao": normalized_identifier}
        ]
    })

    if airport:
        iata = airport.get("iata")
        if iata:
            await redis_pop.zincrby(POP_KEY, 1, iata)
            await redis_pop.expire(POP_KEY, 86400)
        return serialize_doc(airport)

    return None

async def update_airport(iata: str, update_data: AirportUpdate):
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    result = await airports_collection.update_one({"iata": iata}, {"$set": update_dict})
    if result.modified_count and ("lat" in update_dict or "lng" in update_dict):
        airport = await get_airport_by_iata(iata)
        if airport:
            await redis_geo.execute_command("GEOADD", GEO_KEY, airport["lng"], airport["lat"], iata)
    return result.modified_count > 0

async def delete_airport(iata: str):
    normalized_identifier = normalize_code(iata)
    if not normalized_identifier:
        return False

    airport = await airports_collection.find_one({
        "$or": [
            {"iata": normalized_identifier},
            {"icao": normalized_identifier}
        ]
    })

    if not airport:
        return False

    await airports_collection.delete_one({"_id": airport["_id"]})

    airport_iata = airport.get("iata")
    if airport_iata:
        await redis_geo.zrem(GEO_KEY, airport_iata)
        await redis_pop.zrem(POP_KEY, airport_iata)

    return True

async def get_nearby(lat: float, lng: float, radius_km: float):
    geo_results = await redis_geo.georadius(
        GEO_KEY,
        lng,
        lat,
        radius_km,
        unit="km",
        withdist=True,
        withcoord=True
    )

    if not geo_results:
        return []

    nearby_iatas: List[tuple[str, float]] = []
    for result in geo_results:
        member = result[0]
        distance = result[1]

        iata = member.decode("utf-8") if isinstance(member, bytes) else str(member)
        distance_km = float(distance)
        nearby_iatas.append((iata, distance_km))

    iatas = [iata for iata, _ in nearby_iatas]
    cursor = airports_collection.find({"iata": {"$in": iatas}})
    docs = await cursor.to_list(length=None)

    by_iata = {doc["iata"]: serialize_doc(doc) for doc in docs}
    ordered_results = []
    for iata, distance_km in nearby_iatas:
        airport = by_iata.get(iata)
        if airport:
            airport["distance_km"] = round(distance_km, 3)
            ordered_results.append(airport)

    return ordered_results

async def get_popular(limit: int = 10):
    raw_results = await redis_pop.zrevrange(POP_KEY, 0, limit-1, withscores=True)
    if not raw_results:
        return []

    iatas = [member.decode("utf-8") if isinstance(member, bytes) else str(member) for member, _ in raw_results]
    cursor = airports_collection.find({"iata": {"$in": iatas}}, {"iata": 1, "name": 1, "lat": 1, "lng": 1})
    docs = await cursor.to_list(length=None)
    by_iata = {doc["iata"]: doc for doc in docs}

    results = []
    for member, score in raw_results:
        iata = member.decode("utf-8") if isinstance(member, bytes) else str(member)
        airport = by_iata.get(iata)
        if not airport:
          continue

        results.append({
            "iata": iata,
            "name": airport.get("name"),
            "lat": airport.get("lat"),
            "lng": airport.get("lng"),
            "visits": score
        })

    return results