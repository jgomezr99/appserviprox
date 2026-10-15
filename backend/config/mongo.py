from django.conf import settings

MONGO_COLLECTIONS = ("chat_messages", "audit_logs", "notifications", "pqrs", "technical_issues")

_client = None


def get_mongo_db():
    """Devuelve la base MongoDB o None si MONGODB_URI no está configurado."""
    global _client
    if not settings.MONGODB_URI:
        return None
    if _client is None:
        from pymongo import MongoClient

        _client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=3000)
    return _client[settings.MONGODB_DB]


def purge_collections(names):
    """Vacía colecciones de MongoDB; devuelve documentos borrados (0 si está desactivado)."""
    db = get_mongo_db()
    if db is None:
        return 0
    return sum(db[name].delete_many({}).deleted_count for name in names)
