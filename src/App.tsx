import { IonApp, IonRouterOutlet, IonSplitPane, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Menu from './components/Menu';
import Page from './pages/Page';
import ClientHome from './pages/ClientHome';
import ClientOnboarding from './pages/ClientOnboarding';

import Login from './pages/Login';
import Register from './pages/Register';
import ServicioJob from './components/servicioJob/servicio';
import Reservas from './components/misreservas/misreserva';
import HistorialPago from './components/historiadepago/historiapago';
import Misfavorito from './components/misfavorito/misfavorito';
import Configuracion from './components/configuracion/configuracion';
import HouseholdsPage from './pages/HouseholdsPage';
import ProfessionalDashboard from './pages/ProfessionalDashboard';
import ProfessionalOnboarding from './pages/ProfessionalOnboarding';
import ProfessionalProfilePage from './pages/ProfessionalProfilePage';
import RolePlaceholderPage from './pages/RolePlaceholderPage';
import StaffHome from './pages/StaffHome';
import { RequireAuth, RootRedirect } from './components/routing/RouteGuards';


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
              {/* Auth routes */}
              <Route path="/login" exact={true}>
                <Login />
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
              <Route path="/cliente/viviendas" exact={true}>
                <RequireAuth role="client">
                  <HouseholdsPage />
                </RequireAuth>
              </Route>
              <Route path="/cliente/servicios" exact={true}>
                <RequireAuth role="client">
                  <ServicioJob />
                </RequireAuth>
              </Route>
              <Route path="/cliente/solicitudes" exact={true}>
                <RequireAuth role="client">
                  <Reservas />
                </RequireAuth>
              </Route>
              <Route path="/cliente/favoritos" exact={true}>
                <RequireAuth role="client">
                  <Misfavorito />
                </RequireAuth>
              </Route>

              <Route path="/profesional/inicio" exact={true}>
                <RequireAuth role="professional">
                  <ProfessionalDashboard />
                </RequireAuth>
              </Route>
              <Route path="/profesional/perfil" exact={true}>
                <RequireAuth role="professional">
                  <ProfessionalProfilePage />
                </RequireAuth>
              </Route>
              <Route path="/profesional/solicitudes" exact={true}>
                <RequireAuth role="professional">
                  <RolePlaceholderPage
                    kicker="PROFESIONAL"
                    title="Solicitudes recibidas"
                    description="Las solicitudes reales se conectarán cuando integremos el flujo de solicitudes del próximo Sprint."
                  />
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
                <RequireAuth onboarding="any">
                  <Configuracion />
                </RequireAuth>
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
              <Route path="/reservas" exact={true}>
                <Redirect to="/cliente/solicitudes" />
              </Route>
              <Route path="/publicar" exact={true}>
                <Redirect to="/profesional/perfil" />
              </Route>
              <Route path="/historialpago" exact={true}>
                <RequireAuth onboarding="any">
                  <HistorialPago />
                </RequireAuth>
              </Route>
              <Route path="/misfavorito" exact={true}>
                <Redirect to="/cliente/favoritos" />
              </Route>
              <Route path="/configuracion" exact={true}>
                <Redirect to="/cuenta" />
              </Route>

              {/* Default redirect */}
              <Route path="/" exact={true}>
                <RootRedirect />
              </Route>
            </IonRouterOutlet>
          </IonSplitPane>
        </IonReactRouter>
      </AuthProvider>
    </IonApp>
  );
};

export default App;
