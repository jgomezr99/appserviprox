import React, { Suspense, lazy } from 'react';
import { IonApp, IonRouterOutlet, IonSplitPane, IonSpinner, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Menu from './components/Menu';
import Login from './pages/Login';
import ClientHome from './pages/ClientHome';
import { GlobalChatButton } from './components/GlobalChatButton';
import { ConnectionBanner } from './components/ConnectionBanner';
import { RoleThemeController } from './components/RoleThemeController';
import { RequireAuth } from './components/routing/RouteGuards';
import { useHomeFlags } from './services/platformSettings';
import { getEntryRoute } from './utils/routes';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Ionic Dark Mode */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

// Componentes secundarios cargados bajo demanda (Code Splitting) para inicio ultrarrápido
const Page = lazy(() => import('./pages/Page'));
const AdministrativeLoginPage = lazy(() => import('./pages/AdministrativeLoginPage'));
const Register = lazy(() => import('./pages/Register'));
const ClientProfilePage = lazy(() => import('./pages/ClientProfilePage'));
const ClientOnboarding = lazy(() => import('./pages/ClientOnboarding'));
const ClientProfessionalDetail = lazy(() => import('./pages/ClientProfessionalDetail'));
const ContractorMapPage = lazy(() => import('./pages/ContractorMapPage'));
const HistorialPago = lazy(() => import('./components/historiadepago/historiapago'));
const Misfavorito = lazy(() => import('./components/misfavorito/misfavorito'));
const HouseholdsPage = lazy(() => import('./pages/HouseholdsPage'));
const ProfessionalDashboard = lazy(() => import('./pages/ProfessionalDashboard'));
const ProfessionalOnboarding = lazy(() => import('./pages/ProfessionalOnboarding'));
const ProfessionalProfilePage = lazy(() => import('./pages/ProfessionalProfilePage'));
const ProfessionalRequestDetailPage = lazy(() => import('./pages/ProfessionalRequestDetailPage'));
const ProfessionalRequestsPage = lazy(() => import('./pages/ProfessionalRequestsPage'));
const RolePlaceholderPage = lazy(() => import('./pages/RolePlaceholderPage'));
const StaffHome = lazy(() => import('./pages/StaffHome'));
const WorkTrackingPage = lazy(() => import('./pages/WorkTrackingPage'));
const PqrPage = lazy(() => import('./pages/PqrPage'));
const Reservas = lazy(() => import('./pages/Reservas'));
const BenefitsPage = lazy(() => import('./pages/BenefitsPage'));
const StorePage = lazy(() => import('./pages/StorePage'));

const PageFallback: React.FC = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: '60vh',
      width: '100%',
      backgroundColor: 'transparent',
    }}
  >
    <IonSpinner name="crescent" color="primary" />
  </div>
);

const withLazy = <P extends object>(Component: React.ComponentType<P>): React.FC<P> => {
  return (props: P) => (
    <Suspense fallback={<PageFallback />}>
      <Component {...props} />
    </Suspense>
  );
};

const LazyPage = withLazy(Page);
const LazyAdministrativeLoginPage = withLazy(AdministrativeLoginPage);
const LazyRegister = withLazy(Register);
const LazyClientProfilePage = withLazy(ClientProfilePage);
const LazyClientOnboarding = withLazy(ClientOnboarding);
const LazyClientProfessionalDetail = withLazy(ClientProfessionalDetail);
const LazyContractorMapPage = withLazy(ContractorMapPage);
const LazyHistorialPago = withLazy(HistorialPago);
const LazyMisfavorito = withLazy(Misfavorito);
const LazyHouseholdsPage = withLazy(HouseholdsPage);
const LazyProfessionalDashboard = withLazy(ProfessionalDashboard);
const LazyProfessionalOnboarding = withLazy(ProfessionalOnboarding);
const LazyProfessionalProfilePage = withLazy(ProfessionalProfilePage);
const LazyProfessionalRequestDetailPage = withLazy(ProfessionalRequestDetailPage);
const LazyProfessionalRequestsPage = withLazy(ProfessionalRequestsPage);
const LazyStaffHome = withLazy(StaffHome);
const LazyWorkTrackingPage = withLazy(WorkTrackingPage);
const LazyPqrPage = withLazy(PqrPage);
const LazyReservas = withLazy(Reservas);
const LazyBenefitsPage = withLazy(BenefitsPage);
const LazyStorePage = withLazy(StorePage);

