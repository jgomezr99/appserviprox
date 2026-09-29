import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useHistory, useLocation } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  closeCircleOutline,
  expandOutline,
  flashOutline,
  listOutline,
  locationOutline,
  mapOutline,
  navigateOutline,
  searchOutline,
  shieldCheckmarkOutline,
  sparkles,
  star,
  timeOutline,
  radioOutline,
  chevronBackOutline,
  chevronForwardOutline,
} from "ionicons/icons";

import {
  BOGOTA_LOCALITIES,
  CONTRACTORS_MAP_DATA,
  USER_PROJECT_LOCATION,
  WORK_SPECIALTIES,
  type MapContractor,
  type UserProjectLocation,
} from "../data/contractorMapData";
import { professionalSearchService, pqrService } from "../services/serviprox";
import type { Professional } from "../types/serviprox";
import type { PqrReport, PqrContractorRef, AppProblemReport } from "../types/serviprox";
import {
  getStoredPqrReports,
  saveStoredPqrReports,
  getStoredAppProblems,
  saveStoredAppProblems,
} from "../data/pqrInitialData";
import { PqrDetailModal } from "../components/pqr/PqrDetailModal";

import { PqrReportModal } from "../components/pqr/PqrReportModal";
import { PqrListView } from "../components/pqr/PqrListView";
import { LiveSupportChatModal } from "../components/pqr/LiveSupportChatModal";
import "./ContractorMapPage.css";


const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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

const toMapContractor = (
  professional: Professional,
  index: number,
  projectLocation: UserProjectLocation
): MapContractor => {
  const matchingService = professional.matching_service;
  const specialty = matchingService?.category_name || professional.categories[0] || "Servicios para el hogar";
  const priceValue = Number(matchingService?.price_min);
  const price = Number.isFinite(priceValue) && priceValue > 0 ? priceValue : null;
  const rawLat = professional.latitude !== null && professional.latitude !== undefined
    ? Number(professional.latitude)
    : projectLocation.lat + (index + 1) * 0.004;
  const rawLng = professional.longitude !== null && professional.longitude !== undefined
    ? Number(professional.longitude)
    : projectLocation.lng + (index + 1) * 0.004;
  const latitude = Number.isFinite(rawLat) ? rawLat : projectLocation.lat;
  const longitude = Number.isFinite(rawLng) ? rawLng : projectLocation.lng;

  const rawDist = professional.distance_km !== undefined && professional.distance_km !== null
    ? Number(professional.distance_km)
    : getDistanceFromLatLonInKm(projectLocation.lat, projectLocation.lng, latitude, longitude);
  const distanceKm = Number.isFinite(rawDist) ? rawDist : 0;

  return {
    id: String(professional.slug || professional.id),
    name: professional.display_name,
    shortName: professional.display_name,
    businessName: professional.company_name || professional.headline || professional.display_name,
    subtitle: `${professional.headline || professional.specialty_label || "Especialista"} • ${professional.jobs_completed} trabajos completados`,
    avatar: professional.avatar_url || "",
    rating: Number(professional.rating_avg) || 0,
    reviewsCount: professional.jobs_completed,
    locality: professional.neighborhood || "Bogotá",
    neighborhood: professional.neighborhood || "Bogotá",
    city: professional.city || "Bogotá D.C.",
    distanceKm,
    estimatedMinutes: Math.max(5, Math.round((distanceKm || 1) * 4)),
    visitPriceCop: price,
    specialty,
    specialtyLabel: matchingService?.service_name || professional.specialty_label || specialty,
    specialties: professional.categories.length ? professional.categories : [specialty],
    badges: [],
    jobsCompleted: professional.jobs_completed,
    lat: latitude,
    lng: longitude,
    isAvailableInZone: true,
    acceptsUrgent24h: professional.accepts_urgent,
    hasPolicyOrRetie: professional.is_verified,
    availabilityLabel: professional.availability_label || "Horario por acordar",
  };
};

