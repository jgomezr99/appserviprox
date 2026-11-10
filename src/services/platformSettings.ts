import { useEffect, useState } from "react";
import { api } from "./api";

export interface PlatformFeatures {
  new_users: boolean;
  professionals: boolean;
  services: boolean;
  products: boolean;
  chat: boolean;
  hirings: boolean;
  pqr: boolean;
  benefits: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  maintenance: boolean;
}

export interface PlatformSettings {
  platform_name: string;
  description?: string;
  logo: string;
  country: string;
  timezone?: string;
  language: string;
  date_format?: string;
  time_format?: string;
  currency: string;
  cities: string[];
  features: PlatformFeatures;
  maintenance_message: string;
  test_payment_enabled?: boolean;
  email?: { host: string; port: string; cipher: string; sender: string; sender_name: string; requires_auth: boolean };
  social?: Record<"facebook" | "instagram" | "x" | "youtube" | "linkedin", string>;
  documents?: Record<"terms" | "privacy" | "refunds" | "rules" | "contract", string>;
  last_backup?: string;
  sections?: Record<string, Section>;
  benefit_catalog?: Section;
  appearance?: Section;
  role_params?: Section;
  system?: {
    version: string;
    updated_at: string;
    db_engine: string;
    environment: string;
    users_total: number;
    backups: Array<{ name: string; size: number; created_at: number }>;
    history: Array<{ date: string; action: string; target: string; admin: string }>;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Section = Record<string, any>;

const CACHE_KEY = "serviprox_platform_settings";
const CHANGE_EVENT = "serviprox:platform-settings";

export const DEFAULT_SETTINGS: PlatformSettings = {
  platform_name: "Serviprox",
  logo: "",
  country: "Colombia",
  language: "Español",
  currency: "Peso colombiano (COP)",
  cities: [],
  features: {
    new_users: true,
    professionals: true,
    services: true,
    products: true,
    chat: true,
    hirings: true,
    pqr: true,
    benefits: true,
    email_notifications: true,
    push_notifications: true,
    maintenance: false,
  },
  maintenance_message: "Serviprox se encuentra en mantenimiento. Intenta de nuevo en unos minutos.",
};

const hexToRgb = (hex: string): number[] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const mix = (rgb: number[], target: number, amount: number) =>
  `rgb(${rgb.map((c) => Math.round(c + (target - c) * amount)).join(",")})`;

const BUTTON_RADIUS: Record<string, string> = { Redondeado: "12px", Cuadrado: "0px", Sutil: "6px" };
const CARD_STYLE: Record<string, string> = {
  Suave: "box-shadow:0 2px 8px rgba(15,23,42,.08)",
  Elevado: "box-shadow:0 10px 24px rgba(15,23,42,.18)",
  "Con borde": "box-shadow:none;border:1px solid #cbd5e1",
};

/** Aplica colores, tipografía, estilos y favicon definidos en Personalización. */
export const applyAppearance = (a?: Section) => {
  if (!a || typeof document === "undefined") return;
  const rules: string[] = [];
  const vars: string[] = [];
  const primary = hexToRgb(a.primary ?? "");
  if (primary) {
    vars.push(
      `--ion-color-primary:${a.primary}`,
      `--ion-color-primary-rgb:${primary.join(",")}`,
      `--ion-color-primary-contrast:#ffffff`,
      `--ion-color-primary-shade:${mix(primary, 0, 0.12)}`,
      `--ion-color-primary-tint:${mix(primary, 255, 0.1)}`
    );
  }
  const secondary = hexToRgb(a.secondary ?? "");
  if (secondary) {
    vars.push(
      `--ion-color-secondary:${a.secondary}`,
      `--ion-color-secondary-rgb:${secondary.join(",")}`,
      `--ion-color-secondary-contrast:#ffffff`,
      `--ion-color-secondary-shade:${mix(secondary, 0, 0.12)}`,
      `--ion-color-secondary-tint:${mix(secondary, 255, 0.1)}`
    );
  }
  if (a.font) {
    vars.push(`--ion-font-family:"${a.font}",system-ui,sans-serif`);
    rules.push(`body{font-family:"${a.font}",system-ui,sans-serif}`);
  }
  if (vars.length) rules.push(`:root{${vars.join(";")}}`);
  if (BUTTON_RADIUS[a.buttons]) rules.push(`ion-button{--border-radius:${BUTTON_RADIUS[a.buttons]}}`);
  if (CARD_STYLE[a.cards]) rules.push(`ion-card{${CARD_STYLE[a.cards]}}`);

  let style = document.getElementById("sx-appearance");
  if (!style) {
    style = document.createElement("style");
    style.id = "sx-appearance";
    document.head.appendChild(style);
  }
  style.textContent = rules.join("\n");

  document.documentElement.classList.toggle("ion-palette-dark", a.theme === "dark");
  document.documentElement.dataset.sxDensity = a.density ?? "Estándar";

  if (a.font) {
    let link = document.getElementById("sx-font") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "sx-font";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(a.font)}:wght@400;600;700&display=swap`;
  }

  if (a.favicon) {
    let icon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.href = a.favicon;
  }
};

const readCache = (): PlatformSettings => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      applyAppearance(parsed.appearance);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        features: { ...DEFAULT_SETTINGS.features, ...parsed.features },
        role_params: parsed.role_params || parsed.sections?.role_params || DEFAULT_SETTINGS.role_params,
      };
    }
  } catch {
    /* caché inválida */
  }
  return DEFAULT_SETTINGS;
};

export const platformSettingsService = {
  async fetchPublic(): Promise<PlatformSettings> {
    const data = await api.get<PlatformSettings>("platform/settings/", { auth: false });
    const merged = { ...DEFAULT_SETTINGS, ...data, features: { ...DEFAULT_SETTINGS.features, ...data.features } };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
    } catch {
      /* imágenes grandes pueden exceder la cuota */
    }
    applyAppearance(merged.appearance);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: merged }));
    return merged;
  },
  getAdmin: () => api.get<PlatformSettings>("admin/settings/"),
  saveAdmin: async (patch: Partial<PlatformSettings>) => {
    const saved = await api.patch<PlatformSettings>("admin/settings/", patch);
    const merged: PlatformSettings = {
      ...DEFAULT_SETTINGS,
      ...saved,
      features: { ...DEFAULT_SETTINGS.features, ...saved.features },
      sections: { ...(saved.sections || {}) },
      role_params: saved.role_params || saved.sections?.role_params,
    };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
    } catch {
      /* Imágenes grandes pueden exceder la cuota de almacenamiento. */
    }
    applyAppearance(merged.appearance);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: merged }));
    return merged;
  },
  systemAction: async (body: Record<string, unknown> & { action: string; confirm?: string; name?: string; enabled?: boolean }): Promise<{ detail: string; settings?: PlatformSettings; last_backup?: string }> => {
    const { action } = body;
    const result = await api.post<{ detail: string; settings?: PlatformSettings; last_backup?: string }>(
      "admin/system-action/",
      body
    );

    // Mantener sincronizada la caché local solo después de confirmar la acción en el servidor.
    if (action === "clear_cache") {
      try {
        if (typeof localStorage !== "undefined") {
          const keysToRemove = [
            "serviprox_pqr_reports",
            "serviprox_app_problem_reports",
            "serviprox_support_conversations",
            "serviprox_blocked_users",
            "serviprox_orders",
            "serviprox_active_jobs",
            "serviprox_chat_messages",
            "serviprox_pqr_seed_v4",
            "serviprox_problems_seed_v4",
          ];
          keysToRemove.forEach((k) => localStorage.removeItem(k));
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && (k.startsWith("serviprox_chat_") || k.startsWith("serviprox_cache_"))) {
              localStorage.removeItem(k);
            }
          }
        }
        if (typeof window !== "undefined" && "caches" in window) {
          window.caches.keys().then((names) => names.forEach((n) => window.caches.delete(n))).catch(() => {});
        }
        window.dispatchEvent(new CustomEvent("serviprox:pqr-updated"));
        window.dispatchEvent(new CustomEvent("serviprox:cache-cleared"));
      } catch (e) {
        console.warn("Falla limpiando caché local:", e);
      }
    } else if (action === "reset_services") {
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem("serviprox_clients_list");
          localStorage.removeItem("serviprox_pros_list");
          localStorage.removeItem("serviprox_deleted_accounts");
          localStorage.removeItem("serviprox_orders");
          localStorage.removeItem("serviprox_active_jobs");
          localStorage.removeItem("serviprox_pqr_reports");
          localStorage.removeItem("serviprox_app_problem_reports");
        }
        window.dispatchEvent(new CustomEvent("serviprox:pqr-updated"));
        window.dispatchEvent(new CustomEvent("serviprox:accounts-reset"));
      } catch (e) {
        console.warn("Error restableciendo almacenamiento de servicios:", e);
      }
    } else if (action === "delete_platform") {
      try {
        if (typeof localStorage !== "undefined") {
          const keysToKeep = [
            "serviprox_access_token",
            "serviprox_refresh_token",
            "serviprox_user",
            "serviprox_api_host",
          ];
          const keepMap: Record<string, string> = {};
          keysToKeep.forEach((k) => {
            const v = localStorage.getItem(k);
            if (v !== null) keepMap[k] = v;
          });
          localStorage.clear();
          Object.entries(keepMap).forEach(([k, v]) => localStorage.setItem(k, v));
          localStorage.setItem(CACHE_KEY, JSON.stringify(DEFAULT_SETTINGS));
        }
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.clear();
        }
        applyAppearance(DEFAULT_SETTINGS.appearance);
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: DEFAULT_SETTINGS }));
        window.dispatchEvent(new CustomEvent("serviprox:pqr-updated"));
        window.dispatchEvent(new CustomEvent("serviprox:accounts-reset"));
      } catch (e) {
        console.warn("Error purgando plataforma local:", e);
      }
    } else if (action === "toggle_maintenance") {
      if (result.settings) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(result.settings));
        } catch {
          /* sin almacenamiento local disponible */
        }
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: result.settings }));
      }
    } else if (action === "restore_backup") {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(DEFAULT_SETTINGS));
        applyAppearance(DEFAULT_SETTINGS.appearance);
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: DEFAULT_SETTINGS }));
      } catch {
        /* sin almacenamiento local disponible */
      }
    }

    return result;
  },
};

let activeSubscribers = 0;
let pollTimer: number | undefined;
let inflight: Promise<unknown> | undefined;

const loadShared = () => {
  if (!inflight) {
    inflight = platformSettingsService
      .fetchPublic()
      .catch(() => undefined)
      .finally(() => {
        inflight = undefined;
      });
  }
  return inflight;
};

/** Parámetros públicos de la plataforma; una sola petición compartida al montar y cada 60 s. */
export const usePlatformSettings = (): PlatformSettings => {
  const [settings, setSettings] = useState<PlatformSettings>(readCache);

  useEffect(() => {
    const onChange = (e: Event) => setSettings((e as CustomEvent).detail);
    window.addEventListener(CHANGE_EVENT, onChange);
    activeSubscribers += 1;
    if (activeSubscribers === 1) {
      void loadShared();
      pollTimer = window.setInterval(() => void loadShared(), 60000);
    }
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      activeSubscribers -= 1;
      if (activeSubscribers === 0 && pollTimer !== undefined) {
        window.clearInterval(pollTimer);
        pollTimer = undefined;
      }
    };
  }, []);

  return settings;
};

type HomeRole = "client" | "professional";

// Cada opción del home exige además que la función global correspondiente esté activa.
const GLOBAL_FEATURE: Record<HomeRole, Record<string, keyof PlatformFeatures>> = {
  client: {
    map: "professionals",
    services: "services",
    requests: "hirings",
    pqr: "pqr",
    store: "products",
    publish_store: "products",
  },
  professional: {
    requests: "hirings",
    jobs: "hirings",
    benefits: "benefits",
    services_offered: "services",
    store: "products",
    publish_store: "products",
    pqr: "pqr",
    chat: "chat",
    profile: "professionals",
    ads: "professionals",
  },
};

const ROLE_KEYS: Record<HomeRole, string[]> = {
  client: ["map", "services", "requests", "homes", "favorites", "pqr", "store", "publish_store", "profile"],
  professional: [
    "profile_status",
    "profile",
    "services_offered",
    "availability",
    "requests",
    "jobs",
    "chat",
    "ads",
    "benefits",
    "store",
    "publish_store",
    "pqr",
  ],
};

export const homeFlags = (settings: PlatformSettings, role: HomeRole): Record<string, boolean> => {
  const params = (
    settings.role_params?.[role] ??
    settings.sections?.role_params?.[role] ??
    {}
  ) as Record<string, boolean>;
  return Object.fromEntries(
    ROLE_KEYS[role].map((key) => {
      const global = GLOBAL_FEATURE[role]?.[key];
      const isGlobalEnabled = global ? Boolean(settings.features[global]) : true;
      const isRoleParamEnabled = params[key] !== false;
      return [key, isGlobalEnabled && isRoleParamEnabled];
    })
  );
};

/** Qué secciones del home puede ver cada rol: parámetro del rol y función global activas. */
export const useHomeFlags = (role: HomeRole): Record<string, boolean> => homeFlags(usePlatformSettings(), role);
