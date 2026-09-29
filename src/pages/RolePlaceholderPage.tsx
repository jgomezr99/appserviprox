import React from "react";
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import "./RolePages.css";

type RolePlaceholderPageProps = {
  title: string;
  kicker: string;
  description: string;
};

const RolePlaceholderPage: React.FC<RolePlaceholderPageProps> = ({
  title,
  kicker,
  description,
}) => (
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonMenuButton autoHide={false} menu="main-menu" />
        </IonButtons>
        <IonTitle>{title}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent fullscreen className="sp-role-content">
      <main className="sp-role-page">
        <section className="sp-card">
          <div className="sp-card-title">
            <span className="sp-role-kicker">{kicker}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </section>
      </main>
    </IonContent>
  </IonPage>
);

export default RolePlaceholderPage;
