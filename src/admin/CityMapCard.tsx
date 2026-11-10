import React, { useEffect, useMemo, useState } from "react";
import type { ReportsStatsResponse } from "../services/adminService";
import { countByName, insideZone, loadCityMap, project, shortLabel, zoneCenter, zonePath, type CityMapData } from "./cityMap";

type City = NonNullable<ReportsStatsResponse["cities"]>[number];
type Props = {
  cities: City[];
  /** Localidades de Bogotá contadas por barrio; se usan cuando los registros no traen coordenadas. */
  bogotaLocalities?: Array<{ name: string; count: number }>;
  other?: { households: number; professionals: number };
  loaded: boolean;
};

const HOME = "#2563eb";
const PRO = "#dc2626";

// Escala de azules según la cantidad de registros de la zona.
const shade = (count: number, max: number) => {
  if (count <= 0 || max <= 0) return "#d7e3f4";
  const t = Math.min(1, count / max);
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${lerp(147, 29)}, ${lerp(197, 78)}, ${lerp(253, 216)})`;
};

const CityMapCard: React.FC<Props> = ({ cities, bogotaLocalities, other, loaded }) => {
  const [selected, setSelected] = useState(cities[0]?.id ?? "bogota");
  const [map, setMap] = useState<CityMapData | null>(null);
  const [mapError, setMapError] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const city = cities.find((item) => item.id === selected) ?? cities[0];

  useEffect(() => {
    let active = true;
    setMap(null);
    setMapError(false);
    setHovered(null);
    loadCityMap(selected)
      .then((data) => {
        if (!active) return;
        if (data) setMap(data);
        else setMapError(true);
      })
      .catch(() => active && setMapError(true));
    return () => {
      active = false;
    };
  }, [selected]);

  // Cuenta los hogares y profesionales de cada zona: por coordenadas si las hay, y si no, por el nombre del barrio.
  const stats = useMemo(() => {
    const result = new Map<string, { homes: number; pros: number }>();
    const dots: Array<{ x: number; y: number; kind: "home" | "pro" }> = [];
    let outside = 0;
    let byName = false;
    if (!map || !city) return { result, dots, outside, byName };
    const zones = map.zones.filter((z) => !z.context);
    zones.forEach((z) => result.set(z.id, { homes: 0, pros: 0 }));
    for (const point of city.points) {
      const [x, y] = project(map, point.lat, point.lng);
      const zone = zones.find((z) => insideZone(z, x, y));
      if (!zone) {
        outside += 1;
        continue;
      }
      const row = result.get(zone.id)!;
      if (point.kind === "home") row.homes += 1;
      else row.pros += 1;
      dots.push({ x, y, kind: point.kind });
    }
    if (dots.length === 0) {
      const named = city.id === "bogota" && bogotaLocalities?.length ? bogotaLocalities : city.zones;
      const counts = countByName(zones, named);
      counts.forEach((count, id) => {
        result.get(id)!.homes = count;
        byName = true;
      });
    }
    return { result, dots, outside, byName };
  }, [map, city, bogotaLocalities]);

  if (!city) return null;
  const countable = map?.zones.filter((z) => !z.context) ?? [];
  const totals = countable.map((z) => (stats.result.get(z.id)?.homes ?? 0) + (stats.result.get(z.id)?.pros ?? 0));
  const max = Math.max(0, ...totals);
  const hoveredZone = map?.zones.find((z) => z.id === hovered);
  const hoveredStat = hovered ? stats.result.get(hovered) : undefined;
  const ranking = countable
    .map((z) => ({ zone: z, ...(stats.result.get(z.id) ?? { homes: 0, pros: 0 }) }))
    .sort((a, b) => b.homes + b.pros - (a.homes + a.pros) || a.zone.name.localeCompare(b.zone.name, "es"));
  const withoutLocation = Math.max(0, city.households + city.professionals - (city.located ?? city.points.length));
  const byNameNote = stats.byName
    ? "Estos registros no tienen coordenadas: la cantidad por zona se calcula con el barrio o localidad que escribieron."
    : "";

  return (
    <div className="ad-city-map">
      <div className="ad-city-tabs" role="tablist" aria-label="Elegir ciudad">
        {cities.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === city.id}
            className={`ad-city-tab ${item.id === city.id ? "is-active" : ""}`}
            onClick={() => setSelected(item.id)}
          >
            {item.name}
            <span>{loaded ? item.households + item.professionals : "—"}</span>
          </button>
        ))}
      </div>

      <div className="ad-city-body">
        <div className="ad-city-map-box">
          {mapError ? (
            <p className="ad-city-muted">No se pudo cargar el mapa de {city.name}.</p>
          ) : !map ? (
            <p className="ad-city-muted">Cargando mapa de {city.name}...</p>
          ) : (
            <svg
              viewBox={`0 0 ${map.width} ${map.height}`}
              className="ad-city-svg"
              role="img"
              aria-label={`Mapa de ${city.name}`}
              onMouseLeave={() => setHovered(null)}
            >
              {map.zones.map((zone) => {
                const row = stats.result.get(zone.id);
                const total = row ? row.homes + row.pros : 0;
                return (
                  <path
                    key={zone.id}
                    d={zonePath(zone)}
                    fillRule="evenodd"
                    className={`ad-city-zone ${zone.context ? "is-context" : ""} ${hovered === zone.id ? "is-hover" : ""}`}
                    fill={zone.context ? "#e2e8f0" : shade(total, max)}
                    onMouseEnter={zone.context ? undefined : () => setHovered(zone.id)}
                  >
                    <title>{zone.context ? zone.name : `${zone.name}: ${row?.homes ?? 0} hogares · ${row?.pros ?? 0} profesionales`}</title>
                  </path>
                );
              })}
              {countable.map((zone) => {
                const label = shortLabel(zone.name, countable.length);
                if (!label) return null;
                const [x, y, area] = zoneCenter(zone);
                // Las zonas diminutas no llevan etiqueta para no tapar el mapa.
                if (area < 1200) return null;
                return (
                  <text key={`l-${zone.id}`} x={x} y={y} className="ad-city-label">
                    {label}
                  </text>
                );
              })}
              {stats.dots.map((dot, index) => (
                <circle key={index} cx={dot.x} cy={dot.y} r={map.width / 140} fill={dot.kind === "home" ? HOME : PRO} className="ad-city-dot" />
              ))}
            </svg>
          )}
          {hoveredZone && (
            <div className="ad-city-hint" role="status">
              <strong>{hoveredZone.name}</strong> · {hoveredStat?.homes ?? 0} hogares · {hoveredStat?.pros ?? 0} profesionales
            </div>
          )}
        </div>

        <div className="ad-city-side">
          <div className="ad-city-totals">
            <div><i style={{ background: HOME }} />Hogares<strong>{loaded ? city.households : "—"}</strong></div>
            <div><i style={{ background: PRO }} />Profesionales<strong>{loaded ? city.professionals : "—"}</strong></div>
          </div>
          <h4>{city.id === "cundinamarca" ? "Municipios" : city.id === "bogota" ? "Localidades" : city.id === "cartagena" ? "Unidades comuneras" : "Comunas y corregimientos"}</h4>
          <ul className="ad-city-zones">
            {ranking.slice(0, 12).map(({ zone, homes, pros }) => (
              <li key={zone.id} className={hovered === zone.id ? "is-hover" : ""} onMouseEnter={() => setHovered(zone.id)} onMouseLeave={() => setHovered(null)}>
                <i style={{ background: shade(homes + pros, max) }} />
                <span>{zone.name}</span>
                <strong>{homes + pros}</strong>
              </li>
            ))}
          </ul>
          {byNameNote && <p className="ad-city-muted">{byNameNote}</p>}
          {!stats.byName && withoutLocation > 0 && <p className="ad-city-muted">{withoutLocation} registros sin ubicación en el mapa.</p>}
          {other && (other.households > 0 || other.professionals > 0) && (
            <p className="ad-city-muted">Otras ciudades: {other.households} hogares · {other.professionals} profesionales</p>
          )}
          {map && <p className="ad-city-credits">Mapa vectorial · {map.credits}</p>}
        </div>
      </div>
    </div>
  );
};

export default CityMapCard;
