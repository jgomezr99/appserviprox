export type UserRole = "client" | "professional" | "staff";
export type PublicRegisterRole = Exclude<UserRole, "staff">;

export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone: string;
  city: string;
  document_id?: string;
  address?: string;
  avatar_url?: string;
  initials: string;
  is_identity_verified: boolean;
  onboarding_completed: boolean;
  created_at: string;
}

export interface UpdateMePayload {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  city?: string;
  document_id?: string;
  address?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthTokenResponse {
  access: string;
  refresh: string;
}

export interface RefreshTokenResponse {
  access: string;
  refresh?: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  city?: string;
  document_id?: string;
  address?: string;
  role: PublicRegisterRole;
  password: string;
}

export interface Service {
  id: number;
  category: number;
  category_slug: string;
  name: string;
  slug: string;
  description: string;
  price_min: string | null;
  price_max: string | null;
  estimated_hours: string | null;
}

export interface ServiceCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon_key: string;
  professionals_count: number;
  sort_order?: number;
  services?: Service[];
}

export interface Household {
  id: number;
  label: string;
  property_type: "apartment" | "house" | "office" | "commercial";
  address_line: string;
  neighborhood: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  area_m2: number | null;
  build_year: number | null;
  notes: string;
  is_default: boolean;
  short_location: string;
  created_at: string;
}

export type HouseholdPayload = Omit<
  Household,
  "id" | "short_location" | "created_at" | "latitude" | "longitude"
> & {
  latitude?: number | null;
  longitude?: number | null;
};

export interface ProfessionalService {
  id: number;
  service: number;
  service_name: string;
  service_slug: string;
  category: number;
  category_name: string;
  category_slug: string;
  price_min: string | null;
  price_max: string | null;
  observaciones: string;
  years_experience: number;
}

export interface Professional {
  id: number;
  slug?: string;
  display_name: string;
  initials: string;
  headline: string;
  company_name?: string;
  specialty_label?: string;
  avatar_url?: string;
  phone?: string;
  rating_avg: string;
  jobs_completed: number;
  is_verified: boolean;
  accepts_urgent: boolean;
  neighborhood: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  distance_km?: number;
  categories: string[];
  matching_service: ProfessionalService | null;
  availability_label?: string;
}

export interface ProfessionalProfile {
  id: number;
  display_name: string;
  headline: string;
  bio: string;
  latitude: number | null;
  longitude: number | null;
  neighborhood: string;
  city: string;
  coverage_radius_km: number;
  response_time_minutes: number;
  accepts_urgent: boolean;
  is_verified: boolean;
  is_active: boolean;
  rating_avg: string;
  jobs_completed: number;
  services: ProfessionalService[];
  created_at: string;
}

export interface AvailabilitySlot {
  id: number;
  weekday: number;
  weekday_label: string;
  start_time: string;
  end_time: string;
}

export interface PortfolioItem {
  id: number;
  image_url: string;
  caption: string;
  sort_order: number;
}

export interface ProfessionalDetail extends Professional {
  bio: string;
  coverage_radius_km: number;
  response_time_minutes: number;
  services: ProfessionalService[];
  availability: AvailabilitySlot[];
  portfolio: PortfolioItem[];
  created_at: string;
}

export interface ProfessionalProfilePayload {
  display_name: string;
  headline: string;
  bio?: string;
  neighborhood?: string;
  city: string;
  coverage_radius_km?: number;
  response_time_minutes?: number;
  accepts_urgent?: boolean;
  service_ids?: number[];
  service_offerings?: ProfessionalServicePayload[];
  custom_services?: CustomProfessionalServicePayload[];
}

export interface ProfessionalServicePayload {
  service: number;
  price_min?: string | null;
  price_max?: string | null;
  observaciones?: string;
  years_experience?: number;
}

export interface CustomProfessionalServicePayload {
  category: number;
  name: string;
  description?: string;
  price_min?: string | null;
  price_max?: string | null;
  observaciones?: string;
  years_experience?: number;
}

export type ServiceRequestStatus =
  | "draft"
  | "open"
  | "matched"
  | "accepted"
  | "rejected"
  | "closed"
  | "cancelled";

export type ServiceRequestUrgency = "flexible" | "this_week" | "urgent";

export interface RequestClient {
  id: number;
  first_name: string;
  last_name: string;
  initials: string;
  city: string;
}

export interface RequestOrder {
  id: number;
  status: string;
  status_label: string;
  payment_status: OrderPaymentStatus;
  payment_status_label: string;
  payment_confirmed_at: string | null;
}

export type OrderPaymentStatus = "pending" | "paid";

