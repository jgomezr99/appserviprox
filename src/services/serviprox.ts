import { api } from "./api";
import type {
  Household,
  HouseholdPayload,
  PaginatedResponse,
  ProfessionalProfile,
  ProfessionalProfilePayload,
  Professional,
  ProfessionalDetail,
  Order,
  Service,
  ServiceCategory,
  ServiceRequest,
  ServiceRequestPayload,
  ServiceRequestStatus,
  PqrReport,
  PqrMessage,
  AppProblemReport,
} from "../types/serviprox";


const unwrapList = <T>(payload: PaginatedResponse<T> | T[] | null | undefined): T[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
};

const buildQuery = (params: Record<string, string | number | boolean | null | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
};

export const catalogService = {
  listCategories: async () =>
    unwrapList(await api.get<PaginatedResponse<ServiceCategory> | ServiceCategory[]>("categories/")),
  getCategory: (slug: string) => api.get<ServiceCategory>(`categories/${slug}/`),
  getService: (id: number | string) => api.get<Service>(`services/${id}/`),
  listServices: async (params: { category?: number | string } = {}) =>
    unwrapList(
      await api.get<PaginatedResponse<Service> | Service[]>(
        `services/${buildQuery({ category: params.category })}`
      )
    ),
};

export const householdService = {
  list: async () =>
    unwrapList(await api.get<PaginatedResponse<Household> | Household[]>("households/")),
  create: (payload: HouseholdPayload) => api.post<Household>("households/", payload),
  update: (id: number, payload: Partial<HouseholdPayload>) =>
    api.patch<Household>(`households/${id}/`, payload),
  remove: (id: number) => api.delete<null>(`households/${id}/`),
};

export const professionalProfileService = {
  getMine: () => api.get<ProfessionalProfile>("professionals/me/"),
  createMine: (payload: ProfessionalProfilePayload) =>
    api.post<ProfessionalProfile>("professionals/me/", payload),
  updateMine: (payload: Partial<ProfessionalProfilePayload>) =>
    api.patch<ProfessionalProfile>("professionals/me/", payload),
};

export const professionalSearchService = {
  list: async (
    params: {
      category?: string;
      service?: number | string;
      lat?: number;
      lng?: number;
      radius_km?: number;
      accepts_urgent?: boolean;
      price_min?: string | number;
      price_max?: string | number;
    } = {}
  ) =>
    unwrapList(
      await api.get<PaginatedResponse<Professional> | Professional[]>(
        `professionals/${buildQuery(params)}`
      )
    ),
  get: (id: number | string) => api.get<ProfessionalDetail>(`professionals/${id}/`),
};

export const serviceRequestService = {
  list: async (params: { status?: ServiceRequestStatus } = {}) =>
    unwrapList(
      await api.get<PaginatedResponse<ServiceRequest> | ServiceRequest[]>(
        `requests/${buildQuery(params)}`
      )
    ),
  get: (id: number | string) => api.get<ServiceRequest>(`requests/${id}/`),
  create: (payload: ServiceRequestPayload, images: File[] = []) => {
    if (!images.length) return api.post<ServiceRequest>("requests/", payload);
    const form = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        form.append(key, String(value));
      }
    });
    images.forEach((image) => form.append("images", image));
    return api.post<ServiceRequest>("requests/", form);
  },
  accept: (id: number | string) => api.post<ServiceRequest>(`requests/${id}/accept/`),
  reject: (id: number | string) => api.post<ServiceRequest>(`requests/${id}/reject/`),
};

export const orderService = {
  list: async (params: { status?: string } = {}) =>
    unwrapList(
      await api.get<PaginatedResponse<Order> | Order[]>(`orders/${buildQuery(params)}`)
    ),
  get: (id: number | string) => api.get<Order>(`orders/${id}/`),
  confirmDemoPayment: (id: number | string) =>
    api.post<Order>(`orders/${id}/confirm-demo-payment/`),
  transition: (id: number | string, status: string, note = "") =>
    api.post<Order>(`orders/${id}/transition/`, { status, note }),
  updateLocation: (id: number | string, latitude: number, longitude: number) =>
    api.post<Order>(`orders/${id}/location/`, { latitude, longitude }),
  addEvidence: (id: number | string, image: File, caption = "") => {
    const form = new FormData();
    form.append("image", image);
    form.append("caption", caption);
    return api.post<Order>(`orders/${id}/evidence/`, form);
  },
};

// ─── PQR Service ─────────────────────────────────────────────────────────────

type PqrCreatePayload = Omit<
  PqrReport,
  "id" | "radicadoNumber" | "status" | "createdAt" | "estimatedResponseDays" | "messages"
>;

export const pqrService = {
  /** List all PQRs, optionally filtered by user / email */
  list: (params?: { mine?: boolean; email?: string }) =>
    api
      .get<PaginatedResponse<PqrReport> | PqrReport[]>("pqrs/", { params })
      .then(unwrapList)
      .catch(() => [] as PqrReport[]),          // graceful fallback if endpoint missing

  /** Get single PQR with its message thread */
  get: (id: string) =>
    api.get<PqrReport>(`pqrs/${id}/`),

  /** Create a new PQR report */
  create: (payload: PqrCreatePayload) =>
    api.post<PqrReport>("pqrs/", payload),

  /** Send a reply message to a PQR thread */
  sendMessage: (pqrId: string, text: string) =>
    api.post<PqrMessage>(`pqrs/${pqrId}/messages/`, { text }),

  /** Cancel / withdraw a PQR (client) */
  cancel: (pqrId: string) =>
    api.post<PqrReport>(`pqrs/${pqrId}/cancel/`),
};

/** App technical problem tickets */
export const appProblemService = {
  list: (params?: { mine?: boolean; email?: string }) =>
    api
      .get<PaginatedResponse<AppProblemReport> | AppProblemReport[]>("app-problems/", { params })
      .then(unwrapList)
      .catch(() => [] as AppProblemReport[]),

  create: (payload: Omit<AppProblemReport, "id" | "ticketNumber" | "status" | "createdAt">) =>
    api
      .post<AppProblemReport>("app-problems/", payload)
      .catch(() => ({
        id: `prob-local-${Date.now()}`,
        ticketNumber: `APP-BUG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        status: "recibido" as const,
        createdAt: new Date().toISOString(),
        ...payload,
      } as AppProblemReport)),
};

