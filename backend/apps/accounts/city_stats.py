"""Hogares y perfiles por ciudad para el mapa del panel administrativo."""
import re
import unicodedata

from apps.households.models import Household
from apps.professionals.models import ProfessionalProfile

# id, nombre, centro del mapa, zoom y nombres con los que se reconoce la ciudad.
CITIES = {
    "bogota": ("Bogotá", (4.7110, -74.0721), 11, ("bogota", "bogota d c", "bogota dc")),
    "medellin": ("Medellín", (6.2442, -75.5812), 12, ("medellin",)),
    "cali": ("Cali", (3.4516, -76.5320), 12, ("cali", "santiago de cali")),
    "cartagena": ("Cartagena", (10.3910, -75.4794), 12, ("cartagena", "cartagena de indias")),
    "cundinamarca": (
        "Cundinamarca",
        (4.8600, -74.0400),
        9,
        ("cundinamarca", "soacha", "chia", "zipaquira", "facatativa", "funza", "mosquera", "cajica", "fusagasuga",
         "girardot", "la calera", "sopo", "tocancipa", "cota", "madrid", "sibate", "tabio", "tenjo"),
    ),
}
MAX_POINTS_PER_CITY = 1500
MAX_ZONES = 80
MAX_ROWS = 20000


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def city_of(value: str) -> str | None:
    """Ciudad del panel a la que pertenece el texto de ciudad de un hogar o perfil."""
    normalized = _normalize(value)
    if not normalized:
        return None
    for city_id, (_, _, _, aliases) in CITIES.items():
        if any(re.search(rf"\b{re.escape(alias)}\b", normalized) for alias in aliases):
            return city_id
    return None


def city_stats() -> dict:
    cities = {
        city_id: {
            "id": city_id,
            "name": name,
            "center": list(center),
            "zoom": zoom,
            "households": 0,
            "professionals": 0,
            "located": 0,
            "zones": {},
            "points": [],
        }
        for city_id, (name, center, zoom, _) in CITIES.items()
    }
    other = {"households": 0, "professionals": 0}

    sources = (
        ("households", "home", Household.objects.order_by("-id").values("city", "neighborhood", "latitude", "longitude")),
        ("professionals", "pro", ProfessionalProfile.objects.order_by("-id").values("city", "neighborhood", "latitude", "longitude")),
    )
    for counter, kind, rows in sources:
        for row in rows[:MAX_ROWS]:
            city_id = city_of(row["city"])
            if city_id is None:
                other[counter] += 1
                continue
            city = cities[city_id]
            city[counter] += 1
            zone = (row["neighborhood"] or "").strip().title()
            if zone:
                city["zones"][zone] = city["zones"].get(zone, 0) + 1
            if row["latitude"] is not None and row["longitude"] is not None:
                city["located"] += 1
                if len(city["points"]) < MAX_POINTS_PER_CITY:
                    # Se redondea para no exponer la ubicación exacta de una vivienda.
                    city["points"].append({"lat": round(row["latitude"], 3), "lng": round(row["longitude"], 3), "kind": kind})

    result = []
    for city in cities.values():
        zones = sorted(city["zones"].items(), key=lambda item: (-item[1], item[0]))[:MAX_ZONES]
        city["zones"] = [{"name": name, "count": count} for name, count in zones]
        result.append(city)
    return {"cities": result, "cities_other": other}
