import React, { useMemo, useState, useEffect } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonMenuButton,
  IonSearchbar,
  IonAccordion,
  IonAccordionGroup,
  IonItem,
  IonLabel,
  IonBadge,
  IonButton,
  IonIcon,
  IonList,
  IonText,
  IonSegment,
  IonSegmentButton,
  useIonRouter,
  useIonAlert,
} from "@ionic/react";
import { mailOutline, callOutline, cloudUploadOutline, trashOutline, createOutline } from "ionicons/icons"; // quitado eyeOutline
import "./misreserva.css";

type Estado = "Programado" | "Completado" | "Cancelado";

// Añadir datos del cliente para vista profesional
type Reserva = {
  id: string;
  titulo: string;
  profesional: string;
  lugar: string;
  email: string;
  celular: string;
  fechaInicio: string; // ISO
  fechaFin?: string | null;
  numeroOrden: string;
  estado?: Estado;
  descripcion?: string;
  cliente: string;
  emailCliente?: string;
  celularCliente?: string;
};

// Tipo para las publicaciones locales
type Publicacion = {
  id: string;
  titulo: string;
  categoriaNombre: string;
  tarifaCOP: number;
  createdAt: string;
};

// URL del JSON usado por la página principal (ajusta si tu path es distinto)
const RESERVAS_URL = "/assets/data/reservas.json";

/** Datos de ejemplo como fallback si falla la carga remota */
const SAMPLE: Reserva[] = [
  // movido a public/assets/data/reservas.json
];

const fFecha = (iso?: string | null) => {
  if (!iso) return "N/A";
  const da = new Date(iso);
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(da);
};

const badgeColor = (es?: Estado) =>
  es === "Programado" ? "primary" : es === "Completado" ? "success" : "danger";