const BenefitsRoute: React.FC = () => {
  const flags = useHomeFlags('professional');
  if (!flags.benefits) {
    return <Redirect to="/profesional/inicio" />;
  }
  return <LazyBenefitsPage />;
};

const ClientBenefitsRoute: React.FC = () => {
  const flags = useHomeFlags('client');
  if (!flags.benefits) {
    return <Redirect to="/cliente/inicio" />;
  }
  return <LazyBenefitsPage />;
};

const ClientServicesRoute: React.FC = () => {
  const flags = useHomeFlags('client');
  if (!flags.services) {
    return <Redirect to="/cliente/inicio" />;
  }
  return <LazyPage />;
};

const ContractorMapRoute: React.FC = () => {
  const flags = useHomeFlags('client');
  if (!flags.map) {
    return <Redirect to="/cliente/inicio" />;
  }
  return <LazyContractorMapPage />;
};

const SolicitudesRedirect: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated || !user) {
    return <Redirect to="/login" />;
  }
  if (user.role === 'professional') {
    return <Redirect to="/login" />;
  }
  return <Redirect to="/login" />;
};

const ClientSolicitudesRoute: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === 'professional') {
    return <Redirect to="/login" />;
  }
  return <LazyReservas />;
};

const RootRedirect: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return <PageFallback />;
  }
  if (isAuthenticated && user) {
    return <Redirect to={getEntryRoute(user)} />;
  }
  return <Redirect to="/login" />;
};

setupIonicReact();

const AppSplitPane: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <IonSplitPane contentId="main" when="false">
      {children}
    </IonSplitPane>
  );
};

