from motor.motor_asyncio import AsyncIOMotorClient
import redis.asyncio as redis
import os

# ====================== MONGO ======================
mongo_client = AsyncIOMotorClient(os.getenv("MONGO_URI", "mongodb://mongo:27017/airport_db"))
db = mongo_client.get_default_database()
airports_collection = db.airports

# ====================== REDIS ======================
redis_geo = redis.from_url(os.getenv("REDIS_GEO_URL", "redis://:redisgeo123@redis-geo:6379/0"))
redis_pop = redis.from_url(os.getenv("REDIS_POP_URL", "redis://:redispop123@redis-pop:6379/0"))

# Keys
GEO_KEY = "airports:geo"
POP_KEY = "airport_popularity"