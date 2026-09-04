"""Distancia geografica sin depender de PostGIS.

Usamos la formula de haversine expresada en SQL para poder filtrar y ordenar en
la base de datos, de modo que la busqueda del mapa siga siendo paginable. La
variante con asin() es estable numericamente y usa solo funciones que existen
tanto en PostgreSQL como en el backend SQLite de Django.
"""
from django.db.models import F, FloatField, QuerySet
from django.db.models.expressions import RawSQL

EARTH_RADIUS_KM = 6371.0088


def annotate_distance(
    queryset: QuerySet,
    latitude: float,
    longitude: float,
    lat_field: str = "latitude",
    lng_field: str = "longitude",
) -> QuerySet:
    """Anota `distance_km` desde (latitude, longitude) hasta cada fila."""
    table = queryset.model._meta.db_table
    lat = f'radians("{table}"."{lat_field}")'
    lng = f'radians("{table}"."{lng_field}")'
    sql = (
        f"2 * {EARTH_RADIUS_KM} * asin(sqrt("
        f"  sin(({lat} - radians(%s)) / 2) * sin(({lat} - radians(%s)) / 2)"
        f"  + cos(radians(%s)) * cos({lat})"
        f"    * sin(({lng} - radians(%s)) / 2) * sin(({lng} - radians(%s)) / 2)"
        f"))"
    )
    params = (latitude, latitude, latitude, longitude, longitude)
    return queryset.annotate(
        distance_km=RawSQL(sql, params, output_field=FloatField())
    )


def within_radius(queryset: QuerySet, radius_km: float) -> QuerySet:
    """Filtra por el radio elegido por el cliente y por la cobertura del profesional."""
    return queryset.filter(distance_km__lte=radius_km).filter(
        distance_km__lte=F("coverage_radius_km")
    )
