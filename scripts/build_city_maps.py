"""Genera los mapas vectoriales por ciudad (src/data/cityMaps/*.json) a partir de datos abiertos.

Uso: pip install shapely && python scripts/build_city_maps.py

Fuentes (descargadas al ejecutar):
  - Bogotá, localidades: Datos Abiertos Bogotá / SDP (CC BY 4.0).
  - Medellín, comunas y corregimientos: GeoMedellín, Alcaldía de Medellín.
  - Cali, comunas y corregimientos: IDESC, Alcaldía de Santiago de Cali.
  - Cartagena, barrios agrupados por Unidad Comunera de Gobierno: Alcaldía de Cartagena de Indias.
  - Cundinamarca, municipios: DANE, Marco Geoestadístico Nacional 2018.
Los polígonos se simplifican y se proyectan a un lienzo de 1000 unidades de ancho para dibujarlos como SVG
sin depender de servicios de mapas externos.
"""
import json
import math
import urllib.request
from pathlib import Path

from shapely.geometry import box, shape
from shapely.ops import unary_union

OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "cityMaps"
WIDTH = 1000

SRC = {
    "bogota": "https://raw.githubusercontent.com/swseniordev/whatidea_maps/main/localidades_bogota.geojson",
    "cali": "https://raw.githubusercontent.com/swseniordev/whatidea_maps/main/comunas_corregimientos_cali.geojson",
    "medellin": "https://raw.githubusercontent.com/juandavidarbelaezrestrepo/mapas/main/medellin_comunas_corregimientos.geojson",
    "cartagena": "https://services7.arcgis.com/t784NacZjQPpWVsA/arcgis/rest/services/Barrios_de_Cartagena/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&resultRecordCount=2000",
    "municipios": "https://raw.githubusercontent.com/caticoa3/colombia_mapa/master/co_2018_MGN_MPIO_POLITICO.geojson",
}

BOGOTA_NAMES = {
    "USAQUEN": "Usaquén", "CHAPINERO": "Chapinero", "SANTA FE": "Santa Fe", "SAN CRISTOBAL": "San Cristóbal",
    "USME": "Usme", "TUNJUELITO": "Tunjuelito", "BOSA": "Bosa", "KENNEDY": "Kennedy", "FONTIBON": "Fontibón",
    "ENGATIVA": "Engativá", "SUBA": "Suba", "BARRIOS UNIDOS": "Barrios Unidos", "TEUSAQUILLO": "Teusaquillo",
    "LOS MARTIRES": "Los Mártires", "ANTONIO NARIÑO": "Antonio Nariño", "PUENTE ARANDA": "Puente Aranda",
    "CANDELARIA": "La Candelaria", "RAFAEL URIBE URIBE": "Rafael Uribe Uribe", "CIUDAD BOLIVAR": "Ciudad Bolívar",
    "SUMAPAZ": "Sumapaz",
}
SMALL = {"de", "del", "la", "las", "los", "el", "y"}


def title(text: str) -> str:
    words = text.strip().lower().split()
    return " ".join(w if (i and w in SMALL) else w.capitalize() for i, w in enumerate(words))


def load(url: str) -> list:
    with urllib.request.urlopen(url, timeout=120) as response:  # noqa: S310
        return json.load(response)["features"]


