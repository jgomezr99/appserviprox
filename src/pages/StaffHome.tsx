import React from "react";
import { IonContent, IonPage } from "@ionic/react";
import AdminDashboard from "../admin/AdminDashboard";

const StaffHome: React.FC = () => {
  return (
    <IonPage>
      <IonContent fullscreen style={{ "--background": "#1c88f5" }}>
        <AdminDashboard />
      </IonContent>
    </IonPage>
  );
};

export default StaffHome;
