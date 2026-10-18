import type { User, UserRole } from "../types/serviprox";

export const isUserAdmin = (user?: User | null): boolean => {
  if (!user) return false;
  return user.role === "staff" || Boolean(user.is_staff) || Boolean(user.is_superuser);
};

export const getRoleHomeRoute = (role?: UserRole) => {
  if (role === "professional") return "/profesional/inicio";
  if (role === "staff") return "/admin";
  return "/cliente/inicio";
};

export const getOnboardingRoute = (role?: UserRole) => {
  if (role === "professional") return "/onboarding/professional";
  if (role === "staff") return "/admin";
  return "/cliente/inicio";
};

export const getEntryRoute = (user: User | null) => {
  if (!user) return "/login";
  if (isUserAdmin(user)) return "/admin";
  if (user.role === "professional") return "/profesional/inicio";
  return "/cliente/inicio";
};
