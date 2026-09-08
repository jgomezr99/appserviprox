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
  calendarClearOutline, calendarClearSharp,
  heartOutline, heartSharp,
  arrowForwardOutline, arrowForwardSharp,
  personCircleOutline,
  businessOutline, businessSharp,
  constructOutline, constructSharp,
  timeOutline, timeSharp,
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


const clientPages: AppPage[] = [
  { title: 'Inicio', url: '/cliente/inicio', iosIcon: homeOutline, mdIcon: homeSharp },
  { title: 'Servicios', url: '/cliente/servicios', iosIcon: constructOutline, mdIcon: constructSharp },
  { title: 'Mis solicitudes', url: '/cliente/solicitudes', iosIcon: calendarClearOutline, mdIcon: calendarClearSharp },
  { title: 'Favoritos', url: '/cliente/favoritos', iosIcon: heartOutline, mdIcon: heartSharp },
  { title: 'Mis viviendas', url: '/cliente/viviendas', iosIcon: businessOutline, mdIcon: businessSharp },
  { title: 'Mi perfil', url: '/perfil', iosIcon: personCircleOutline, mdIcon: personCircleOutline },
];

const professionalPages: AppPage[] = [
  { title: 'Inicio', url: '/profesional/inicio', iosIcon: homeOutline, mdIcon: homeSharp },
  { title: 'Solicitudes', url: '/profesional/solicitudes', iosIcon: calendarClearOutline, mdIcon: calendarClearSharp },
  { title: 'Mis trabajos', url: '/profesional/trabajos', iosIcon: briefcaseOutline, mdIcon: briefcaseSharp },
  { title: 'Mi perfil', url: '/perfil', iosIcon: personCircleOutline, mdIcon: personCircleOutline },
  { title: 'Disponibilidad', url: '/profesional/disponibilidad', iosIcon: timeOutline, mdIcon: timeSharp },
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

  const isPublicPage =
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/ingresar') ||
    location.pathname.startsWith('/register');
  const isOnboardingPage = location.pathname.startsWith('/onboarding/');
  const menuPages =
    user?.role === 'professional'
      ? professionalPages
      : user?.role === 'client'
        ? clientPages
        : [];
  const menuDisabled = isPublicPage || isOnboardingPage || !isAuthenticated;

  return (
    <IonMenu contentId="main" type="overlay" swipeGesture={!menuDisabled} disabled={menuDisabled} menuId="main-menu">
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

          {menuPages.map((pp) => (
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
          {!isAuthenticated && !isLoading && !isPublicPage ? (
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
              <IonLabel>{user?.first_name || user?.email || 'Mi cuenta'}</IonLabel>
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
