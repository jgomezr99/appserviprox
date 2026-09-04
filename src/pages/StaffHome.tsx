import React from "react";
import { IonButton, IonContent, IonPage } from "@ionic/react";
import { useAuth } from "../context/AuthContext";
import "./RolePages.css";

const StaffHome: React.FC = () => {
  const { logout } = useAuth();
  return (
    <IonPage>
      <IonContent fullscreen className="sp-role-content">
        <main className="sp-role-page">
          <section className="sp-card">
            <div className="sp-card-title">
              <span className="sp-role-kicker">SERVIPROX STAFF</span>
              <h2>Panel administrativo no disponible en esta versión</h2>
              <p>
                La cuenta staff está autenticada, pero este Sprint solo separa las
                experiencias de cliente y profesional.
              </p>
            </div>
            <div className="sp-actions sp-actions--spaced">
              <IonButton className="sp-primary-button" onClick={logout}>
                Cerrar sesión
              </IonButton>
            </div>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default StaffHome;