const App: React.FC = () => {
  return (
    <IonApp>
      <AuthProvider>
        <IonReactRouter>
          {/* ── Dynamic Theme Controller (Rojo Cliente / Azul Profesional) ── */}
          <RoleThemeController />

          {/* ── SplitPane responsivo: menú al lado de la página principal en desktop/tablet ── */}
          <AppSplitPane>
            <Menu />
            <IonRouterOutlet id="main">
              {/* Redirección inteligente al inicio sin demoras ni pasos innecesarios */}
              <Route path="/" exact={true}>
                <RootRedirect />
              </Route>
              <Route path="/login" exact={true}>
                <Login />
              </Route>
              <Route path="/login/administrativo" exact={true}>
                <LazyAdministrativeLoginPage />
              </Route>
              {/* alternate entry path used by the Menu */}
              <Route path="/ingresar" exact={true}>
                <Redirect to="/login" />
              </Route>
              <Route path="/register" exact={true}>
                <LazyRegister />
              </Route>

              <Route path="/onboarding/client" exact={true}>
                <RequireAuth role="client" onboarding="required">
                  <LazyClientOnboarding />
                </RequireAuth>
              </Route>
              <Route path="/onboarding/professional" exact={true}>
                <RequireAuth role="professional" onboarding="required">
                  <LazyProfessionalOnboarding />
                </RequireAuth>
              </Route>

              <Route path="/cliente/inicio" exact={true}>
                <RequireAuth role="client">
                  <ClientHome />
                </RequireAuth>
              </Route>
              <Route path="/cliente/perfil" exact={true}>
                <RequireAuth role="client">
                  <LazyClientProfilePage />
                </RequireAuth>
              </Route>
              <Route path="/cliente/viviendas" exact={true}>
                <RequireAuth role="client">
                  <LazyHouseholdsPage />
                </RequireAuth>
              </Route>
             
              <Route path="/cliente/profesionales/:id" exact={true}>
                <RequireAuth role="client">
                  <LazyClientProfessionalDetail />
                </RequireAuth>
              </Route>
            
              <Route path="/cliente/favoritos" exact={true}>
                <RequireAuth role="client">
                  <LazyMisfavorito />
                </RequireAuth>
              </Route>
              <Route path="/cliente/mapa" exact={true}>
                <RequireAuth role="client">
                  <ContractorMapRoute />
                </RequireAuth>
              </Route>
              <Route path="/cliente/historialpago" exact={true}>
                <RequireAuth role="client">
                  <LazyHistorialPago />
                </RequireAuth>
              </Route>
              <Route path="/cliente/pqrs" exact={true}>
                <RequireAuth role="client">
                  <LazyPqrPage />
                </RequireAuth>
              </Route>
              <Route path="/cliente/beneficios" exact={true}>
                <RequireAuth role="client">
                  <ClientBenefitsRoute />
                </RequireAuth>
              </Route>
              <Route path="/tienda" exact={true}>
                <LazyStorePage />
              </Route>
              <Route path="/productos" exact={true}>
                <Redirect to="/tienda" />
              </Route>
              <Route path="/cliente/solicitudes" exact={true}>
                <RequireAuth role="client">
                  <ClientSolicitudesRoute />
                </RequireAuth>
              </Route>
              <Route path="/cliente/servicios" exact={true}>
                <RequireAuth role="client">
                  <ClientServicesRoute />
                </RequireAuth>
              </Route>
              <Route path="/mapa" exact={true}>
                <Redirect to="/cliente/mapa" />
              </Route>

              <Route path="/profesional/inicio" exact={true}>
                <RequireAuth role="professional">
                  <LazyProfessionalDashboard />
                </RequireAuth>
              </Route>
              <Route path="/profesional/perfil" exact={true}>
                <Redirect to="/perfil" />
              </Route>
              <Route path="/perfil" exact={true}>
                <RequireAuth role="professional" onboarding="any">
                  <LazyProfessionalProfilePage />
                </RequireAuth>
              </Route>
              <Route path="/profesional/solicitudes" exact={true}>
                <RequireAuth role="professional">
                  <LazyProfessionalRequestsPage />
                </RequireAuth>
              </Route>
              <Route path="/profesional/solicitudes/:id" exact={true}>
                <RequireAuth role="professional">
                  <LazyProfessionalRequestDetailPage />
                </RequireAuth>
              </Route>
              <Route path="/seguimiento/:id" exact={true}>
                <RequireAuth onboarding="any">
                  <LazyWorkTrackingPage />
                </RequireAuth>
              </Route>
              <Route path="/profesional/trabajos" exact={true}>
                <RequireAuth role="professional">
                  <RolePlaceholderPage
                    kicker="PROFESIONAL"
                    title="Mis trabajos"
                    description="Todavía no hay órdenes conectadas para esta experiencia profesional."
                  />
                </RequireAuth>
              </Route>
              <Route path="/profesional/disponibilidad" exact={true}>
                <RequireAuth role="professional">
                  <RolePlaceholderPage
                    kicker="PROFESIONAL"
                    title="Disponibilidad"
                    description="La agenda por franjas existe en backend, pero su gestión UI queda para un Sprint posterior."
                  />
                </RequireAuth>
              </Route>

              <Route path="/profesional/beneficios" exact={true}>
                <RequireAuth role="professional">
                  <BenefitsRoute />
                </RequireAuth>
              </Route>
              <Route path="/profesional/pqrs" exact={true}>
                <RequireAuth role="professional">
                  <LazyPqrPage />
                </RequireAuth>
              </Route>

              <Route path="/cuenta" exact={true}>
                <Redirect to="/perfil" />
              </Route>

              <Route path="/staff" exact={true}>
                <Redirect to="/admin" />
              </Route>
              {/* Ruta del administrador (panel administrativo bajo demanda) */}
              <Route path="/admin" exact={false}>
                <RequireAuth role="staff" onboarding="any">
                  <LazyStaffHome />
                </RequireAuth>
              </Route>

              <Route path="/folder/:name" exact={true}>
                <RequireAuth role="client">
                  <LazyPage />
                </RequireAuth>
              </Route>

              {/* Feature routes */}
              <Route path="/servicioJob/servicio" exact={true}>
                <Redirect to="/cliente/servicios" />
              </Route>
              <Route path="/solicitudes" exact={true}>
                <SolicitudesRedirect />
              </Route>
              <Route path="/mis-solicitudes" exact={true}>
                <SolicitudesRedirect />
              </Route>
              <Route path="/reservas" exact={true}>
                <SolicitudesRedirect />
              </Route>
              <Route path="/publicar" exact={true}>
                <Redirect to="/perfil" />
              </Route>
              
              <Route path="/misfavorito" exact={true}>
                <Redirect to="/cliente/favoritos" />
              </Route>
              <Route path="/configuracion" exact={true}>
                <Redirect to="/perfil" />
              </Route>
            </IonRouterOutlet>
          </AppSplitPane>

          {/* ── Global floating "Chat de Reporte en Vivo" button ── */}
          <GlobalChatButton />

          {/* ── Global Database & Backend Connection Monitor ── */}
          <ConnectionBanner />

        </IonReactRouter>
      </AuthProvider>
    </IonApp>
  );
};

export default App;
