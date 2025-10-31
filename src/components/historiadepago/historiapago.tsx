import React, { useMemo, useState } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonButton, IonIcon,
  IonSelect, IonSelectOption, IonInput, IonRow, IonCol,
  IonButtons,
  IonMenuButton
} from "@ionic/react";
import { downloadOutline, searchOutline } from "ionicons/icons";
import { Capacitor, registerPlugin } from "@capacitor/core";

/* Tipos */
type Estado = "Pagada" | "Pendiente" | "Pago Rechazado";
type MetodoPago = "Nequi" | "Bancolombia" | "Efectivo" | "Otro";
type Factura = {
  id: string;
  fecha: string;
  servicio: string;
  montoCOP: number;
  estado: Estado;
  metodoPago: MetodoPago;
};

/* Datos demo */
const FACTURAS: Factura[] = [
  {  id: "FACT-00123", fecha: "2024-08-15", servicio: "Entrenamiento", montoCOP: 180000, estado: "Pagada", metodoPago: "Nequi" },
  { id: "FACT-00124", fecha: "2025-05-17", servicio: "Clases", montoCOP: 120000, estado: "Pago Rechazado", metodoPago: "Bancolombia" },
  { id: "FACT-00125", fecha: "2025-02-01", servicio: "Desarrollo Web", montoCOP: 1500000, estado: "Pagada", metodoPago: "Efectivo" },
];

/* Helpers */
const formatFecha = (iso: string) => new Date(iso).toLocaleDateString();
const formatCOP = (n: number) => n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

/* Generar PDF (carga dinámica) */
const descargarComprobante = async (f: Factura) => {
  if (f.estado !== "Pagada") {
    alert("Sólo puede descargar comprobante de pagos marcados como 'Pagada'.");
    return;
  }

  let mod: any;
  try {
    mod = await import("jspdf");
  } catch {
    alert("Funcionalidad PDF no disponible. Instala 'jspdf' con: npm install jspdf");
    return;
  }

  const jsPDF = mod?.jsPDF ?? mod?.default ?? mod;
  if (!jsPDF) {
    alert("No se pudo cargar jsPDF.");
    return;
  }

  try {
    // @ts-ignore
    const doc = new (jsPDF as any)();
    doc.setFontSize(20);
    doc.text("Comprobante de Pago", 20, 20);
    doc.setFontSize(11);
    doc.text(`Nº Factura: ${f.id}`, 20, 34);
    doc.text(`Fecha: ${formatFecha(f.fecha)}`, 20, 42);
    doc.text(`Servicio: ${f.servicio}`, 20, 50);
    doc.text(`Monto: ${formatCOP(f.montoCOP)}`, 20, 58);
    doc.text(`Método de Pago: ${f.metodoPago}`, 20, 66);
    doc.text(`Estado: ${f.estado}`, 20, 74);

    const filename = `${f.id}-comprobante.pdf`;
    const platform = Capacitor.getPlatform?.() ?? "web";

    // Web: descarga directa
    if (platform === "web") {
      doc.save(filename);
      return;
    }

    // Nativo: guardar y compartir usando plugins registrados dinámicamente
    const Filesystem: any = registerPlugin("Filesystem");
    const Share: any = registerPlugin("Share");

    // Si plugins no están disponibles, abrir en nueva pestaña como fallback
    if (!Filesystem?.writeFile || !Share?.share) {
      const blobUrl = doc.output("bloburl");
      window.open(blobUrl, "_blank");
      return;
    }

    // Verificar capacidad de compartir (si está disponible en el plugin)
    try {
      if (typeof Share.canShare === "function") {
        const can = await Share.canShare();
        if (can && can.value === false) {
          const blobUrl = doc.output("bloburl");
          window.open(blobUrl, "_blank");
          return;
        }
      }
    } catch {
      // Ignorar si canShare no está soportado
    }

    // Guardar PDF en Documents
    const dataUri = doc.output("datauristring") as string;
    const base64 = dataUri.split(",")[1];
    const path = `comprobantes/${filename}`;

    const writeRes = await Filesystem.writeFile({
      path,
      data: base64,
      directory: "DOCUMENTS", // equivalente a Directory.Documents
      recursive: true,
    });

    // Resolver URL compartible
    let shareUrl: string | undefined = writeRes?.uri || (writeRes as any)?.uriPath;

    // En Android, convertir a content://
    if (platform === "android" && typeof Filesystem.getUri === "function") {
      const r = await Filesystem.getUri({ directory: "DOCUMENTS", path });
      shareUrl = r?.uri || shareUrl;
    }

    if (shareUrl) {
      await Share.share({
        title: "Comprobante de Pago",
        text: `Comprobante ${f.id}`,
        url: shareUrl,
      });
    } else {
      const blobUrl = doc.output("bloburl");
      window.open(blobUrl, "_blank");
    }
  } catch (e) {
    console.error(e);
    alert("Error generando o compartiendo el PDF.");
  }
};

