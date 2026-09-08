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
} from "../types/serviprox";

const unwrapList = <T>(payload: PaginatedResponse<T> | T[]) =>
  Array.isArray(payload) ? payload : payload.results;

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
};
