import React from 'react';
import { useParams } from 'react-router-dom';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonCard, IonCardContent, IonIcon, IonButton
} from '@ionic/react';
import { star, locationOutline, cashOutline } from 'ionicons/icons';
import { getServicioById } from '../data/servicios';

const ServicioPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const servicio = getServicioById(id);

  if (!servicio) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>No encontrado</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: 16 }}>
            Servicio no encontrado
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{servicio.titulo}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonCard>
          <img src={servicio.img} alt={servicio.titulo} style={{ width: '100%', height: 200, objectFit: 'cover' }} />
          <IonCardContent>
            <h1>{servicio.titulo}</h1>
            <div className="categoria">{servicio.categoria}</div>
            <div className="descripcion">{servicio.descripcion}</div>
            
            <div className="meta">
              <div>
                <IonIcon icon={locationOutline} />
                {servicio.remoto ? "Remoto" : `${servicio.ubicacion}, ${servicio.ciudad}`}
              </div>
              {servicio.rating && (
                <div>
                  <IonIcon icon={star} />
                  {servicio.rating}
                </div>
              )}
            </div>

            <div className="precio">
              <IonIcon icon={cashOutline} />
              {new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: 'COP'
              }).format(servicio.tarifa)}
              {servicio.unidad && ` ${servicio.unidad}`}
            </div>

            <IonButton expand="block">
              Reservar {servicio.tipo === 'servicio' ? 'Servicio' : 'Espacio'}
            </IonButton>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default ServicioPage;
