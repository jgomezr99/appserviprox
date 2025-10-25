import React, { useMemo, useState, useEffect } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonButton, IonIcon, IonImg, IonText, IonItem,
  IonButtons,
  IonMenuButton
} from "@ionic/react";
import {
  heartOutline, heart, star, locationOutline, cashOutline
} from "ionicons/icons";
import "./favoritos.css";
import { Servicio, SERVICIOS_DATA } from '../../data/servicios';

type Tipo = "servicio" | "espacio";

type Favorito = {
  id: string;
  tipo: Tipo;
  titulo: string;
  categoria?: string;
  descripcion?: string;      // NUEVO: descripción corta
  profesional?: string;
  ubicacion?: string;
  ciudad?: string;
  tarifa: number;
  unidad?: string;
  rating?: number;
  img?: string;
  etiquetas?: string[];
  remoto?: boolean;
};

/* ====== DEMO ====== */
const DATA: Favorito[] = [
  {
    id: "svc-frontend",
    tipo: "servicio",
    titulo: "Desarrollo Web Frontend",
    categoria: "Tecnología",
    descripcion: "Creación de interfaces de usuario interactivas y responsivas para tu sitio web.",
    profesional: "Carlos Rodríguez",
    remoto: true,
    tarifa: 75000,
    unidad: "por hora",
    rating: 4.7,
    ciudad: "Remoto",
    img: "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?q=80&w=1200&auto=format&fit=crop"
  },
  {
    id: "svc-fitness",
    tipo: "servicio",
    titulo: "Entrenamiento Fitness Personalizado",
    categoria: "Entrenador Personal",
    descripcion: "Planes personalizados para tus objetivos de fitness. Sesiones individuales/grupales.",
    profesional: "Ana García",
    tarifa: 50000,
    unidad: "por hora",
    rating: 4.9,
    ciudad: "Bogotá, Colombia",
    ubicacion: "Gimnasio Local Central",
    img: "https://images.unsplash.com/photo-1571907480495-61c9b4b5df1a?q=80&w=1200&auto=format&fit=crop"
  },
  {
    id: "esp-bombonera",
    tipo: "espacio",
    titulo: 'Cancha Sintética "La Bombonera"',
    categoria: "Fútbol salón techado",
    tarifa: 80000,
    unidad: "por hora",
    rating: 4.7,
    ciudad: "Bogotá, Colombia",
    ubicacion: "Chapinero Alto",
    etiquetas: ["CUbierta", "Iluminación LED", "Graderías"],
    img: "https://picsum.photos/800/600?random=1"
  },
  {
    id: "esp-campin-aux",
    tipo: "espacio",
    titulo: 'Estadio El Campín (Cancha Auxiliar)',
    categoria: "Cancha de fútbol 11",
    tarifa: 150000,
    unidad: "por hora",
    rating: 4.5,
    ciudad: "Bogotá, Colombia",
    ubicacion: "Teusaquillo",
    etiquetas: ["Grama natural", "Fútbol 11", "Camerinos"],
    img: "https://picsum.photos/800/600?random=2"
  }
];

