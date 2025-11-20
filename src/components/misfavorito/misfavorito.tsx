import React, { useMemo, useState, useEffect } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonButton, IonIcon, IonImg, IonText, IonItem,
  IonButtons,
  IonMenuButton,
  IonGrid, IonRow, IonCol, IonBadge, IonList, IonLabel
} from "@ionic/react";
import {
  heartOutline, heart, star, locationOutline, cashOutline,
  globeOutline, pinOutline
} from "ionicons/icons";
import "./favoritos.css";
import "../servicioJob/ServicioJob.css"; // Importar estilos de servicio
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
  const [favoritos, setFavoritos] = useState<any[]>(() => {
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

  const toggleFavorito = (item: any) => {
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
          <IonGrid fixed>
            <IonRow className="cards-row">
              {favoritos.map((item: any) => {
                return (
                  <IonCol size="12" sizeMd="6" sizeLg="4" key={item.id}>
                    <IonCard className="service-card">
                      <div
                        className="hero"
                        style={{ 
                          backgroundImage: `url(${item.img || "https://placehold.co/800x600?text=No+image"})`,
                          height: '200px',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          position: 'relative',
                          borderTopLeftRadius: '12px',
                          borderTopRightRadius: '12px',
                        }}
                        role="img"
                        aria-label={item.titulo}
                      >
                        <IonButton
                          className="like-btn"
                          fill="clear"
                          size="small"
                          onClick={(e) => { e.stopPropagation(); toggleFavorito(item); }}
                          style={{ position: "absolute", top: 10, right: 8, zIndex: 10, background: "rgba(255,255,255,.7)", borderRadius: 999 }}
                        >
                          <IonIcon icon={heart} style={{ fontSize: 22, color: "#e53935" }} />
                        </IonButton>
                      </div>
                      <IonCardHeader>
                        <IonBadge color="secondary">{item.categoria || "Servicio"}</IonBadge>
                        <IonCardTitle className="title">{item.titulo}</IonCardTitle>
                      </IonCardHeader>
                      <IonCardContent>
                        <IonList lines="none" className="specs">
                          <IonItem>
                            <IonLabel>
                              <strong>Tarifa:</strong> {fmtCOP(item.tarifa)} {item.unidad || ""}
                            </IonLabel>
                          </IonItem>
                          {item.profesional && (
                            <IonItem>
                              <IonLabel>
                                <strong>Profesional:</strong> {item.profesional}
                              </IonLabel>
                            </IonItem>
                          )}
                          <IonItem className="meta">
                            <IonIcon icon={star} className="star" />
                            <span className="rating">{item.rating?.toFixed(1) || "N/A"}</span>
                            <span className="dot">•</span>
                            {item.remoto ? (
                              <>
                                <IonIcon icon={globeOutline} />
                                <span>Remoto</span>
                              </>
                            ) : (
                              <>
                                <IonIcon icon={pinOutline} />
                                <span>{item.ubicacion || item.ciudad || "Ubicación"}</span>
                              </>
                            )}
                          </IonItem>
                        </IonList>
                        <IonButton expand="block">Reservar Servicio</IonButton>
                      </IonCardContent>
                    </IonCard>
                  </IonCol>
                );
              })}
            </IonRow>
          </IonGrid>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Favoritos;
