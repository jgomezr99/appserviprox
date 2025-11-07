import React, { useMemo, useState, useRef, useEffect } from "react";
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
  IonText,
  IonDatetime,
} from "@ionic/react";
import {
  briefcaseOutline,
  cloudUploadOutline,
  calendarClearOutline,
} from "ionicons/icons";
import { useIonRouter } from "@ionic/react";

type Categoria = {
  id: string;
  nombre: string;
};

type ImagenPreview = {
  file: File;
  url: string;
  data?: string; // <-- base64 para persistir
};

// Persistencia simple (sin backend)
type Publicacion = {
  id: string;
  titulo: string;
  descripcion: string;
  categoriaId: string;
  categoriaNombre: string;
  tarifaCOP: number;
  disponibilidad: string;
  ubicacion: string;
  imagenes: string[]; // base64 o URLs
  createdAt: string;
};
const STORAGE_KEY = "serviprox_publicaciones";

const loadPublicaciones = (): Publicacion[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Publicacion[]) : [];
  } catch {
    return [];
  }
};
const savePublicaciones = (items: Publicacion[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};
const addPublicacion = (p: Publicacion) => {
  const items = loadPublicaciones();
  items.unshift(p);
  savePublicaciones(items);
};
const removePublicacion = (id: string) => {
  const items = loadPublicaciones().filter((x) => x.id !== id);
  savePublicaciones(items);
};

// Helper: leer archivo como base64
const readFileAsDataURL = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

const PAISES = [
  { value: 'CO', label: 'Colombia' },
  { value: 'AR', label: 'Argentina' },
  { value: 'CL', label: 'Chile' },
  { value: 'PE', label: 'Perú' },
  { value: 'BR', label: 'Brasil' },
  { value: 'EC', label: 'Ecuador' },
  { value: 'UY', label: 'Uruguay' },
  { value: 'PY', label: 'Paraguay' },
  { value: 'BO', label: 'Bolivia' },

];

export default function Publicar() {
  // Reajuste: solo existe el segmento "servicio"
  const router = useIonRouter();

  // Segment ampliado
  const [segment, setSegment] = useState<"publicar" | "publicaciones" | "reservas">("publicar");

  const categorias: Categoria[] = useMemo(
    () => [
      { id: "tecno_diseno", nombre: "Tecnología y Diseño" },
      { id: "mantenimiento", nombre: "Mantenimiento y Reparaciones" },
      { id: "cuidado_mascota", nombre: "Cuidado mascota" },
      { id: "seguridad_privada", nombre: "Servicio de seguridad privada" },
      { id: "foto_video", nombre: "Foto y Video" },
      { id: "educacion_tutoria", nombre: "Educación y entrenador" }, // quitado espacio final
    ],
    []
  );

  // Estado del formulario
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | undefined>(undefined);
  const [tarifa, setTarifa] = useState<string>(""); // cadena formateada
  // Estado para disponibilidad
  const [dias, setDias] = useState<string[]>([]);
  const [horaInicio, setHoraInicio] = useState<string>("");
  const [horaFin, setHoraFin] = useState<string>("");
  // Estado de ubicación desglosado
  const [pais, setPais] = useState("CO");
  const [departamento, setDepartamento] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [barrio, setBarrio] = useState("");
  const [direccion, setDireccion] = useState("");

  const [imagenes, setImagenes] = useState<ImagenPreview[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>(""); // <-- mensaje del toast
  const [presentAlert] = useIonAlert();
  const inputArchivoRef = useRef<HTMLInputElement | null>(null);

  // Estado de publicaciones cargadas
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  const refreshPublicaciones = () => setPublicaciones(loadPublicaciones());
  useEffect(() => {
    refreshPublicaciones();
  }, []);

  // Redirigir cuando se selecciona "reservas"
  useEffect(() => {
    if (segment === "reservas") {
      router.push("/reservas");
      setSegment("publicar");
    }
  }, [segment, router]);

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

  const validarArchivos = async (files: FileList) => {
    const aceptados = ["image/png", "image/jpeg", "image/webp"];
    const maxMB = 5;
    const maxArchivos = 8;

    const actuales = imagenes.length;
    const resto = Math.max(0, maxArchivos - actuales);
    const toArray = Array.from(files).slice(0, resto);

    const invalidos: string[] = [];
    const pendientes: File[] = [];

    toArray.forEach((f) => {
      if (!aceptados.includes(f.type)) {
        invalidos.push(`${f.name} (tipo inválido)`);
        return;
      }
      if (f.size > maxMB * 1024 * 1024) {
        invalidos.push(`${f.name} (> ${maxMB} MB)`);
        return;
      }
      pendientes.push(f);
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

    if (pendientes.length) {
      const nuevos = await Promise.all(
        pendientes.map(async (f) => {
          const data = await readFileAsDataURL(f);
          return { file: f, url: URL.createObjectURL(f), data } as ImagenPreview;
        })
      );
      setImagenes((prev) => [...prev, ...nuevos]);
    }
  };

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) await validarArchivos(e.dataTransfer.files);
  };

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) await validarArchivos(e.target.files);
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

    // Helper para formatear la hora desde ISO string
    const formatTime = (isoString: string) => {
      if (!isoString) return "";
      try {
        return new Date(isoString).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
      } catch {
        return "";
      }
    };

    // Construir objeto de publicación y persistir en localStorage
    const cat = categorias.find((c) => c.id === categoriaId);
    const id = String(Date.now());
    const disponibilidadString = `Días: ${dias.join(', ')}. Horario: ${formatTime(horaInicio)} - ${formatTime(horaFin)}`;
    const pub: Publicacion = {
      id,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      categoriaId: categoriaId!,
      categoriaNombre: cat?.nombre ?? "",
      tarifaCOP: desformatearNumero(tarifa),
      disponibilidad: disponibilidadString,
      // Unir campos de ubicación en una sola cadena, incluyendo el país
      ubicacion: [pais, departamento, ciudad, barrio, direccion].filter(Boolean).join(", "),
      imagenes: imagenes.map((p) => p.data || p.url),
      createdAt: new Date().toISOString(),
    };
    addPublicacion(pub);
    refreshPublicaciones();

    setToastMessage("Publicación creada");
    setShowToast(true);
    // Opcional: limpiar formulario
    setTitulo("");
    setDescripcion("");
    setCategoriaId(undefined);
    setTarifa("");
    // Limpiar disponibilidad
    setDias([]);
    setHoraInicio("");
    setHoraFin("");
    // Limpiar campos de ubicación
    setPais("CO"); // Resetear país
    setDepartamento("");
    setCiudad("");
    setBarrio("");
    setDireccion("");
    setImagenes([]);
  };

  // Nuevo: eliminar individual
  const eliminarPublicacion = (id: string) => {
    presentAlert({
      header: 'Confirmar eliminación',
      message: '¿Estás seguro de que quieres eliminar esta publicación?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            removePublicacion(id);
            setToastMessage("Publicación eliminada");
            setShowToast(true);
            refreshPublicaciones();
          },
        },
      ],
    });
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
          <IonText className="ps-container">
            {/* Nuevo IonSegment */}
            <IonSegment
              value={segment}
              onIonChange={e => setSegment(e.detail.value as any)}
              className="ps-segment"
            >
              <IonSegmentButton value="publicar">
                <IonIcon icon={briefcaseOutline} />
                <IonLabel>Publicar</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="publicaciones">
                <IonIcon icon={cloudUploadOutline} />
                <IonLabel>Mis Publicaciones</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="reservas">
                <IonIcon icon={calendarClearOutline} />
                <IonLabel>Mis Reservas</IonLabel>
              </IonSegmentButton>
            </IonSegment>

            {segment === "publicar" && (
              <>
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
                  <IonRow className="gap-row">
                    <IonCol size="12">
                      <IonItem className="input-item" lines="none">
                        <IonLabel position="stacked">Días Disponibles</IonLabel>
                        <IonSelect
                          multiple={true}
                          interface="popover"
                          placeholder="Selecciona los días"
                          value={dias}
                          onIonChange={(e) => setDias(e.detail.value)}
                        >
                          <IonSelectOption value="Lunes">Lunes</IonSelectOption>
                          <IonSelectOption value="Martes">Martes</IonSelectOption>
                          <IonSelectOption value="Miércoles">Miércoles</IonSelectOption>
                          <IonSelectOption value="Jueves">Jueves</IonSelectOption>
                          <IonSelectOption value="Viernes">Viernes</IonSelectOption>
                          <IonSelectOption value="Sábado">Sábado</IonSelectOption>
                          <IonSelectOption value="Domingo">Domingo</IonSelectOption>
                        </IonSelect>
                      </IonItem>
                    </IonCol>
                  </IonRow>
                  <IonRow className="gap-row">
                    <IonCol size="12" sizeMd="6">
                      <IonItem className="input-item" lines="none">
                        <IonLabel position="stacked">Hora de inicio</IonLabel>
                        <IonDatetime
                          presentation="time"
                          preferWheel={true}
                          aria-label="Selecciona hora"
                          value={horaInicio}
                          onIonChange={(e) => setHoraInicio(String(e.detail.value ?? ""))}
                        />
                      </IonItem>
                    </IonCol>
                    <IonCol size="12" sizeMd="6">
                      <IonItem className="input-item" lines="none">
                        <IonLabel position="stacked">Hora de fin</IonLabel>
                        <IonDatetime
                          presentation="time"
                          preferWheel={true}
                          aria-label="Selecciona hora"
                          value={horaFin}
                          onIonChange={(e) => setHoraFin(String(e.detail.value ?? ""))}
                        />
                      </IonItem>
                    </IonCol>
                  </IonRow>
                  <IonRow>
                    <IonCol>
                      <IonNote className="helper-note">
                        Indica tus horarios y días de trabajo.
                      </IonNote>
                    </IonCol>
                  </IonRow>
    
                  {/* Ubicación desglosada */}
                  <IonRow>
                    <IonCol size="12">
                      <IonItem className="input-item" lines="none">
                        <IonLabel position="stacked">País</IonLabel>
                        <IonSelect
                          interface="popover"
                          placeholder="Selecciona un país"
                          value={pais}
                          onIonChange={(e) => setPais(e.detail.value)}
                        >
                          {PAISES.map((p) => (
                            <IonSelectOption value={p.value} key={p.value}>
                              {p.label}
                            </IonSelectOption>
                          ))}
                        </IonSelect>
                      </IonItem>
                    </IonCol>
                  </IonRow>
                  <IonRow className="gap-row">
                    <IonCol size="12" sizeMd="6">
                      <IonItem className="input-item" lines="none">
                        <IonLabel position="stacked">Departamento</IonLabel>
                        <IonInput
                          placeholder="Ej: Antioquia"
                          value={departamento}
                          onIonInput={(e) => setDepartamento(String(e.detail.value ?? ""))}
                        />
                      </IonItem>
                    </IonCol>
                    <IonCol size="12" sizeMd="6">
                      <IonItem className="input-item" lines="none">
                        <IonLabel position="stacked">Ciudad</IonLabel>
                        <IonInput
                          placeholder="Ej: Medellín"
                          value={ciudad}
                          onIonInput={(e) => setCiudad(String(e.detail.value ?? ""))}
                        />
                      </IonItem>
                    </IonCol>
                  </IonRow>
                  <IonRow className="gap-row">
                    <IonCol size="12" sizeMd="6">
                      <IonItem className="input-item" lines="none">
                        <IonLabel position="stacked">Barrio</IonLabel>
                        <IonInput
                          placeholder="Ej: El Poblado"
                          value={barrio}
                          onIonInput={(e) => setBarrio(String(e.detail.value ?? ""))}
                        />
                      </IonItem>
                    </IonCol>
                    <IonCol size="12" sizeMd="6">
                      <IonItem className="input-item" lines="none">
                        <IonLabel position="stacked">Dirección (Opcional)</IonLabel>
                        <IonInput
                          placeholder="Ej: Calle 10 #43A-30"
                          value={direccion}
                          onIonInput={(e) => setDireccion(String(e.detail.value ?? ""))}
                        />
                      </IonItem>
                    </IonCol>
                  </IonRow>
                  <IonRow>
                    <IonCol>
                      <IonNote className="helper-note">
                        Especifica la ubicación para servicios presenciales.
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
                        Sube imágenes de trabajos previos, portafolio, etc.
                      </IonNote>
    
                      {/* Acciones: publicar */}
                      <div className="actions-row" style={{ marginTop: 16 }}>
                        <IonButton expand="block" onClick={handleSubmit}>
                          Publicar
                        </IonButton>
                      </div>
                    </IonCol>
                  </IonRow>
                </IonGrid>
    
                {/* Toast para feedback */}
                <IonToast
                  isOpen={showToast}
                  message={toastMessage}
                  duration={2000}
                  onDidDismiss={() => setShowToast(false)}
                />
              </>
            )}

            {segment === "publicaciones" && (
              <div className="mis-publicaciones">
                <h2>Mis Publicaciones</h2>
                {publicaciones.length === 0 && (
                  <IonNote>No tienes publicaciones aún.</IonNote>
                )}
                {publicaciones.map(p => (
                  <IonItem key={p.id} lines="none" className="pub-item">
                    <IonLabel className="ion-text-wrap">
                      <h3>{p.titulo}</h3>
                      <p>{p.categoriaNombre} • {formatoCOP(p.tarifaCOP)}</p>
                      <p>
                        Creado: {new Date(p.createdAt).toLocaleDateString()} •
                        Imágenes: {p.imagenes.length}
                      </p>
                    </IonLabel>
                    <IonButton
                      color="danger"
                      size="small"
                      onClick={() => eliminarPublicacion(p.id)}
                    >
                      Eliminar
                    </IonButton>
                  </IonItem>
                ))}
              </div>
            )}

          </IonText>
        </IonContent>
      </IonPage>
  );
}