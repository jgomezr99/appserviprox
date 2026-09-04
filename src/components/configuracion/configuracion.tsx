import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonIcon,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonButtons,
  IonMenuButton,
  IonInput,
  IonToast,
  useIonRouter,
  IonText,
  IonSpinner
} from '@ionic/react';
import {
  moonOutline,
  notificationsOutline,
  languageOutline,
  personOutline,
  informationCircleOutline
} from 'ionicons/icons';
import { useAuth } from '../../context/AuthContext';
import './configuracion.css';

const Configuracion: React.FC = () => {
  const router = useIonRouter();
  const { isAuthenticated, user, updateMe } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState('es');

  // Datos de perfil
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.body.classList.toggle('dark');
  };

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setCity(user.city || '');
    }
  }, [user]);

  const onSaveProfile = async () => {
    setSaving(true);
    setError('');
    try {
      await updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        city: city.trim(),
      });
      setSaved(true);
    } catch {
      setError('No pudimos guardar los cambios de tu cuenta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          <IonTitle>Mi cuenta</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        {!isAuthenticated ? (
          <IonText className="ion-padding">
            <h2>Necesitas iniciar sesión</h2>
            <p>Ingresa a tu cuenta para ver y editar tu configuración.</p>
            <IonButton onClick={() => router.push('/login')}>Ir a Ingresar</IonButton>
          </IonText>
        ) : ( 
          <IonList className="account-list">
            {/* Perfil: nombre, apellido, email */}
            <IonItem lines="full">
              <IonIcon icon={personOutline} slot="start" />
              <IonLabel position="stacked">Nombre</IonLabel>
              <IonInput
                placeholder="Tu nombre"
                value={firstName}
                onIonInput={(e) => setFirstName(String(e.detail.value ?? ''))}
              />
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Apellido</IonLabel>
              <IonInput
                placeholder="Tu apellido"
                value={lastName}
                onIonInput={(e) => setLastName(String(e.detail.value ?? ''))}
              />
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Email</IonLabel>
              <IonInput
                type="email"
                placeholder="tucorreo@ejemplo.com"
                value={email}
                readonly
              />
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Teléfono</IonLabel>
              <IonInput
                type="tel"
                placeholder="+57 300 000 0000"
                value={phone}
                onIonInput={(e) => setPhone(String(e.detail.value ?? ''))}
              />
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Ciudad</IonLabel>
              <IonInput
                placeholder="Bogotá"
                value={city}
                onIonInput={(e) => setCity(String(e.detail.value ?? ''))}
              />
            </IonItem>

            <div className="ion-padding">
              {error && <p className="account-error">{error}</p>}
              <IonButton onClick={onSaveProfile} disabled={saving}>
                {saving ? <IonSpinner name="crescent" /> : 'Guardar cambios'}
              </IonButton>
            </div>

            <IonItem>
              <IonIcon icon={moonOutline} slot="start" />
              <IonLabel>Modo oscuro</IonLabel>
              <IonToggle
                checked={darkMode}
                onIonChange={toggleDarkMode}
                slot="end"
              />
            </IonItem>

            <IonItem>
              <IonIcon icon={notificationsOutline} slot="start" />
              <IonLabel>Notificaciones</IonLabel>
              <IonToggle
                checked={notifications}
                onIonChange={(e) => setNotifications(e.detail.checked)}
                slot="end"
              />
            </IonItem>

            <IonItem>
              <IonIcon icon={languageOutline} slot="start" />
              <IonLabel>Idioma</IonLabel>
              <IonSelect
                value={language}
                onIonChange={(e) => setLanguage(e.detail.value)}
                interface="popover"
              >
                <IonSelectOption value="es">Español</IonSelectOption>
                <IonSelectOption value="en">English</IonSelectOption>
              </IonSelect>
            </IonItem>

            <IonItem className="ion-margin-top">
              <IonIcon icon={informationCircleOutline} slot="start" />
              <IonLabel>
                <h2>Acerca de</h2>
                <p>Versión 1.0.0</p>
              </IonLabel>
            </IonItem>
          </IonList>
        )}
        <IonToast
          isOpen={saved}
          duration={1800}
          message="Datos guardados"
          onDidDismiss={() => setSaved(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default Configuracion;
