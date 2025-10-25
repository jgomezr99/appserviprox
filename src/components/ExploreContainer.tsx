import React, { useEffect, useState } from "react";
import {
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonIcon,
  IonText,
  IonButton
} from '@ionic/react';
import {
  shieldCheckmarkOutline,
  flashOutline,
  peopleCircleOutline,
  cardOutline,
  personAddOutline,
  searchOutline,
  checkmarkCircleOutline,
  starOutline,
  homeOutline,
  laptopOutline,
  restaurantOutline,
  buildOutline,
  
  briefcaseOutline,
  carOutline,
  cameraOutline,
  shieldOutline,
  terminalOutline,
  pawOutline
} from 'ionicons/icons';

import './ExploreContainer.css';

interface ContainerProps {
  name: string; // no lo usamos, pero se mantiene por compatibilidad
}

type Feature = { title: string; text: string; icon: string };
type HowTo = { title: string; text: string; icon: string; step: number };
type Category = { title: string; sub: string; icon: string };

const FEATURES: Feature[] = [
  {
    title: '100% Gratuito',
    text: 'Regístrate, explora y publica servicios sin costos. Solo pagamos cuando efectivamente se contrata.',
    icon: shieldCheckmarkOutline
  },
  {
    title: 'Proceso Rápido',
    text: 'Encuentra y contrata profesionales en minutos. Sistema de órdenes con seguimiento en tiempo real.',
    icon: flashOutline
  },
  {
    title: 'Profesionales Verificados',
    text: 'Perfiles con reseñas reales y calificaciones de clientes anteriores.',
    icon: peopleCircleOutline
  },
  {
    title: 'Pagos Seguros',
    text: 'Integración con tarjetas de crédito, débito y PSE. Comisiones justas solo sobre servicios completados.',
    icon: cardOutline
  }
];

const HOWTO: HowTo[] = [
  {
    title: 'Regístrate Gratis',
    text: 'Crea tu cuenta sin costos. Completa tu perfil y verifica tu identidad.',
    icon: personAddOutline,
    step: 1
  },
  {
    title: 'Busca o Publica',
    text: 'Explora por categoría, ubicación y precio, o publica tu servicio.',
    icon: searchOutline,
    step: 2
  },
  {
    title: 'Conecta y Contrata',
    text: 'Recibe propuestas, negocia detalles y acepta la orden.',
    icon: checkmarkCircleOutline,
    step: 3
  },
  {
    title: 'Califica la Experiencia',
    text: 'Al finalizar, califica el servicio y construye reputación.',
    icon: starOutline,
    step: 4
  }
];

const CATEGORIA: Category[] = [
  //{ title: 'Hogar y Limpieza', sub: '120+ servicios', icon: homeOutline },
  { title: 'Tecnología y Diseño', sub: '95+ servicios', icon: terminalOutline,},
  
  { title: 'Mantenimiento y Reparaciones', sub: '110+ servicios', icon: buildOutline },
  { title: 'Cuidado mascota ', sub: '70+ servicios', icon: pawOutline },
  { title: 'Servicio de segurida privada', sub: '50+ servicios', icon:shieldOutline},
  { title: 'Foto y Video', sub: '40+ servicios', icon: cameraOutline },
  {title:'Educacion y Entrenador', sub: '80+ servicios', icon: peopleCircleOutline}
];

const ExploreContainer: React.FC<ContainerProps> = () => {
  // favoritos por título (puede cambiar a id si añades uno)
  const [favs, setFavs] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("explore_favs");
      return raw ? new Set<string>(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("explore_favs", JSON.stringify(Array.from(favs)));
    } catch { /* ignore */ }
  }, [favs]);

  const toggleFav = (key: string) => {
    setFavs(prev => {
      const copy = new Set(prev);
      if (copy.has(key)) copy.delete(key); else copy.add(key);
      return copy;
    });
  };

  return (
    <div className="landing-wrapper">
      {/* ===== Why ===== */}
      <section className="section light">
        <IonText color="dark">
          <h2 className="section-title">¿Por Qué Elegir  Serviprox?</h2>
        </IonText>
        <IonText color="medium">
          <p className="section-subtitle">
            Creamos una plataforma justa y transparente donde tanto profesionales como clientes
            pueden crecer sin limitaciones económicas injustas.
          </p>
        </IonText>

        <IonGrid fixed>
          <IonRow className="cards-row">
            {FEATURES.map((f, idx) => {
              const key = `feature-${f.title}`;
              const isFav = favs.has(key);
              return (
                <IonCol key={idx} size="12" sizeMd="6">
                  <IonCard className="info-card">
                    <div className="icon-badge">
                      <IonIcon icon={f.icon} />
                    </div>

                    {/* favorito desactivado (removido) */}

                    <IonCardHeader>
                      <IonText color="dark">
                        <IonCardTitle>{f.title}</IonCardTitle>
                      </IonText>
                    </IonCardHeader>
                    <IonCardContent>
                      <IonText color="medium">{f.text}</IonText>
                    </IonCardContent>
                  </IonCard>
                </IonCol>
              );
            })}
          </IonRow>
        </IonGrid>
      </section>

      {/* ===== Cómo Funciona ===== */}
      <section className="section">
        <IonText color="dark">
          <h2 className="section-title">Cómo Funciona</h2>
        </IonText>
        <IonText color="medium">
          <p className="section-subtitle">
            Cuatro pasos simples para conectar profesionales con clientes de manera segura y eficiente.
          </p>
        </IonText>

        <IonGrid fixed>
          <IonRow className="how-row">
            {HOWTO.map((h, idx) => (
              <IonCol key={idx} size="12" sizeMd="6" className="how-item">
                <div className="how-icon">
                  <IonIcon icon={h.icon} />
               
                  
                  <span className="how-step">{h.step}</span>
                </div>
                <IonText color="dark">
                  <h3>{h.title}</h3>
                </IonText>
                <IonText color="medium">
                  <p>{h.text}</p>
                </IonText>
              </IonCol>
            ))}
          </IonRow>
        </IonGrid>
      </section>

      {/* ===== Categoria ===== */}
      <section className="section light">
        <IonText color="dark">
          <h2 className="section-title">Explora Nuestras Categorías</h2>
        </IonText>
        <IonText color="medium">
          <p className="section-subtitle">
            Desde servicios para el hogar hasta consultoría profesional, encuentra exactamente lo que necesitas.
          </p>
        </IonText>

        <IonGrid fixed>
          <IonRow className="cards-row">
            {CATEGORIA.map((c, idx) => {
              const key = `cat-${c.title}`;
              const isFav = favs.has(key);
              return (
                <IonCol key={idx} size="12" sizeMd="6" sizeLg="4">
                  <IonCard className="category-card">
                    <div className="icon-badge">
                      <IonIcon icon={c.icon} />
                    </div>

                    {/* favorito desactivado (removido) */}

                    <IonCardHeader>
                      <IonText color="dark">
                        <IonCardTitle>{c.title}</IonCardTitle>
                      </IonText>
                    </IonCardHeader>
                    <IonCardContent className="muted">
                      <IonText color="medium">{c.sub}</IonText>
                    </IonCardContent>
                  </IonCard>
                </IonCol>
              );
            })}
          </IonRow>
        </IonGrid>
      </section>
    </div>
  );
};

export default ExploreContainer;
