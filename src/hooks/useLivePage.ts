import { useEffect, useState } from "react";
import { useIonViewDidLeave, useIonViewWillEnter } from "@ionic/react";

/** Ionic conserva páginas montadas: refrescar al regresar y pausar consultas al salir. */
export function useLivePage(refresh: () => Promise<void>, intervalMs = 8000) {
  const [active, setActive] = useState(true);
  const [entry, setEntry] = useState(0);
  useIonViewWillEnter(() => { setActive(true); setEntry((value) => value + 1); }, []);
  useIonViewDidLeave(() => setActive(false), []);
  useEffect(() => {
    if (!active) return;
    let inFlight = false;
    const update = async () => {
      if (inFlight) return;
      inFlight = true;
      try { await refresh(); } finally { inFlight = false; }
    };
    void update();
    const timer = window.setInterval(() => void update(), intervalMs);
    return () => window.clearInterval(timer);
  }, [refresh, active, entry, intervalMs]);
  return active;
}
