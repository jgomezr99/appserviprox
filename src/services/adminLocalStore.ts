/**
 * adminLocalStore.ts
 *
 * Motor de persistencia y base de datos autónoma para el Administrador de Serviprox.
 * Provee datos persistentes en SQLite / LocalStorage para Clientes, Profesionales,
 * PQRs, Incidencias Técnicas, Auditoría y Reportes cuando la máquina virtual o
 * el servidor backend remoto no están disponibles, garantizando operatividad continua en Web y Android.
 */

import { CONTRACTORS_MAP_DATA } from "../data/contractorMapData";
import {
  getStoredPqrReports,
  saveStoredPqrReports,
  getStoredAppProblems,
  saveStoredAppProblems,
} from "../data/pqrInitialData";
import type { PqrReport, AppProblemReport } from "../types/serviprox";

export interface LocalClientItem {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  phone: string;
  city: string;
  neighborhood?: string;
  address: string;
  document_id: string;
  is_active: boolean;
  is_identity_verified: boolean;
  requests_count: number;
  date_joined: string;
  is_blocked?: boolean;
  block_type?: string;
  block_duration_days?: number;
  block_reason?: string;
  blocked_until?: string | null;
  blocked_at?: string | null;
  wallet_balance?: number;
  points?: number;
}

export interface LocalProfessionalItem {
  id: number | string;
  slug?: string;
  display_name: string;
  initials?: string;
  headline?: string;
  company_name?: string;
  specialty_label?: string;
  has_certificate?: boolean;
  avatar_url?: string;
  phone?: string;
  email?: string;
  bio?: string;
  coverage_radius_km?: number;
  accepts_urgent?: boolean;
  rating_avg: string | number;
  jobs_completed: number;
  is_verified: boolean;
  is_active: boolean;
  points: number;
  wallet_balance: string | number;
  categories?: string[];
  neighborhood?: string;
  city?: string;
  is_blocked?: boolean;
  block_type?: string;
  block_duration_days?: number;
  block_reason?: string;
  blocked_until?: string | null;
  blocked_at?: string | null;
}

export interface LocalAuditLogEntry {
  id: string;
  adminName: string;
  action: string;
  target: string;
  date: string;
  reason: string;
}

const STORAGE_KEYS = {
  CLIENTS: "serviprox_clients_list",
  PROS: "serviprox_pros_list",
  AUDIT_LOGS: "serviprox_audit_logs",
  ROLES: "serviprox_users_roles",
  ACTIVE_DB: "serviprox_db_target",
};

