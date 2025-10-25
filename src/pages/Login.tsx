import React, { useState, useRef, useEffect } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonBackButton,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonCard,
  IonCardContent,
  IonNote,
  IonAlert, // <-- add this
  useIonRouter,
  IonModal,
  IonIcon,
  IonSelect,
  IonSelectOption, // <-- añadido
  IonDatetime,
  IonImg,
  IonText
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import { chevronBack } from 'ionicons/icons';
import styles from './Login.module.css';

import logo from '../Assets/logo.png';

const emailOk = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());

const PAISES_SURAMERICA = [
  { value: 'CO', label: 'Colombia' },
  { value: 'AR', label: 'Argentina' },
  { value: 'CL', label: 'Chile' },
  { value: 'PE', label: 'Perú' },
  { value: 'BR', label: 'Brasil' },
  { value: 'EC', label: 'Ecuador' },
  { value: 'UY', label: 'Uruguay' },
  { value: 'PY', label: 'Paraguay' },
  { value: 'BO', label: 'Bolivia' },
  { value: 'VE', label: 'Venezuela' }
];

// Add document types constant
const TIPOS_DOCUMENTO = [
  { value: 'CC', label: 'Cédula de Ciudadanía' },
  { value: 'CE', label: 'Cédula de Extranjería' },
  { value: 'DNI', label: 'Documento Nacional de Identidad' },
  { value: 'PA', label: 'Pasaporte' },
  { value: 'RUT', label: 'RUT (Chile)' },
  { value: 'RUC', label: 'RUC (Perú)' },
  { value: 'CPF', label: 'CPF (Brasil)' }
];

