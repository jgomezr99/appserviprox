import { api } from "./api";

export type HiringAlertKey = "stalled" | "overdue_visit" | "unpaid" | "no_review";

export interface HiringRow {
  id: number;
  request_id: number;
  created_at: string;
  status: string;
  status_label: string;
  service: string;
  category: string;
  client: { id: number; name: string; email: string; phone: string };
  professional: { id: number; name: string };
  city: string;
  neighborhood: string;
  final_price: number | null;
  payment_status: string;
  payment_status_label: string;
  payout_status: string;
  payout_status_label: string;
  scheduled_for: string | null;
  rating: number | null;
  alerts: HiringAlertKey[];
}

export interface HiringPage<T> {
  count: number;
  page: number;
  page_size: number;
  results: T[];
}

export interface HiringSummary {
  total: number;
  by_status: Record<string, number>;
  active: number;
  completed: number;
  cancelled: number;
  value_total: number;
  avg_ticket: number;
  daily: Array<{ date: string; count: number }>;
  monthly: Array<{ month: string; count: number }>;
  top_services: Array<{ name: string; count: number }>;
  top_professionals: Array<{ id: number; name: string; count: number; rating: number | null }>;
  alerts: Array<{ key: HiringAlertKey; label: string; count: number }>;
  requests: { no_professional: number; awaiting: number; awaiting_stale: number };
  generated_at: string;
}

export interface HiringDetail extends HiringRow {
  description: string;
  client_notes: string;
  urgency: string;
  address: string;
  estimate_min: number | null;
  estimate_max: number | null;
  payment_reference: string;
  payment_confirmed_at: string | null;
  commission_amount: number | null;
  professional_amount: number | null;
  payout_settled_at: string | null;
  professional_detail: { email: string; phone: string; rating: number; jobs_completed: number; verified: boolean };
  review: { rating: number; comment: string } | null;
  events: Array<{ status: string; label: string; note: string; by: string; created_at: string }>;
  evidence: Array<{ id: number; caption: string; created_at: string; url: string }>;
  payments: Array<{ id: number; reference: string; status: string; status_label: string; amount: number; discount: number; method: string; created_at: string }>;
  notes: Array<{ id: number; text: string; author: string; created_at: string }>;
  can_cancel: boolean;
  cancel_blocked_reason: string;
  can_settle: boolean;
}

export interface OpenRequest {
  id: number;
  created_at: string;
  hours_waiting: number;
  client: { name: string; email: string; phone: string };
  service: string;
  category: string;
  city: string;
  neighborhood: string;
  urgency: string;
  urgency_label: string;
  description: string;
  professional: { id: number; name: string } | null;
}

export interface AssignableProfessional {
  id: number;
  name: string;
  rating: number;
  jobs_completed: number;
  verified: boolean;
  city: string;
  distance_km: number | null;
  current: boolean;
}

export type HiringFilters = {
  status?: string;
  payment?: string;
  city?: string;
  q?: string;
  date_from?: string;
  date_to?: string;
  alert?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
};

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : "";
};

export const hiringService = {
  summary: () => api.get<HiringSummary>("admin/hirings/summary/"),
  list: (filters: HiringFilters) => api.get<HiringPage<HiringRow>>(`admin/hirings/${query(filters)}`),
  detail: (id: number) => api.get<HiringDetail>(`admin/hirings/${id}/`),
  cancel: (id: number, reason: string) => api.post<{ detail: string }>(`admin/hirings/${id}/cancel/`, { reason }),
  addNote: (id: number, text: string) =>
    api.post<{ id: number; text: string; author: string; created_at: string }>(`admin/hirings/${id}/notes/`, { text }),
  openPqr: (id: number, type: "queja" | "reclamo" | "peticion", description: string) =>
    api.post<{ id: number; radicado_number: string }>(`admin/hirings/${id}/pqr/`, { type, description }),
  requests: (params: { kind?: string; page?: number; page_size?: number }) =>
    api.get<HiringPage<OpenRequest>>(`admin/hirings/requests/${query(params)}`),
  professionalsFor: (requestId: number) =>
    api.get<AssignableProfessional[]>(`admin/hirings/requests/${requestId}/professionals/`),
  assign: (requestId: number, professionalId: number) =>
    api.post<{ detail: string }>(`admin/hirings/requests/${requestId}/assign/`, { professional_id: professionalId }),
};

export const STATUS_OPTIONS: Array<[string, string]> = [
  ["", "Todos los estados"],
  ["requested", "Solicitada"],
  ["accepted", "Aceptada"],
  ["scheduled", "Agendada"],
  ["traveling", "En camino"],
  ["arrived", "En el lugar"],
  ["in_progress", "En ejecución"],
  ["completed", "Completada"],
  ["cancelled", "Cancelada"],
];
