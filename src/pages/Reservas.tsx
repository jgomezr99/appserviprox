import React from "react";
import MisReserva from "../components/misreservas/misreserva";

// Evita anidar IonPage dentro de otra IonPage. El componente MisReserva ya
// devuelve su propio IonPage con encabezado y botón de menú.
const Reservas: React.FC = () => <MisReserva />;

export default Reservas;
