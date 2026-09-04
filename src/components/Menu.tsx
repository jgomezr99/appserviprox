import React from 'react';
import {
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenu,
  IonMenuToggle,
  IonFooter,
  IonButton,
  useIonRouter,
  IonHeader,
  IonImg,
} from '@ionic/react';
import { useLocation } from 'react-router-dom';
import {
  homeOutline, homeSharp,
  briefcaseOutline, briefcaseSharp,
  cloudUploadOutline, cloudUploadSharp,
  calendarClearOutline, calendarClearSharp,
  heartOutline, heartSharp,
  settingsOutline, settingsSharp,
  arrowForwardOutline, arrowForwardSharp,
  personCircleOutline,
} from 'ionicons/icons';

import './Menu.css';
import logo from '../Assets/logo.png';
import { useAuth } from '../context/AuthContext';

interface AppPage {
  url: string;
  iosIcon: string;
  mdIcon: string;
  title: string;
}


const appPages: AppPage[] = [
  { title: 'Inicio', url: '/folder/inbox', iosIcon: homeOutline, mdIcon: homeSharp },
  { title: 'Servicios del hogar', url: '/servicioJob/servicio', iosIcon: briefcaseOutline, mdIcon: briefcaseSharp },
  { title: 'Ofrecer servicios', url: '/publicar', iosIcon: cloudUploadOutline, mdIcon: cloudUploadSharp },
  { title: 'Solicitudes', url: '/reservas', iosIcon: calendarClearOutline, mdIcon: calendarClearSharp },
  { title: 'Guardados', url: '/misfavorito', iosIcon: heartOutline, mdIcon: heartSharp },
  { title: 'Configuración', url: '/configuracion', iosIcon: settingsOutline, mdIcon: settingsSharp },
];

const Menu: React.FC = () => {
  const location = useLocation();
  const router = useIonRouter();
  const { isAuthenticated, isLoading, logout, user } = useAuth();

  const isActive = (url: string) =>
    location.pathname === url || location.pathname.startsWith(url + '/');

  const onLogout = () => {
    logout();
    router.push('/login');
  };

  const isAuthPage =
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/ingresar');

  return (
    <IonMenu contentId="main" type="overlay" swipeGesture={!isAuthPage} disabled={isAuthPage} menuId="main-menu">
      <IonHeader className="menu-header-logo">
        <IonImg className="menu-logo" src={logo} alt="Logo" />
      </IonHeader>

      <IonContent className="menu-content menu-has-footer">
        <IonList id="side-menu">
          <IonListHeader className="menu-header">
            <IonMenuToggle autoHide={false}>
              <IonItem
                routerLink="/ingresar"
                routerDirection="none"
                lines="none"
                detail={false}
                className="menu-logo-item"
              >
                
              </IonItem>
            </IonMenuToggle>
          </IonListHeader>

          {appPages.map((pp) => (
            <IonMenuToggle key={pp.url} autoHide={false}>
              <IonItem
                className={isActive(pp.url) ? 'selected' : ''}
                routerLink={pp.url}
                routerDirection="none"
                lines="none"
                detail={false}
              >
                <IonIcon slot="start" ios={pp.iosIcon} md={pp.mdIcon} />
                <IonLabel>{pp.title}</IonLabel>
              </IonItem>
            </IonMenuToggle>
          ))}
        </IonList>
      </IonContent>
  {/* Footer del menú */}
      <IonFooter className="menu-footer">
        <IonMenuToggle autoHide={false}>
          {/* Mostrar LOGIN solo si NO hay sesión y NO estoy en /login o /ingresar */}
          {!isAuthenticated && !isLoading && !isAuthPage ? (
            <IonItem
              routerLink="/login"
              routerDirection="none"
              lines="none"
              detail={false}
              className="login-item"
            >
              <IonIcon slot="start" ios={arrowForwardOutline} md={arrowForwardSharp} />
              <IonLabel>Ingresar / Crear Cuenta</IonLabel>
            </IonItem>
          ) : null}

          {/* Si hay sesión, muestra perfil/acciones y oculta el login */}
          {isAuthenticated ? (
            <IonItem lines="none" className="profile-item" detail={false}>
              <IonIcon slot="start" icon={personCircleOutline} />
              <IonLabel>{user?.first_name || user?.email || 'Mi perfil'}</IonLabel>
              <IonButton slot="end" fill="clear" onClick={onLogout}>
                Cerrar sesión
              </IonButton>
            </IonItem>
          ) : null}
        </IonMenuToggle>
      </IonFooter>
    </IonMenu>
  );
};
export default Menu;