const Login: React.FC = () => {
  const history = useHistory();
  const ionRouter = useIonRouter();

  // Vista: 'login' | 'recover'
  const [mode, setMode] = useState<"login" | "recover">("login");

  // Estado login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Estado registro (modal)
  const [registerOpen, setRegisterOpen] = useState(false); // <-- añadido
  const [registerStep, setRegisterStep] = useState(1); // Add this state
  const regNameRef = useRef<HTMLIonInputElement | null>(null); // <-- añadido
  const regEmailRef = useRef<HTMLIonInputElement | null>(null); // <-- añadido
  const regPassRef = useRef<HTMLIonInputElement | null>(null); // <-- añadido

  // Estado recuperar
  const recEmailRef = useRef<HTMLIonInputElement | null>(null);

  // Alert state (reemplaza Toast)
  const [alertState, setAlertState] = useState<{ isOpen: boolean; header?: string; message: string }>({
    isOpen: false,
    header: "",
    message: ""
  });

  const showAlert = (message: string, header = "Aviso") => {
    setAlertState({ isOpen: true, header, message });
  };

  // Validation states for Step 1
  const [formStep1, setFormStep1] = useState({
    nombre: '',
    apellido: '',
    pais: 'CO',
    telefono: '',
    tipoPerfil: ''
  });

  // Validation states for Step 2
  const [formStep2, setFormStep2] = useState({
    fechaNacimiento: '',
    genero: '',
    tipoDocumento: '',
    numeroDocumento: '',
    correo: '',
    password: '',
    confirmPassword: ''
  });

  // add date bounds for datetime
	const todayISO = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
	const minDateISO = new Date(new Date().setFullYear(new Date().getFullYear() - 100)).toISOString().slice(0, 10);

  // --- Handler de Atrás (header y hardware) ---
  const handleBack = () => {
    // prioridad: cerrar modal registro, luego modo recover, luego navegar atrás o a "/"
    if (registerOpen) {
      setRegisterOpen(false);
      return;
    }
    if (mode === "recover") {
      setMode("login");
      return;
    }
    if (ionRouter.canGoBack()) {
      ionRouter.goBack();
    } else {
      history.replace("/");
    }
  };

  // Capturar botón atrás de Android: cerrar "register"/"recover" primero
  useEffect(() => {
    const handler = (ev: any) => {
      ev.detail.register(10, () => {
        handleBack();
      });
    };
    document.addEventListener("ionBackButton", handler);
    return () => document.removeEventListener("ionBackButton", handler);
  }, [mode, registerOpen]); // <-- añadir registerOpen como dependencia

  // --- Acciones ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOk(email) || password.length < 6) {
      showAlert("Revisa tu email y la contraseña (mín. 6 caracteres).", "Error");
      return;
    }
    // Autenticación real aquí...
    history.replace("/"); // evita volver al /login con Atrás
  };

  // Add form validation handlers
  const validateStep1 = () => {
    const { nombre, apellido, pais, tipoPerfil } = formStep1;
    
    if (!nombre.trim()) {
      showAlert("Por favor ingresa tu nombre", "Error");
      return false;
    }
    
    if (!apellido.trim()) {
      showAlert("Por favor ingresa tu apellido", "Error");
      return false;
    }
    
    if (!tipoPerfil) {
      showAlert("Por favor selecciona un tipo de perfil", "Error");
      return false;
    }

    if (formStep1.telefono && !/^\+?[0-9]{10,13}$/.test(formStep1.telefono)) {
      showAlert("Formato de teléfono inválido", "Error");
      return false;
    }

    return true;
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep1()) {
      setRegisterStep(2);
    }
  };

  const validateStep2 = () => {
    const { correo, password, confirmPassword } = formStep2;

    if (!correo || !emailOk(correo)) {
      showAlert("Por favor ingresa un correo válido", "Error");
      return false;
    }

    if (!password || password.length < 6) {
      showAlert("La contraseña debe tener al menos 6 caracteres", "Error");
      return false;
    }

    if (password !== confirmPassword) {
      showAlert("Las contraseñas no coinciden", "Error");
      return false;
    }

    return true;
  };

  // Nuevo: confirmar registro desde modal
  const confirmRegister = (c: React.FormEvent) => {
    c.preventDefault();
    if (validateStep2()) {
      // Crear cuenta...
      const formData = { ...formStep1, ...formStep2 };
      console.log('Registro exitoso:', formData);
      setRegisterOpen(false);
      showAlert("¡Cuenta creada exitosamente!");
      resetForms();
    }
  };

  const resetForms = () => {
    setFormStep1({
      nombre: '',
      apellido: '',
      pais: 'CO',
      telefono: '',
      tipoPerfil: ''
    });
    setFormStep2({
      fechaNacimiento: '',
      genero: '',
      tipoDocumento: '',
      numeroDocumento: '',
      correo: '',
      password: '',
      confirmPassword: ''
    });
    setRegisterStep(1);
  };

  const handleRecover = (e: React.FormEvent) => {
    e.preventDefault();
    const correo = String(recEmailRef.current?.value ?? "").trim();
    if (!emailOk(correo)) {
      showAlert("Escribe un correo válido.", "Error");
      return;
    }
    showAlert(`Enviamos un enlace a ${correo}`);
    setMode("login");
  };

  // Reset step when modal closes
  const handleModalDismiss = () => {
    setRegisterOpen(false);
    setRegisterStep(1);
  };

  const updateStep1 = (field: string, value: string) => {
		setFormStep1(prev => ({
			...prev,
			[field]: value
		}));
	};

	const updateStep2 = (field: string, value: string) => {
		setFormStep2(prev => ({
			...prev,
			[field]: value
		}));
	};

  return (
    <IonPage className={styles.loginPage}>
      <IonContent fullscreen>
        
           <h1 className={styles.title}>
              {mode === "login" ? "¡Bienvenido de nuevo!" : "Recuperar cuenta"}
            </h1>
        <IonText className={styles.container}>
        
          <IonText className={styles.loginCard}>
            <IonImg 
              src={logo} 
              alt="ServiProx Logo" 
              className={styles.logo}
            />
            
           

            {mode === "login" ? (
              <form onSubmit={handleLogin}>
                <IonText className={styles.formGroup}>
                  <IonItem lines="none" className={styles.input}>
                    <IonInput
                      type="email"
                      placeholder="Correo electrónico"
                      value={email}
                      onIonChange={(e) => setEmail(e.detail.value ?? "")}
                      className={email ? styles.focused : ""}
                      required
                    />
                  </IonItem>
                  {!emailOk(email) && email !== "" && (
                    <div className={styles.error}>Email inválido</div>
                  )}
                </IonText>

                <IonText className={styles.formGroup}>
                  <IonItem lines="none" className={styles.input}>
                    <IonInput
                      type="password"
                      placeholder="Contraseña"
                      value={password}
                      onIonChange={(e) => setPassword(e.detail.value ?? "")}
                      className={password ? styles.focused : ""}
                      required
                    />
                  </IonItem>
                  {password !== "" && password.length < 6 && (
                    <IonText className={styles.error}>Mínimo 6 caracteres</IonText>
                  )}
                </IonText>

                <IonButton 
                  expand="block" 
                  type="submit"
                  className={styles.button}
                  disabled={!emailOk(email) || password.length < 6}
                >
                  Iniciar Sesión
                </IonButton>

                <IonButton
                  expand="block"
                  fill="clear"
                  className={styles.linkButton}
                  onClick={() => setMode("recover")}
                >
                  ¿Olvidaste tu contraseña?
                </IonButton>

                <IonButton
                  expand="block"
                  fill="clear"
                  className={styles.linkButton}
                  onClick={() => setRegisterOpen(true)}
                >
                  ¿No tienes cuenta? Regístrate
                </IonButton>
              </form>
            ) : (
              <form onSubmit={handleRecover}>
                <IonText className={styles.formGroup}>
                  <IonItem lines="none" className={styles.input}>
                    <IonInput
                      ref={recEmailRef}
                      type="email"
                      placeholder="Correo electrónico"
                      required
                    />
                  </IonItem>
                </IonText>

                <IonButton expand="block" type="submit" className={styles.button}>
                  Enviar enlace
                </IonButton>

                <IonButton
                  expand="block"
                  fill="clear"
                  className={styles.linkButton}
                  onClick={() => setMode("login")}
                >
                  Volver a iniciar sesión
                </IonButton>
              </form>
            )}
          </IonText>
        </IonText>

        {/* Modal: Crear cuenta */}
        <IonModal isOpen={registerOpen} onDidDismiss={handleModalDismiss}>
          <IonHeader>
            <IonToolbar>
              <IonButtons slot="start">
                <IonButton onClick={() => history.push('/login')}>
                  Volver a Inicio
                </IonButton>
              </IonButtons>
              <IonTitle>Crear Cuenta</IonTitle>
              <IonLabel slot="end" className={styles.stepIndicator}>
                Paso {registerStep} de 2
              </IonLabel>
            </IonToolbar>
          </IonHeader>

          <IonContent className="ion-padding">
            {registerStep === 1 ? (
              <form onSubmit={(e) => { e.preventDefault(); handleNextStep(e); }}>
                <IonText className={styles.formGroup}>
                  <IonLabel>Nombre</IonLabel>
                  <IonInput
                    value={formStep1.nombre}
                    onIonChange={n => updateStep1('nombre', n.detail.value!)}
                    className={styles.input}
                    placeholder=" Juan Pablo"
                    required
                  />
                </IonText>

                <IonText className={styles.formGroup}>
                  <IonLabel>Apellido</IonLabel>
                  <IonInput
                    value={formStep1.apellido}
                    onIonChange={e => updateStep1('apellido', e.detail.value!)}
                    className={styles.input}
                    placeholder=" Gómez López"
                    required
                  />
                </IonText>

                <IonText className={styles.formGroup}>
                  <IonLabel>País</IonLabel>
                  <IonSelect 
                    className={styles.select} 
                    interface="action-sheet"
                    value={formStep1.pais}
                    onIonChange={e => updateStep1('pais', e.detail.value!)}
                    placeholder="Selecciona tu país"
                  >
                    {PAISES_SURAMERICA.map(pais => (
                      <IonSelectOption key={pais.value} value={pais.value}>
                        {pais.label}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonText>

                <IonText className={styles.formGroup}>
                  <IonLabel>Teléfono (Opcional)</IonLabel>
                  <IonInput
                    value={formStep1.telefono}
                    onIonChange={e => updateStep1('telefono', e.detail.value!)}
                    className={styles.input}
                    type="tel"
                    placeholder="+573028505481"
                  />
                </IonText>

                <IonText className={styles.formGroup}>
                  <IonLabel>Tipo de perfil</IonLabel>
                  <IonSelect 
                    className={styles.select} 
                    interface="action-sheet"
                    value={formStep1.tipoPerfil}
                    onIonChange={e => updateStep1('tipoPerfil', e.detail.value!)}
                  >
                    <IonSelectOption value="user">Usuario (Busco servicios/espacios)</IonSelectOption>
                    <IonSelectOption value="pro">Profesional (Ofrezco servicios)</IonSelectOption>
                  </IonSelect>
                </IonText>

                <IonButton expand="block" type="submit" className={styles.submitButton}>
                  Siguiente
                </IonButton>

                <IonText className={styles.loginLink}>
                  <IonButton fill="clear" onClick={() => history.push('/login')}>
                    ¿Ya tienes cuenta? Ingresar
                  </IonButton>
                </IonText>
              </form>
            ) : (
              <form onSubmit={confirmRegister}>
                <IonText className={styles.formGroup}>
                  <IonLabel>Fecha de Nacimiento</IonLabel>
                  <IonDatetime
                    className={styles.input}
                    presentation="date"
                    preferWheel={true}
                    value={formStep2.fechaNacimiento || ''}
                    onIonChange={e => updateStep2('fechaNacimiento', String(e.detail.value ?? ''))}
                    max={todayISO}
                    min={minDateISO}
                    aria-label="Selecciona tu fecha de nacimiento"
                  />
                </IonText>

                <IonText className={styles.formGroup}>
                  <IonLabel>Tipo de documento</IonLabel>
                  <IonSelect 
                    className={styles.select}
                    interface="action-sheet"
                    placeholder="Selecciona tipo de documento"
                    value={formStep2.tipoDocumento || ''}
                    onIonChange={e => updateStep2('tipoDocumento', String(e.detail.value ?? ''))}
                  >
                    {TIPOS_DOCUMENTO.map(tipo => (
                      <IonSelectOption key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonText>

                <IonText className={styles.formGroup}>
                  <IonLabel>Número de documento</IonLabel>
                  <IonInput
                    className={styles.input}
                    type="text"
                    placeholder="Ingresa tu número de documento"
                    value={formStep2.numeroDocumento}
                    onIonChange={e => updateStep2('numeroDocumento', String(e.detail.value ?? ''))}
                  />
                </IonText>

                <IonText className={styles.formGroup}>
                  <IonLabel>Correo</IonLabel>
                  <IonInput
                    className={styles.input}
                    type="email"
                    placeholder="tu@correo.com"
                    value={formStep2.correo}
                    onIonChange={e => updateStep2('correo', e.detail.value!)}
                    required
                  />
                </IonText>

                <IonText className={styles.formGroup}>
                  <IonLabel>Contraseña</IonLabel>
                  <IonInput
                    className={styles.input}
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={formStep2.password}
                    onIonChange={e => updateStep2('password', e.detail.value!)}
                    required
                  />
                  {formStep2.password && formStep2.password.length < 6 && (
                    <div className={styles.error}>La contraseña debe tener al menos 6 caracteres</div>
                  )}
                </IonText>

                <IonText className={styles.formGroup}>
                  <IonLabel>Confirmar Contraseña</IonLabel>
                  <IonInput
                    className={styles.input}
                    type="password"
                    placeholder="Repite tu contraseña"
                    value={formStep2.confirmPassword}
                    onIonChange={c => updateStep2('confirmPassword', c.detail.value!)}
                    required
                  />
                  {formStep2.confirmPassword && formStep2.password !== formStep2.confirmPassword && (
                    <div className={styles.error}>Las contraseñas no coinciden</div>
                  )}
                </IonText>

                <IonButton 
                  expand="block" 
                  type="submit"
                  className={styles.submitButton}
                  disabled={!formStep2.password || 
                           formStep2.password.length < 6 || 
                           formStep2.password !== formStep2.confirmPassword}
                >
                  Crear Cuenta
                </IonButton>
              </form>
            )}
          </IonContent>
        </IonModal>

        <IonAlert
          isOpen={alertState.isOpen}
          header={alertState.header}
          message={alertState.message}
          buttons={[
            {
              text: "OK",
              role: "confirm",
              handler: () => setAlertState(prev => ({ ...prev, isOpen: false }))
            }
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default Login;
