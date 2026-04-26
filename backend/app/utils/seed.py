import json
from app.core.database import airports_collection, redis_geo, GEO_KEY

async def seed_data():
    # Verificar si ya hay datos en Mongo
    count = await airports_collection.count_documents({})
    if count > 0:
        # Si Redis GEO esta vacio (por reinicio de contenedor), lo rehidrata desde Mongo.
        geo_count = await redis_geo.zcard(GEO_KEY)
        if geo_count == 0:
            print("♻️ Redis GEO vacio: sincronizando desde Mongo...")
            cursor = airports_collection.find({}, {"iata": 1, "lng": 1, "lat": 1})
            docs = await cursor.to_list(length=None)

            loaded = 0
            skipped = 0
            for doc in docs:
                try:
                    iata = doc.get("iata")
                    lat = doc.get("lat")
                    lng = doc.get("lng")

                    if not iata or lat is None or lng is None:
                        skipped += 1
                        continue

                    lat = float(lat)
                    lng = float(lng)

                    if not (-85.05112878 <= lat <= 85.05112878) or not (-180 <= lng <= 180):
                        skipped += 1
                        continue

                    if lat == 0 and lng == 0:
                        skipped += 1
                        continue

                    await redis_geo.execute_command("GEOADD", GEO_KEY, lng, lat, iata)
                    loaded += 1
                except Exception:
                    skipped += 1

            print(f"✅ Redis GEO sincronizado: {loaded} aeropuertos (descartados: {skipped})")

        print("✅ Base de datos ya inicializada (seed de Mongo omitido)")
        return

    print("🌱 Iniciando carga inicial de aeropuertos...")

    with open("airports.json", "r", encoding="utf-8") as f:
        airports = json.load(f)

    # Insertar en MongoDB
    await airports_collection.insert_many(airports)

    # Insertar en Redis GEO
    for airport in airports:
        await redis_geo.execute_command("GEOADD", GEO_KEY, airport["lng"], airport["lat"], airport["iata"])

    print(f"✅ Seed completado: {len(airports)} aeropuertos cargados en MongoDB y Redis GEO")