const renderTechnicianPinSvg = (clipId: string) => `
  <svg class="sp-technician-pin-svg" width="38" height="46" viewBox="0 0 38 46" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow-${clipId}" x="0" y="0" width="38" height="46" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="2.5" stdDeviation="2" flood-color="#0f172a" flood-opacity="0.32"/>
      </filter>
      <clipPath id="avatarClip-${clipId}">
        <circle cx="19" cy="17" r="13.5"/>
      </clipPath>
    </defs>
    <path d="M19 0C9.6 0 2 7.6 2 17C2 28.5 19 44 19 44C19 44 36 28.5 36 17C36 7.6 28.4 0 19 0Z" fill="#1d4ed8" stroke="#ffffff" stroke-width="2" filter="url(#shadow-${clipId})"/>
    <circle cx="19" cy="17" r="14.5" fill="#bae6fd"/>
    <g clip-path="url(#avatarClip-${clipId})">
      <path d="M8 34C8 26 13 24 19 24C25 24 30 26 30 34Z" fill="#1e40af"/>
      <path d="M16 24L19 28L22 24Z" fill="#ffffff"/>
      <rect x="16.5" y="21" width="5" height="4" rx="1.5" fill="#fed7aa"/>
      <ellipse cx="19" cy="16.5" rx="7.5" ry="7" fill="#fed7aa"/>
      <circle cx="11.5" cy="16.5" r="1.8" fill="#fed7aa"/>
      <circle cx="26.5" cy="16.5" r="1.8" fill="#fed7aa"/>
      <ellipse cx="16.2" cy="15.2" rx="1.6" ry="2" fill="#1e293b"/>
      <circle cx="15.7" cy="14.6" r="0.6" fill="#ffffff"/>
      <ellipse cx="21.8" cy="15.2" rx="1.6" ry="2" fill="#1e293b"/>
      <circle cx="21.3" cy="14.6" r="0.6" fill="#ffffff"/>
      <circle cx="14.5" cy="17.2" r="1.4" fill="#fca5a5" opacity="0.6"/>
      <circle cx="23.5" cy="17.2" r="1.4" fill="#fca5a5" opacity="0.6"/>
      <path d="M16 17.8Q19 21.2 22 17.8Z" fill="#b91c1c"/>
      <path d="M16.8 17.8Q19 19.2 21.2 17.8Z" fill="#ffffff"/>
      <path d="M12.5 13.5C13.5 15 14.5 15.5 14.5 15.5" stroke="#78350f" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M25.5 13.5C24.5 15 23.5 15.5 23.5 15.5" stroke="#78350f" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M12 12C12 7.5 15 4.8 19 4.8C23 4.8 26 7.5 26 12Z" fill="#1d4ed8"/>
      <ellipse cx="19" cy="12" rx="9" ry="2.2" fill="#1e40af"/>
      <path d="M19 6.8L16.2 9V11.2H21.8V9L19 6.8Z" fill="#ffffff"/>
      <rect x="18.2" y="9.4" width="1.6" height="1.8" fill="#1d4ed8"/>
    </g>
  </svg>
`;

const buildContractorPopupHtml = (contractor: MapContractor): string => {
  const locality = (contractor.locality || "BOGOTÁ").toUpperCase();
  const neighborhood = (contractor.neighborhood || contractor.locality || "BOGOTÁ").toUpperCase();
  const headerLocation = `${neighborhood} / ${locality}, BOGOTÁ`;
  const ratingVal = contractor.rating.toFixed(1);
  const reviewsVal = `(${contractor.reviewsCount})`;
  const businessName = contractor.businessName || contractor.name;
  const proName = contractor.name || contractor.shortName;
  const specialtyLabel = contractor.specialtyLabel || contractor.specialty || "Servicios profesionales";
  const distanceFormatted = `~${contractor.distanceKm.toFixed(1)} km`;
  const priceFormatted = contractor.visitPriceCop
    ? `$ ${contractor.visitPriceCop.toLocaleString("es-CO")}`
    : "$ 35.000";

  return `
    <div class="sp-popup-card">
      <div class="sp-popup-header-row">
        <span class="sp-popup-location">${headerLocation}</span>
        <span class="sp-popup-rating">
          <span class="sp-popup-star">★</span>
          <span class="sp-popup-rating-val">${ratingVal}</span>
          <span class="sp-popup-rating-count">${reviewsVal}</span>
        </span>
      </div>

      <div class="sp-popup-title">${businessName}</div>

      <div class="sp-popup-pro-row">
        <span class="sp-popup-pro-icon">👷</span>
        <span class="sp-popup-pro-label">Profesional:</span>
        <span class="sp-popup-pro-name">${proName}</span>
      </div>

      <div class="sp-popup-specialty">${specialtyLabel}</div>

      <div class="sp-popup-status-row">
        <div class="sp-popup-status-badge ${!contractor.isAvailableInZone ? "sp-popup-status-badge--offline" : ""}">
          <span class="sp-popup-status-dot ${!contractor.isAvailableInZone ? "sp-popup-status-dot--offline" : ""}"></span>
          <span>${contractor.isAvailableInZone ? "DISPONIBLE HOY EN LA ZONA" : "DISPONIBILIDAD POR CONFIRMAR"}</span>
        </div>
        <span class="sp-popup-distance">${distanceFormatted}</span>
      </div>

      <div class="sp-popup-price-row">
        <span class="sp-popup-price-label">Visita técnica diagnóstica:</span>
        <span class="sp-popup-price-value">${priceFormatted}</span>
      </div>

      <button type="button" class="sp-popup-action-btn" onclick="window.__serviproxGoToContractor && window.__serviproxGoToContractor('${contractor.id}')">
        <span class="sp-popup-hand">👉</span>
        <span>Clic en el pin para ver todos los datos</span>
      </button>
    </div>
  `;
};

