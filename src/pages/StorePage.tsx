import React, { useState, useEffect, useCallback } from "react";
import {
  IonButtons,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonPage,
  IonTitle,
  IonToolbar,
  IonToast,
  IonModal,
} from "@ionic/react";
import {
  cartOutline,
  addCircleOutline,
  searchOutline,
  alertCircleOutline,
  arrowBackOutline,
  chatbubbleEllipsesOutline,
  closeOutline,
  imageOutline,
  trashOutline,
} from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { usePlatformSettings } from "../services/platformSettings";
import { useHistory, useLocation } from "react-router-dom";
import "./RolePages.css";

interface StoreProduct {
  id: string | number;
  title: string;
  category: string;
  price: number;
  description: string;
  sellerName: string;
  sellerRole: "Contratista" | "Cliente" | "Ferretería Aliada" | "Administrador";
  phone: string;
  city: string;
  image: string;
  date: string;
  isOwner?: boolean;
}

interface ApiStoreProduct {
  id: number;
  title: string;
  category: string;
  price: number;
  description: string;
  seller_name: string;
  seller_role: StoreProduct["sellerRole"];
  phone: string;
  city: string;
  image_url: string;
  is_owner: boolean;
  created_at: string;
}

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='240'><rect width='100%' height='100%' fill='#f1f5f9'/><text x='50%' y='50%' fill='#94a3b8' font-family='sans-serif' font-size='18' text-anchor='middle' dominant-baseline='middle'>Sin imagen</text></svg>"
  );

const fromApiProduct = (item: ApiStoreProduct): StoreProduct => ({
  id: item.id,
  title: item.title,
  category: item.category,
  price: item.price,
  description: item.description,
  sellerName: item.seller_name,
  sellerRole: item.seller_role,
  phone: item.phone,
  city: item.city,
  image: item.image_url || PLACEHOLDER_IMAGE,
  date: new Date(item.created_at).toLocaleDateString("es-CO"),
  isOwner: item.is_owner,
});

const PROFESSIONAL_CATEGORIES = ["Herramientas", "Seguridad y EPP", "Materiales", "Repuestos", "Equipos"];
const CLIENT_CATEGORIES = ["Tecnología", "Muebles", "Ropa", "Electrodomésticos", "Hogar y decoración", "Otros"];

const MAX_IMAGE_SIDE = 1280;

// Reduce el tamaño de las fotos del celular antes de subirlas.
const compressImage = (file: File): Promise<File> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          resolve(new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("invalid image"));
    };
    img.src = url;
  });

const INITIAL_STORE_PRODUCTS: StoreProduct[] = [
  {
    id: "prod-1",
    title: "Taladro Percutor Inalámbrico DeWalt 20V Max",
    category: "Herramientas",
    price: 380000,
    description: "Incluye 2 baterías de litio de 2.0Ah, cargador rápido y maletín de transporte rígido. Excelente estado.",
    sellerName: "Carlos Mendoza (Ing. Eléctrico)",
    sellerRole: "Contratista",
    phone: "+57 312 458 9912",
    city: "Bogotá (Usaquén)",
    image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&auto=format&fit=crop&q=80",
    date: "Hoy",
  },
  {
    id: "prod-2",
    title: "Escalera Telescópica de Aluminio 3.8m Multiuso",
    category: "Equipos",
    price: 240000,
    description: "Capacidad de 150 kg, compacta y liviana, ideal para trabajos de pintura, drywall y redes eléctricas.",
    sellerName: "Rodrigo Salamanca (Pintor Pro)",
    sellerRole: "Contratista",
    phone: "+57 320 889 1234",
    city: "Bogotá (Chapinero)",
    image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&auto=format&fit=crop&q=80",
    date: "Ayer",
  },
  {
    id: "prod-3",
    title: "Kit Profesional de Pinza Voltiamperimétrica Fluke",
    category: "Herramientas",
    price: 520000,
    description: "Medición True RMS, cables de prueba reforzados CAT IV y certificación de calibración vigente.",
    sellerName: "Ferretería Eléctrica del Norte",
    sellerRole: "Ferretería Aliada",
    phone: "+57 301 234 5678",
    city: "Bogotá (Suba)",
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400&auto=format&fit=crop&q=80",
    date: "Hace 2 días",
  },
  {
    id: "prod-4",
    title: "Kit de Arnés de Seguridad + Línea de Vida 1.8m",
    category: "Seguridad y EPP",
    price: 195000,
    description: "Norma ANSI Z359.11 para trabajo en alturas. 4 argollas en acero forjado, soporte lumbar ergonómico.",
    sellerName: "Seguridad Industrial Andina",
    sellerRole: "Ferretería Aliada",
    phone: "+57 315 901 2345",
    city: "Bogotá (Fontibón)",
    image: "https://images.unsplash.com/photo-1541888946425-d0fbb186f5f7?w=400&auto=format&fit=crop&q=80",
    date: "Hace 3 días",
  },
];