export interface Order {
  id: number;
  service_request: number;
  professional: Professional;
  status: string;
  status_label: string;
  payment_status: OrderPaymentStatus;
  payment_status_label: string;
  payment_confirmed_at: string | null;
  payment_reference: string;
  scheduled_for: string | null;
  estimate_min: string | null;
  estimate_max: string | null;
  final_price: string | null;
  client_notes: string;
  arrival_code?: string;
  professional_latitude?: number | string | null;
  professional_longitude?: number | string | null;
  workplace_latitude?: number | null;
  workplace_longitude?: number | null;
  workplace_address?: string;
  workplace_neighborhood?: string;
  workplace_city?: string;
  household_label?: string;
  work_evidence?: Array<{
    id: number;
    image_url: string;
    caption: string;
    created_at: string;
  }>;
  events: Array<{
    id: number;
    status: string;
    status_label: string;
    note: string;
    created_at: string;
  }>;
  created_at: string;
}

export interface ServiceRequestImage {
  id: number;
  image_url: string;
  created_at: string;
}

export interface ServiceRequest {
  id: number;
  client: RequestClient;
  household: Household;
  diagnostic_session: number | null;
  suggested_category: ServiceCategory | null;
  selected_category: ServiceCategory;
  selected_service: Service | null;
  professional: Professional | null;
  followed_suggestion: boolean | null;
  description: string;
  urgency: ServiceRequestUrgency;
  search_radius_km: number;
  status: ServiceRequestStatus;
  status_label: string;
  order: RequestOrder | null;
  images: ServiceRequestImage[];
  created_at: string;
}

export interface ServiceRequestPayload {
  household: number;
  selected_service: number;
  professional: number;
  description: string;
  urgency?: ServiceRequestUrgency;
  search_radius_km?: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ─── PQR / Quejas & Garantías ────────────────────────────────────────────────

export type PqrStatus =
  | 'radicado'
  | 'en_revision'
  | 'conciliacion'
  | 'resuelto'
  | 'sancionado';

export type PqrType = 'queja' | 'reclamo' | 'recurso_garantia' | 'peticion';

export type PqrReason =
  | 'mala_calidad_obra'
  | 'incumplimiento_horario'
  | 'cobro_injustificado'
  | 'dano_material'
  | 'garantia_no_atendida'
  | 'abandono_obra'
  | 'falta_respeto_trato'
  | 'otro';

export type PqrMessageSender = 'client' | 'contractor' | 'support_agent' | 'system';

export interface PqrMessage {
  id: string;
  sender: PqrMessageSender;
  senderName: string;
  senderRole?: string;
  text: string;
  timestamp: string;
}

export interface PqrReport {
  id: string;
  radicadoNumber: string;
  status: PqrStatus;
  type: PqrType;
  reason: PqrReason;
  // Contractor
  contractorId: string;
  contractorName: string;
  contractorCompany: string;
  contractorSpecialty?: string;
  contractorAvatar?: string;
  // Client
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientDocumentId: string;
  clientAddress: string;
  // Details
  incidentDate: string;
  serviceRequestId?: string;
  serviceTitle?: string;
  amountDisputed?: number;
  description: string;
  desiredResolution: string;
  evidenceFiles?: string[];
  // Thread
  messages?: PqrMessage[];
  adminResolutionNotes?: string;
  // Metadata
  createdAt: string;
  estimatedResponseDays?: number;
}

// ─── App Problem Reports ──────────────────────────────────────────────────────

export type AppProblemCategory =
  | 'error_mapa'
  | 'falla_pago'
  | 'lentitud_carga'
  | 'error_login'
  | 'notificaciones'
  | 'otro_tecnico';

export interface AppProblemReport {
  id: string;
  ticketNumber: string;
  category: AppProblemCategory;
  categoryLabel: string;
  description: string;
  deviceInfo: string;
  reportedBy: string;
  userEmail?: string;
  status: 'recibido' | 'en_proceso' | 'resuelto';
  createdAt: string;
  responseNotes?: string;
}

// ─── Live Support Chat ────────────────────────────────────────────────────────

export interface LiveChatMessage {
  id: string;
  sender: 'agent' | 'user';
  agentName?: string;
  agentAvatar?: string;
  text: string;
  timestamp: string;
  quickOptions?: { label: string; action: string }[];
  ticketCreated?: {
    ticketNumber: string;
    type: 'pqr_contratista' | 'problema_app';
    summary: string;
  };
}

// Convenience alias — the PQR form/chat pass MapContractor-shaped data
export interface PqrContractorRef {
  id: string;
  name: string;
  companyName: string;
  specialtyLabel?: string;
  avatarUrl?: string;
  neighborhood?: string;
  phone?: string;
}

