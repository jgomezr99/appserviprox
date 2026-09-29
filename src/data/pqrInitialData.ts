/**
 * pqrInitialData.ts
 *
 * Base de datos inicial y persistencia local para PQRs, Reclamos y Problemas Técnicos.
 * Todos los reclamos están asociados a contratistas registrados oficialmente en Bogotá.
 */

import type { PqrReport, AppProblemReport, PqrContractorRef } from '../types/serviprox';
import { CONTRACTORS_MAP_DATA } from './contractorMapData';

// ─── Contratistas registrados oficialmente en la base de datos (SQLite) ────────
export const REGISTERED_CONTRACTORS_REF: PqrContractorRef[] = [
  {
    id: 'morales-construcciones',
    name: 'Jorge Morales',
    companyName: 'Morales Construcciones & Acabados',
    specialtyLabel: 'Albañilería, Mampostería y Drywall',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=240&auto=format&fit=crop',
    neighborhood: 'Chicó',
    phone: '+57 310 274 0971',
  },
  {
    id: 'carlos-mendoza',
    name: 'Ing. Carlos Mendoza',
    companyName: 'Mendoza Instalaciones Eléctricas RETIE',
    specialtyLabel: 'Electricidad y Certificación RETIE',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=240&auto=format&fit=crop',
    neighborhood: 'Chicó Norte',
    phone: '+57 312 458 9912',
  },
  {
    id: 'salamanca-plomeria',
    name: 'Rodrigo Salamanca',
    companyName: 'Salamanca Plomería & Filtraciones',
    specialtyLabel: 'Plomería, Fugas y Desagües',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=240&auto=format&fit=crop',
    neighborhood: 'Galerías',
    phone: '+57 318 642 1190',
  },
  {
    id: 'cerrajeria-express',
    name: 'Maestro Néstor Caicedo',
    companyName: 'Cerrajería de Seguridad Bogotá 24H',
    specialtyLabel: 'Cerrajería de Seguridad y Control de Acceso',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=240&auto=format&fit=crop',
    neighborhood: 'Salitre',
    phone: '+57 315 889 4433',
  },
  {
    id: 'pinzon-pinturas',
    name: 'Sandra Pinzón',
    companyName: 'Pinzón Pinturas & Acabados',
    specialtyLabel: 'Pintura Profesional y Acabados',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=240&auto=format&fit=crop',
    neighborhood: 'Pontevedra',
    phone: '+57 316 774 2211',
  },
  {
    id: 'hidropro-plomeria',
    name: 'Pedro Rivas • HidroPro',
    companyName: 'HidroPro Redes & Plomería',
    specialtyLabel: 'Plomería, Bombas y Presión de Agua',
    avatarUrl: 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?q=80&w=240&auto=format&fit=crop',
    neighborhood: 'Cedritos',
    phone: '+57 311 890 2345',
  },
  {
    id: 'beltran-redes',
    name: 'Ing. Hernán Beltrán',
    companyName: 'Beltrán Redes Eléctricas & Datos',
    specialtyLabel: 'Instalaciones Eléctricas de Alta Demanda',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=240&auto=format&fit=crop',
    neighborhood: 'Santa Bárbara',
    phone: '+57 314 567 8901',
  },
  {
    id: 'clima-bogota',
    name: 'Ing. Tatiana Duarte',
    companyName: 'ClimaBogotá Soluciones Térmicas',
    specialtyLabel: 'Calefacción, Aire Acondicionado y Gas',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=240&auto=format&fit=crop',
    neighborhood: 'Álamos',
    phone: '+57 317 234 5678',
  },
  {
    id: 'carpinteria-aranda',
    name: 'Maestro Gonzalo Gómez',
    companyName: 'Carpintería & Maderas Aranda',
    specialtyLabel: 'Carpintería Fina y Muebles a Medida',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=240&auto=format&fit=crop',
    neighborhood: 'Salazar Gómez',
    phone: '+57 319 876 5432',
  },
];

