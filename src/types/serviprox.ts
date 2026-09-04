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
  initials: string;
  is_identity_verified: boolean;
  onboarding_completed: boolean;
  created_at: string;
}

export interface UpdateMePayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  city?: string;
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
  category: number;
  category_name: string;
  category_slug: string;
  price_min: string | null;
  price_max: string | null;
  years_experience: number;
}

export interface Professional {
  id: number;
  display_name: string;
  initials: string;
  headline: string;
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

export interface ProfessionalProfilePayload {
  display_name: string;
  headline: string;
  bio?: string;
  neighborhood?: string;
  city: string;
  coverage_radius_km?: number;
  response_time_minutes?: number;
  accepts_urgent?: boolean;
  service_category_ids?: number[];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
