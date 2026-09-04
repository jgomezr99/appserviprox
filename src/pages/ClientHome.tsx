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
import ExploreContainer from "../components/ExploreContainer";
import "./RolePages.css";

const ClientHome: React.FC = () => (
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonMenuButton autoHide={false} menu="main-menu" />
        </IonButtons>
        <IonTitle>Serviprox</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent fullscreen className="sp-role-content">
      <ExploreContainer name="cliente" />
    </IonContent>
  </IonPage>
);

export default ClientHome;
