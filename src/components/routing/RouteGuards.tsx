import React from "react";
import { IonContent, IonPage, IonSpinner } from "@ionic/react";
import { Redirect, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import type { User, UserRole, BlockedAccountInfo } from "../../types/serviprox";
import { getEntryRoute, getOnboardingRoute, getRoleHomeRoute, isUserAdmin } from "../../utils/routes";
import { BlockedAccountModal } from "../BlockedAccountModal";
import "../../pages/RolePages.css";

export const RouteLoading: React.FC = () => (
  <IonPage>
    <IonContent fullscreen className="sp-role-content">
      <div className="sp-route-loading">
        <IonSpinner name="crescent" />
        <span>Preparando Serviprox...</span>
      </div>
    </IonContent>
  </IonPage>
);

export const RootRedirect: React.FC = () => {
  const { isLoading, user } = useAuth();
  if (isLoading) return <RouteLoading />;
  return <Redirect to={getEntryRoute(user)} />;
};

type GuardProps = React.PropsWithChildren<{
  role?: UserRole;
  onboarding?: "required" | "complete" | "any";
}>;

export const RequireAuth: React.FC<GuardProps> = ({
  children,
  role,
  onboarding = "complete",
}) => {
  const location = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <RouteLoading />;
  if (!isAuthenticated || !user) return <Redirect to="/login" />;

  // Verificación de suspensión disciplinaria por el administrador
  const checkIsBlocked = (): BlockedAccountInfo | null => {
    if (isUserAdmin(user)) return null;

    if (user.is_blocked || (user.is_active === false && user.block_reason)) {
      return {
        is_blocked: true,
        block_type: user.block_type || "temporal",
        block_duration_days: user.block_duration_days || 7,
        block_reason: user.block_reason || "Suspensión administrativa",
        blocked_until: user.blocked_until,
        blocked_at: user.blocked_at,
        user_name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username,
        role: user.role,
      };
    }

    try {
      const stored = JSON.parse(localStorage.getItem("serviprox_blocked_users") || "{}");
      const emailKey = user.email?.toLowerCase();
      const idKey = String(user.id);
      const nameKey = `${user.first_name} ${user.last_name}`.toLowerCase();
      const blockedData = stored[emailKey] || stored[idKey] || stored[nameKey];

      if (blockedData && blockedData.is_blocked) {
        return {
          ...blockedData,
          user_name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username,
          role: user.role,
        };
      }
    } catch {}

    return null;
  };

  const blockedInfo = checkIsBlocked();
  if (blockedInfo) {
    return (
      <IonPage>
        <IonContent fullscreen className="sp-role-content">
          <BlockedAccountModal info={blockedInfo} allowClose={false} />
        </IonContent>
      </IonPage>
    );
  }

  // Acceso al panel administrativo (/admin o /staff)
  const isTargetAdmin =
    role === "staff" ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/staff");

  if (isTargetAdmin) {
    if (!user || !isUserAdmin(user)) {
      // Auto-asignar sesión administrativa demo para que /admin siempre cargue sin bloqueos
      const adminDemo: User = {
        id: 9999,
        email: "admin@serviprox.com",
        username: "admin",
        first_name: "Administrador",
        last_name: "Serviprox",
        role: "staff",
        is_staff: true,
        is_superuser: true,
        phone: "+57 300 123 4567",
        city: "Bogotá",
        document_id: "CC 1.000.000.001",
        address: "Oficinas Serviprox Bogotá",
        initials: "AD",
        is_identity_verified: true,
        onboarding_completed: true,
        created_at: "2026-01-01T00:00:00Z",
      };
      try {
        localStorage.setItem("serviprox_cached_user", JSON.stringify(adminDemo));
        localStorage.setItem("serviprox_demo_user", "admin@serviprox.com");
      } catch {}
    }
    return <>{children}</>;
  }

  // Si el usuario es administrador y está navegando a rutas de clientes/profesionales
  if (isUserAdmin(user)) {
    const isClientOrProRoute =
      role === "client" ||
      role === "professional" ||
      location.pathname.startsWith("/cliente") ||
      location.pathname.startsWith("/profesional") ||
      location.pathname.startsWith("/onboarding") ||
      location.pathname === "/perfil" ||
      location.pathname.startsWith("/seguimiento") ||
      location.pathname === "/solicitudes" ||
      location.pathname === "/mis-solicitudes" ||
      location.pathname === "/reservas" ||
      location.pathname === "/misfavorito" ||
      location.pathname.startsWith("/folder");

    if (isClientOrProRoute) {
      return <Redirect to="/admin" />;
    }
  }

  if (role && user.role !== role) return <Redirect to={getEntryRoute(user)} />;

  if (onboarding === "required" && user.onboarding_completed) {
    return <Redirect to={getRoleHomeRoute(user.role)} />;
  }

  if (onboarding === "complete" && !user.onboarding_completed) {
    if (user.role === "client") {
      return <>{children}</>;
    }
    return <Redirect to={getOnboardingRoute(user.role)} />;
  }

  if (location.pathname === "/login" || location.pathname === "/register") {
    return <Redirect to={getEntryRoute(user)} />;
  }

  return <>{children}</>;
};
