import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchRealRoute } from "../../utils/geocoding";

type Props = { start: [number, number]; destination: [number, number]; professionalName: string; address: string };
type Route = NonNullable<Awaited<ReturnType<typeof fetchRealRoute>>>;

const TravelMap: React.FC<Props> = ({ start, destination, professionalName, address }) => {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.CircleMarker[]>([]);
  const line = useRef<L.Polyline | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [routeLoading, setRouteLoading] = useState(true);
  const [lat, lng] = start;
  const [homeLat, homeLng] = destination;

  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, { zoomControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
    }).addTo(instance);
    map.current = instance;
    markers.current = [
      L.circleMarker([0, 0], { radius: 10, color: "#dc2626", className: "sf-travel-origin", fillOpacity: 1 }).addTo(instance),
      L.circleMarker([0, 0], { radius: 10, color: "#15803d", fillOpacity: 1 }).addTo(instance),
    ];
    const observer = new ResizeObserver(() => instance.invalidateSize(false));
    observer.observe(container.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; markers.current = []; line.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    // bindTooltip con nodos evita interpretar nombres y direcciones como HTML.
    const name = document.createElement("span"); name.textContent = professionalName;
    const home = document.createElement("span"); home.textContent = address;
    markers.current[0].setLatLng([lat, lng]).bindTooltip(name);
    markers.current[1].setLatLng([homeLat, homeLng]).bindTooltip(home);
    map.current.fitBounds([[lat, lng], [homeLat, homeLng]], { padding: [28, 28], maxZoom: 16 });
  }, [lat, lng, homeLat, homeLng, professionalName, address]);

  useEffect(() => {
    let active = true;
    setRoute(null); setRouteLoading(true);
    if (line.current) { line.current.remove(); line.current = null; }
    void fetchRealRoute([lat, lng], [homeLat, homeLng]).then((next) => {
      if (!active) return;
      setRoute(next); setRouteLoading(false);
      if (next && map.current) line.current = L.polyline(next.waypoints, { color: "#dc2626", className: "sf-travel-route", weight: 5 }).addTo(map.current);
    });
    return () => { active = false; };
  }, [lat, lng, homeLat, homeLng]);

  return <section className="tracking-card tracking-travel" aria-label="Ruta de llegada">
    <h2>Profesional en camino</h2>
    <div className="sp-tracking-map" ref={container} aria-label="Mapa del desplazamiento" />
    {route ? <div className="tracking-summary-grid">
      <div><span>Distancia por carretera</span><strong>{route.distanceKm.toFixed(1)} km</strong></div>
      <div><span>Tiempo estimado de viaje</span><strong>{route.durationMinutes} min</strong></div>
    </div> : <p role="status">{routeLoading ? "Consultando el trayecto…" : "No se pudo calcular el trayecto. Las ubicaciones siguen visibles."}</p>}
    <small>Estimación de conducción; puede variar con las condiciones de la vía.</small>
  </section>;
};

export default TravelMap;
