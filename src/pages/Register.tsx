import React, { useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonSelect,
  IonSelectOption,
  IonButtons,
  IonIcon,
  IonDatetime,
} from '@ionic/react';
import { chevronBack } from 'ionicons/icons';
import { useHistory } from 'react-router';
import './Register.css';

const Register: React.FC = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    pais: 'Colombia',
    telefono: '',
    tipoPerfil: '',
    fechaNacimiento: '',
    genero: '',
    tipoDocumento: '',
    numeroDocumento: '',
    correo: '',
    password: '',
    confirmPassword: ''
  });

  const history = useHistory();

  const handleChange = (name: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNext = () => {
    // Validar campos del paso 1
    if (formData.nombre && formData.apellido && formData.pais && formData.telefono && formData.tipoPerfil) {
      setStep(2);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Registro completo:', formData);
    history.push('/login');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            {step === 2 ? (
              <IonButton onClick={() => setStep(1)}>
                <IonIcon icon={chevronBack} />
                Atrás
              </IonButton>
            ) : (
              <IonButton onClick={() => history.push('/login')}>Cancelar</IonButton>
            )}
          </IonButtons>
          <IonTitle>Crear Cuenta</IonTitle>
          <IonLabel slot="end" className="step-indicator">
            Paso {step} de 2
          </IonLabel>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {step === 1 ? (
          <form onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
            <IonItem>
              <IonLabel position="floating">Nombre</IonLabel>
              <IonInput
                value={formData.nombre}
                onIonChange={e => handleChange('nombre', e.detail.value!)}
                required
              />
            </IonItem>

            <IonItem>
              <IonLabel position="floating">Apellido</IonLabel>
              <IonInput
                value={formData.apellido}
                onIonChange={e => handleChange('apellido', e.detail.value!)}
                required
              />
            </IonItem>

            <IonItem>
              <IonLabel>País</IonLabel>
              <IonSelect
                value={formData.pais}
                onIonChange={e => handleChange('pais', e.detail.value)}
              >
                <IonSelectOption value="Colombia">Colombia</IonSelectOption>
              </IonSelect>
            </IonItem>

            <IonItem>
              <IonLabel position="floating">Teléfono (Opcional)</IonLabel>
              <IonInput
                type="tel"
                value={formData.telefono}
                onIonChange={e => handleChange('telefono', e.detail.value!)}
              />
            </IonItem>

            <IonItem>
              <IonLabel>Tipo de perfil</IonLabel>
              <IonSelect
                value={formData.tipoPerfil}
                onIonChange={e => handleChange('tipoPerfil', e.detail.value)}
                required
              >
                <IonSelectOption value="usuario">Usuario</IonSelectOption>
                <IonSelectOption value="profesional">Profesional</IonSelectOption>
              </IonSelect>
            </IonItem>

            <IonButton 
              expand="block" 
              className="ion-margin-top"
              type="submit"
            >
              Siguiente
            </IonButton>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <IonItem>
              <IonLabel>Fecha de Nacimiento</IonLabel>
              <IonDatetime
                presentation="date"
                value={formData.fechaNacimiento}
                onIonChange={e => handleChange('fechaNacimiento', e.detail.value!)}
              />
            </IonItem>

            <IonItem>
              <IonLabel>Género (Opcional)</IonLabel>
              <IonSelect
                value={formData.genero}
                onIonChange={e => handleChange('genero', e.detail.value)}
              >
                <IonSelectOption value="M">Masculino</IonSelectOption>
                <IonSelectOption value="F">Femenino</IonSelectOption>
                <IonSelectOption value="O">Otro</IonSelectOption>
              </IonSelect>
            </IonItem>

            <IonItem>
              <IonLabel>Tipo de documento (Opcional)</IonLabel>
              <IonSelect
                value={formData.tipoDocumento}
                onIonChange={e => handleChange('tipoDocumento', e.detail.value)}
              >
                <IonSelectOption value="CC">Cédula de Ciudadanía</IonSelectOption>
                <IonSelectOption value="CE">Cédula de Extranjería</IonSelectOption>
                <IonSelectOption value="PA">Pasaporte</IonSelectOption>
              </IonSelect>
            </IonItem>

            <IonItem>
              <IonLabel position="floating">Número de documento (Opcional)</IonLabel>
              <IonInput
                value={formData.numeroDocumento}
                onIonChange={e => handleChange('numeroDocumento', e.detail.value!)}
              />
            </IonItem>

            <IonItem>
              <IonLabel position="floating">Correo</IonLabel>
              <IonInput
                type="email"
                value={formData.correo}
                onIonChange={e => handleChange('correo', e.detail.value!)}
                required
              />
            </IonItem>

            <IonItem>
              <IonLabel position="floating">Contraseña</IonLabel>
              <IonInput
                type="password"
                value={formData.password}
                onIonChange={e => handleChange('password', e.detail.value!)}
                required
                placeholder="Mínimo 6 caracteres"
              />
            </IonItem>

            <IonItem>
              <IonLabel position="floating">Confirmar Contraseña</IonLabel>
              <IonInput
                type="password"
                value={formData.confirmPassword}
                onIonChange={e => handleChange('confirmPassword', e.detail.value!)}
                required
              />
            </IonItem>

            <IonButton 
              expand="block" 
              className="ion-margin-top"
              type="submit"
            >
              Crear cuenta
            </IonButton>
          </form>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Register;
