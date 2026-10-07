import { IonApp, IonRouterOutlet, IonSplitPane, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Menu from './components/Menu';
import Page from './pages/Page';
import ClientHome from './pages/ClientHome';
import ClientProfilePage from './pages/ClientProfilePage';
import ClientOnboarding from './pages/ClientOnboarding';
import ClientProfessionalDetail from './pages/ClientProfessionalDetail';
import ContractorMapPage from './pages/ContractorMapPage';

import Login from './pages/Login';
import AdministrativeLoginPage from './pages/AdministrativeLoginPage';
import Register from './pages/Register';

import HistorialPago from './components/historiadepago/historiapago';
import Misfavorito from './components/misfavorito/misfavorito';
import HouseholdsPage from './pages/HouseholdsPage';
import ProfessionalDashboard from './pages/ProfessionalDashboard';
import ProfessionalOnboarding from './pages/ProfessionalOnboarding';
import ProfessionalProfilePage from './pages/ProfessionalProfilePage';
import ProfessionalRequestDetailPage from './pages/ProfessionalRequestDetailPage';
import ProfessionalRequestsPage from './pages/ProfessionalRequestsPage';
import RolePlaceholderPage from './pages/RolePlaceholderPage';
import StaffHome from './pages/StaffHome';
import WorkTrackingPage from './pages/WorkTrackingPage';
import PqrPage from './pages/PqrPage';
import Reservas from './pages/Reservas';
import { GlobalChatButton } from './components/GlobalChatButton';
import { ConnectionBanner } from './components/ConnectionBanner';
import { RequireAuth, RootRedirect } from './components/routing/RouteGuards';
import { useAuth } from './context/AuthContext';

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
  return <Reservas />;
};




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

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

const App: React.FC = () => {
  return (
    <IonApp>
      <AuthProvider>
        <IonReactRouter>
          <IonSplitPane contentId="main" when="false">
            <Menu />
            <IonRouterOutlet id="main">
              {/* Página principal: /login como ingreso principal de la app */}
              <Route path="/" exact={true}>
                <Redirect to="/login" />
              </Route>
              <Route path="/login" exact={true}>
                <Login />
              </Route>
              <Route path="/login/administrativo" exact={true}>
                <AdministrativeLoginPage />
              </Route>
              {/* alternate entry path used by the Menu */}
              <Route path="/ingresar" exact={true}>
                <Redirect to="/login" />
              </Route>
              <Route path="/register" exact={true}>
                <Register />
              </Route>

              <Route path="/onboarding/client" exact={true}>
                <RequireAuth role="client" onboarding="required">
                  <ClientOnboarding />
                </RequireAuth>
              </Route>
              <Route path="/onboarding/professional" exact={true}>
                <RequireAuth role="professional" onboarding="required">
                  <ProfessionalOnboarding />
                </RequireAuth>
              </Route>

              <Route path="/cliente/inicio" exact={true}>
                <RequireAuth role="client">
                  <ClientHome />
                </RequireAuth>
              </Route>
              <Route path="/cliente/perfil" exact={true}>
                <RequireAuth role="client">
                  <ClientProfilePage />
                </RequireAuth>
              </Route>
              <Route path="/cliente/viviendas" exact={true}>
                <RequireAuth role="client">
                  <HouseholdsPage />
                </RequireAuth>
              </Route>
             
              <Route path="/cliente/profesionales/:id" exact={true}>
                <RequireAuth role="client">
                  <ClientProfessionalDetail />
                </RequireAuth>
              </Route>
            
              <Route path="/cliente/favoritos" exact={true}>
                <RequireAuth role="client">
                  <Misfavorito />
                </RequireAuth>
              </Route>
              <Route path="/cliente/mapa" exact={true}>
                <RequireAuth role="client">
                  <ContractorMapPage />
                </RequireAuth>
              </Route>
              <Route path="/cliente/historialpago" exact={true}>
                <RequireAuth role="client">
                  <HistorialPago />
                </RequireAuth>
              </Route>
              <Route path="/cliente/pqrs" exact={true}>
                <RequireAuth role="client">
                  <PqrPage />
                </RequireAuth>
              </Route>
              <Route path="/cliente/solicitudes" exact={true}>
                <ClientSolicitudesRoute />
              </Route>
              <Route path="/cliente/servicios" exact={true}>
                <Page />
              </Route>
              <Route path="/mapa" exact={true}>
                <Redirect to="/cliente/mapa" />
              </Route>

              <Route path="/profesional/inicio" exact={true}>
                <RequireAuth role="professional">
                  <ProfessionalDashboard />
                </RequireAuth>
              </Route>
              <Route path="/profesional/perfil" exact={true}>
                <Redirect to="/perfil" />
              </Route>
              <Route path="/perfil" exact={true}>
                <RequireAuth onboarding="any">
                  <ProfessionalProfilePage />
                </RequireAuth>
              </Route>
              <Route path="/profesional/solicitudes" exact={true}>
                <RequireAuth role="professional">
                  <ProfessionalRequestsPage />
                </RequireAuth>
              </Route>
              <Route path="/profesional/solicitudes/:id" exact={true}>
                <RequireAuth role="professional">
                  <ProfessionalRequestDetailPage />
                </RequireAuth>
              </Route>
              <Route path="/seguimiento/:id" exact={true}>
                <RequireAuth onboarding="any">
                  <WorkTrackingPage />
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

              <Route path="/cuenta" exact={true}>
                <Redirect to="/perfil" />
              </Route>

              <Route path="/staff" exact={true}>
                <RequireAuth role="staff" onboarding="any">
                  <StaffHome />
                </RequireAuth>
              </Route>

              <Route path="/folder/:name" exact={true}>
                <RequireAuth role="client">
                  <Page />
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
          </IonSplitPane>

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
