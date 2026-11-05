import React from "react";
import { IonIcon, IonSpinner } from "@ionic/react";
import "./ServiceButtonContent.css";

type Props = { busy: boolean; icon: string; label: string; busyLabel: string };

/** Mantener un único hijo proyectado en IonButton y no reemplazar sus nodos al cargar. */
const ServiceButtonContent: React.FC<Props> = ({ busy, icon, label, busyLabel }) => (
  <span className="sp-service-button-content" aria-busy={busy}>
    <span className="sp-service-button-symbol" aria-hidden="true">
      <span hidden={busy}><IonIcon icon={icon} /></span>
      <span hidden={!busy}><IonSpinner name="crescent" paused={!busy} /></span>
    </span>
    <span className="sp-service-button-label">{busy ? busyLabel : label}</span>
  </span>
);

export default ServiceButtonContent;