/* Componente principal */
const Historiapago: React.FC = () => {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<Estado | "Todos">("Todos");
  const [metodo, setMetodo] = useState<MetodoPago | "Todos">("Todos");
  

  const filtradas = useMemo(() => {
    return FACTURAS.filter(f => {
      if (estado !== "Todos" && f.estado !== estado) return false;
      if (metodo !== "Todos" && f.metodoPago !== metodo) return false;
      const s = q.trim().toLowerCase();
      if (!s) return true;
      return f.id.toLowerCase().includes(s) || f.servicio.toLowerCase().includes(s);
    });
  }, [q, estado, metodo]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
           <IonButtons slot="start">
              <IonMenuButton autoHide={false} menu="main-menu" />
            </IonButtons>
          <IonTitle>Historial de Pagos</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRow style={{ marginBottom: 12, gap: 8 }}>
          <IonCol size="12" sizeMd="4">
            <IonItem>
              <IonIcon slot="start" icon={searchOutline} />
              <IonInput placeholder="Buscar Nº o servicio" value={q} onIonInput={e => setQ(e.detail.value ?? "")} />
            </IonItem>
          </IonCol>
          <IonCol size="6" sizeMd="4">
            <IonItem>
              <IonSelect value={estado} onIonChange={e => setEstado(e.detail.value as any)}>
                <IonSelectOption value="Todos">Todos</IonSelectOption>
                <IonSelectOption value="Pagada">Pagadas</IonSelectOption>
                <IonSelectOption value="Pendiente">Pendientes</IonSelectOption>
                <IonSelectOption value="Pago Rechazado">Pago Rechazado</IonSelectOption>
              </IonSelect>
            </IonItem>
          </IonCol>
          <IonCol size="6" sizeMd="4">
            <IonItem>
              <IonSelect value={metodo} onIonChange={e => setMetodo(e.detail.value as any)}>
                <IonSelectOption value="Todos">Todos los métodos</IonSelectOption>
                <IonSelectOption value="Nequi">Nequi</IonSelectOption>
                <IonSelectOption value="Bancolombia">Bancolombia</IonSelectOption>
                <IonSelectOption value="Efectivo">Efectivo</IonSelectOption>
                <IonSelectOption value="Otro">Otro</IonSelectOption>
              </IonSelect>
            </IonItem>
          </IonCol>
        </IonRow>

        <IonList>
          {filtradas.map(f => (
            <IonItem key={f.id}>
              <IonLabel>
                <h3>{f.id} — {formatFecha(f.fecha)}</h3>
                <p>{f.servicio}</p>
                <p>{formatCOP(f.montoCOP)} • {f.metodoPago} • <strong>{f.estado}</strong></p>
              </IonLabel>
              <IonButton slot="end" color="primary" onClick={() => descargarComprobante(f)} title="Descargar comprobante" disabled={f.estado !== "Pagada"}>
                <IonIcon slot="icon-only" icon={downloadOutline} />
              </IonButton>
            </IonItem>
          ))}
          {filtradas.length === 0 && <IonItem><IonLabel>No hay resultados.</IonLabel></IonItem>}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Historiapago;