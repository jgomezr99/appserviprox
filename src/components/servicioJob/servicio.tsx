import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonRow,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonBadge,
  IonButtons,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonRange,
  IonInput,
  IonNote,
  IonMenuButton,
} from "@ionic/react";
import {
  funnelOutline,
  codeSlashOutline,
  constructOutline,
  pawOutline,
  shieldCheckmarkOutline,
  cameraOutline,
  schoolOutline,
  sparklesOutline,
  star,
  pinOutline,
  globeOutline,
  searchOutline,
  closeOutline,
  heart,
  heartOutline
} from "ionicons/icons";
import "../servicioJob/ServicioJob.css";

type Category = {
  id: string;
  label: string;
  icon: string;
};

type Service = {
  id: string;
  title: string;
  categoryId: string;
  categoryLabel: string;
  price: string;
  professional: string;
  rating: number;
  location: string;
  isRemote?: boolean;
  image?: string;
};

// Definición de Publicacion para leer localStorage
type Publicacion = {
  id: string;
  titulo: string;
  descripcion: string;
  categoriaId: string;
  categoriaNombre: string;
  tarifaCOP: number;
  disponibilidad: string;
  ubicacion: string;
  imagenes: string[];
  createdAt: string;
};

const CATEGORIES: Category[] = [
  { id: "all",               label: "Todos",                          icon: sparklesOutline },
  { id: "tecno_diseno",      label: "Tecnología y\nDiseño",           icon: codeSlashOutline },
  { id: "mantenimiento",     label: "Mantenimiento y\nReparaciones",  icon: constructOutline },
  { id: "cuidado_mascota",   label: "Cuidado de mascotas",            icon: pawOutline },
  { id: "seguridad_privada", label: "Servicio de\nseguridad privada", icon: shieldCheckmarkOutline },
  { id: "foto_video",        label: "Foto y Video",                   icon: cameraOutline },
  { id: "educacion_tutoria", label: "Educación y\nEntrenador",        icon: schoolOutline },
];

// Servicios estáticos
const STATIC_SERVICES: Service[] = [
  {
    id: "s1",
    title: "Desarrollo Web Frontend",
    categoryId: "tecno_diseno",
    categoryLabel: "Tecnología",
    price: "$75.000 por proyecto",
    professional: "Carlos Rodríguez",
    rating: 4.7,
    location: "Remoto",
    isRemote: true,
    image: "https://images.unsplash.com/photo-1587620962725-abab7fe55159?q=80&w=2000&auto=format&fit=crop"
  },
  {
    id: "s2",
    title: "Entrenamiento Fitness Personalizado",
    categoryId: "educacion_tutoria",
    categoryLabel: "Entrenador Personal",
    price: "$50.000 por hora",
    professional: "Ana García",
    rating: 4.9,
    location: "Bogotá",
    image: "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?q=80&w=2000&auto=format&fit=crop"
  },
  {
    id: "s3",
    title: "Servicios de Contratista General",
    categoryId: "mantenimiento",
    categoryLabel: "Contratista",
    price: "$80.000 por hora",
    professional: "Javier Gómez",
    rating: 4.5,
    location: "Bogotá y alrededores, Colombia",
    image: "https://i.ibb.co/sdd1z3t3/Servicios-Generales-Olusa-Contratisas-Generales-Peru.jpg"
  },
];

// Convierte "$75.000 por proyecto" -> 75000
const parsePrice = (price: string) => {
  const digits = price.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
};