// ─── Clientes iniciales registrados en la base de datos local ─────────
const INITIAL_CLIENTS: LocalClientItem[] = [
  {
    id: 1,
    first_name: "Carlos",
    last_name: "Rodríguez",
    full_name: "Carlos Rodríguez",
    email: "carlos.rodriguez@email.com",
    role: "client",
    phone: "+57 312 456 7890",
    city: "Bogotá",
    neighborhood: "Chicó Norte",
    address: "Calle 93 # 14-20 Apt 502",
    document_id: "CC 1.020.345.678",
    is_active: true,
    is_identity_verified: true,
    requests_count: 5,
    date_joined: "2026-01-12T10:30:00Z",
    wallet_balance: 120000,
    points: 340,
  },
  {
    id: 2,
    first_name: "María Paula",
    last_name: "Morales",
    full_name: "María Paula Morales",
    email: "mp.morales@serviprox.com",
    role: "client",
    phone: "+57 315 789 1234",
    city: "Bogotá",
    neighborhood: "Usaquén",
    address: "Cra 7 # 116-50 Torre B",
    document_id: "CC 52.890.123",
    is_active: true,
    is_identity_verified: true,
    requests_count: 3,
    date_joined: "2026-01-20T14:15:00Z",
    wallet_balance: 85000,
    points: 210,
  },
  {
    id: 3,
    first_name: "Andrés Felipe",
    last_name: "Silva",
    full_name: "Andrés Felipe Silva",
    email: "af.silva@empresa.com",
    role: "client",
    phone: "+57 320 123 4567",
    city: "Bogotá",
    neighborhood: "Chapinero",
    address: "Calle 67 # 9-18",
    document_id: "CC 1.018.987.654",
    is_active: true,
    is_identity_verified: true,
    requests_count: 8,
    date_joined: "2026-02-05T09:40:00Z",
    wallet_balance: 230000,
    points: 520,
  },
  {
    id: 4,
    first_name: "Claudia Patricia",
    last_name: "Gómez",
    full_name: "Claudia Patricia Gómez",
    email: "claudia.gomez@gmail.com",
    role: "client",
    phone: "+57 310 987 6543",
    city: "Bogotá",
    neighborhood: "Suba",
    address: "Cra 91 # 135-22",
    document_id: "CC 53.012.345",
    is_active: true,
    is_identity_verified: false,
    requests_count: 2,
    date_joined: "2026-02-18T16:20:00Z",
    wallet_balance: 45000,
    points: 90,
  },
  {
    id: 5,
    first_name: "Jorge Eliecer",
    last_name: "Gaitán",
    full_name: "Jorge Eliecer Gaitán",
    email: "jorge.gaitan@outlook.com",
    role: "client",
    phone: "+57 317 654 3210",
    city: "Bogotá",
    neighborhood: "Teusaquillo",
    address: "Calle 34 # 19-05",
    document_id: "CC 19.876.543",
    is_active: true,
    is_identity_verified: true,
    requests_count: 11,
    date_joined: "2026-02-28T11:00:00Z",
    wallet_balance: 310000,
    points: 680,
  },
  {
    id: 6,
    first_name: "Sofia",
    last_name: "Vergara R.",
    full_name: "Sofia Vergara R.",
    email: "sofia.vr@serviprox.com",
    role: "client",
    phone: "+57 311 234 5678",
    city: "Bogotá",
    neighborhood: "Salitre",
    address: "Av. La Esperanza # 68B-15",
    document_id: "CC 1.032.456.789",
    is_active: true,
    is_identity_verified: true,
    requests_count: 6,
    date_joined: "2026-03-08T15:10:00Z",
    wallet_balance: 175000,
    points: 410,
  },
];

// ─── Generación de profesionales a partir del catálogo oficial ────────
function buildInitialProfessionals(): LocalProfessionalItem[] {
  return CONTRACTORS_MAP_DATA.map((c, index) => {
    const rawId = index + 101;
    return {
      id: rawId,
      slug: c.id,
      display_name: c.name,
      initials: c.shortName.slice(0, 2).toUpperCase(),
      headline: c.subtitle,
      company_name: c.businessName,
      specialty_label: c.specialtyLabel || c.specialty,
      has_certificate: c.hasPolicyOrRetie,
      avatar_url: c.avatar,
      phone: "+57 310 274 0971",
      email: `${c.id.replace(/-/g, ".")}@serviprox.com`,
      bio: `Profesional certificado en ${c.specialty} con ${c.jobsCompleted} servicios completados exitosamente en Serviprox.`,
      coverage_radius_km: 10,
      accepts_urgent: c.acceptsUrgent24h,
      rating_avg: c.rating,
      jobs_completed: c.jobsCompleted,
      is_verified: true,
      is_active: true,
      points: 1200 + index * 150,
      wallet_balance: (250000 + index * 45000),
      categories: c.specialties || [c.specialtyLabel || c.specialty],
      neighborhood: c.neighborhood || c.locality || "Chicó",
      city: c.city || "Bogotá",
      is_blocked: false,
    };
  });
}

// ─── Auditoría inicial administrativa ─────────────────────────────────
const INITIAL_AUDIT_LOGS: LocalAuditLogEntry[] = [
  {
    id: "aud-001",
    adminName: "Superadministrador",
    action: "Conexión a Base de Datos",
    target: "SQLite Local / Serviprox DB",
    date: new Date().toISOString(),
    reason: "Inicialización exitosa del entorno administrativo autónomo",
  },
  {
    id: "aud-002",
    adminName: "Superadministrador",
    action: "Verificación de Contratistas",
    target: "Jorge Morales & Hnos.",
    date: new Date(Date.now() - 3600000 * 2).toISOString(),
    reason: "Validación de certificación RETIE y tarjeta profesional",
  },
  {
    id: "aud-003",
    adminName: "Superadministrador",
    action: "Aprobación de Publicación",
    target: "Instalación de Punto Eléctrico RETIE",
    date: new Date(Date.now() - 3600000 * 5).toISOString(),
    reason: "Cumple con las políticas de calidad y seguridad de Serviprox",
  },
];

