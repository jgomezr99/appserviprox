import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { professionalProfileService } from "../services/serviprox";

/**
 * ProfessionalLocationTracker
 *
 * Mantiene la ubicación GPS en tiempo real del profesional sincronizada con el backend
 * y la base de datos mientras el profesional tenga la aplicación abierta.
 */
export const ProfessionalLocationTracker: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const lastSentRef = useRef<number>(0);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const [gpsBlocked, setGpsBlocked] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user || user.role !== "professional") {
      return;
    }

    if (!navigator.geolocation) {
      return;
    }

    let active = true;

    const sendLocation = async (lat: number, lng: number, force = false) => {
      const now = Date.now();
      const lastCoords = lastCoordsRef.current;

      // Si las coordenadas no han cambiado apreciablemente y no han pasado 15 segundos, omitir
      if (!force && lastCoords) {
        const dLat = Math.abs(lat - lastCoords.lat);
        const dLng = Math.abs(lng - lastCoords.lng);
        const elapsed = now - lastSentRef.current;
        if (dLat < 0.0001 && dLng < 0.0001 && elapsed < 15000) {
          return;
        }
      }

      lastSentRef.current = now;
      lastCoordsRef.current = { lat, lng };

      try {
        await professionalProfileService.updateLiveLocation(lat, lng);
        setGpsBlocked(false);
      } catch (err) {
        // En caso de fallo transitorio de red, se reintentará en la siguiente lectura
      }
    };

    // 1. Lectura inmediata de posición inicial
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!active) return;
        void sendLocation(pos.coords.latitude, pos.coords.longitude, true);
      },
      () => setGpsBlocked(true),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    // 2. Rastreo activo continuo con watchPosition
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!active) return;
        void sendLocation(pos.coords.latitude, pos.coords.longitude);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    // 3. Intervalo de respaldo periódico cada 15 segundos
    const intervalId = window.setInterval(() => {
      if (!active) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!active) return;
          void sendLocation(pos.coords.latitude, pos.coords.longitude);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
      );
    }, 15000);

    return () => {
      active = false;
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, user?.role, user?.id]);

  if (!gpsBlocked || dismissed || !isAuthenticated || user?.role !== "professional") return null;

  return (
    <div
      role="alert"
      style={{
        position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 9000, maxWidth: 520, margin: "0 auto",
        background: "#fff7e6", border: "1px solid #ffd591", color: "#ad6800", borderRadius: 14,
        padding: "10px 14px", fontSize: "0.85rem", fontWeight: 600, display: "flex", gap: 10, alignItems: "center",
      }}
    >
      <span style={{ flex: 1 }}>
        📍 Activa la ubicación (GPS) del navegador para aparecer en el mapa con tu posición exacta. Mientras tanto
        los clientes te ven en el centro de tu ciudad.
      </span>
      <button type="button" onClick={() => setDismissed(true)} aria-label="Cerrar aviso"
        style={{ border: 0, background: "transparent", color: "inherit", fontSize: "1.1rem", cursor: "pointer" }}>✕</button>
    </div>
  );
};