export const StorePage: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();
  const platform = usePlatformSettings();
  const productsEnabled = platform.features.products;

  const [serverProducts, setServerProducts] = useState<StoreProduct[]>([]);
  const products = [...serverProducts, ...INITIAL_STORE_PRODUCTS];

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [modalOpen, setModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [publishing, setPublishing] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const data = await api.get<ApiStoreProduct[]>("store/products/");
      setServerProducts(data.map(fromApiProduct));
    } catch {
      setToastMessage("No pudimos cargar las publicaciones de la tienda. Verifica la conexión con el servidor.");
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const location = useLocation();
  useEffect(() => {
    if (location.search.includes("action=publish")) {
      setModalOpen(true);
    }
  }, [location.search]);

  // Clientes publican tecnología, muebles, ropa, etc.; profesionales solo herramientas y materiales de trabajo.
  const publishCategories =
    user?.role === "professional"
      ? PROFESSIONAL_CATEGORIES
      : user?.role === "staff"
      ? [...PROFESSIONAL_CATEGORIES, ...CLIENT_CATEGORIES]
      : CLIENT_CATEGORIES;

  // Formulario nuevo producto
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const selectedPublishCategory = publishCategories.includes(newCategory) ? newCategory : publishCategories[0];
  const [newPrice, setNewPrice] = useState(150000);
  const [newDescription, setNewDescription] = useState("");
  const [newPhone, setNewPhone] = useState("+57 310 123 4567");
  const [newCity, setNewCity] = useState("Bogotá");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  useEffect(() => {
    if (!newImage) {
      setImagePreview("");
      return;
    }
    const url = URL.createObjectURL(newImage);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [newImage]);

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setToastMessage("Selecciona un archivo de imagen (JPG, PNG o WEBP).");
      return;
    }
    try {
      setNewImage(await compressImage(file));
    } catch {
      setToastMessage("No pudimos procesar esa imagen. Prueba con otra.");
    }
  };

  const closePublishModal = () => {
    setModalOpen(false);
    setNewImage(null);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (publishing) return;
    if (!newTitle.trim()) {
      setToastMessage("Por favor ingresa el título del producto.");
      return;
    }
    if (!user) {
      setToastMessage("Inicia sesión para publicar en la tienda.");
      return;
    }

    const form = new FormData();
    form.append("title", newTitle.trim());
    form.append("category", selectedPublishCategory);
    form.append("price", String(Math.round(Number(newPrice)) || 0));
    form.append("description", newDescription.trim() || "Producto garantizado por el contratista.");
    form.append("phone", newPhone.trim());
    form.append("city", newCity.trim());
    if (newImage) form.append("image", newImage);

    setPublishing(true);
    try {
      const created = await api.post<ApiStoreProduct>("store/products/", form);
      setServerProducts((current) => [fromApiProduct(created), ...current]);
      closePublishModal();
      setNewTitle("");
      setNewDescription("");
      setToastMessage("¡Producto publicado exitosamente en la tienda!");
    } catch (err) {
      setToastMessage(err instanceof Error && err.message ? err.message : "No pudimos publicar el producto.");
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteProduct = async (product: StoreProduct) => {
    try {
      await api.delete(`store/products/${product.id}/`);
      setServerProducts((current) => current.filter((item) => item.id !== product.id));
      setToastMessage("Publicación eliminada.");
    } catch {
      setToastMessage("No pudimos eliminar la publicación.");
    }
  };

  // Si la tienda está desactivada por el administrador, bloquear vista
  if (!productsEnabled) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonMenuButton autoHide={false} menu="main-menu" />
            </IonButtons>
            <IonTitle>Tienda de Productos</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding sp-role-content">
          <div
            style={{
              maxWidth: "520px",
              margin: "60px auto",
              padding: "36px 24px",
              background: "#ffffff",
              borderRadius: "20px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.06)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#fee2e2",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                fontSize: "2rem",
              }}
            >
              <IonIcon icon={alertCircleOutline} />
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a", marginBottom: "10px" }}>
              Tienda de Productos Desactivada
            </h2>
            <p style={{ color: "#64748b", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "24px" }}>
              La publicación y comercialización de productos en la tienda ha sido desactivada temporalmente por la administración de Serviprox.
            </p>
            <IonButton
              fill="solid"
              color="primary"
              onClick={() => history.push(user?.role === "professional" ? "/profesional/inicio" : "/cliente/inicio")}
              style={{ fontWeight: 700, borderRadius: "12px" }}
            >
              <IonIcon slot="start" icon={arrowBackOutline} /> Volver al Inicio
            </IonButton>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const isClientStore = user?.role !== "professional" && user?.role !== "staff";
  const visibleCategories = publishCategories;
  const categories = ["Todas", ...visibleCategories];

  const filtered = products.filter((p) => {
    if (!visibleCategories.includes(p.category)) return false;
    const matchCat = selectedCategory === "Todas" || p.category === selectedCategory;
    const matchSearch =
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.sellerName.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          <IonTitle>{isClientStore ? "🛒 Tienda de Productos" : "🛒 Tienda de Productos y Equipos"}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="sp-role-content">
        <main className="sp-role-page" style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px 16px" }}>
          {/* Header con botón para publicar producto */}
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <div>
              <button
                type="button"
                onClick={() => history.push(user?.role === "professional" ? "/profesional/inicio" : "/cliente/inicio")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#ffffff",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  borderRadius: "10px",
                  padding: "6px 12px",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  marginBottom: "10px",
                }}
              >
                <IonIcon icon={arrowBackOutline} /> Volver
              </button>
              <br />
              <span className="sp-role-kicker" style={{ color: "#2563eb", fontWeight: 700 }}>
                {isClientStore ? "MERCADO DE ARTÍCULOS PARA EL HOGAR Y MÁS" : "MERCADO DE HERRAMIENTAS Y SUMINISTROS"}
              </span>
              <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "#0f172a", margin: "4px 0 6px" }}>
                Tienda Oficial Serviprox
              </h1>
              <p style={{ color: "#64748b", margin: 0, fontSize: "0.95rem" }}>
                {isClientStore
                  ? "Compra y publica tecnología, muebles, ropa, electrodomésticos y más artículos."
                  : "Encuentra y publica herramientas, materiales y equipamiento para servicios y proyectos de obra."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "#2563eb",
                color: "#ffffff",
                padding: "12px 20px",
                borderRadius: "12px",
                border: "none",
                fontWeight: 700,
                fontSize: "0.95rem",
                cursor: "pointer",
                boxShadow: "0 10px 15px -3px rgba(37,99,235,0.3)",
                transition: "all 0.15s",
              }}
            >
              <IonIcon icon={addCircleOutline} style={{ fontSize: "1.2rem" }} />
              Publicar Producto
            </button>
          </header>

          {/* Buscador */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "#ffffff",
              borderRadius: "14px",
              padding: "10px 16px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
              marginBottom: "18px",
            }}
          >
            <IonIcon icon={searchOutline} style={{ color: "#94a3b8", fontSize: "1.2rem", marginRight: "10px" }} />
            <input
              type="text"
              placeholder={isClientStore ? "Buscar celulares, muebles, ropa, electrodomésticos..." : "Buscar taladros, escaleras, pintura, cables, EPP..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                fontSize: "0.92rem",
                color: "#0f172a",
                background: "transparent",
              }}
            />
          </div>

          {/* Chips de Categorías */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  fontSize: "0.86rem",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: selectedCategory === cat ? "#0f172a" : "#ffffff",
                  color: selectedCategory === cat ? "#ffffff" : "#475569",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: selectedCategory === cat ? "#0f172a" : "#e2e8f0",
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grilla de Productos */}
          {filtered.length === 0 ? (
            <div
              style={{
                background: "#ffffff",
                padding: "40px 20px",
                borderRadius: "16px",
                border: "1px dashed #cbd5e1",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              <IonIcon icon={cartOutline} style={{ fontSize: "2.5rem", color: "#94a3b8", marginBottom: "10px" }} />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b", margin: "0 0 6px" }}>
                No se encontraron productos en esta categoría
              </h3>
              <p style={{ margin: 0, fontSize: "0.88rem" }}>
                Sé el primero en publicar un producto haciendo clic en "Publicar Producto".
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "20px",
              }}
            >
              {filtered.map((p) => (
                <article
                  key={p.id}
                  style={{
                    background: "#ffffff",
                    borderRadius: "18px",
                    overflow: "hidden",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  {/* Foto de producto */}
                  <div style={{ position: "relative", height: "160px", background: "#f8fafc" }}>
                    <img
                      src={p.image}
                      alt={p.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        top: "12px",
                        left: "12px",
                        background: "rgba(15, 23, 42, 0.75)",
                        backdropFilter: "blur(4px)",
                        color: "#ffffff",
                        padding: "4px 10px",
                        borderRadius: "8px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                      }}
                    >
                      {p.category}
                    </span>
                  </div>

                  {/* Info */}
                  <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                        <span style={{ fontSize: "1.3rem", fontWeight: 900, color: "#2563eb" }}>
                          \${p.price.toLocaleString("es-CO")} COP
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{p.city}</span>
                      </div>

                      <h3 style={{ fontSize: "0.98rem", fontWeight: 700, color: "#0f172a", margin: "0 0 6px", lineHeight: 1.35 }}>
                        {p.title}
                      </h3>
                      <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "0 0 14px", lineHeight: 1.45 }}>
                        {p.description}
                      </p>
                    </div>

                    <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                        <div
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            background: "#e0e7ff",
                            color: "#4338ca",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                          }}
                        >
                          {p.sellerName.slice(0, 1).toUpperCase()}
                        </div>
                        <div style={{ fontSize: "0.76rem" }}>
                          <span style={{ fontWeight: 700, color: "#1e293b", display: "block" }}>{p.sellerName}</span>
                          <span
                            style={{
                              color: p.sellerRole === "Administrador" ? "#2563eb" : "#64748b",
                              fontWeight: p.sellerRole === "Administrador" ? 700 : 400,
                            }}
                          >
                            {p.sellerRole === "Administrador" ? "👑 Oficial Administrador" : p.sellerRole}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setToastMessage(`Contactando a ${p.sellerName} al teléfono ${p.phone}...`)}
                        style={{
                          width: "100%",
                          padding: "9px",
                          borderRadius: "10px",
                          border: "none",
                          background: "#0f172a",
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                        }}
                      >
                        <IonIcon icon={chatbubbleEllipsesOutline} /> Contactar Vendedor
                      </button>
                      {p.isOwner && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteProduct(p)}
                          style={{
                            width: "100%",
                            marginTop: "8px",
                            padding: "8px",
                            borderRadius: "10px",
                            border: "1px solid #fecaca",
                            background: "#fef2f2",
                            color: "#dc2626",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                          }}
                        >
                          <IonIcon icon={trashOutline} /> Eliminar mi publicación
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>

        {/* Modal: Publicar Producto */}
        <IonModal isOpen={modalOpen} onDidDismiss={closePublishModal}>
          <div style={{ padding: "24px", maxWidth: "540px", margin: "0 auto", background: "#ffffff", height: "100%", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Publicar Producto en Tienda
              </h2>
              <button
                type="button"
                onClick={closePublishModal}
                style={{ background: "none", border: "none", fontSize: "1.4rem", color: "#64748b", cursor: "pointer" }}
              >
                <IonIcon icon={closeOutline} />
              </button>
            </div>

            <form onSubmit={handleCreateProduct}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Taladro Bosch GSB 13 RE 650W"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Categoría
                  </label>
                  <select
                    value={selectedPublishCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", background: "#ffffff" }}
                  >
                    {publishCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Precio (COP) *
                  </label>
                  <input
                    type="number"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Descripción detallada
                </label>
                <textarea
                  rows={3}
                  placeholder="Estado, accesorios incluidos, especificaciones..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", resize: "vertical" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Ciudad / Ubicación
                  </label>
                  <input
                    type="text"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Imagen del producto
                </label>
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    minHeight: "140px",
                    border: "2px dashed #cbd5e1",
                    borderRadius: "12px",
                    cursor: "pointer",
                    color: "#64748b",
                    fontSize: "0.85rem",
                    overflow: "hidden",
                    background: "#f8fafc",
                  }}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Vista previa" style={{ width: "100%", maxHeight: "220px", objectFit: "cover" }} />
                  ) : (
                    <>
                      <IonIcon icon={imageOutline} style={{ fontSize: "2rem" }} />
                      Toca para subir una foto (JPG, PNG o WEBP)
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: "none" }}
                    aria-label="Subir imagen del producto"
                  />
                </label>
                {newImage && (
                  <button
                    type="button"
                    onClick={() => setNewImage(null)}
                    style={{ marginTop: "6px", background: "none", border: "none", color: "#dc2626", fontWeight: 700, cursor: "pointer", fontSize: "0.8rem" }}
                  >
                    Quitar imagen
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={publishing}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  cursor: publishing ? "wait" : "pointer",
                  opacity: publishing ? 0.7 : 1,
                  marginBottom: "10px",
                }}
              >
                {publishing ? "Publicando..." : "Publicar Producto Ahora"}
              </button>
              <button
                type="button"
                onClick={closePublishModal}
                style={{
                  width: "100%",
                  padding: "11px",
                  borderRadius: "12px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </form>
          </div>
        </IonModal>

        <IonToast
          isOpen={!!toastMessage}
          message={toastMessage}
          duration={3500}
          color="dark"
          onDidDismiss={() => setToastMessage("")}
        />
      </IonContent>
    </IonPage>
  );
};

export default StorePage;