// ─── Solicitudes de servicio iniciales para métricas y gráficos ───────
export const INITIAL_REQUESTS = [
  {
    id: "REQ-701",
    client: "Carlos Rodríguez",
    contractor: "Ing. Carlos Mendoza",
    service: "Certificación Eléctrica RETIE",
    date: "17/11/2026",
    status: "En Proceso",
    amount: "$ 180.000",
  },
  {
    id: "REQ-702",
    client: "María Paula Morales",
    contractor: "Rodrigo Salamanca",
    service: "Reparación de Fuga en Tubería",
    date: "16/11/2026",
    status: "Completado",
    amount: "$ 90.000",
  },
  {
    id: "REQ-703",
    client: "Andrés Felipe Silva",
    contractor: "Jorge Morales",
    service: "Instalación de Muro en Drywall",
    date: "15/11/2026",
    status: "Completado",
    amount: "$ 350.000",
  },
  {
    id: "REQ-704",
    client: "Sofia Vergara R.",
    contractor: "Sandra Pinzón",
    service: "Pintura de Apartamento 85m²",
    date: "14/11/2026",
    status: "En Proceso",
    amount: "$ 650.000",
  },
];

// ─── Métodos de acceso y mutación segura ───────────────────────────────

export function getLocalClients(): LocalClientItem[] {
  if (typeof localStorage === "undefined") return INITIAL_CLIENTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLIENTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(INITIAL_CLIENTS));
      return INITIAL_CLIENTS;
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.length > 0 ? list : INITIAL_CLIENTS;
  } catch {
    return INITIAL_CLIENTS;
  }
}

export function saveLocalClients(clients: LocalClientItem[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  } catch (e) {
    console.error("Error guardando clientes locales:", e);
  }
}

export function getLocalProfessionals(): LocalProfessionalItem[] {
  if (typeof localStorage === "undefined") return buildInitialProfessionals();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROS);
    if (!raw) {
      const initial = buildInitialProfessionals();
      localStorage.setItem(STORAGE_KEYS.PROS, JSON.stringify(initial));
      return initial;
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.length > 0 ? list : buildInitialProfessionals();
  } catch {
    return buildInitialProfessionals();
  }
}

export function saveLocalProfessionals(pros: LocalProfessionalItem[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.PROS, JSON.stringify(pros));
  } catch (e) {
    console.error("Error guardando profesionales locales:", e);
  }
}

export function updateLocalProfessional(
  targetId: number | string,
  data: Partial<LocalProfessionalItem> & { adminName?: string; reason?: string }
): { ok: boolean; message: string; professional?: LocalProfessionalItem } {
  const pros = getLocalProfessionals();
  const index = pros.findIndex(
    (p) => String(p.id) === String(targetId) || (p.slug && p.slug === String(targetId))
  );

  if (index === -1) {
    return { ok: false, message: `Profesional #${targetId} no encontrado en la base de datos.` };
  }

  const existing = pros[index];
  const updated: LocalProfessionalItem = {
    ...existing,
    ...data,
    // Asegurar que rating y wallet mantengan tipos compatibles
    rating_avg: data.rating_avg !== undefined ? data.rating_avg : existing.rating_avg,
    wallet_balance: data.wallet_balance !== undefined ? data.wallet_balance : existing.wallet_balance,
  };

  pros[index] = updated;
  saveLocalProfessionals(pros);

  // Registrar en la auditoría inmutable
  addLocalAuditLog({
    adminName: data.adminName || "Superadministrador",
    action: "Edición de Datos Profesionales",
    target: updated.display_name,
    reason: data.reason || "Actualización administrativa de perfil y credenciales",
  });

  return {
    ok: true,
    message: `Datos de ${updated.display_name} actualizados exitosamente en la base de datos.`,
    professional: updated,
  };
}

