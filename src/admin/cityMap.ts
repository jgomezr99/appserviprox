export type MapZone = { id: string; name: string; rings: number[][][]; context?: boolean };
export type CityMapData = {
  city: string;
  width: number;
  height: number;
  bounds: [number, number, number, number];
  kx: number;
  ky: number;
  credits: string;
  zones: MapZone[];
};
export type MapPoint = { lat: number; lng: number; kind: "home" | "pro" };

const loaders = import.meta.glob<{ default: CityMapData }>("../data/cityMaps/*.json");

/** Carga el mapa vectorial de una ciudad; cada ciudad es un archivo aparte para no cargar todos a la vez. */
export const loadCityMap = async (cityId: string): Promise<CityMapData | null> => {
  const loader = loaders[`../data/cityMaps/${cityId}.json`];
  return loader ? (await loader()).default : null;
};

/** Lleva una coordenada al lienzo del mapa de la ciudad. */
export const project = (map: CityMapData, lat: number, lng: number): [number, number] => [
  (lng - map.bounds[0]) * map.kx,
  (map.bounds[3] - lat) * map.ky,
];

/** Punto dentro de un polígono con huecos (regla par-impar sobre todos sus anillos). */
export const insideZone = (zone: MapZone, x: number, y: number): boolean => {
  let inside = false;
  for (const ring of zone.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
};

export const zonePath = (zone: MapZone): string =>
  zone.rings.map((ring) => `M${ring.map(([x, y]) => `${x} ${y}`).join("L")}Z`).join("");

/** Centro del anillo más grande, para ubicar la etiqueta de la zona. */
export const zoneCenter = (zone: MapZone): [number, number, number] => {
  let best: number[][] = zone.rings[0];
  let bestArea = -1;
  for (const ring of zone.rings) {
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    if (area > bestArea) {
      bestArea = area;
      best = ring;
    }
  }
  const xs = best.map((p) => p[0]);
  const ys = best.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, bestArea];
};

export const shortLabel = (name: string, total: number): string => {
  const numbered = /^(?:Comuna|UCG)\s+(\d+)/.exec(name);
  if (numbered) return numbered[1];
  return total <= 22 && name.length <= 14 ? name : "";
};

const plain = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Nombre con el que se busca una zona en el barrio o localidad escrito por los usuarios. */
export const zoneKey = (name: string): string =>
  plain(name.replace(/^(Comuna|Corregimiento|UCG)\s*\d*\s*·?\s*/i, "").replace(/·.*$/, ""));

/** Registros sin coordenadas: se asignan a la zona cuyo nombre aparece en su barrio o localidad. */
export const countByName = (zones: MapZone[], named: Array<{ name: string; count: number }>) => {
  const result = new Map<string, number>();
  const keys = zones.map((zone) => ({ id: zone.id, key: zoneKey(zone.name) })).filter((z) => z.key.length >= 3);
  for (const entry of named) {
    const text = plain(entry.name);
    const match = keys.find((z) => text === z.key || text.includes(z.key) || (text.length >= 5 && z.key.includes(text)));
    if (match) result.set(match.id, (result.get(match.id) ?? 0) + entry.count);
  }
  return result;
};
