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
  created_at: string;
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
  latitude: number;
  longitude: number;
  area_m2: number | null;
  build_year: number | null;
  notes: string;
  is_default: boolean;
  short_location: string;
  created_at: string;
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
  latitude: number;
  longitude: number;
  distance_km?: number;
  categories: string[];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
