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
  email?: { host: string; port: string; cipher: string; sender: string; sender_name: string; requires_auth: boolean };
  social?: Record<"facebook" | "instagram" | "x" | "youtube" | "linkedin", string>;
  documents?: Record<"terms" | "privacy" | "refunds" | "rules" | "contract", string>;
  last_backup?: string;
  sections?: Record<string, Section>;
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
      return { ...DEFAULT_SETTINGS, ...parsed, features: { ...DEFAULT_SETTINGS.features, ...parsed.features } };
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
    await platformSettingsService.fetchPublic().catch(() => undefined);
    return saved;
  },
  systemAction: (body: Record<string, unknown> & { action: string }) =>
    api.post<{ detail: string; settings?: PlatformSettings; last_backup?: string }>("admin/system-action/", body),
};

/** Parámetros públicos de la plataforma; se refrescan al montar y cada 60 s. */
export const usePlatformSettings = (): PlatformSettings => {
  const [settings, setSettings] = useState<PlatformSettings>(readCache);

  useEffect(() => {
    const onChange = (e: Event) => setSettings((e as CustomEvent).detail);
    window.addEventListener(CHANGE_EVENT, onChange);
    const load = () => platformSettingsService.fetchPublic().catch(() => undefined);
    load();
    const timer = window.setInterval(load, 60000);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.clearInterval(timer);
    };
  }, []);

  return settings;
};

type HomeRole = "client" | "professional";

// Cada opción del home exige además que la función global correspondiente esté activa.
const GLOBAL_FEATURE: Record<HomeRole, Record<string, keyof PlatformFeatures>> = {
  client: { services: "services", requests: "hirings", pqr: "pqr" },
  professional: { requests: "hirings", jobs: "hirings", benefits: "benefits" },
};

const ROLE_KEYS: Record<HomeRole, string[]> = {
  client: ["map", "services", "requests", "homes", "favorites", "pqr"],
  professional: ["profile_status", "services_offered", "availability", "requests", "jobs", "benefits"],
};

export const homeFlags = (settings: PlatformSettings, role: HomeRole): Record<string, boolean> => {
  const params = (settings.role_params?.[role] ?? {}) as Record<string, boolean>;
  return Object.fromEntries(
    ROLE_KEYS[role].map((key) => {
      const global = GLOBAL_FEATURE[role][key];
      return [key, params[key] !== false && (!global || settings.features[global])];
    })
  );
};

/** Qué secciones del home puede ver cada rol: parámetro del rol y función global activas. */
export const useHomeFlags = (role: HomeRole): Record<string, boolean> => homeFlags(usePlatformSettings(), role);
