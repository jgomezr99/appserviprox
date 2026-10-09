import type { User, UserRole } from "../types/serviprox";

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
  if (!user) return "/cliente/inicio";
  if (user.role === "staff") return "/admin";
  if (user.role === "professional") return "/profesional/inicio";
  return "/cliente/inicio";
};
