import { api, ApiError } from "./api";

export interface AdminCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon_key: string;
  keywords: string[];
  sort_order: number;
  is_active: boolean;
  services_count: number;
}

export interface AdminCatalogService {
  id: number;
  category: number;
  category_name: string;
  category_active: boolean;
  name: string;
  slug: string;
  description: string;
  keywords: string[];
  price_min: string | null;
  price_max: string | null;
  estimated_hours: string | null;
  is_active: boolean;
  professionals_count: number;
}

export type CategoryInput = Pick<AdminCategory,
  "name" | "description" | "icon_key" | "keywords" | "sort_order" | "is_active">;
export type ServiceInput = Pick<AdminCatalogService,
  "category" | "name" | "description" | "keywords" | "price_min" | "price_max" | "estimated_hours" | "is_active">;

export interface SuggestionPreview {
  suggested_category: { id: number; name: string; slug: string } | null;
  suggested_service: { id: number; name: string; category: number } | null;
  confidence: number;
  rationale: string;
  ranking: Array<{ slug: string; name: string; score: number }>;
  service_ranking: Array<{
    id: number;
    name: string;
    category: { id: number; name: string; slug: string };
    score: number;
    matched_terms: string[];
  }>;
}

type Page<T> = { results: T[]; next: string | null };
const ROOT = "admin/catalog/";

async function listAll<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= 1000; page += 1) {
    const result = await api.get<Page<T> | T[]>(ROOT + path, { params: { page, page_size: 100 } });
    if (Array.isArray(result)) return result;
    items.push(...result.results);
    if (!result.next) return items;
  }
  throw new Error("El catálogo es demasiado grande para cargarlo completo.");
}

export const adminCatalog = {
  categories: () => listAll<AdminCategory>("categories/"),
  services: () => listAll<AdminCatalogService>("services/"),
  createCategory: (data: CategoryInput) => api.post<AdminCategory>(ROOT + "categories/", data),
  updateCategory: (id: number, data: Partial<CategoryInput>) =>
    api.patch<AdminCategory>(`${ROOT}categories/${id}/`, data),
  deleteCategory: (id: number) => api.delete<void>(`${ROOT}categories/${id}/`),
  createService: (data: ServiceInput) => api.post<AdminCatalogService>(ROOT + "services/", data),
  updateService: (id: number, data: Partial<ServiceInput>) =>
    api.patch<AdminCatalogService>(`${ROOT}services/${id}/`, data),
  deleteService: (id: number) => api.delete<void>(`${ROOT}services/${id}/`),
  preview: (description: string) => api.post<SuggestionPreview>(ROOT + "suggestions/preview/", { description }),
};

const FIELD_NAMES: Record<string, string> = {
  name: "Nombre", category: "Categoría", description: "Descripción", keywords: "Palabras clave",
  sort_order: "Orden", icon_key: "Icono", price_min: "Tarifa mínima", price_max: "Tarifa máxima",
  estimated_hours: "Duración", is_active: "Estado", non_field_errors: "Datos",
};

function flattenMessages(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenMessages);
  if (value && typeof value === "object") return Object.values(value).flatMap(flattenMessages);
  return [];
}

export function catalogError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Tu sesión venció. Vuelve a iniciar sesión como administrador.";
    if (error.status === 403) return "Tu cuenta no tiene permisos para administrar el catálogo.";
    if (error.status >= 500) return "No pudimos conectar con el catálogo. Comprueba el backend e inténtalo nuevamente.";
    if (error.payload && typeof error.payload === "object" && !Array.isArray(error.payload)) {
      return Object.entries(error.payload).map(([key, value]) => {
        const label = FIELD_NAMES[key];
        return (label ? `${label}: ` : "") + flattenMessages(value).join(" ");
      }).filter(Boolean).join(" ") || error.message;
    }
  }
  return error instanceof Error ? error.message : "No pudimos completar la operación.";
}
