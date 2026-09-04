import type { User, UserRole } from "../types/serviprox";

export const getRoleHomeRoute = (role?: UserRole) => {
  if (role === "professional") return "/profesional/inicio";
  if (role === "staff") return "/staff";
  return "/cliente/inicio";
};

export const getOnboardingRoute = (role?: UserRole) => {
  if (role === "professional") return "/onboarding/professional";
  if (role === "staff") return "/staff";
  return "/onboarding/client";
};

export const getEntryRoute = (user: User | null) => {
  if (!user) return "/login";
  if (user.role === "staff") return "/staff";
  if (!user.onboarding_completed) return getOnboardingRoute(user.role);
  return getRoleHomeRoute(user.role);
};