const ContractorMapPage: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const homeMarkerRef = useRef<L.Marker | null>(null);
  const coverageCircleRef = useRef<L.Circle | null>(null);
  const localityScrollRef = useRef<HTMLDivElement | null>(null);
  const specialtyScrollRef = useRef<HTMLDivElement | null>(null);
  const activeMarkerRef = useRef<Record<string, L.Marker>>({});
  const [mapReady, setMapReady] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocality, setSelectedLocality] = useState("Todas");
  const [selectedSpecialty, setSelectedSpecialty] = useState("Todas las Especialidades");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cat = params.get("category");
    if (cat) {
      const match = WORK_SPECIALTIES.find(
        (s) =>
          s.toLowerCase().includes(cat.toLowerCase()) ||
          cat.toLowerCase().includes(s.toLowerCase())
      );
      if (match) {
        setSelectedSpecialty(match);
      } else {
        setSearchQuery(cat);
      }
    }
  }, [location.search]);
  const [filterAvailable, setFilterAvailable] = useState(true);
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [filterPolicy, setFilterPolicy] = useState(false);
  const [radiusKm, setRadiusKm] = useState(50);
  const [showCoverageRadius, setShowCoverageRadius] = useState(true);
  const [selectedContractorId, setSelectedContractorId] = useState<string>("cerrajeria-express");
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [contractors, setContractors] = useState<MapContractor[]>(CONTRACTORS_MAP_DATA);
  const [projectLocation, setProjectLocation] = useState<UserProjectLocation>(USER_PROJECT_LOCATION);

  // ── PQR State ─────────────────────────────────────────────────────────────
  const [pqrReports, setPqrReports] = useState<PqrReport[]>(() => getStoredPqrReports());
  const [appProblemReports, setAppProblemReports] = useState<AppProblemReport[]>(() => getStoredAppProblems());
  const [showPqrListView, setShowPqrListView] = useState(false);

  const [showPqrReportModal, setShowPqrReportModal] = useState(false);
  const [showLiveChatModal, setShowLiveChatModal] = useState(false);
  const [showPqrDetailModal, setShowPqrDetailModal] = useState(false);
  const [selectedPqrReport, setSelectedPqrReport] = useState<PqrReport | null>(null);
  const [pqrTargetContractor, setPqrTargetContractor] = useState<PqrContractorRef | undefined>(undefined);

  const formatDistance = (distance: number) => `${distance.toFixed(1)} km`;

  const getInitials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();

  useEffect(() => {
    if (!navigator.geolocation) return;

    const updateLocation = async ({ coords }: GeolocationPosition) => {
      const distFromBogota = getDistanceFromLatLonInKm(
        coords.latitude,
        coords.longitude,
        USER_PROJECT_LOCATION.lat,
        USER_PROJECT_LOCATION.lng
      );

      // Si el usuario está en Bogotá o alrededores (<= 50km), actualizamos su ubicación real.
      // Si está más lejos (pruebas en otra ciudad o país), se preserva la ubicación demo de Bogotá
      // para evitar que los contratistas queden fuera de rango.
      if (distFromBogota <= 50) {
        const location = {
          label: "Mi ubicación",
          address: `Ubicación actual (${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)})`,
          lat: coords.latitude,
          lng: coords.longitude,
        } satisfies UserProjectLocation;
        setProjectLocation(location);

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}&zoom=18&addressdetails=1`,
            { headers: { Accept: "application/json", "Accept-Language": "es" } }
          );
          if (!response.ok) return;
          const payload = (await response.json()) as { display_name?: string };
          if (payload.display_name) {
            setProjectLocation((current) => ({
              ...current,
              address: payload.display_name || current.address,
            }));
          }
        } catch {
          // Conserva las coordenadas reales si no se puede resolver la dirección.
        }
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      updateLocation,
      () => {
        // Mantiene la ubicación de Bogotá configurada como respaldo.
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    let active = true;
    const distFromBogota = getDistanceFromLatLonInKm(
      projectLocation.lat,
      projectLocation.lng,
      USER_PROJECT_LOCATION.lat,
      USER_PROJECT_LOCATION.lng
    );
    const searchLat = distFromBogota <= 50 ? projectLocation.lat : USER_PROJECT_LOCATION.lat;
    const searchLng = distFromBogota <= 50 ? projectLocation.lng : USER_PROJECT_LOCATION.lng;

    professionalSearchService
      .list({
        lat: searchLat,
        lng: searchLng,
        radius_km: 50,
      })
      .then((professionals) => {
        if (!active || !professionals || !professionals.length) return;
        const validPros = professionals.filter(
          (p) => p.latitude !== null && p.latitude !== undefined &&
                 p.longitude !== null && p.longitude !== undefined &&
                 Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))
        );
        if (!validPros.length) return;

        const nextContractors = validPros.map((professional, index) =>
          toMapContractor(professional, index, projectLocation)
        );
        if (nextContractors.length > 0) {
          setContractors(nextContractors);
          setSelectedContractorId(String(nextContractors[0].id));
        }
      })
      .catch(() => {
        // El mapa conserva los datos demo si la API no está disponible.
      });

    return () => {
      active = false;
    };
  }, [projectLocation]);

  useEffect(() => {
    (window as any).__serviproxGoToContractor = (contractorId: string) => {
      history.push(`/cliente/profesionales/${contractorId}`);
    };
    return () => {
      delete (window as any).__serviproxGoToContractor;
    };
  }, [history]);

  // Filtered Contractors
  const filteredContractors = useMemo(() => {
    return contractors.filter((item) => {
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q) || item.businessName.toLowerCase().includes(q);
        const matchesSub = item.subtitle.toLowerCase().includes(q);
        const matchesSpecialty = item.specialties.some((s) => s.toLowerCase().includes(q));
        const matchesLoc = item.locality.toLowerCase().includes(q) || item.neighborhood.toLowerCase().includes(q);
        if (!matchesName && !matchesSub && !matchesSpecialty && !matchesLoc) {
          return false;
        }
      }

      // Locality filter
      if (selectedLocality !== "Todas") {
        const selLoc = selectedLocality.toLowerCase();
        const itemLoc = (item.locality || "").toLowerCase();
        const itemNeigh = (item.neighborhood || "").toLowerCase();
        if (!itemLoc.includes(selLoc) && !itemNeigh.includes(selLoc)) {
          return false;
        }
      }

      // Specialty filter
      if (selectedSpecialty !== "Todas las Especialidades") {
        const selSpec = selectedSpecialty.toLowerCase();
        const matchesSpec =
          item.specialty.toLowerCase().includes(selSpec) ||
          item.specialtyLabel.toLowerCase().includes(selSpec) ||
          item.specialties.some((s) => s.toLowerCase().includes(selSpec));
        if (!matchesSpec) {
          return false;
        }
      }

      // Available filter
      if (filterAvailable && !item.isAvailableInZone) {
        return false;
      }

      // Urgent filter
      if (filterUrgent && !item.acceptsUrgent24h) {
        return false;
      }

      // Policy filter
      if (filterPolicy && !item.hasPolicyOrRetie) {
        return false;
      }

      // Radius filter: solo filtrar si tiene distancia calculada y supera el radio
      if (item.distanceKm > 0 && item.distanceKm > radiusKm) {
        return false;
      }

      return true;
    }).sort((a, b) => a.distanceKm - b.distanceKm || b.rating - a.rating);
  }, [contractors, searchQuery, selectedLocality, selectedSpecialty, filterAvailable, filterUrgent, filterPolicy, radiusKm]);

  // Closest contractor
  const closestContractor = useMemo(() => {
    if (!filteredContractors.length) return null;
    return filteredContractors.reduce((min, curr) => (curr.distanceKm < min.distanceKm ? curr : min), filteredContractors[0]);
  }, [filteredContractors]);

  // Initialize Map ONCE on mount
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [4.656, -74.075],
      zoom: 12.6,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);

    // Layer group for dynamic contractor markers
    const markersGroup = L.layerGroup().addTo(map);
    markersLayerGroupRef.current = markersGroup;

    const homeIcon = L.divIcon({
      className: "sp-custom-marker-wrapper",
      html: `
        <div class="sp-tu-obra-marker-wrap">
          <div class="sp-tu-obra-capsule">
            <span> 🏠  Hogar </span>
          </div>
          <div class="sp-tu-obra-pin-icon">
            <svg width="28" height="38" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 0C6.3 0 0 6.3 0 14C0 24.5 14 38 14 38C14 38 28 24.5 28 14C28 6.3 21.7 0 14 0Z" fill="#dc2626" stroke="#ffffff" stroke-width="2.5"/>
              <circle cx="14" cy="14" r="5" fill="#ffffff"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    const homeMarker = L.marker([projectLocation.lat, projectLocation.lng], {
      icon: homeIcon,
      zIndexOffset: 1200,
    })
      .addTo(map)
      .bindPopup(`<strong>Tu Obra</strong><br/>${projectLocation.address}`);
    homeMarkerRef.current = homeMarker;

    mapInstanceRef.current = map;
    setMapReady(true);

    const resizeObserver = new ResizeObserver(() => map.invalidateSize(false));
    resizeObserver.observe(mapContainerRef.current);
    requestAnimationFrame(() => map.invalidateSize(true));
    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize(true);
      map.setView([4.656, -74.075], 12.6);
    }, 250);

    return () => {
      resizeObserver.disconnect();
      window.clearTimeout(resizeTimer);
      map.remove();
      mapInstanceRef.current = null;
      markersLayerGroupRef.current = null;
      homeMarkerRef.current = null;
      coverageCircleRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Update Home Marker position when projectLocation changes
  useEffect(() => {
    if (homeMarkerRef.current) {
      homeMarkerRef.current.setLatLng([projectLocation.lat, projectLocation.lng]);
      homeMarkerRef.current.setPopupContent(`<strong>Tu Obra</strong><br/>${projectLocation.address}`);
    }
  }, [projectLocation]);

  // Update Coverage Radius Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    if (coverageCircleRef.current) {
      coverageCircleRef.current.remove();
      coverageCircleRef.current = null;
    }

    if (showCoverageRadius) {
      const circle = L.circle([projectLocation.lat, projectLocation.lng], {
        radius: radiusKm * 1000,
        color: "#0e2fe9",
        weight: 1.5,
        dashArray: "6, 6",
        fillColor: "#3e55d6",
        fillOpacity: 0.07,
      }).addTo(map);
      coverageCircleRef.current = circle;
    }
  }, [projectLocation, showCoverageRadius, radiusKm, mapReady]);

  // Update Contractor Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerGroupRef.current;
    if (!map || !markersGroup || !mapReady) return;

    markersGroup.clearLayers();
    activeMarkerRef.current = {};

    filteredContractors.forEach((contractor) => {
      const lat = Number(contractor.lat);
      const lng = Number(contractor.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const isSelected = contractor.id === selectedContractorId;
      const safeId = String(contractor.id).replace(/[^a-zA-Z0-9_-]/g, "_");

      const markerHtml = `
        <div class="sp-map-marker-item ${isSelected ? "is-selected" : ""}" id="marker-cont-${safeId}">
          <div class="sp-marker-bubble-pill">
            <span class="sp-marker-name">${contractor.shortName}</span>
            <span class="sp-marker-star">★</span>
            <span class="sp-marker-rating-num">${contractor.rating.toFixed(1)}</span>
            <span class="sp-marker-zone-tag">En Zona</span>
          </div>

          <div class="sp-marker-pin-head">
            ${renderTechnicianPinSvg(safeId)}
          </div>
        </div>
      `;


      const icon = L.divIcon({
        className: "sp-custom-marker-wrapper",
        html: markerHtml,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([lat, lng], {
        icon,
        zIndexOffset: isSelected ? 1000 : 200,
      });

      marker.on("click", () => {
        setSelectedContractorId(contractor.id);
        marker.openPopup();
        const cardElem = document.getElementById(`contractor-card-${contractor.id}`);
        if (cardElem) {
          cardElem.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });

      marker.bindPopup(buildContractorPopupHtml(contractor), {
        closeButton: false,
        className: "sp-leaflet-custom-popup",
        offset: [0, -70],
        autoPan: true,
        autoPanPadding: [25, 25],
      });

      marker.addTo(markersGroup);
      activeMarkerRef.current[contractor.id] = marker;
    });

    if (selectedContractorId && activeMarkerRef.current[selectedContractorId]) {
      const selectedMarker = activeMarkerRef.current[selectedContractorId];
      window.setTimeout(() => {
        selectedMarker.openPopup();
      }, 150);
    }
  }, [filteredContractors, selectedContractorId, mapReady]);

  // Handle focusing a contractor
  const handleFocusContractor = (contractor: MapContractor) => {
    setSelectedContractorId(contractor.id);
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([contractor.lat, contractor.lng], 14.5, {
        duration: 0.8,
      });
    }
    const marker = activeMarkerRef.current[contractor.id];
    if (marker) {
      marker.openPopup();
    }
  };

  // ── PQR Helpers ─────────────────────────────────────────────────────────

  /** Convert a MapContractor into the leaner PqrContractorRef shape */
  const toContractorRef = (c: MapContractor): PqrContractorRef => ({
    id: c.id,
    name: c.name,
    companyName: c.businessName,
    specialtyLabel: c.specialtyLabel,
    avatarUrl: c.avatar || undefined,
    neighborhood: c.neighborhood,
  });

  /** Full list of contractor refs for the PQR selectors */
  const allContractorRefs: PqrContractorRef[] = contractors.map(toContractorRef);

  const handleOpenPqrModal = (contractor?: PqrContractorRef) => {
    setPqrTargetContractor(contractor);
    setShowPqrReportModal(true);
  };

  const handleSubmitPqr = async (
    data: PqrReport | Omit<PqrReport, 'id' | 'radicadoNumber' | 'status' | 'createdAt' | 'estimatedResponseDays'>
  ) => {
    // Si ya viene creado desde PqrReportModal con id y radicado oficial
    if ('id' in data && 'radicadoNumber' in data && data.id && data.radicadoNumber) {
      const created = data as PqrReport;
      setPqrReports((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      saveStoredPqrReports([created, ...getStoredPqrReports().filter((r) => r.id !== created.id)]);
      return;
    }

    try {
      const created = await pqrService.create(data);
      setPqrReports((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      saveStoredPqrReports([created, ...getStoredPqrReports().filter((r) => r.id !== created.id)]);
    } catch {
      const newReport: PqrReport = {
        ...data,
        id: `pqr-${Date.now()}`,
        radicadoNumber: `PQR-BOG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'radicado',
        createdAt: new Date().toISOString(),
        estimatedResponseDays: 2,
        messages: [],
      };
      setPqrReports((prev) => {
        const updated = [newReport, ...prev];
        saveStoredPqrReports(updated);
        return updated;
      });
    }
  };

  const handleSendPqrMessage = async (pqrId: string, text: string) => {
    try {
      const newMsg = await pqrService.sendMessage(pqrId, text);
      setPqrReports((prev) => {
        const updated = prev.map((rep) => {
          if (rep.id !== pqrId) return rep;
          return { ...rep, messages: [...(rep.messages ?? []), newMsg] };
        });
        saveStoredPqrReports(updated);
        return updated;
      });
    } catch {
      setPqrReports((prev) => {
        const updated = prev.map((rep) => {
          if (rep.id !== pqrId) return rep;
          const newMsg = {
            id: `msg-${Date.now()}`,
            sender: 'client' as const,
            senderName: rep.clientName || 'Cliente',
            senderRole: 'Cliente',
            text,
            timestamp: new Date().toISOString(),
          };
          return { ...rep, messages: [...(rep.messages ?? []), newMsg] };
        });
        saveStoredPqrReports(updated);
        return updated;
      });
    }
  };

  const handleInspectPqr = (report: PqrReport) => {
    setSelectedPqrReport(report);
    setShowPqrDetailModal(true);
  };

  const handleAppProblemReported = (problem: AppProblemReport) => {
    setAppProblemReports((prev) => {
      const updated = [problem, ...prev];
      saveStoredAppProblems(updated);
      return updated;
    });
  };



  // Fit all markers in view
  const handleFitAll = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (!filteredContractors.length) {
      map.flyTo([projectLocation.lat, projectLocation.lng], 13);
      return;
    }
    const bounds = L.latLngBounds(
      filteredContractors.map((c) => [c.lat, c.lng] as [number, number])
    );
    bounds.extend([projectLocation.lat, projectLocation.lng]);
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
  };

  // Center on user location
  const handleCenterUser = () => {
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([projectLocation.lat, projectLocation.lng], 14, {
        duration: 0.8,
      });
    }
  };

  // Auto-fit initial bounds when map is ready and contractors are loaded
  useEffect(() => {
    if (!mapReady || !filteredContractors.length) return;
    const timer = window.setTimeout(() => {
      handleFitAll();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [mapReady, filteredContractors.length]);

  // Scroll horizontal helpers
  const scrollChips = (ref: React.RefObject<HTMLDivElement | null>, offset: number) => {
    if (ref.current) {
      ref.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          <IonTitle>Mapa de Contratistas • Bogotá</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="sp-map-page-content">
        <div className="sp-map-layout">
          {/* Map Surface */}
          <div className="sp-map-container" ref={mapContainerRef} />

          {/* Map Top Floating Header Controls */}
          <div className="sp-map-top-bar">
            {/* Row 1 */}
            <div className="sp-map-top-row">
              <div className="sp-top-pill sp-top-pill--osm">
                <span className="sp-pill-globe">🌐</span>
                <span>OpenStreetMap</span>
              </div>
              <div className="sp-top-pill sp-top-pill--city">
                <span className="sp-pill-pin">📍</span>
                <span>Bogotá D.C.</span>
              </div>
              <div className="sp-top-pill sp-top-pill--available">
                <span className="sp-pill-dot">●</span>
                <span>{filteredContractors.filter((c) => c.isAvailableInZone).length} Disponibles en Zona</span>
              </div>
            </div>

            {/* Row 2 */}
            <div className="sp-map-top-row">
              {closestContractor ? (
                <button
                  type="button"
                  className="sp-map-top-pill sp-map-top-pill--closest"
                  onClick={() => handleFocusContractor(closestContractor)}
                >
                  <IonIcon icon={flashOutline} />
                  <span>Ver más cercano ({formatDistance(closestContractor.distanceKm)})</span>
                </button>
              ) : null}

              <button type="button" className="sp-map-top-pill sp-map-top-pill--count" onClick={handleFitAll}>
                <span>{filteredContractors.length} en mapa</span>
                <IonIcon icon={expandOutline} />
              </button>

              <button
                type="button"
                className={`sp-map-top-pill sp-map-top-pill--radius ${
                  showCoverageRadius ? "is-active" : ""
                }`}
                onClick={() => setShowCoverageRadius((prev) => !prev)}
              >
                <IonIcon icon={radioOutline} />
                <span>Radio cobertura</span>
              </button>
            </div>
          </div>

          {/* OpenStreetMap Layer Tag (Top Left of Map) */}
          <div className="sp-map-layer-tag">
            <span>Capa: OpenStreetMap</span>
          </div>

          {/* Bottom Right Map Action Controls */}
          <div className="sp-map-bottom-controls">
            <button
              type="button"
              className="sp-map-ctrl-btn sp-map-ctrl-btn--expand"
              title="Ajustar mapa a todos"
              onClick={handleFitAll}
            >
              <IonIcon icon={expandOutline} />
            </button>
            <button
              type="button"
              className="sp-map-ctrl-btn sp-map-ctrl-btn--center"
              title="Centrar en Tu Obra"
              onClick={handleCenterUser}
            >
              <IonIcon icon={navigateOutline} />
            </button>
          </div>

          {/* Floating Left Panel (Buscador, Filtros y Lista) */}
          <aside
            className={`sp-map-sidebar ${
              mobileView === "map" ? "is-map-view" : ""
            }`}
          >
            {/* Search Input */}
            <div className="sp-sidebar-header">
              <div className="sp-search-bar-wrap">
                <IonIcon icon={searchOutline} className="sp-search-icon" />
                <input
                  type="text"
                  className="sp-search-input"
                  placeholder="Buscar por servicio, electricista, plomero, barrio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className="sp-search-clear"
                    onClick={() => setSearchQuery("")}
                  >
                    <IonIcon icon={closeCircleOutline} />
                  </button>
                ) : null}
              </div>
            </div>

            {/* Filter Sections */}
            <div className="sp-sidebar-filters">
              {/* Localidad de Bogotá */}
              <div>
                <div className="sp-filter-section-title">
                  <IonIcon icon={locationOutline} />
                  <span>LOCALIDAD DE BOGOTÁ</span>
                </div>
                <div className="sp-chip-scroll-row">
                  <button
                    type="button"
                    className="sp-chip-arrow"
                    onClick={() => scrollChips(localityScrollRef, -120)}
                    aria-label="Anterior"
                  >
                    <IonIcon icon={chevronBackOutline} />
                  </button>
                  <div className="sp-chip-scroll-container" ref={localityScrollRef}>
                    {BOGOTA_LOCALITIES.map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        className={`sp-chip-pill ${
                          selectedLocality === loc ? "sp-chip-pill--orange-active" : ""
                        }`}
                        onClick={() => setSelectedLocality(loc)}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="sp-chip-arrow"
                    onClick={() => scrollChips(localityScrollRef, 120)}
                    aria-label="Siguiente"
                  >
                    <IonIcon icon={chevronForwardOutline} />
                  </button>
                </div>
              </div>

              {/* Especialidad de Obra */}
              <div>
                <div className="sp-filter-section-title sp-filter-section-title--dark">
                  <span>ESPECIALIDAD DE OBRA</span>
                </div>
                <div className="sp-chip-scroll-row">
                  <button
                    type="button"
                    className="sp-chip-arrow"
                    onClick={() => scrollChips(specialtyScrollRef, -120)}
                    aria-label="Anterior"
                  >
                    <IonIcon icon={chevronBackOutline} />
                  </button>
                  <div className="sp-chip-scroll-container" ref={specialtyScrollRef}>
                    {WORK_SPECIALTIES.map((spec) => (
                      <button
                        key={spec}
                        type="button"
                        className={`sp-chip-pill ${
                          selectedSpecialty === spec ? "sp-chip-pill--black-active" : ""
                        }`}
                        onClick={() => setSelectedSpecialty(spec)}
                      >
                        {spec}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="sp-chip-arrow"
                    onClick={() => scrollChips(specialtyScrollRef, 120)}
                    aria-label="Siguiente"
                  >
                    <IonIcon icon={chevronForwardOutline} />
                  </button>
                </div>
              </div>

              {/* Toggle Pills & Radius */}
              <div className="sp-toggles-row">
                <button
                  type="button"
                  className={`sp-toggle-pill ${filterAvailable ? "is-active" : ""}`}
                  onClick={() => setFilterAvailable((v) => !v)}
                >
                  <span className="sp-badge-pill--green-dot" />
                  <span>Disponibles en la Zona</span>
                </button>

                <button
                  type="button"
                  className={`sp-toggle-pill sp-toggle-pill--urgent ${
                    filterUrgent ? "is-active" : ""
                  }`}
                  onClick={() => setFilterUrgent((v) => !v)}
                >
                  <span>🚨 Urgencias 24h</span>
                </button>

                <button
                  type="button"
                  className={`sp-toggle-pill sp-toggle-pill--policy ${
                    filterPolicy ? "is-active" : ""
                  }`}
                  onClick={() => setFilterPolicy((v) => !v)}
                >
                  <IonIcon icon={shieldCheckmarkOutline} />
                  <span>Póliza / RETIE</span>
                </button>

                <div className="sp-radio-dropdown-wrap">
                  <label htmlFor="radius-select">Radio:</label>
                  <select
                    id="radius-select"
                    className="sp-radio-select"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                  >
                    <option value={5}>5 km</option>
                    <option value={10}>10 km</option>
                    <option value={20}>20 km</option>
                    <option value={35}>35 km</option>
                    <option value={50}>50 km</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Results Header */}
            <div className="sp-results-header">
              <span className="sp-results-count">
                {filteredContractors.length} contratistas disponibles
              </span>
              <span className="sp-results-sort">
                Ordenados por cercanía y calificación
              </span>
            </div>

            {/* Contractors List */}
            <div className="sp-contractors-list">
              {filteredContractors.length > 0 ? (
                filteredContractors.map((contractor) => {
                  const isSelected = contractor.id === selectedContractorId;
                  return (
                    <article
                      key={contractor.id}
                      id={`contractor-card-${contractor.id}`}
                      className={`sp-contractor-card ${
                        isSelected ? "is-selected" : ""
                      }`}
                      onClick={() => handleFocusContractor(contractor)}
                    >
                      <div className="sp-contractor-card-top">
                        <div className="sp-contractor-avatar-wrap">
                          <span className="sp-contractor-avatar sp-contractor-avatar--fallback">
                            {getInitials(contractor.name)}
                          </span>
                          {contractor.avatar ? (
                            <img
                              src={contractor.avatar}
                              alt={contractor.name}
                              className="sp-contractor-avatar sp-contractor-avatar--image"
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                            />
                          ) : null}
                        </div>

                        <div className="sp-contractor-info">
                          <div className="sp-contractor-location-row">
                            <span className="sp-contractor-zone">
                              {contractor.neighborhood.toUpperCase()},{" "}
                              {contractor.city.toUpperCase()}
                            </span>
                            <span className="sp-rating-badge">
                              <IonIcon icon={star} />
                              <span>
                                {contractor.rating.toFixed(1)} (
                                {contractor.reviewsCount})
                              </span>
                            </span>
                          </div>

                          <h3 className="sp-contractor-name">
                            {contractor.businessName}
                          </h3>
                          <p className="sp-contractor-sub">{contractor.subtitle}</p>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="sp-card-badges">
                        {contractor.isAvailableInZone ? (
                          <span className="sp-badge-pill sp-badge-pill--green">
                            <span className="sp-badge-pill--green-dot" />
                            Disponible en la zona
                          </span>
                        ) : null}

                        <span className="sp-badge-pill sp-badge-pill--gray">
                          🔧 {contractor.specialtyLabel}
                        </span>

                        {contractor.hasPolicyOrRetie ? (
                          <span className="sp-badge-pill sp-badge-pill--teal">
                            <IonIcon icon={shieldCheckmarkOutline} />
                            Garantía & Seguro
                          </span>
                        ) : null}

                        <span className="sp-badge-pill sp-badge-pill--gray">
                          {contractor.jobsCompleted}+ trabajos
                        </span>
                      </div>

                      {/* Footer */}
                      <div className="sp-contractor-card-footer">
                        <div className="sp-footer-meta">
                          <span className="sp-distance-pill">
                            <IonIcon icon={locationOutline} />
                            {contractor.neighborhood}  {formatDistance(contractor.distanceKm)}
                          </span>
                          <span className="sp-time-pill">
                            <IonIcon icon={timeOutline} /> ~{contractor.estimatedMinutes} min
                          </span>
                        </div>

                        <div className="sp-price-box">
                          <span className="sp-price-label">Visita</span>
                          {contractor.visitPriceCop ? (
                            <span className="sp-price-val">
                              ${" "}
                              {contractor.visitPriceCop.toLocaleString("es-CO")}
                            </span>
                          ) : (
                            <span className="sp-price-val sp-price-val--pending">
                              Por acordar
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="sp-contractor-card-actions">
                        <button
                          type="button"
                          className="sp-card-action sp-card-action--map"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleFocusContractor(contractor);
                            setMobileView("map");
                          }}
                        >
                          <IonIcon icon={locationOutline} />
                          <span>En mapa</span>
                        </button>
                        <button
                          type="button"
                          className="sp-card-action"
                          onClick={(event) => {
                            event.stopPropagation();
                            history.push(`/cliente/profesionales/${contractor.id}`);
                          }}
                        >
                          <span>Revisar perfil</span>
                          <IonIcon icon={chevronForwardOutline} />
                        </button>
                        <button
                          type="button"
                          className="sp-card-action sp-card-action--quote"
                          onClick={(event) => {
                            event.stopPropagation();
                            history.push(
                              `/cliente/profesionales/${contractor.id}?mode=quote`
                            );
                          }}
                        >
                          <IonIcon icon={sparkles} />
                          <span>Cotiza</span>
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="sp-empty-contractors">
                  <IonIcon icon={locationOutline} />
                  <h4>Sin contratistas compatibles</h4>
                  <p>
                    Intenta ampliar el radio de búsqueda o modificar los filtros de
                    especialidad y localidad.
                  </p>
                  <button
                    type="button"
                    className="sp-chip-pill sp-chip-pill--orange-active"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedLocality("Todas");
                      setSelectedSpecialty("Todas las Especialidades");
                      setFilterAvailable(false);
                      setFilterUrgent(false);
                      setFilterPolicy(false);
                      setRadiusKm(50);
                    }}
                  >
                    Restablecer filtros
                  </button>
                </div>
              )}
            </div>
          </aside>

          {/* Mobile Bottom Toggle Bar */}
          <div className="sp-mobile-view-toggle">
            <button
              type="button"
              className={`sp-mobile-view-btn ${
                mobileView === "map" ? "is-active" : ""
              }`}
              onClick={() => setMobileView("map")}
            >
              <IonIcon icon={mapOutline} />
              <span>Mapa</span>
            </button>
            <button
              type="button"
              className={`sp-mobile-view-btn ${
                mobileView === "list" ? "is-active" : ""
              }`}
              onClick={() => setMobileView("list")}
            >
              <IonIcon icon={listOutline} />
              <span>Lista ({filteredContractors.length})</span>
            </button>
          </div>
        </div>

        {/* ── PQR List Overlay ──────────────────────────────────────────────── */}
        {showPqrListView && (
          <div className="fixed inset-0 z-40 bg-white overflow-y-auto">
            {/* Back bar */}
            <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-4 py-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowPqrListView(false)}
                className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 transition-colors text-neutral-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <IonIcon icon={chevronBackOutline} />
                <span>Volver al Mapa</span>
              </button>
            </div>
            <div className="p-4 sm:p-6 max-w-4xl mx-auto">
              <PqrListView
                pqrReports={pqrReports}
                appProblemReports={appProblemReports}
                onOpenNewPqrModal={handleOpenPqrModal}
                onOpenLiveSupportChat={() => setShowLiveChatModal(true)}
                onInspectReport={handleInspectPqr}
              />
            </div>
          </div>
        )}

        {/* ── Floating PQR button ───────────────────────────────────────────── */}
        {!showPqrListView && (
          <button
            id="btn-floating-pqr"
            type="button"
            onClick={() => setShowPqrListView(true)}
            className="fixed bottom-24 right-4 z-30 bg-neutral-900 hover:bg-rose-700 active:scale-95 text-white font-extrabold text-[11px] px-3.5 py-2.5 rounded-2xl shadow-xl transition-all flex items-center gap-2 cursor-pointer border border-white/10"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            <IonIcon icon={shieldCheckmarkOutline} />
            <span>Chat de Reporte en Vivo</span>
            {(pqrReports.length + appProblemReports.length) > 0 && (
              <span className="bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {pqrReports.length + appProblemReports.length}
              </span>
            )}
          </button>
        )}
      </IonContent>

      {/* ── PQR Report Form Modal ─────────────────────────────────────────────── */}
      <PqrReportModal
        isOpen={showPqrReportModal}
        onClose={() => {
          setShowPqrReportModal(false);
          setShowPqrListView(true);
        }}
        contractor={pqrTargetContractor}
        allContractors={allContractorRefs.length > 0 ? allContractorRefs : [{ id: 'demo', name: 'Contratista Demo', companyName: 'Empresa Demo' }]}
        onSubmitPqr={(data) => {
          handleSubmitPqr(data);
        }}
      />

      {/* ── PQR Detail / Expediente Modal ─────────────────────────────────────── */}
      <PqrDetailModal
        isOpen={showPqrDetailModal}
        onClose={() => setShowPqrDetailModal(false)}
        report={selectedPqrReport}
        onSendMessage={handleSendPqrMessage}
      />

      {/* ── Live Support Chat Modal ───────────────────────────────────────────── */}
      <LiveSupportChatModal
        isOpen={showLiveChatModal}
        onClose={() => setShowLiveChatModal(false)}
        contractors={allContractorRefs.length > 0 ? allContractorRefs : [{ id: 'demo', name: 'Contratista Demo', companyName: 'Empresa Demo' }]}
        onPqrCreatedFromChat={(data) => {
          handleSubmitPqr(data);
          setShowPqrListView(true);
        }}
        onAppProblemReported={handleAppProblemReported}
      />
    </IonPage>
  );
};

export default ContractorMapPage;

