import React, { useState, useEffect } from "react";
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
  pricetagOutline,
  chatbubbleEllipsesOutline,
  closeOutline,
  checkmarkCircleOutline,
} from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
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
}

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

  const [products, setProducts] = useState<StoreProduct[]>(() => {
    try {
      const saved = localStorage.getItem("serviprox_store_products");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_STORE_PRODUCTS;
  });

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [modalOpen, setModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const location = useLocation();
  useEffect(() => {
    if (location.search.includes("action=publish")) {
      setModalOpen(true);
    }
  }, [location.search]);

  // Formulario nuevo producto
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Herramientas");
  const [newPrice, setNewPrice] = useState(150000);
  const [newDescription, setNewDescription] = useState("");
  const [newPhone, setNewPhone] = useState("+57 310 123 4567");
  const [newCity, setNewCity] = useState("Bogotá");

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setToastMessage("Por favor ingresa el título del producto.");
      return;
    }

    const created: StoreProduct = {
      id: `prod-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      price: Number(newPrice) || 10000,
      description: newDescription.trim() || "Producto garantizado por el contratista.",
      sellerName:
        user?.role === "staff"
          ? "Administrador Serviprox"
          : user?.first_name
          ? `${user.first_name} ${user.last_name || ""}`
          : user?.email || "Contratista Serviprox",
      sellerRole:
        user?.role === "staff"
          ? "Administrador"
          : user?.role === "professional"
          ? "Contratista"
          : "Cliente",
      phone: newPhone.trim(),
      city: newCity.trim(),
      image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&auto=format&fit=crop&q=80",
      date: "Hoy",
    };

    const updated = [created, ...products];
    setProducts(updated);
    try {
      localStorage.setItem("serviprox_store_products", JSON.stringify(updated));
    } catch {}

    setModalOpen(false);
    setNewTitle("");
    setNewDescription("");
    setToastMessage("¡Producto publicado exitosamente en la tienda!");
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

  const categories = ["Todas", "Herramientas", "Seguridad y EPP", "Materiales", "Repuestos", "Equipos"];

  const filtered = products.filter((p) => {
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
          <IonTitle>🛒 Tienda de Productos y Equipos</IonTitle>
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
              <span className="sp-role-kicker" style={{ color: "#2563eb", fontWeight: 700 }}>
                MERCADO DE HERRAMIENTAS Y SUMINISTROS
              </span>
              <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "#0f172a", margin: "4px 0 6px" }}>
                Tienda Oficial Serviprox
              </h1>
              <p style={{ color: "#64748b", margin: 0, fontSize: "0.95rem" }}>
                Encuentra y publica herramientas, materiales y equipamiento para servicios y proyectos de obra.
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
              placeholder="Buscar taladros, escaleras, pintura, cables, EPP..."
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
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>

        {/* Modal: Publicar Producto */}
        <IonModal isOpen={modalOpen} onDidDismiss={() => setModalOpen(false)}>
          <div style={{ padding: "24px", maxWidth: "540px", margin: "0 auto", background: "#ffffff", height: "100%", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Publicar Producto en Tienda
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
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
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", background: "#ffffff" }}
                  >
                    <option value="Herramientas">Herramientas</option>
                    <option value="Seguridad y EPP">Seguridad y EPP</option>
                    <option value="Materiales">Materiales</option>
                    <option value="Repuestos">Repuestos</option>
                    <option value="Equipos">Equipos</option>
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

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                }}
              >
                Publicar Producto Ahora
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

