import { api } from "./api";
import type {
  Household,
  HouseholdPayload,
  PaginatedResponse,
  ProfessionalProfile,
  ProfessionalProfilePayload,
  ServiceCategory,
} from "../types/serviprox";

const unwrapList = <T>(payload: PaginatedResponse<T> | T[]) =>
  Array.isArray(payload) ? payload : payload.results;

export const catalogService = {
  listCategories: async () =>
    unwrapList(await api.get<PaginatedResponse<ServiceCategory> | ServiceCategory[]>("categories/")),
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