const ServicioJob: React.FC = () => {
  // Estado para servicios combinados
  const [allServices, setAllServices] = useState<Service[]>(STATIC_SERVICES);

  // Cargar publicaciones dinámicas al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem("serviprox_publicaciones");
      if (raw) {
        const pubs = JSON.parse(raw) as Publicacion[];
        const dynamicServices: Service[] = pubs.map((p) => ({
          id: p.id,
          title: p.titulo,
          categoryId: p.categoriaId, // Asegúrate de que coincida con los IDs de CATEGORIES si quieres filtrado exacto
          categoryLabel: p.categoriaNombre,
          price: `$${p.tarifaCOP.toLocaleString("es-CO")}`,
          professional: "Usuario Local", // O el nombre del usuario logueado
          rating: 5.0, // Valor por defecto para nuevos
          location: p.ubicacion,
          isRemote: p.ubicacion.toLowerCase().includes("remoto"),
          image: p.imagenes[0] || "https://via.placeholder.com/300?text=Sin+Imagen",
        }));
        // Mostrar publicaciones nuevas primero
        setAllServices([...dynamicServices, ...STATIC_SERVICES]);
      }
    } catch (e) {
      console.error("Error cargando publicaciones", e);
    }
  }, []);

  // Filtro por tarjeta
  const [selectedCategory, setSelectedCategory] = useState<string>(""); // "" = todas

  // Buscador rápido
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modal de filtros avanzados
  const [showFilters, setShowFilters] = useState(false);
  const [minRating, setMinRating] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(200000);
  const [locationFilter, setLocationFilter] = useState<string>("");

  const carouselRef = useRef<HTMLDivElement | null>(null);

  const scrollNext = () => {
    const el = carouselRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  const scrollPrev = () => {
    const el = carouselRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: -amount, behavior: "smooth" });
  };

  const filteredServices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const loc = locationFilter.trim().toLowerCase();

    return allServices.filter((s) => {
      const byCat =
        selectedCategory === "" || selectedCategory === "all"
          ? true
          : s.categoryId === selectedCategory;

      const byText =
        term.length === 0 ||
        s.title.toLowerCase().includes(term) ||
        s.professional.toLowerCase().includes(term) ||
        s.categoryLabel.toLowerCase().includes(term) ||
        s.price.toLowerCase().includes(term) ||
        s.location.toLowerCase().includes(term);

      const byLocation =
        loc.length === 0 ||
        s.location.toLowerCase().includes(loc) ||
        (loc.includes("remoto") && !!s.isRemote);

      const byRating = s.rating >= minRating;
      const byPrice = parsePrice(s.price) <= maxPrice;

      return byCat && byText && byLocation && byRating && byPrice;
    });
  }, [selectedCategory, searchTerm, locationFilter, minRating, maxPrice, allServices]);

  // Favoritos: ids guardados en localStorage
  const [favoritos, setFavoritos] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("mis_favoritos") || "[]");
    } catch {
      return [];
    }
  });

  const toggleFavorito = (id: string) => {
    setFavoritos(prev => {
      const existe = prev.includes(id);
      const nuevos = existe ? prev.filter(f => f !== id) : [...prev, id];
      localStorage.setItem("mis_favoritos", JSON.stringify(nuevos));
      return nuevos;
    });
  };

  const esFavorito = (id: string) => favoritos.includes(id);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>

          <IonTitle>Servicios Profesionales</IonTitle>

          <IonButtons slot="end">
            <IonButton fill="clear" onClick={() => setShowFilters(true)}>
              <IonIcon slot="start" icon={funnelOutline} />
              Filtros
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <div className="container">
          {/* Buscador */}
          <div className="search-row">
            <IonSearchbar
              placeholder="Buscar servicios..."
              value={searchTerm}
              onIonInput={(e) => setSearchTerm(e.detail.value ?? "")}
              inputmode="search"
              enterkeyhint="search"
              showClearButton="always"
              searchIcon={searchOutline}
            />
          </div>

          {/* CARRUSEL DE CATEGORÍAS */}
          <section aria-label="Categorías de servicios">
            <div className="cat-carousel-wrap">
              <button className="carousel-nav prev" aria-label="Anterior" onClick={scrollPrev}>‹</button>

              <div className="cat-carousel" ref={carouselRef} role="list">
                {CATEGORIES.map((c) => {
                  const isActive =
                    c.id === "all"
                      ? selectedCategory === "" || selectedCategory === "all"
                      : selectedCategory === c.id;

                  return (
                    <div key={c.id} className={`cat-card ${isActive ? "active" : ""}`} role="listitem">
                      <button
                        className="cat-card-btn"
                        onClick={() =>
                          setSelectedCategory((prev) =>
                            c.id === "all" ? "" : prev === c.id ? "" : c.id
                          )
                        }
                        aria-pressed={isActive}
                        aria-label={`Filtrar por categoría ${c.label.replace("\n", " ")}`}
                      >
                        <span className="icon-wrap" aria-hidden="true">
                          <IonIcon icon={c.icon} />
                        </span>
                        <div className="cat-text">
                          <h3 className="cat-title">
                            {c.label.split("\n").map((line, i) => (
                              <span key={i}>
                                {line}
                                <br />
                              </span>
                            ))}
                          </h3>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>

              <button className="carousel-nav next" aria-label="Siguiente" onClick={scrollNext}>›</button>
            </div>
          </section>

          {/* LISTA DE SERVICIOS */}
          <IonGrid fixed>
            <IonRow className="cards-row">
              {filteredServices.map((s) => (
                <IonCol size="12" sizeMd="6" sizeLg="4" key={s.id}>
                  <IonCard className="service-card">
                    <div
                      className="hero"
                      style={{ 
                        backgroundImage: `url(${s.image})`,
                        height: '200px',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        position: 'relative',
                        borderTopLeftRadius: '12px',
                        borderTopRightRadius: '12px',
                      }}
                      role="img"
                      aria-label={s.title}
                    >
                      <IonButton
                        className="like-btn"
                        fill="clear"
                        size="small"
                        onClick={e => { e.stopPropagation(); toggleFavorito(s.id); }}
                        aria-pressed={esFavorito(s.id)}
                        aria-label={esFavorito(s.id) ? "Quitar de favoritos" : "Agregar a favoritos"}
                        style={{ position: "absolute", top: 10, right: 8, zIndex: 10, background: "rgba(255,255,255,.7)", borderRadius: 999 }}
                      >
                        <IonIcon icon={esFavorito(s.id) ? heart : heartOutline} style={{ fontSize: 22, color: esFavorito(s.id) ? "#e53935" : "#1976d2" }} />
                      </IonButton>
                    </div>
                    <IonCardHeader>
                      <IonBadge color="secondary">{s.categoryLabel}</IonBadge>
                      <IonCardTitle className="title">{s.title}</IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                      <IonList lines="none" className="specs">
                        <IonItem>
                          <IonLabel>
                            <strong>Tarifa:</strong> {s.price}
                          </IonLabel>
                        </IonItem>
                        <IonItem>
                          <IonLabel>
                            <strong>Profesional:</strong> {s.professional}
                          </IonLabel>
                        </IonItem>
                        <IonItem className="meta">
                          <IonIcon icon={star} className="star" />
                          <span className="rating">{s.rating.toFixed(1)}</span>
                          <span className="dot">•</span>
                          {s.isRemote ? (
                            <>
                              <IonIcon icon={globeOutline} />
                              <span>Remoto</span>
                            </>
                          ) : (
                            <>
                              <IonIcon icon={pinOutline} />
                              <span>{s.location}</span>
                            </>
                          )}
                        </IonItem>
                      </IonList>
                      <IonButton expand="block">Reservar Servicio</IonButton>
                    </IonCardContent>
                  </IonCard>
                </IonCol>
              ))}
            </IonRow>
          </IonGrid>

          {filteredServices.length === 0 && (
            <div className="empty">
              No hay resultados para tu filtro. Prueba otra categoría o búsqueda.
            </div>
          )}
        </div>

        {/* MODAL FILTROS */}
        <IonModal isOpen={showFilters} onDidDismiss={() => setShowFilters(false)}>
          <IonHeader>
            <IonButtons slot="start">
          <IonMenuButton autoHide={false}></IonMenuButton>
        </IonButtons>
            <IonToolbar>
              <IonTitle>Filtrar Servicios</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowFilters(false)}>
                  <IonIcon icon={closeOutline} />
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>

          <IonContent className="ion-padding">
            {/* Categoría */}
            <IonItem>
              <IonLabel>Categoría del Servicio</IonLabel>
            </IonItem>
            <IonItem>
              <IonSelect
                interface="popover"
                value={selectedCategory || "all"}
                onIonChange={(e) =>
                  setSelectedCategory(e.detail.value === "all" ? "" : e.detail.value)
                }
              >
                {CATEGORIES.map((c) => (
                  <IonSelectOption key={c.id} value={c.id}>
                    {c.label.replace(/\n/g, " ")}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            {/* Ubicación / Modalidad */}
            <IonItem>
              <IonLabel>Ubicación / Modalidad</IonLabel>
            </IonItem>
            <IonItem>
              <IonInput
                placeholder="Ej: Remoto, Bogotá"
                value={locationFilter}
                onIonChange={(e) => setLocationFilter(e.detail.value ?? "")}
              />
            </IonItem>

            {/* Valoración mínima */}
            <IonItem lines="none" className="ion-margin-top">
              <IonLabel>Valoración mínima</IonLabel>
            </IonItem>
            <IonItem>
              <IonIcon slot="start" icon={star} />
              <IonRange
                min={0}
                max={5}
                step={0.1}
                pin={true}
                value={minRating}
                onIonChange={(e) => setMinRating(Number(e.detail.value))}
              />
              <IonLabel slot="end">{minRating.toFixed(1)}</IonLabel>
            </IonItem>

            {/* Tarifa máxima */}
            <IonItem lines="none" className="ion-margin-top">
              <IonLabel>Tarifa máxima</IonLabel>
            </IonItem>
            <IonItem>
              <IonRange
                min={0}
                max={200000}
                step={5000}
                pin={true}
                value={maxPrice}
                onIonChange={(e) => setMaxPrice(Number(e.detail.value))}
              />
              <IonLabel slot="end">
                ${maxPrice.toLocaleString("es-CO")}
              </IonLabel>
            </IonItem>
            <IonNote className="ion-padding-start ion-padding-bottom" color="medium">
              La tarifa puede ser por hora o por proyecto, según el servicio.
            </IonNote>

            <IonButton
              expand="block"
              className="ion-margin-vertical"
              onClick={() => setShowFilters(false)}
            >
              Mostrar resultados
            </IonButton>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default ServicioJob;
