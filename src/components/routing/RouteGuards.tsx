import React from "react";
import { IonContent, IonPage, IonSpinner } from "@ionic/react";
import { Redirect, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import type { UserRole } from "../../types/serviprox";
import { getEntryRoute, getOnboardingRoute, getRoleHomeRoute } from "../../utils/routes";
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
  if (role && user.role !== role) return <Redirect to={getEntryRoute(user)} />;
  if (user.role === "staff" && role !== "staff") return <Redirect to="/staff" />;

  if (onboarding === "required" && user.onboarding_completed) {
    return <Redirect to={getRoleHomeRoute(user.role)} />;
  }

  if (onboarding === "complete" && !user.onboarding_completed) {
    return <Redirect to={getOnboardingRoute(user.role)} />;
  }

  if (location.pathname === "/login" || location.pathname === "/register") {
    return <Redirect to={getEntryRoute(user)} />;
  }

  return <>{children}</>;
};