const Favoritos: React.FC = () => {
  const [favoritos, setFavoritos] = useState<Servicio[]>(() => {
    try {
      const raw = localStorage.getItem("mis_favoritos");
      return raw ? JSON.parse(raw) : SERVICIOS_DATA;
    } catch {
      return SERVICIOS_DATA;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("mis_favoritos", JSON.stringify(favoritos));
    } catch { /* ignore storage errors */ }
  }, [favoritos]);

  const idsFavoritos = useMemo(
    () => new Set(favoritos.map(f => f.id)),
    [favoritos]
  );

  const toggleFavorito = (item: Favorito) => {
    setFavoritos(prev => {
      const existe = prev.some(f => f.id === item.id);
      return existe ? prev.filter(f => f.id !== item.id) : [...prev, item];
    });
  };

  const fmtCOP = (v: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0
    }).format(v);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
           <IonButtons slot="start">
              <IonMenuButton autoHide={false} menu="main-menu" />
            </IonButtons>
          <IonTitle>
            
            Mis Favoritos
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="fav-content">
        {favoritos.length === 0 ? (
          <div className="empty">
            Aún no tienes favoritos. Explora el catálogo y toca el <span aria-hidden>♡</span>.
          </div>
        ) : (
          <div className="favorites-grid">
            {favoritos.map(item => {
              const enFavoritos = idsFavoritos.has(item.id);
              return (
                <IonCard key={item.id} className="fav-card" style={{ position: "relative", paddingBottom: 36 }}>
                  <IonImg
                    src={item.img || "https://placehold.co/800x600?text=No+image"}
                    alt={`Imagen de ${item.titulo}`}
                    style={{ borderTopLeftRadius: 12, borderTopRightRadius: 12, objectFit: "cover", height: 120 }}
                  />

                  <IonCardContent className="card-content" style={{ paddingTop: 12, paddingBottom: 0 }}>
                    <IonCardTitle
                      className="card-title"
                      style={{
                        fontWeight: 600,
                        fontSize: 18,
                        margin: 0,
                        marginBottom: 4,
                        lineHeight: 1.2
                      }}
                    >
                      {item.titulo}
                    </IonCardTitle>

                    {item.categoria && (
                      <div
                        style={{
                          background: "#1976d2",
                          color: "#fff",
                          borderRadius: 8,
                          padding: "2px 12px",
                          display: "inline-block",
                          fontWeight: 600,
                          fontSize: 13,
                          marginBottom: 6
                        }}
                      >
                        {item.categoria}
                      </div>
                    )}

                    {item.descripcion && (
                      <div style={{ color: "#666", fontSize: 14, marginBottom: 6 }}>
                        {item.descripcion}
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      {item.remoto ? (
                        <span style={{ color: "#1976d2", fontWeight: 500, fontSize: 15, display: "flex", alignItems: "center" }}>
                          <IonIcon icon={locationOutline} style={{ marginRight: 2, fontSize: 16 }} />
                          Remoto
                        </span>
                      ) : (
                        <span style={{ color: "#1976d2", fontWeight: 500, fontSize: 15, display: "flex", alignItems: "center" }}>
                          <IonIcon icon={locationOutline} style={{ marginRight: 2, fontSize: 16 }} />
                          {item.ubicacion ? `${item.ubicacion}, ` : ""}
                          {item.ciudad || "Colombia"}
                        </span>
                      )}
                      {typeof item.rating === "number" && (
                        <span style={{ color: "#1976d2", fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center" }}>
                          <IonIcon icon={star} style={{ marginRight: 2, fontSize: 16 }} />
                          {item.rating.toFixed(1)}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 15, marginBottom: 2 }}>
                      <span style={{ fontWeight: 600 }}>Tarifa:</span>{" "}
                      {fmtCOP(item.tarifa)}
                      {item.unidad ? ` ${item.unidad}` : ""}
                    </div>
                    {item.profesional && (
                      <div style={{ fontSize: 15 }}>
                        <span style={{ fontWeight: 600 }}>Profesional:</span>{" "}
                        {item.profesional}
                      </div>
                    )}
                  </IonCardContent>

                  <IonButton
                    className="like-btn"
                    fill="clear"
                    size="small"
                    style={{
                      position: "absolute",
                      bottom: 8,
                      right: 8,
                      borderRadius: "50%",
                      minWidth: 36,
                      minHeight: 36,
                      width: 36,
                      height: 36,
                      padding: 0,
                      zIndex: 2,
                      background: "#fff",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.08)"
                    }}
                    onClick={() => toggleFavorito(item)}
                    aria-pressed={enFavoritos}
                    aria-label={enFavoritos ? "Quitar de favoritos" : "Agregar a favoritos"}
                  >
                    <IonIcon icon={enFavoritos ? heart : heartOutline} color="danger" style={{ fontSize: 22 }} />
                  </IonButton>
                </IonCard>
              );
            })}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Favoritos;
