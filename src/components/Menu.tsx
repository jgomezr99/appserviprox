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
  IonToast,
} from '@ionic/react';
import { menuController } from '@ionic/core';
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
  mapOutline, mapSharp,
  shieldCheckmarkOutline, shieldCheckmarkSharp,
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
  { title: 'Mapa de contratistas', url: '/cliente/mapa', iosIcon: mapOutline, mdIcon: mapSharp },
  { title: 'Servicios', url: '/cliente/servicios', iosIcon: constructOutline, mdIcon: constructSharp },
  { title: 'Mis solicitudes', url: '/cliente/solicitudes', iosIcon: calendarClearOutline, mdIcon: calendarClearSharp },
  { title: 'Favoritos', url: '/cliente/favoritos', iosIcon: heartOutline, mdIcon: heartSharp },
  { title: 'Mis viviendas', url: '/cliente/viviendas', iosIcon: businessOutline, mdIcon: businessSharp },
  { title: 'PQRS & Quejas', url: '/cliente/pqrs', iosIcon: shieldCheckmarkOutline, mdIcon: shieldCheckmarkSharp },
  { title: 'Mi perfil de cliente', url: '/cliente/inicio', iosIcon: personCircleOutline, mdIcon: personCircleOutline },
];


const professionalPages: AppPage[] = [
  { title: 'Inicio', url: '/profesional/inicio', iosIcon: homeOutline, mdIcon: homeSharp },
  { title: 'Mis solicitudes', url: '/profesional/solicitudes', iosIcon: calendarClearOutline, mdIcon: calendarClearSharp },
  { title: 'Mis trabajos', url: '/profesional/trabajos', iosIcon: briefcaseOutline, mdIcon: briefcaseSharp },
  { title: 'Mi perfil profesional', url: '/perfil', iosIcon: personCircleOutline, mdIcon: personCircleOutline },
  { title: 'Disponibilidad', url: '/profesional/disponibilidad', iosIcon: timeOutline, mdIcon: timeSharp },
];


const Menu: React.FC = () => {
  const location = useLocation();
  const router = useIonRouter();
  const { becomeClient, becomeProfessional, isAuthenticated, isLoading, logout, user } = useAuth();
  const [roleChangeError, setRoleChangeError] = React.useState('');
  const [roleChanging, setRoleChanging] = React.useState(false);

  const isActive = (url: string) => {
    if (url === '/cliente/solicitudes' && (location.pathname === '/solicitudes' || location.pathname === '/mis-solicitudes' || location.pathname === '/reservas')) {
      return true;
    }
    if (url === '/profesional/solicitudes' && (location.pathname === '/solicitudes' || location.pathname === '/mis-solicitudes')) {
      return true;
    }
    return location.pathname === url || location.pathname.startsWith(url + '/');
  };

  const onLogout = () => {
    logout();
    router.push('/login');
  };

  const onBecomeProfessional = async () => {
    if (roleChanging) return;
    setRoleChanging(true);
    try {
      await becomeProfessional();
      await menuController.close('main-menu');
      router.push('/onboarding/professional');
    } catch {
      setRoleChangeError('No pudimos cambiar tu rol. Inténtalo nuevamente.');
    } finally {
      setRoleChanging(false);
    }
  };

  const onBecomeClient = async () => {
    if (roleChanging) return;
    setRoleChanging(true);
    try {
      await becomeClient();
      await menuController.close('main-menu');
      router.push('/cliente/inicio');
    } catch {
      setRoleChangeError('No pudimos cambiar a perfil cliente. Inténtalo nuevamente.');
    } finally {
      setRoleChanging(false);
    }
  };

  const isPublicPage =
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/ingresar') ||
    location.pathname.startsWith('/register');
  const isOnboardingPage = location.pathname.startsWith('/onboarding/');
  const menuPages =
    user?.role === 'professional'
      ? professionalPages
      : clientPages;
  const menuDisabled = isPublicPage || isOnboardingPage;

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
          {user?.role === 'client' ? (
            <IonItem lines="none" detail={false} className="role-switch-item">
              <IonIcon slot="start" icon={briefcaseOutline} />
              <IonLabel>Ofrecer servicios</IonLabel>
              <IonButton
                slot="end"
                fill="clear"
                disabled={roleChanging}
                onClick={(event) => {
                  event.stopPropagation();
                  void onBecomeProfessional();
                }}
              >
                {roleChanging ? 'Cambiando...' : 'Ser profesional'}
              </IonButton>
            </IonItem>
          ) : null}
          {user?.role === 'professional' ? (
            <IonItem lines="none" detail={false} className="role-switch-item">
              <IonIcon slot="start" icon={homeOutline} />
              <IonLabel>Usar como cliente</IonLabel>
              <IonButton
                slot="end"
                fill="clear"
                disabled={roleChanging}
                onClick={(event) => {
                  event.stopPropagation();
                  void onBecomeClient();
                }}
              >
                {roleChanging ? 'Cambiando...' : 'Cambiar'}
              </IonButton>
            </IonItem>
          ) : null}
        </IonMenuToggle>
      </IonFooter>
      <IonToast
        isOpen={!!roleChangeError}
        message={roleChangeError}
        duration={3000}
        color="danger"
        onDidDismiss={() => setRoleChangeError('')}
      />
    </IonMenu>
  );
};
export default Menu;
