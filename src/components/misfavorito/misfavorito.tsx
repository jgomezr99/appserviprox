import React, { useState, useEffect } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonButton, IonIcon, IonItem,
  IonButtons,
  IonMenuButton,
  IonGrid, IonRow, IonCol, IonBadge, IonList, IonLabel
} from "@ionic/react";
import {
  heart, star,
  globeOutline, pinOutline
} from "ionicons/icons";
import "./favoritos.css";
import { type Servicio, SERVICIOS_DATA } from '../../data/servicios';

const Favoritos: React.FC = () => {
  const [favoritos, setFavoritos] = useState<Servicio[]>(() => {
    try {
      const raw = localStorage.getItem("mis_favoritos");
      return raw ? (JSON.parse(raw) as Servicio[]) : SERVICIOS_DATA;
    } catch {
      return SERVICIOS_DATA;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("mis_favoritos", JSON.stringify(favoritos));
    } catch { /* ignore storage errors */ }
  }, [favoritos]);

  const toggleFavorito = (item: Servicio) => {
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
              {favoritos.map((item: Servicio) => {
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
