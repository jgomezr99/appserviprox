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
  IonText
} from '@ionic/react';
import {
  moonOutline,
  notificationsOutline,
  languageOutline,
  personOutline,
  informationCircleOutline
} from 'ionicons/icons';

const Configuracion: React.FC = () => {
  const router = useIonRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState('es');
  const [isAuth, setIsAuth] = useState<boolean>(false);

  // Datos de perfil
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.body.classList.toggle('dark');
  };

  useEffect(() => {
    const hasToken = !!localStorage.getItem('authToken');
    setIsAuth(hasToken);

    if (hasToken) {
      // Cargar perfil almacenado
      setFirstName(localStorage.getItem('user.firstName') || '');
      setLastName(localStorage.getItem('user.lastName') || '');
      setEmail(localStorage.getItem('user.email') || '');
    }
  }, []);

  const onSaveProfile = () => {
    localStorage.setItem('user.firstName', firstName.trim());
    localStorage.setItem('user.lastName', lastName.trim());
    localStorage.setItem('user.email', email.trim());
    setSaved(true);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          <IonTitle>Configuración</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        {!isAuth ? (
          <IonText className="ion-padding">
            <h2>Necesitas iniciar sesión</h2>
            <p>Ingresa a tu cuenta para ver y editar tu configuración.</p>
            <IonButton onClick={() => router.push('/login')}>Ir a Ingresar</IonButton>
          </IonText>
        ) : ( 
          <IonList>
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
                onIonInput={(e) => setEmail(String(e.detail.value ?? ''))}
              />
            </IonItem>

            <div className="ion-padding">
              <IonButton onClick={onSaveProfile}>Guardar cambios</IonButton>
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

            <IonItem button routerLink="/perfil">
              <IonIcon icon={personOutline} slot="start" />
              <IonLabel>Perfil</IonLabel>
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
