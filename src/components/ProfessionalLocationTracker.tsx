import React, { useEffect, useRef } from "react";
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
      () => {},
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

  return null;
};