/** Obtiene la foto propia de un ciudadano titular de forma determinista y única */
export function getCitizenAvatar(name?: string): string {
  if (!name) {
    return 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=240&auto=format&fit=crop';
  }
  const lower = name.toLowerCase().trim();
  if (lower.includes('laura')) {
    return 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=240&auto=format&fit=crop';
  }
  if (lower.includes('camila')) {
    return 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=240&auto=format&fit=crop';
  }
  if (lower.includes('juan') || lower.includes('pablo') || lower.includes('gomez')) {
    return 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=240&auto=format&fit=crop';
  }
  if (lower.includes('andres') || lower.includes('ruiz')) {
    return 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=240&auto=format&fit=crop';
  }
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e11d48&color=fff&bold=true&rounded=true`;
}

// ─── Lista inicial de reclamos contra contratistas registrados ─────────────────
// Vacío por defecto: Cada cuenta registrada inicia en 0 hasta que radique en la base de datos
export const INITIAL_PQR_REPORTS: PqrReport[] = [];

// ─── Lista inicial de tickets de problemas técnicos con la app ─────────────────
// Vacío por defecto: Inicia en 0 hasta que el usuario reporte una falla técnica
export const INITIAL_APP_PROBLEMS: AppProblemReport[] = [];

// ─── Persistencia en LocalStorage con sincronización por cuenta ───────────────

const PQR_STORAGE_KEY = 'serviprox_pqr_reports_v5';
const APP_PROBLEMS_STORAGE_KEY = 'serviprox_app_problems_v5';

// Limpieza de claves previas con datos de prueba
try {
  if (typeof localStorage !== 'undefined') {
    [
      'serviprox_pqr_reports_v2',
      'serviprox_app_problems_v2',
      'serviprox_pqr_reports_v1',
      'serviprox_pqr_reports',
      'serviprox_app_problems',
    ].forEach((k) => localStorage.removeItem(k));
  }
} catch {
  // Entorno sin localStorage
}

export function getStoredPqrReports(email?: string): PqrReport[] {
  try {
    const raw = localStorage.getItem(PQR_STORAGE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw);
    const list = Array.isArray(all) ? all : [];
    if (email) {
      return list.filter((r: PqrReport) => r.clientEmail?.toLowerCase() === email.toLowerCase());
    }
    return list;
  } catch {
    return [];
  }
}

export function saveStoredPqrReports(reports: PqrReport[]): void {
  try {
    const raw = localStorage.getItem(PQR_STORAGE_KEY);
    const existing: PqrReport[] = raw ? JSON.parse(raw) : [];
    const mergedMap = new Map<string, PqrReport>();
    if (Array.isArray(existing)) {
      existing.forEach((r) => mergedMap.set(r.id, r));
    }
    reports.forEach((r) => mergedMap.set(r.id, r));
    localStorage.setItem(PQR_STORAGE_KEY, JSON.stringify(Array.from(mergedMap.values())));
  } catch (err) {
    console.error('Error saving PQR reports to localStorage:', err);
  }
}

export function getStoredAppProblems(email?: string): AppProblemReport[] {
  try {
    const raw = localStorage.getItem(APP_PROBLEMS_STORAGE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw);
    const list = Array.isArray(all) ? all : [];
    if (email) {
      return list.filter((p: AppProblemReport) => p.userEmail?.toLowerCase() === email.toLowerCase());
    }
    return list;
  } catch {
    return [];
  }
}

export function saveStoredAppProblems(problems: AppProblemReport[]): void {
  try {
    const raw = localStorage.getItem(APP_PROBLEMS_STORAGE_KEY);
    const existing: AppProblemReport[] = raw ? JSON.parse(raw) : [];
    const mergedMap = new Map<string, AppProblemReport>();
    if (Array.isArray(existing)) {
      existing.forEach((p) => mergedMap.set(p.id, p));
    }
    problems.forEach((p) => mergedMap.set(p.id, p));
    localStorage.setItem(APP_PROBLEMS_STORAGE_KEY, JSON.stringify(Array.from(mergedMap.values())));
  } catch (err) {
    console.error('Error saving App Problems to localStorage:', err);
  }
}

