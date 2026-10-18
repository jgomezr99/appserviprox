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
  giftOutline, giftSharp,
  cartOutline, cartSharp,
  logOutOutline,
  swapHorizontalOutline,
} from 'ionicons/icons';


import './Menu.css';
import logo from '../Assets/logo.png';
import { useAuth } from '../context/AuthContext';
import { usePlatformSettings, homeFlags } from '../services/platformSettings';
import { isUserAdmin } from '../utils/routes';

interface AppPage {
  url: string;
  iosIcon: string;
  mdIcon: string;
  title: string;
}

const storePage: AppPage = {
  title: 'Tienda de productos',
  url: '/tienda',
  iosIcon: cartOutline,
  mdIcon: cartSharp,
};

const clientBenefitsPage: AppPage = {
  title: 'Beneficios y puntos',
  url: '/cliente/beneficios',
  iosIcon: giftOutline,
  mdIcon: giftSharp,
};

const proBenefitsPage: AppPage = {
  title: 'Beneficios',
  url: '/profesional/beneficios',
  iosIcon: giftOutline,
  mdIcon: giftSharp,
};

const proPqrPage: AppPage = {
  title: 'PQRS & Soporte',
  url: '/profesional/pqrs',
  iosIcon: shieldCheckmarkOutline,
  mdIcon: shieldCheckmarkSharp,
};

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
  const platform = usePlatformSettings();
  const clientFlags = homeFlags(platform, 'client');
  const proFlags = homeFlags(platform, 'professional');

  const clientUrlFlag: Record<string, string> = {
    '/cliente/mapa': 'map',
    '/cliente/servicios': 'services',
    '/cliente/solicitudes': 'requests',
    '/cliente/favoritos': 'favorites',
    '/cliente/viviendas': 'homes',
    '/cliente/pqrs': 'pqr',
    '/tienda': 'store',
    '/cliente/beneficios': 'benefits',
  };

  const proUrlFlag: Record<string, string> = {
    '/profesional/solicitudes': 'requests',
    '/profesional/trabajos': 'jobs',
    '/profesional/disponibilidad': 'availability',
    '/tienda': 'store',
    '/profesional/beneficios': 'benefits',
    '/profesional/pqrs': 'pqr',
  };

  // Páginas del cliente según funciones activas en la plataforma
  const clientPagesList: AppPage[] = [
    { title: 'Inicio', url: '/cliente/inicio', iosIcon: homeOutline, mdIcon: homeSharp },
    ...(platform.features.professionals !== false && platform.features.services !== false
      ? [{ title: 'Mapa de contratistas', url: '/cliente/mapa', iosIcon: mapOutline, mdIcon: mapSharp }]
      : []),
    ...(platform.features.services !== false
      ? [{ title: 'Servicios', url: '/cliente/servicios', iosIcon: constructOutline, mdIcon: constructSharp }]
      : []),
    ...(platform.features.products !== false
      ? [storePage]
      : []),
    ...(platform.features.hirings !== false
      ? [{ title: 'Mis solicitudes', url: '/cliente/solicitudes', iosIcon: calendarClearOutline, mdIcon: calendarClearSharp }]
      : []),
    { title: 'Favoritos', url: '/cliente/favoritos', iosIcon: heartOutline, mdIcon: heartSharp },
    { title: 'Mis viviendas', url: '/cliente/viviendas', iosIcon: businessOutline, mdIcon: businessSharp },
    ...(platform.features.benefits !== false
      ? [clientBenefitsPage]
      : []),
    ...(platform.features.pqr !== false
      ? [{ title: 'PQRS & Quejas', url: '/cliente/pqrs', iosIcon: shieldCheckmarkOutline, mdIcon: shieldCheckmarkSharp }]
      : []),
    { title: 'Mi perfil de cliente', url: '/cliente/perfil', iosIcon: personCircleOutline, mdIcon: personCircleOutline },
  ];

  // Páginas del profesional según funciones activas en la plataforma
  const proPagesList: AppPage[] = [
    { title: 'Inicio', url: '/profesional/inicio', iosIcon: homeOutline, mdIcon: homeSharp },
    ...(platform.features.products !== false
      ? [storePage]
      : []),
    ...(platform.features.hirings !== false
      ? [{ title: 'Mis solicitudes', url: '/profesional/solicitudes', iosIcon: calendarClearOutline, mdIcon: calendarClearSharp }]
      : []),
    ...(platform.features.hirings !== false
      ? [{ title: 'Mis trabajos', url: '/profesional/trabajos', iosIcon: briefcaseOutline, mdIcon: briefcaseSharp }]
      : []),
    ...(platform.features.benefits !== false
      ? [proBenefitsPage]
      : []),
    ...(platform.features.pqr !== false
      ? [proPqrPage]
      : []),
    { title: 'Mi perfil profesional', url: '/perfil', iosIcon: personCircleOutline, mdIcon: personCircleOutline },
    { title: 'Disponibilidad', url: '/profesional/disponibilidad', iosIcon: timeOutline, mdIcon: timeSharp },
  ];

  const isAdmin = isUserAdmin(user);

  const staffPagesList: AppPage[] = [
    { title: 'Panel de Administración', url: '/admin', iosIcon: shieldCheckmarkOutline, mdIcon: shieldCheckmarkSharp },
  ];

  const menuPages = isAdmin
    ? staffPagesList
    : user?.role === 'professional'
      ? proPagesList.filter((page) => {
          const flagKey = proUrlFlag[page.url];
          return flagKey ? proFlags[flagKey] !== false : true;
        })
      : clientPagesList.filter((page) => {
          const flagKey = clientUrlFlag[page.url];
          return flagKey ? clientFlags[flagKey] !== false : true;
        });

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
              <IonIcon slot="start" icon={isAdmin ? shieldCheckmarkOutline : personCircleOutline} />
              <IonLabel>{isAdmin ? 'Administrador Serviprox' : (user?.first_name || user?.email || 'Mi cuenta')}</IonLabel>
              <IonButton slot="end" fill="clear" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión">
                <IonIcon slot="icon-only" icon={logOutOutline} />
              </IonButton>
            </IonItem>
          ) : null}
          {!isAdmin && user?.role === 'client' && platform.features.professionals !== false && platform.features.services !== false ? (
            <IonItem lines="none" detail={false} className="role-switch-item">
              <IonIcon slot="start" icon={briefcaseOutline} />
              <IonLabel>Ofrecer servicios</IonLabel>
              <IonButton
                slot="end"
                fill="clear"
                disabled={roleChanging}
                aria-label="Ser profesional"
                title="Ser profesional"
                onClick={(event) => {
                  event.stopPropagation();
                  void onBecomeProfessional();
                }}
              >
                <IonIcon slot="icon-only" icon={swapHorizontalOutline} />
              </IonButton>
            </IonItem>
          ) : null}
          {!isAdmin && user?.role === 'professional' ? (
            <IonItem lines="none" detail={false} className="role-switch-item">
              <IonIcon slot="start" icon={homeOutline} />
              <IonLabel>Usar como cliente</IonLabel>
              <IonButton
                slot="end"
                fill="clear"
                disabled={roleChanging}
                aria-label="Usar como cliente"
                title="Usar como cliente"
                onClick={(event) => {
                  event.stopPropagation();
                  void onBecomeClient();
                }}
              >
                <IonIcon slot="icon-only" icon={swapHorizontalOutline} />
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