export default function TablaReservas() {
  const router = useIonRouter();
  const [presentAlert] = useIonAlert();
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  type Rol = "usuario" | "profesional" | "publicaciones";
  const [rol, setRol] = useState<Rol>("usuario");

  // Nuevo: estado de datos desde servicio/base JSON
  const [data, setData] = useState<Reserva[]>([]); // antes: SAMPLE
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Estado para publicaciones locales
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);

  useEffect(() => {
    if (rol === "publicaciones") {
      // Cargar publicaciones de localStorage en lugar de redirigir
      try {
        const raw = localStorage.getItem("serviprox_publicaciones");
        setPublicaciones(raw ? JSON.parse(raw) : []);
      } catch {
        setPublicaciones([]);
      }
      return;
    }

    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(RESERVAS_URL, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (Array.isArray(json)) {
          setData(json as Reserva[]);
        } else if (Array.isArray(json?.reservas)) {
          setData(json.reservas as Reserva[]);
        } else {
          throw new Error("Formato JSON inválido");
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setError(e?.message ?? "Error al cargar");
          // fallback a SAMPLE
          setData(SAMPLE);
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [rol]);

  const items = useMemo(() => {
    const k = q.trim().toLowerCase();
    const src = data; // usar datos del servicio
    if (!k) return src;
    return src.filter((r) =>
      [
        r.titulo,
        r.profesional,
        r.lugar,
        r.email,
        r.celular,
        r.numeroOrden,
        r.descripcion ?? "",
        r.cliente,
        r.emailCliente ?? "",
        r.celularCliente ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(k)
    );
  }, [q, data]);

  // Helpers de contacto según rol
  const contactoNombre = (r: Reserva) =>
    rol === "usuario" ? r.profesional : r.cliente;
  const contactoEmail = (r: Reserva) =>
    rol === "usuario" ? r.email : r.emailCliente ?? r.email;
  const contactoCel = (r: Reserva) =>
    rol === "usuario" ? r.celular : r.celularCliente ?? r.celular;

  const eliminarPublicacion = (id: string) => {
    presentAlert({
      header: "Eliminar Publicación",
      message: "¿Estás seguro de que deseas eliminar esta publicación?",
      buttons: [
        "Cancelar",
        {
          text: "Eliminar",
          role: "destructive",
          handler: () => {
            const nuevas = publicaciones.filter((p) => p.id !== id);
            setPublicaciones(nuevas);
            localStorage.setItem("serviprox_publicaciones", JSON.stringify(nuevas));
          },
        },
      ],
    });
  };

  const editarPublicacion = (id: string) => {
    router.push(`/publicar?editId=${id}`);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          <IonTitle>
            {rol === "publicaciones" ? "Mis Publicaciones" : `Mis Reservas — ${rol === "usuario" ? "Usuario" : "Profesional"}`}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="misreservas-content">
        {/* Selector de vista: Usuario / Profesional */}
        <IonSegment
          value={rol}
          onIonChange={(e) => setRol((e.detail.value as Rol) ?? "usuario")}
        >
          <IonSegmentButton value="usuario">Usuario</IonSegmentButton>
          <IonSegmentButton value="profesional">Profesional</IonSegmentButton>
          <IonSegmentButton value="publicaciones">
            <IonIcon icon={cloudUploadOutline} />
            <IonLabel>Mis Publicaciones</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {rol === "publicaciones" ? (
          <div className="ion-padding">
            {publicaciones.length === 0 ? (
              <p className="empty">No tienes publicaciones activas.</p>
            ) : (
              <IonList>
                {publicaciones.map((p) => (
                  <IonItem key={p.id} lines="full">
                    <IonLabel>
                      <h2>{p.titulo}</h2>
                      <p>{p.categoriaNombre}</p>
                      <p>
                        <IonText color="primary">
                          ${p.tarifaCOP.toLocaleString("es-CO")}
                        </IonText>{" "}
                        • {new Date(p.createdAt).toLocaleDateString()}
                      </p>
                    </IonLabel>
                    <IonButton
                      fill="clear"
                      color="medium"
                      slot="end"
                      onClick={() => editarPublicacion(p.id)}
                    >
                      <IonIcon icon={createOutline} />
                    </IonButton>
                    <IonButton
                      fill="clear"
                      color="danger"
                      slot="end"
                      onClick={() => eliminarPublicacion(p.id)}
                    >
                      <IonIcon icon={trashOutline} />
                    </IonButton>
                  </IonItem>
                ))}
              </IonList>
            )}
          </div>
        ) : (
          <>
            <IonSearchbar
              placeholder="Buscar por título, profesional, orden..."
              value={q}
              onIonInput={(b) => setQ(b.detail.value ?? "")}
              enterkeyhint="search"
            />

            {/* Mensajes de estado */}
            {loading && <p className="loading">Cargando reservas...</p>}
            {error && !loading && <p className="error">No se pudo cargar: {error}</p>}

            <IonAccordionGroup
              value={openId ?? undefined}
              onIonChange={(e) => setOpenId((e.detail.value as string) || null)}
              expand="inset"
            >
              {items.map((r) => (
                <IonAccordion key={r.id} value={r.id}>
                  <IonItem slot="header" lines="full">
                    <IonLabel>
                      <h3>{r.titulo}</h3>
                      <p>
                        {rol === "usuario"
                          ? `Profesional: ${r.profesional}`
                          : `Cliente: ${r.cliente}`}{" "}
                        • {r.lugar}
                      </p>
                    </IonLabel>
                    {r.estado && (
                      <IonBadge slot="end" color={badgeColor(r.estado)}>
                        {r.estado}
                      </IonBadge>
                    )}
                  </IonItem>

                  <IonText slot="content">
                    <IonList inset>
                      {r.descripcion && (
                        <IonItem lines="none">
                          <IonLabel className="ion-text-wrap">{r.descripcion}</IonLabel>
                        </IonItem>
                      )}

                      <IonItem>
                        <IonLabel color="medium">
                          Email {rol === "usuario" ? "del profesional" : "del cliente"}
                        </IonLabel>
                        <IonLabel className="ion-text-wrap">
                          {contactoEmail(r)}
                        </IonLabel>
                        <IonButton
                          size="small"
                          fill="clear"
                          href={`mailto:${contactoEmail(r)}`}
                          slot="end"
                          title="Enviar email"
                        >
                          <IonIcon icon={mailOutline} />
                        </IonButton>
                      </IonItem>

                      <IonItem>
                        <IonLabel color="medium">
                          Celular {rol === "usuario" ? "del profesional" : "del cliente"}
                        </IonLabel>
                        <IonLabel>{contactoCel(r)}</IonLabel>
                        <IonButton
                          size="small"
                          fill="clear"
                          href={`tel:${contactoCel(r)}`}
                          slot="end"
                          title="Llamar"
                        >
                          <IonIcon icon={callOutline} />
                        </IonButton>
                      </IonItem>

                      <IonItem>
                        <IonLabel color="medium">Inicio</IonLabel>
                        <IonLabel>{fFecha(r.fechaInicio)}</IonLabel>
                      </IonItem>

                      <IonItem>
                        <IonLabel color="medium">Fin</IonLabel>
                        <IonLabel>{fFecha(r.fechaFin)}</IonLabel>
                      </IonItem>

                      <IonItem>
                        <IonLabel color="medium">N° Orden</IonLabel>
                        <IonLabel>{r.numeroOrden}</IonLabel>
                      </IonItem>

                      <IonItem lines="none">
                        <IonButton size="default" href={`mailto:${contactoEmail(r)}`}>
                          <IonIcon icon={mailOutline} slot="start" />
                          Email
                        </IonButton>
                        <IonButton size="small" fill="clear" href={`tel:${contactoCel(r)}`}>
                          <IonIcon icon={callOutline} slot="start" />
                          Teléfono
                        </IonButton>
                      </IonItem>
                    </IonList>
                  </IonText>
                </IonAccordion>
              ))}
            </IonAccordionGroup>

            {!loading && items.length === 0 && <p className="empty">Sin resultados.</p>}
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
