from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from app.schemas.airport import AirportCreate, AirportUpdate
from app.crud.airport import (
    create_airport, get_all_airports, get_airport_by_code,
    update_airport, delete_airport, get_nearby, get_popular
)
from app.utils.seed import seed_data

app = FastAPI(title="API Aeropuertos - TP6 NSQL")

# ====================== CORS (necesario para frontend) ======================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====================== SEED ======================
@app.on_event("startup")
async def startup_event():
    await seed_data()

# ====================== CRUD ======================
@app.post("/airports")
async def api_create_airport(airport: AirportCreate):
    try:
        return await create_airport(airport)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

@app.get("/airports")
async def api_get_all(
    limit: int | None = Query(None, gt=0, le=5000, description="Cantidad maxima de resultados"),
    offset: int = Query(0, ge=0, description="Desplazamiento para paginacion"),
    search: str | None = Query(None, min_length=1, description="Filtro por nombre o ciudad"),
    bbox: str | None = Query(
        None,
        description="Bounding box en formato minLng,minLat,maxLng,maxLat"
    )
):
    parsed_bbox = None
    if bbox:
        try:
            min_lng, min_lat, max_lng, max_lat = [float(v.strip()) for v in bbox.split(",")]
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail="bbox invalido. Formato esperado: minLng,minLat,maxLng,maxLat"
            )

        if not (-180 <= min_lng <= 180 and -180 <= max_lng <= 180):
            raise HTTPException(status_code=422, detail="bbox invalido: longitud fuera de rango")
        if not (-90 <= min_lat <= 90 and -90 <= max_lat <= 90):
            raise HTTPException(status_code=422, detail="bbox invalido: latitud fuera de rango")
        if min_lng > max_lng or min_lat > max_lat:
            raise HTTPException(status_code=422, detail="bbox invalido: min debe ser menor o igual a max")

        parsed_bbox = (min_lng, min_lat, max_lng, max_lat)

    return await get_all_airports(limit=limit, offset=offset, search=search, bbox=parsed_bbox)

# ====================== RUTAS ESPECÍFICAS ======================
@app.get("/airports/nearby")
async def api_nearby(
    lat: float = Query(..., description="Latitud"),
    lng: float = Query(..., description="Longitud"),
    radius: float = Query(50, gt=0, description="Radio en km")
):
    results = await get_nearby(lat, lng, radius)
    return results

@app.get("/airports/popular")
async def api_popular(limit: int = Query(10, gt=0, le=50)):
    results = await get_popular(limit)
    return results

# ====================== RUTA DINÁMICA ======================
@app.get("/airports/{identifier}")
async def api_get_by_identifier(identifier: str):
    airport = await get_airport_by_code(identifier)
    if not airport:
        raise HTTPException(status_code=404, detail="Aeropuerto no encontrado")
    return airport

@app.put("/airports/{iata_code}")
async def api_update(iata_code: str, update_data: AirportUpdate):
    updated = await update_airport(iata_code, update_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Aeropuerto no encontrado")
    return {"message": "Aeropuerto actualizado correctamente"}

@app.delete("/airports/{identifier}")
async def api_delete(identifier: str):
    deleted = await delete_airport(identifier)
    if not deleted:
        raise HTTPException(status_code=404, detail="Aeropuerto no encontrado")
    return {"message": "Aeropuerto eliminado correctamente"}

# ====================== DEBUG & SYNC ======================
@app.get("/debug/geo")
async def debug_geo():
    from app.core.database import redis_geo, GEO_KEY
    count = await redis_geo.zcard(GEO_KEY)
    sample = await redis_geo.georadius(GEO_KEY, 145.39, -6.08, 10, unit="km")
    return {
        "total_airports_in_redis_geo": count,
        "sample_near_goroka": sample
    }

@app.get("/debug/sync-geo")
async def sync_geo():
    from app.core.database import airports_collection, redis_geo, GEO_KEY

    await redis_geo.delete(GEO_KEY)

    cursor = airports_collection.find({}, {"iata": 1, "lng": 1, "lat": 1})
    docs = await cursor.to_list(None)

    valid_count = 0
    invalid_count = 0

    for doc in docs:
        try:
            iata = doc.get("iata")
            lat = doc.get("lat")
            lng = doc.get("lng")

            if not iata or lat is None or lng is None:
                invalid_count += 1
                continue

            lat = float(lat)
            lng = float(lng)

            if not (-85.05112878 <= lat <= 85.05112878) or not (-180 <= lng <= 180):
                invalid_count += 1
                continue

            if lat == 0 and lng == 0:
                invalid_count += 1
                continue

            await redis_geo.execute_command("GEOADD", GEO_KEY, lng, lat, iata)
            valid_count += 1

        except Exception as e:
            print(f"❌ Error con {doc}: {e}")
            invalid_count += 1

    return {
        "message": "✅ Redis GEO sincronizado correctamente",
        "total_cargados": valid_count,
        "total_descartados": invalid_count
    }

# ====================== HEALTH ======================
@app.get("/")
def read_root():
    return {"status": "API Aeropuertos funcionando correctamente"}