def build(city_id, zones, clip, tolerance, credits, context=()):
    """zones: [(id, name, geometry)]; context: [(id, name, geometry)] se dibujan sin contar hogares."""
    clip_box = box(*clip)
    items = []
    for kind, group in (("zone", zones), ("context", context)):
        for zone_id, name, geom in group:
            clipped = geom.intersection(clip_box)
            if not clipped.is_empty:
                items.append((kind, zone_id, name, clipped))
    minx, miny, maxx, maxy = unary_union([i[3] for i in items if i[0] == "zone"]).bounds
    mid = math.radians((miny + maxy) / 2)
    scale = WIDTH / ((maxx - minx) * math.cos(mid))
    kx, ky = scale * math.cos(mid), scale
    height = round((maxy - miny) * ky)

    def project(lon, lat):
        return [round((lon - minx) * kx), round((maxy - lat) * ky)]

    out_zones = []
    for kind, zone_id, name, geom in items:
        simple = geom.simplify(tolerance, preserve_topology=True)
        polygons = list(simple.geoms) if simple.geom_type in ("MultiPolygon", "GeometryCollection") else [simple]
        rings = []
        for polygon in polygons:
            if polygon.geom_type != "Polygon" or polygon.is_empty:
                continue
            for ring in [polygon.exterior, *polygon.interiors]:
                points = [project(x, y) for x, y in ring.coords]
                deduped = [p for i, p in enumerate(points) if i == 0 or p != points[i - 1]]
                if len(deduped) >= 4:
                    rings.append(deduped)
        if rings:
            entry = {"id": zone_id, "name": name, "rings": rings}
            if kind == "context":
                entry["context"] = True
            out_zones.append(entry)

    data = {
        "city": city_id,
        "width": WIDTH,
        "height": height,
        "bounds": [round(minx, 5), round(miny, 5), round(maxx, 5), round(maxy, 5)],
        "kx": round(kx, 4),
        "ky": round(ky, 4),
        "credits": credits,
        "zones": out_zones,
    }
    path = OUT / f"{city_id}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(city_id, len(out_zones), "zonas", round(path.stat().st_size / 1024), "KB")


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    bogota = [(f"loc{f['properties']['LocCodigo']}", BOGOTA_NAMES.get(f["properties"]["LocNombre"], title(f["properties"]["LocNombre"])), shape(f["geometry"]))
              for f in load(SRC["bogota"])]
    build("bogota", bogota, (-74.30, 4.45, -73.98, 4.84), 0.0006, "Datos Abiertos Bogotá · Secretaría Distrital de Planeación (CC BY 4.0)")

    medellin = []
    for f in load(SRC["medellin"]):
        p = f["properties"]
        if not p.get("NOMBRE"):
            continue
        name = p["NOMBRE"].replace("Corregimiento de ", "")
        label = f"{p['IDENTIFICA']} · {name}" if p["IDENTIFICA"].startswith("Comuna") else f"Corregimiento {name}"
        medellin.append((f"med{p['CODIGO']}", label, shape(f["geometry"])))
    build("medellin", medellin, (-75.75, 6.12, -75.42, 6.40), 0.0005, "GeoMedellín · Alcaldía de Medellín")

    cali = []
    for i, f in enumerate(load(SRC["cali"])):
        raw = f["properties"]["cvegeo"].strip()
        label = f"Comuna {int(raw.split()[-1])}" if raw.upper().startswith("COMUNA") else f"Corregimiento {title(raw)}"
        cali.append((f"cali{i}", label, shape(f["geometry"])))
    build("cali", cali, (-76.75, 3.25, -76.45, 3.56), 0.0006, "IDESC · Alcaldía de Santiago de Cali")

    groups, locs = {}, {}
    names = {"LH": "Histórica y del Caribe Norte", "LV": "De la Virgen y Turística", "LI": "Industrial de la Bahía"}
    for f in load(SRC["cartagena"]):
        p = f["properties"]
        groups.setdefault(p["UCG"], []).append(shape(f["geometry"]).buffer(0))
        locs.setdefault(p["UCG"], []).append(p["LOC"])
    cartagena = []
    for ucg, geoms in sorted(groups.items(), key=lambda kv: int(kv[0])):
        loc = max(set(locs[ucg]), key=locs[ucg].count)
        cartagena.append((f"ucg{ucg}", f"UCG {ucg} · {names.get(loc, loc)}", unary_union(geoms).buffer(0.0002)))
    build("cartagena", cartagena, (-75.58, 10.30, -75.40, 10.48), 0.0006, "Alcaldía Distrital de Cartagena de Indias")

    municipios = load(SRC["municipios"])
    cundinamarca = [(f"mun{f['properties']['MPIO_CCNCT']}", title(f["properties"]["MPIO_CNMBR"]), shape(f["geometry"]))
                    for f in municipios if str(f["properties"]["DPTO_CCDGO"]) == "25"]
    bogota_dc = [(f"mun{f['properties']['MPIO_CCNCT']}", "Bogotá D.C.", shape(f["geometry"]))
                 for f in municipios if f["properties"]["MPIO_CCNCT"] == "11001"]
    build("cundinamarca", cundinamarca, (-75.0, 3.7, -73.0, 5.9), 0.004,
          "DANE · Marco Geoestadístico Nacional 2018", context=bogota_dc)


if __name__ == "__main__":
    main()
