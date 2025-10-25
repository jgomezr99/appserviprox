import React, { useMemo, useState, useRef } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonNote,
  IonButton,
  IonIcon,
  IonToast,
  useIonAlert,
  IonMenuButton,
  IonButtons,
} from "@ionic/react";
import {
  businessOutline,
  briefcaseOutline,
  cloudUploadOutline,
} from "ionicons/icons";


type Categoria = {
  id: string;
  nombre: string;
};

type ImagenPreview = {
  file: File;
  url: string;
};

export default function Publicar() {
  const [segment, setSegment] = useState<"espacio" | "servicio">("servicio");

  const categorias: Categoria[] = useMemo(
    () => [
    { id: "tecno_diseno",      nombre: "Tecnología y Diseño" },
    { id: "mantenimiento",     nombre: "Mantenimiento y Reparaciones" },
    { id: "cuidado_mascota",   nombre: "Cuidado mascota" },
    { id: "seguridad_privada", nombre: "Servicio de seguridad privada" },
    { id: "foto_video",        nombre: "Foto y Video" },
    { id: "educacion_tutoria", nombre: "Educación y entrenador "},
    ],
    []
  );

  // Estado del formulario
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | undefined>(undefined);
  const [tarifa, setTarifa] = useState<string>(""); // cadena formateada
  const [disponibilidad, setDisponibilidad] = useState(
    "Ej: L-V 9am-6pm, Fines de semana contactar."
  );
  const [ubicacion, setUbicacion] = useState(
    "Ej: Remoto, Bogotá, Medellín y alrededores"
  );
  const [imagenes, setImagenes] = useState<ImagenPreview[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [presentAlert] = useIonAlert();
  const inputArchivoRef = useRef<HTMLInputElement | null>(null);

  // Helpers
  const formatoCOP = (valor: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(valor);

  const desformatearNumero = (value: string) =>
    Number(value.replace(/[^\d]/g, "") || 0);

  const formatearTarifaEnBlur = () => {
    setTarifa((prev) => {
      const numero = desformatearNumero(prev);
      return numero ? formatoCOP(numero) : "";
    });
  };

  const validarArchivos = (files: FileList) => {
    const aceptados = ["image/png", "image/jpeg", "image/webp"];
    const maxMB = 5;
    const maxArchivos = 8;

    const actuales = imagenes.length;
    const resto = Math.max(0, maxArchivos - actuales);
    const toArray = Array.from(files).slice(0, resto);

    const invalidos: string[] = [];
    const nuevos: ImagenPreview[] = [];

    toArray.forEach((f) => {
      if (!aceptados.includes(f.type)) {
        invalidos.push(`${f.name} (tipo inválido)`);
        return;
      }
      if (f.size > maxMB * 1024 * 1024) {
        invalidos.push(`${f.name} (> ${maxMB} MB)`);
        return;
      }
      nuevos.push({ file: f, url: URL.createObjectURL(f) });
    });

    if (invalidos.length) {
      presentAlert({
        header: "Archivo no permitido",
        message:
          "Revisa tipo (PNG/JPG/WEBP) y tamaño (máx. 5 MB):<br/>• " +
          invalidos.join("<br/>• "),
        buttons: ["Entendido"],
      });
    }

    if (nuevos.length) {
      setImagenes((prev) => [...prev, ...nuevos]);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) validarArchivos(e.dataTransfer.files);
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) validarArchivos(e.target.files);
    if (inputArchivoRef.current) inputArchivoRef.current.value = "";
  };

  const eliminarImagen = (url: string) => {
    setImagenes((prev) => prev.filter((p) => p.url !== url));
  };

  const handleSubmit = async () => {
    const errores: string[] = [];
    if (!titulo.trim()) errores.push("El título es obligatorio.");
    if (!descripcion.trim() || descripcion.trim().length < 20)
      errores.push("La descripción debe tener al menos 20 caracteres.");
    if (!categoriaId) errores.push("Selecciona una categoría.");
    if (!tarifa) errores.push("Ingresa la tarifa.");
    if (errores.length) {
      presentAlert({
        header: "Revisa el formulario",
        message: "• " + errores.join("<br/>• "),
        buttons: ["Ok"],
      });
      return;
    }

    // Aquí integrarías la llamada a tu backend…
    // const payload = {...}
    // await api.post('/servicios', payload)

    setShowToast(true);
  };

  return (
    <IonPage className="ps-page">
      <IonHeader translucent>
        <IonToolbar className="ps-toolbar">
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          <IonTitle>Publicar Servicio</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="ps-content">
        <div className="ps-container">
          <IonSegment
            value={segment}
            onIonChange={(e) =>
              setSegment(e.detail.value as "espacio" | "servicio")
            }
            className="ps-segment"
          >
            
            <IonSegmentButton value="servicio">
              <IonIcon icon={briefcaseOutline} />
              <IonLabel>Servicio Independiente</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          <h2 className="ps-subtitle">Publicar Servicio Independiente</h2>
          <p className="ps-intro">
            Describe tus servicios profesionales para que los clientes puedan
            contactarte.
          </p>

          <IonGrid className="ps-form">
            {/* Título */}
            <IonRow>
              <IonCol size="12">
                <IonItem className="input-item" lines="none">
                  <IonLabel position="stacked">Título del Servicio</IonLabel>
                  <IonInput
                    placeholder="Ej: Desarrollo Web Frontend Avanzado"
                    value={titulo}
                    onIonInput={(e) => setTitulo(String(e.detail.value ?? ""))}
                  />
                </IonItem>
                <IonNote className="helper-note">
                  Un título claro y atractivo para tu servicio.
                </IonNote>
              </IonCol>
            </IonRow>

            {/* Descripción */}
            <IonRow>
              <IonCol size="12">
                <IonItem className="input-item" lines="none">
                  <IonLabel position="stacked">
                    Descripción Detallada del Servicio
                  </IonLabel>
                  <IonTextarea
                    autoGrow
                    placeholder="Describe tu servicio, qué ofreces, tu experiencia, etc."
                    value={descripcion}
                    onIonInput={(e) =>
                      setDescripcion(String(e.detail.value ?? ""))
                    }
                  />
                </IonItem>
                <IonNote className="helper-note">
                  Proporciona detalles completos sobre tu servicio para atraer
                  clientes.
                </IonNote>
              </IonCol>
            </IonRow>

            {/* Categoría y Tarifa */}
            <IonRow className="gap-row">
              <IonCol sizeMd="7" size="12">
                <IonItem className="input-item" lines="none">
                  <IonLabel position="stacked">Categoría del Servicio</IonLabel>
                  <IonSelect
                    interface="popover"
                    placeholder="Selecciona una categoría"
                    value={categoriaId}
                    onIonChange={(e) => setCategoriaId(e.detail.value)}
                  >
                    {categorias.map((c) => (
                      <IonSelectOption value={c.id} key={c.id}>
                        {c.nombre}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonNote className="helper-note">
                  Elige la categoría que mejor describa tu servicio.
                </IonNote>
              </IonCol>

              <IonCol sizeMd="5" size="12">
                <IonItem className="input-item" lines="none">
                  <IonLabel position="stacked">Tarifa</IonLabel>
                  <IonInput
                    inputmode="numeric"
                    placeholder="$ 75.000"
                    value={tarifa}
                    onIonInput={(e) => setTarifa(String(e.detail.value ?? ""))}
                    onIonBlur={formatearTarifaEnBlur}
                  />
                </IonItem>
                <IonNote className="helper-note">
                  Ingresa tu tarifa. Esta categoría puede ser por proyecto u
                  hora.
                </IonNote>
              </IonCol>
            </IonRow>

            {/* Disponibilidad */}
            <IonRow>
              <IonCol size="12">
                <IonItem className="input-item" lines="none">
                  <IonLabel position="stacked">Disponibilidad</IonLabel>
                  <IonInput
                    value={disponibilidad}
                    onIonInput={(e) =>
                      setDisponibilidad(String(e.detail.value ?? ""))
                    }
                  />
                </IonItem>
                <IonNote className="helper-note">
                  Indica tus horarios y días de trabajo.
                </IonNote>
              </IonCol>
            </IonRow>

            {/* Ubicación */}
            <IonRow>
              <IonCol size="12">
                <IonItem className="input-item" lines="none">
                  <IonLabel position="stacked">
                    Ubicación / Área de Servicio
                  </IonLabel>
                  <IonInput
                    value={ubicacion}
                    onIonInput={(e) =>
                      setUbicacion(String(e.detail.value ?? ""))
                    }
                  />
                </IonItem>
                <IonNote className="helper-note">
                  Especifica dónde ofreces tus servicios. Escribe “Remoto” si
                  aplica.
                </IonNote>
              </IonCol>
            </IonRow>

            {/* Upload */}
            <IonRow>
              <IonCol size="12">
                <div
                  className="upload-dropzone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  onClick={() => inputArchivoRef.current?.click()}
                  role="button"
                  tabIndex={0}
                >
                  <IonIcon icon={cloudUploadOutline} />
                  <div className="upload-text-1">
                    Haz clic para subir o arrastra y suelta
                  </div>
                  <div className="upload-text-2">
                    PNG, JPG, WEBP (MAX 5 MB por imagen)
                  </div>
                  <input
                    ref={inputArchivoRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    hidden
                    onChange={onPickFiles}
                  />
                </div>

                {imagenes.length > 0 && (
                  <div className="thumbs">
                    {imagenes.map((img) => (
                      <div className="thumb" key={img.url}>
                        <img src={img.url} alt={img.file.name} />
                        <button
                          type="button"
                          className="thumb-remove"
                          onClick={() => eliminarImagen(img.url)}
                          aria-label="Eliminar imagen"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <IonNote className="helper-note">
                  Sube imágenes de trabajos previos, portafolio, etc. (Opcional,
                  hasta 8)
                </IonNote>
              </IonCol>
            </IonRow>

            {/* Submit */}
            <IonRow>
              <IonCol size="12" className="submit-wrap">
                <IonButton size="default" onClick={handleSubmit}>
                  Publicar Servicio Independiente
                </IonButton>
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>

        <IonToast
          isOpen={showToast}
          duration={2500}
          message="¡Tu servicio fue publicado!"
          onDidDismiss={() => setShowToast(false)}
        />
      </IonContent>
    </IonPage>
  );
}