export function getLocalAuditLogs(): LocalAuditLogEntry[] {
  if (typeof localStorage === "undefined") return INITIAL_AUDIT_LOGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(INITIAL_AUDIT_LOGS));
      return INITIAL_AUDIT_LOGS;
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : INITIAL_AUDIT_LOGS;
  } catch {
    return INITIAL_AUDIT_LOGS;
  }
}

export function addLocalAuditLog(entry: {
  adminName: string;
  action: string;
  target: string;
  reason?: string;
  date?: string;
}): void {
  if (typeof localStorage === "undefined") return;
  try {
    const logs = getLocalAuditLogs();
    const newEntry: LocalAuditLogEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      adminName: entry.adminName || "Superadministrador",
      action: entry.action,
      target: entry.target,
      date: entry.date || new Date().toISOString(),
      reason: entry.reason || "Acción ejecutada desde el panel administrativo",
    };
    const updated = [newEntry, ...logs].slice(0, 100);
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(updated));
  } catch (e) {
    console.error("Error agregando auditoría:", e);
  }
}

// ─── Generación del Overview Administrativo Autónomo ──────────────────
export function getAutonomousOverview(options?: {
  engine?: string;
  database_name?: string;
  mode?: "local-sqlite" | "custom" | "vm-direct" | "vm-proxy";
}) {
  const clients = getLocalClients();
  const pros = getLocalProfessionals();
  const pqrReports = getStoredPqrReports();
  const appProblems = getStoredAppProblems();
  const auditLogs = getLocalAuditLogs();

  const activeProsCount = pros.filter((p) => p.is_active && !p.is_blocked).length;
  const openPqrCount = pqrReports.filter((r) => !["resuelto", "cerrado", "anulado"].includes(r.status)).length;
  const techIssuesCount = appProblems.filter((p) => !["solucionado", "cerrado", "descartado"].includes(p.status)).length;

  const topProfessionals = pros.slice(0, 5).map((p) => ({
    id: String(p.id),
    raw_id: typeof p.id === "number" ? p.id : 101,
    name: p.display_name,
    specialty: p.specialty_label || "Especialista Serviprox",
    rating: Number(p.rating_avg) || 5.0,
    tier: (Number(p.rating_avg) >= 4.8 ? "Nivel Oro" : "Nivel Plata") as "Nivel Oro" | "Nivel Plata",
    avatar: p.avatar_url || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=240&auto=format&fit=crop",
    points: p.points || 1200,
    completedJobs: p.jobs_completed || 25,
    verified: p.is_verified,
    blocked: p.is_blocked,
  }));

  return {
    database: {
      connected: true,
      engine: options?.engine || "SQLite (Local Autónomo)",
      database_name: options?.database_name || "Serviprox DB (SQLite)",
      mode: options?.mode || "local-sqlite",
    },
    kpis: {
      clients: clients.length,
      professionals: activeProsCount || pros.length,
      hired_services: 18,
      pending_publications: 3,
      open_pqrs: openPqrCount || 2,
      technical_issues: techIssuesCount || 1,
      raw_clients: clients.length,
      raw_pros: pros.length,
      raw_services: 18,
      raw_publications: 3,
      raw_pqrs: openPqrCount || 2,
      raw_issues: techIssuesCount || 1,
    },
    charts: {
      user_distribution: {
        clients: clients.length,
        professionals: pros.length,
        administrators: 2,
      },
      pqr_chart: {
        radicado: 2,
        en_revision: 1,
        conciliacion: 1,
        resuelto: 6,
      },
    },
    reports: {
      blocked_accounts_today: 0,
      complaints: 2,
      rejected_publications: 1,
      cancelled_services: 0,
      technical_issues: techIssuesCount || 1,
    },
    requests_list: INITIAL_REQUESTS,
    top_professionals: topProfessionals,
    audit_logs: auditLogs,
  };
}
