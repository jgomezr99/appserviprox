import type { Order, Professional, ServiceRequest, User } from "../types/serviprox";

export const customer: User = {
  id: 11, email: "client@workflow.example", username: "workflow-client", first_name: "Cliente", last_name: "Prueba", role: "client",
  phone: "", city: "Bogotá", initials: "CP", is_identity_verified: true, onboarding_completed: true, created_at: "2026-11-04T10:00:00Z",
};
export const worker: User = { ...customer, id: 12, role: "professional", email: "pro@workflow.example" };
export const professional: Professional = {
  id: 2, display_name: "Profesional de prueba con nombre largo", initials: "PP", headline: "Servicios del hogar", rating_avg: "0", jobs_completed: 0,
  is_verified: true, accepts_urgent: true, neighborhood: "Centro", city: "Bogotá", latitude: 4.65, longitude: -74.06, categories: [], matching_service: null,
};
export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 7, service_request: 31, professional, status: "accepted", status_label: "Aceptada", available_transitions: ["cancelled", "scheduled", "traveling"],
    payment_status: "pending", payment_status_label: "Pendiente de pago", payment_confirmed_at: null, payment_reference: "", scheduled_for: null,
    estimate_min: "50000", estimate_max: "90000", final_price: null, client_notes: "Reparar fuga", arrival_code: "1234",
    workplace_address: "Calle 80 # 10-20", workplace_city: "Bogotá", workplace_latitude: 4.64, workplace_longitude: -74.07,
    professional_latitude: 4.65, professional_longitude: -74.06, events: [], work_evidence: [], review: null, created_at: "2026-11-04T10:00:00Z", ...overrides,
  };
}
export function makeRequest(overrides: Partial<ServiceRequest> = {}): ServiceRequest {
  return {
    id: 31, client: customer, household: { id: 3, label: "Casa", property_type: "house", address_line: "Calle 80 # 10-20", neighborhood: "Centro", city: "Bogotá", country: "Colombia", latitude: 4.64, longitude: -74.07, area_m2: null, build_year: null, notes: "", is_default: true, short_location: "Centro, Bogotá", created_at: "2026-11-04T10:00:00Z" },
    diagnostic_session: null, suggested_category: null, selected_category: { id: 1, name: "Plomería", slug: "plomeria", description: "", icon_key: "water", professionals_count: 1 },
    selected_service: null, professional, followed_suggestion: null, description: "Fuga debajo del lavamanos", urgency: "this_week", search_radius_km: 5,
    status: "open", status_label: "Publicada", order: null, images: [], created_at: "2026-11-04T10:00:00Z", ...overrides,
  };
}
