import { IonApp, IonRouterOutlet, IonSplitPane, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';
import Menu from './components/Menu';
import Page from './pages/Page';

import Login from './pages/Login';
import Register from './pages/Register';
import ServicioJob from './components/servicioJob/servicio';
import Publicar from './components/publicar/publicar';
import Reservas from './components/misreservas/misreserva' ;
import HistorialPago from './components/historiadepago/historiapago';
import Misfavorito from './components/misfavorito/misfavorito';
import Configuracion from './components/configuracion/configuracion';


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
              <Login />
            </Route>
            <Route path="/register" exact={true}>
              <Register />
            </Route>

            {/* Main pages */}
            <Route path="/folder/:name" exact={true}>
              <Page />
            </Route>
            {/* Main pages *<Route path="/pages/PerfilUsuario" exact={true}>
              <PerfilUsuario />
            </Route>
            <Route path="/pages/PerfilProfesional" exact={true}>
              <PerfilProfesional />
            </Route>/}

            {/* Feature routes */}
            <Route path="/servicioJob/servicio" exact={true}>
              <ServicioJob />
            </Route>
            <Route path="/reservas" exact={true}>
              <Reservas />
            </Route>
            <Route path="/publicar" exact={true}>
              <Publicar />
            </Route>
            <Route path="/historialpago" exact={true}>
              <HistorialPago />
            </Route>
            <Route path="/misfavorito" exact={true}>
              <Misfavorito />
            </Route>
            <Route path="/configuracion" exact={true}>
              <Configuracion />
            </Route>

            {/* Default redirect */}
            <Route path="/" exact={true}>
              <Redirect to="/folder/inbox" />
            </Route>
          </IonRouterOutlet>
        </IonSplitPane>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
