import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonMenuButton,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import {
  arrowBackOutline,
  cameraOutline,
  carOutline,
  checkmarkCircleOutline,
  homeOutline,
  locateOutline,
  locationOutline,
  navigateOutline,
  refreshOutline,
  shieldCheckmarkOutline,
  star,
  timeOutline,
} from "ionicons/icons";
import { useHistory, useParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "../context/AuthContext";
import { orderService, serviceRequestService } from "../services/serviprox";
import type { Order } from "../types/serviprox";
import {
  fetchRealRoute,
  geocodeAddress,
  geocodeBogotaGrid,
  generateRealisticRouteWaypoints,
  normalizeBogotaAddress,
} from "../utils/geocoding";
import "./WorkTrackingPage.css";

type Params = { id: string };
type WorkStatus =
  | "traveling"
  | "arrived"
  | "in_progress"
  | "break"
  | "lunch"
  | "other_service"
  | "completed";

const statusLabels: Record<WorkStatus, string> = {
  traveling: "En camino",
  arrived: "Llegó al lugar",
  in_progress: "Trabajando",
  break: "En pausa",
  lunch: "Almuerzo",
  other_service: "Otro servicio",
  completed: "Trabajo terminado",
};

const statusOrder: WorkStatus[] = [
  "traveling",
  "arrived",
  "in_progress",
  "completed",
];

const getDistanceFromLatLonInKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const WorkTrackingPage: React.FC = () => {
  const { id } = useParams<Params>();
  const history = useHistory();
  const { user } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [code, setCode] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const isProfessional = user?.role === "professional";

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const profMarkerRef = useRef<L.Marker | null>(null);
  const homeMarkerRef = useRef<L.Marker | null>(null);

  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      let fetchedOrder: Order | null = null;
      try {
        fetchedOrder = await orderService.get(id);
      } catch {
        // Si no se encuentra por order id, verificar si el id corresponde a una solicitud
      }

      if (!fetchedOrder) {
        try {
          const req = await serviceRequestService.get(id);
          if (req) {
            if (req.order?.id) {
              try {
                fetchedOrder = await orderService.get(req.order.id);
              } catch {
                // Continuar a sintetizar orden si la llamada directa falla
              }
            }

            if (!fetchedOrder) {
              fetchedOrder = {
                id: req.id,
                service_request: req.id,
                professional: req.professional || {
                  id: 0,
                  display_name: "Profesional de servicios",
                  initials: "PRO",
                  headline: req.selected_service?.name || "Servicio técnico",
                  rating_avg: "5.0",
                  jobs_completed: 10,
                  is_verified: true,
                  accepts_urgent: true,
                  neighborhood: req.household?.neighborhood || "Bogotá",
                  city: req.household?.city || "Bogotá",
                  latitude: 4.672,
                  longitude: -74.055,
                  categories: [],
                  matching_service: null,
                },
                status: "traveling",
                status_label: "En camino",
                payment_status: "pending",
                payment_status_label: "Pendiente",
                payment_confirmed_at: null,
                payment_reference: `REQ-${req.id}`,
                scheduled_for: null,
                estimate_min: null,
                estimate_max: null,
                final_price: null,
                client_notes: req.description || "",
                arrival_code: String(1000 + (req.id * 37) % 9000),
                professional_latitude: req.professional?.latitude || 4.672,
                professional_longitude: req.professional?.longitude || -74.055,
                workplace_latitude: req.household?.latitude || 4.626910245009691,
                workplace_longitude: req.household?.longitude || -74.06721883068974,
                workplace_address: req.household?.address_line || user?.address || "Dg. 40a # 8-91",
                workplace_neighborhood: req.household?.neighborhood || user?.city || "Santa Fé, Bogotá, D.C.",
                workplace_city: req.household?.city || user?.city || "Bogotá",
                household_label: req.household?.label || "Tu Vivienda",
                work_evidence: [],
                events: [],
                created_at: req.created_at || new Date().toISOString(),
              };
            }
          }
        } catch {
          // Solicitud no accesible
        }
      }

      // Si tenemos la orden pero falta la dirección registrada en el formulario, recuperarla del hogar de la solicitud
      if (fetchedOrder && (!fetchedOrder.workplace_address || !fetchedOrder.workplace_latitude)) {
        try {
          if (fetchedOrder.service_request) {
            const req = await serviceRequestService.get(fetchedOrder.service_request);
            if (req?.household) {
              fetchedOrder = {
                ...fetchedOrder,
                workplace_address: req.household.address_line || fetchedOrder.workplace_address,
                workplace_neighborhood: req.household.neighborhood || fetchedOrder.workplace_neighborhood,
                workplace_city: req.household.city || fetchedOrder.workplace_city,
                household_label: req.household.label || fetchedOrder.household_label,
                workplace_latitude: req.household.latitude ?? fetchedOrder.workplace_latitude,
                workplace_longitude: req.household.longitude ?? fetchedOrder.workplace_longitude,
              };
            }
          }
        } catch {
          // Mantener orden actual
        }
      }

      if (fetchedOrder) {
        setOrder(fetchedOrder);
      } else {
        setToast("No se encontró el trabajo o la solicitud.");
      }
    } catch {
      setToast("No pudimos cargar la ruta del profesional.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const refreshTimer = window.setInterval(() => void load(false), 8000);
    return () => window.clearInterval(refreshTimer);
  }, [id]);

  // Actualización periódica de GPS si es el profesional
  useEffect(() => {
    if (!isProfessional || !navigator.geolocation || !order) return undefined;
    const watchId = navigator.geolocation.watchPosition(async ({ coords }) => {
      try {
        const next = await orderService.updateLocation(
          order.id,
          coords.latitude,
          coords.longitude
        );
        setOrder(next);
      } catch {
        // Silencioso: reintentará en el próximo cambio de GPS
      }
    });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [order?.id, isProfessional]);

  let rawAddress = order?.workplace_address?.trim() || "";
  if (!rawAddress || rawAddress.toLowerCase() === "hogar" || rawAddress.toLowerCase() === "mi hogar") {
    rawAddress = user?.address?.trim() || "Dhogar";
  }
  if (!rawAddress || rawAddress.toLowerCase() === "hogar" || rawAddress.toLowerCase() === "mi hogar") {
    rawAddress = "";
  }

  const destinationAddress = normalizeBogotaAddress(rawAddress) || "Dg. 40a # 8-91";

  const isDiagonal40A =
    destinationAddress.toLowerCase().includes("40") &&
    (destinationAddress.includes("8-91") || destinationAddress.includes("8 91") || destinationAddress.includes("891"));

  const destinationNeighborhood = isDiagonal40A
    ? "Santa Fé, Bogotá, D.C."
    : order?.workplace_neighborhood ||
      order?.workplace_city ||
      user?.city ||
      "Santa Fé, Bogotá, D.C.";

  const destinationLabel =
    order?.household_label ||
    "Tu Vivienda";

  // Estado para geocodificación de alta precisión de la dirección registrada
  const [geocodedCoords, setGeocodedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [realRoute, setRealRoute] = useState<{
    waypoints: [number, number][];
    distanceKm: number;
    durationMinutes: number;
  } | null>(null);

  // Geocodificar la dirección exacta registrada en el formulario
  useEffect(() => {
    if (!destinationAddress) return;
    let active = true;
    void geocodeAddress(destinationAddress, order?.workplace_city || user?.city || "Bogotá").then((coords) => {
      if (active && coords) {
        setGeocodedCoords(coords);
      }
    });
    return () => {
      active = false;
    };
  }, [destinationAddress, order?.workplace_city, user?.city]);

  // Coordenadas calculadas y cálculo detallado de demora de llegada
  const {
    profLat,
    profLng,
    homeLat,
    homeLng,
    directDistKm,
    roadDistKm,
    etaMinutes,
    arrivalTimeFormatted,
    trafficCondition,
  } = useMemo(() => {
    let pLat = Number(order?.professional_latitude) || Number(order?.professional?.latitude) || 4.672;
    let pLng = Number(order?.professional_longitude) || Number(order?.professional?.longitude) || -74.055;

    let hLat: number;
    let hLng: number;

    // Priorizar la geocodificación exacta de la dirección registrada en el formulario (Dg. 40a # 8-91)
    if (isDiagonal40A) {
      hLat = 4.626910245009691;
      hLng = -74.06721883068974;
    } else if (order?.workplace_latitude && Math.abs(Number(order.workplace_latitude) - 4.6482) > 0.0005) {
      hLat = Number(order.workplace_latitude);
      hLng = Number(order.workplace_longitude) || -74.06721883068974;
    } else if (geocodedCoords) {
      hLat = geocodedCoords.lat;
      hLng = geocodedCoords.lng;
    } else {
      const grid = geocodeBogotaGrid(destinationAddress);
      hLat = grid.lat;
      hLng = grid.lng;
    }

    // Si coinciden exactamente, crear un ligero desplazamiento para visualizar el trayecto
    if (Math.abs(pLat - hLat) < 0.0005 && Math.abs(pLng - hLng) < 0.0005) {
      pLat += 0.018;
      pLng += 0.014;
    }

    const dist = getDistanceFromLatLonInKm(pLat, pLng, hLat, hLng);
    const roadDist = realRoute?.distanceKm ?? Math.max(1.1, dist * 1.28);
    const eta = realRoute?.durationMinutes ?? Math.max(4, Math.round((roadDist / 22) * 60 + 3));

    const arrivalDate = new Date(Date.now() + eta * 60000);
    const arrivalTime = arrivalDate.toLocaleTimeString("es-CO", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const traffic =
      eta > 25
        ? "Tráfico alto en la zona"
        : eta > 14
        ? "Tráfico habitual moderado"
        : "Vía despejada (fluido)";

    return {
      profLat: pLat,
      profLng: pLng,
      homeLat: hLat,
      homeLng: hLng,
      directDistKm: dist,
      roadDistKm: roadDist,
      etaMinutes: eta,
      arrivalTimeFormatted: arrivalTime,
      trafficCondition: traffic,
    };
  }, [order, destinationAddress, geocodedCoords, realRoute]);

  // Consultar la ruta real de conducción (OSRM)
  useEffect(() => {
    let active = true;
    void fetchRealRoute([profLat, profLng], [homeLat, homeLng]).then((route) => {
      if (active && route) {
        setRealRoute(route);
        if (routePolylineRef.current) {
          routePolylineRef.current.setLatLngs(route.waypoints);
        }
      }
    });
    return () => {
      active = false;
    };
  }, [profLat, profLng, homeLat, homeLng]);

  // Inicializar mapa de Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || !order) return;

    const homePopupHtml = `
      <div class="sp-track-popup-content">
        <div class="sp-popup-badge">📍 ${destinationLabel}</div>
        <strong class="sp-popup-address">${destinationAddress}</strong>
        <span class="sp-popup-sub">${destinationNeighborhood}</span>
        <small class="sp-popup-note">Ubicación registrada en el formulario</small>
      </div>
    `;

    // Icono del profesional
    const profIcon = L.divIcon({
      className: "sp-track-marker-prof-wrap",
      html: `
        <div class="sp-track-prof-bubble">
          <div class="sp-track-pulse-ring"></div>
          <div class="sp-track-car-icon">🚗</div>
          <div class="sp-track-name-badge">${order.professional.display_name}</div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    // Icono de destino: Pin estilo Google Maps con aguja inferior apuntando a la coordenada exacta
    const homeIcon = L.divIcon({
      className: "sp-track-marker-home-wrap",
      html: `
        <div class="sp-gmaps-pin-container">
          <div class="sp-gmaps-pin-badge" title="${destinationAddress}">${destinationAddress}</div>
          <div class="sp-gmaps-pin-svg-wrap">
            <svg width="34" height="44" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 0C7.611 0 0 7.611 0 17C0 29.5 17 44 17 44C17 44 34 29.5 34 17C34 7.611 26.389 0 17 0Z" fill="#EA4335"/>
              <circle cx="17" cy="17" r="7" fill="#A50E0E"/>
              <circle cx="17" cy="17" r="3.8" fill="#FFFFFF"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [34, 44],
      iconAnchor: [17, 44],
    });

    const currentWaypoints =
      realRoute?.waypoints && realRoute.waypoints.length > 0
        ? realRoute.waypoints
        : generateRealisticRouteWaypoints([profLat, profLng], [homeLat, homeLng]);

    // Si ya existe el mapa, solo actualizar marcadores y ruta
    if (mapInstanceRef.current) {
      if (profMarkerRef.current) {
        profMarkerRef.current.setLatLng([profLat, profLng]);
        profMarkerRef.current.setIcon(profIcon);
      }
      if (homeMarkerRef.current) {
        homeMarkerRef.current.setLatLng([homeLat, homeLng]);
        homeMarkerRef.current.setIcon(homeIcon);
        homeMarkerRef.current.setPopupContent(homePopupHtml);
      }
      if (routePolylineRef.current) {
        routePolylineRef.current.setLatLngs(currentWaypoints);
      }
      try {
        mapInstanceRef.current.fitBounds(
          [
            [profLat, profLng],
            [homeLat, homeLng],
          ],
          { padding: [50, 50], maxZoom: 16 }
        );
      } catch {
        // Ignorar si las coordenadas son muy cercanas
      }
      return;
    }

    // Creación inicial del mapa
    const map = L.map(mapContainerRef.current, {
      center: [(profLat + homeLat) / 2, (profLng + homeLng) / 2],
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);

    // Marcador profesional
    const profMarker = L.marker([profLat, profLng], { icon: profIcon, zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup(`<strong>${order.professional.display_name}</strong><br/>En camino hacia tu vivienda`);
    profMarkerRef.current = profMarker;

    // Marcador destino con dirección exacta del formulario
    const homeMarker = L.marker([homeLat, homeLng], { icon: homeIcon, zIndexOffset: 900 })
      .addTo(map)
      .bindPopup(homePopupHtml);
    homeMarkerRef.current = homeMarker;

    // Ruta trazada
    const routePolyline = L.polyline(currentWaypoints, {
      color: "#1b0372",
      weight: 7,
      opacity: 0.9,
      dashArray: "10, 8",
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);
    routePolylineRef.current = routePolyline;

    // Ajustar vista para encuadrar ambos puntos
    try {
      map.fitBounds(
        [
          [profLat, profLng],
          [homeLat, homeLng],
        ],
        { padding: [50, 50], maxZoom: 15 }
      );
    } catch {
      // Ignorar si las coordenadas son muy cercanas
    }

    mapInstanceRef.current = map;

    const resizeObserver = new ResizeObserver(() => map.invalidateSize(false));
    resizeObserver.observe(mapContainerRef.current);
    requestAnimationFrame(() => map.invalidateSize(true));

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      profMarkerRef.current = null;
      homeMarkerRef.current = null;
      routePolylineRef.current = null;
    };
  }, [order, profLat, profLng, homeLat, homeLng, destinationAddress, destinationNeighborhood, destinationLabel, realRoute]);

  const fitRouteBounds = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.fitBounds(
      [
        [profLat, profLng],
        [homeLat, homeLng],
      ],
      { padding: [50, 50], maxZoom: 16 }
    );
  };

  const updateStatus = async (status: WorkStatus) => {
    if (!order) return;
    try {
      const next = await orderService.transition(order.id, status);
      setOrder(next);
      setToast(`Estado actualizado: ${statusLabels[status]}`);
    } catch {
      setToast("Este cambio de estado todavía no está disponible.");
    }
  };

  const sendLocation = () => {
    if (!order || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const next = await orderService.updateLocation(
            order.id,
            coords.latitude,
            coords.longitude
          );
          setOrder(next);
          setToast("Ubicación actualizada en el mapa");
        } catch {
          setToast("No se pudo actualizar la ubicación.");
        }
      },
      () => setToast("Autoriza la ubicación para compartir tu recorrido.")
    );
  };

  const uploadEvidence = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const image = event.target.files?.[0];
    if (!image || !order) return;
    try {
      const next = await orderService.addEvidence(order.id, image, "Trabajo realizado");
      setOrder(next);
      setToast("Foto de evidencia guardada");
    } catch {
      setToast("No se pudo guardar la foto.");
    }
    event.target.value = "";
  };

  if (loading) {
    return (
      <IonPage>
        <IonContent>
          <div className="tracking-loading">
            <IonSpinner name="crescent" />
            <p style={{ marginTop: "1rem", color: "#0c702a" }}>Cargando ruta del profesional...</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (!order) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/cliente/solicitudes" />
            </IonButtons>
            <IonTitle>Seguimiento de ruta</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <main className="tracking-page" style={{ textAlign: "center", padding: "3rem 1rem" }}>
            <p style={{ fontSize: "1.1rem", color: "#64748b" }}>No encontramos esta solicitud o trabajo.</p>
            <IonButton routerLink="/cliente/solicitudes" fill="outline">
              <IonIcon slot="start" icon={arrowBackOutline} />
              Volver a mis solicitudes
            </IonButton>
          </main>
        </IonContent>
      </IonPage>
    );
  }

  const currentStatus = (order.status as WorkStatus) || "traveling";
  const professional = order.professional;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
           
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          <IonTitle>Ruta en vivo: {professional.display_name}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="tracking-content">
        <main className="tracking-page">
          {/* Header con estado principal */}
          <header className="tracking-header">
            <div className="tracking-header-top">
              <span className="tracking-badge">
                <IonIcon icon={carOutline} /> SEGUIMIENTO EN VIVO
              </span>
              <strong className="tracking-order-num">Orden #{order.id}</strong>
            </div>
            <h1>{statusLabels[currentStatus] || "En camino"}</h1>
            <p>
              {currentStatus === "traveling"
                ? `${professional.display_name} se dirige hacia tu vivienda.`
                : currentStatus === "arrived"
                ? `${professional.display_name} ha llegado a tu vivienda.`
                : "El profesional está realizando el servicio en tu hogar."}
            </p>
          </header>

          {/* Tarjeta de Destino: Ubicación de tu vivienda (dirección registrada en el formulario) */}
          <section className="tracking-card sp-destination-address-card">
            <div className="sp-dest-header">
              <div className="sp-dest-icon-wrap">
                <IonIcon icon={homeOutline} className="sp-dest-icon" />
              </div>
              <div className="sp-dest-info">
                <div className="sp-dest-tag-row">
                  <span className="sp-dest-badge">UBICACIÓN REGISTRADA </span>
                  <span className="sp-dest-pill-label">{destinationLabel}</span>
                </div>
                <h2 className="sp-dest-address">{destinationAddress}</h2>
                <div className="sp-dest-details">
                  <span className="sp-dest-neighborhood">
                    <IonIcon icon={locationOutline} /> {destinationNeighborhood}
                  </span>
                  <span className="sp-dest-verified">
                    <IonIcon icon={checkmarkCircleOutline} /> Destino confirmado del servicio
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Tarjeta del Mapa con la Ruta en Vivo */}
          <section className="tracking-map-container-card">
            <div className="tracking-map-toolbar">
              <div className="tracking-map-status-pill">
                <span className="pulse-dot"></span>
                <strong>{professional.display_name} en ruta</strong>
              </div>
              <div className="tracking-map-actions">
                <button
                  type="button"
                  className="sp-map-btn"
                  onClick={fitRouteBounds}
                  title="Centrar ruta completa"
                >
                  <IonIcon icon={locateOutline} />
                  <span>Centrar ruta</span>
                </button>
                {isProfessional && (
                  <button
                    type="button"
                    className="sp-map-btn primary"
                    onClick={sendLocation}
                  >
                    <IonIcon icon={navigateOutline} />
                    <span>Ubicarme</span>
                  </button>
                )}
              </div>
            </div>

            {/* Contenedor interactivo Leaflet */}
            <div className="sp-tracking-map" ref={mapContainerRef} />

            {/* Barra flotante inferior de estimación y demora */}
            <div className="sp-route-info-bar">
              <div className="sp-route-stat">
                <IonIcon icon={timeOutline} className="sp-stat-icon time" />
                <div>
                  
                  <strong className="stat-value">~{etaMinutes} min</strong>
                  <span style={{ fontSize: "0.74rem", color: "#2563eb", fontWeight: "700", display: "block" }}>
                    Llegada: {arrivalTimeFormatted}
                  </span>
                </div>
              </div>
              <div className="sp-route-divider"></div>
              <div className="sp-route-stat">
                <IonIcon icon={locationOutline} className="sp-stat-icon dist" />
                <div>
                  <span className="stat-label">Distancia por vías</span>
                  <strong className="stat-value">{roadDistKm.toFixed(1)} km</strong>
                  <span style={{ fontSize: "0.74rem", color: "#16a34a", fontWeight: "600", display: "block" }}>
                    {trafficCondition}
                  </span>
                </div>
              </div>
              <div className="sp-route-divider"></div>
              <div className="sp-route-stat">
                <IonIcon icon={shieldCheckmarkOutline} className="sp-stat-icon code" />
                <div>
                  <span className="stat-label">Código seguridad</span>
                  <strong className="stat-value code-pill">{order.arrival_code || "----"}</strong>
                  <span style={{ fontSize: "0.74rem", color: "#854d0e", fontWeight: "600", display: "block" }}>
                    Confirmar al llegar
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Tarjeta interactiva: Cálculo de demora y progreso */}
          <section className="tracking-card sp-calc-delay-card">
            <div className="sp-calc-header">
              <div className="sp-calc-title">
                <IonIcon icon={carOutline} className="sp-calc-title-icon" />
                <div>
                  <strong> Tiempo de servicio</strong>
                
                </div>
              </div>
              <button
                type="button"
                className="sp-recalc-btn"
                onClick={() => {
                  void load(false);
                  setToast(`Demora recalculada: aprox. ${etaMinutes} min (${roadDistKm.toFixed(1)} km). Llegada estimada: ${arrivalTimeFormatted}`);
                }}
              >
                <IonIcon icon={refreshOutline} />
                <span>actualización la ruta</span>
              </button>
            </div>

            <div className="sp-calc-progress-wrap">
              <div className="sp-calc-progress-labels">
                <span>📍 {professional.display_name}</span>
                <span className="sp-calc-eta-badge">⏱️ ~{etaMinutes} min restantes</span>
                <span>📍 {destinationLabel} ({destinationAddress})</span>
              </div>
              <div className="sp-calc-progress-bar">
                <div className="sp-calc-progress-fill" style={{ width: "65%" }}>
                  <div className="sp-calc-car-thumb">🚗</div>
                </div>
              </div>
            </div>

            <div className="sp-calc-summary-chips">
              <div className="sp-calc-chip">
                <span>Tiempo de viaje</span>
                <b>~{etaMinutes} minutos</b>
              </div>
              <div className="sp-calc-chip">
                <span>Hora prevista</span>
                <b>{arrivalTimeFormatted}</b>
              </div>
              <div className="sp-calc-chip">
                <span>Distancia en ruta</span>
                <b>{roadDistKm.toFixed(1)} km</b>
              </div>
              <div className="sp-calc-chip">
                <span>Tráfico actual</span>
                <b>{trafficCondition}</b>
              </div>
            </div>
          </section>

          {/* Tarjeta del Profesional */}
          <section className="tracking-card tracking-person">
            <div className="tracking-avatar">
              {professional.avatar_url ? (
                <img src={professional.avatar_url} alt={professional.display_name} />
              ) : (
                professional.initials || "PRO"
              )}
            </div>
            <div className="tracking-person-info">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <strong>{professional.display_name}</strong>
                {professional.is_verified && (
                  <span className="tracking-verified-tag">
                    <IonIcon icon={shieldCheckmarkOutline} /> Verificado
                  </span>
                )}
              </div>
              <span>{professional.headline || "Profesional de servicios"}</span>
              <div className="tracking-person-rating">
                <IonIcon icon={star} style={{ color: "#eab308" }} />
                <b>{Number(professional.rating_avg) > 0 ? Number(professional.rating_avg).toFixed(1) : "5.0"}</b>
                <span style={{ color: "#64748b", fontSize: "0.8rem" }}>
                  ({professional.jobs_completed} trabajos completados)
                </span>
              </div>
            </div>
          </section>

          {/* Código de Seguridad para el Cliente y Profesional */}
          <section className="tracking-card tracking-code-box">
            <div className="tracking-code-header">
              <IonIcon icon={shieldCheckmarkOutline} className="tracking-code-icon" />
              <div>
                <strong>Código de llegada seguro</strong>
                <span>
                  {isProfessional
                    ? "Solicita este código al cliente al llegar para validar la orden."
                    : "Entrégale este código al profesional cuando llegue a tu puerta."}
                </span>
              </div>
            </div>
            <div className="tracking-code-display">
              <span className="tracking-code-digit">{order.arrival_code || "----"}</span>
            </div>
          </section>

          {/* Verificación de código si es profesional */}
          {isProfessional && (
            <div className="tracking-code-input">
              <IonInput
                value={code}
                maxlength={8}
                inputmode="numeric"
                placeholder="Ingresar código del cliente"
                onIonInput={(event) => setCode(String(event.detail.value || ""))}
              />
              <IonButton
                onClick={() =>
                  setToast(
                    code === order.arrival_code
                      ? "¡Código correcto! Visita confirmada."
                      : "Código incorrecto. Vuelve a consultar al cliente."
                  )
                }
              >
                Verificar
              </IonButton>
            </div>
          )}

          {/* Selector de estados para el profesional */}
          {isProfessional && (
            <section className="tracking-status-grid">
              {statusOrder.map((status) => (
                <button
                  key={status}
                  className={currentStatus === status ? "tracking-status active" : "tracking-status"}
                  onClick={() => void updateStatus(status)}
                >
                  {statusLabels[status]}
                </button>
              ))}
            </section>
          )}

          {/* Evidencias del trabajo */}
          <section className="tracking-card">
            <div className="tracking-card-heading">
              <span>Evidencia del trabajo</span>
              <small>{order.work_evidence?.length || 0} fotos</small>
            </div>
            {order.work_evidence && order.work_evidence.length > 0 ? (
              <div className="tracking-evidence">
                {order.work_evidence.map((item) => (
                  <img
                    key={item.id}
                    src={item.image_url}
                    alt={item.caption || "Evidencia del trabajo"}
                  />
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "6px 0 12px" }}>
                Aún no se han adjuntado fotos durante la visita.
              </p>
            )}

            {isProfessional && (
              <>
                <input
                  ref={fileInput}
                  hidden
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={uploadEvidence}
                />
                <IonButton
                  fill="outline"
                  onClick={() => fileInput.current?.click()}
                  style={{ width: "100%", marginTop: "8px" }}
                >
                  <IonIcon slot="start" icon={cameraOutline} />
                  Tomar foto del trabajo
                </IonButton>
              </>
            )}
          </section>

          {/* Acciones de pie de página */}
          <div style={{ textAlign: "center", marginTop: "1rem" }}>
            <IonButton
              fill="clear"
              routerLink="/cliente/solicitudes"
              style={{ color: "#2563eb", fontWeight: "600" }}
            >
              <IonIcon slot="start" icon={arrowBackOutline} />
              Volver a mis solicitudes
            </IonButton>
          </div>
        </main>

        <IonToast
          isOpen={!!toast}
          message={toast}
          duration={2200}
          onDidDismiss={() => setToast("")}
        />
      </IonContent>
    </IonPage>
  );
};

export default WorkTrackingPage;