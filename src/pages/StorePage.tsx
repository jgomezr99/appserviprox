import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  IonButtons,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonPage,
  IonToolbar,
  IonToast,
  IonModal,
} from "@ionic/react";
import {
  alertCircleOutline,
  arrowBackOutline,
  closeOutline,
  trashOutline,
} from "ionicons/icons";
import {
  Search,
  MapPin,
  Bell,
  User,
  Plus,
  ChevronDown,
  Heart,
  X,
  Phone,
  MessageCircle,
  ShoppingBag,
  ShoppingCart,
  Truck,
  ShieldAlert,
  CreditCard,
  Package,
  Pencil,
  Flag,
  ImagePlus,
  Link2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePlatformSettings } from "../services/platformSettings";
import { useHistory, useLocation } from "react-router-dom";
import { ColombiaCityModal } from "../components/store/ColombiaCityModal";
import { StoreCategoryIcon } from "../components/store/StoreCategoryIcon";
import { MekoShopCarousel } from "../components/store/MekoShopCarousel";
import { StoreDeliveryCheckoutModal } from "../components/store/StoreDeliveryCheckoutModal";
import { StoreCartDrawerModal } from "../components/store/StoreCartDrawerModal";
import { StoreOrderHistoryModal } from "../components/store/StoreOrderHistoryModal";
import { StorePaymentHistoryModal } from "../components/store/StorePaymentHistoryModal";
import {
  MekoCartItem,
  MekoOrder,
  MekoPaymentRecord,
  getMekoCart,
  saveMekoCart,
  getMekoOrders,
  getMekoPayments,
} from "../data/storeStorage";
import {
  ALL_COLOMBIA_OPTION,
  ALL_COLOMBIA_CITIES_FLAT,
  isLocationMatch,
} from "../data/colombiaLocations";
import {
  MAIN_STORE_CATEGORIES,
  EXTRA_STORE_CATEGORIES,
  ALL_PUBLISH_CATEGORIES,
} from "../data/storeCategories";
import {
  storeService,
  compressProductImage,
  fileToDataUrl,
  PLACEHOLDER_PRODUCT_IMAGE,
  getCuratedProductImage,
  isSellerStoreBlocked,
  type StoreProduct,
} from "../services/storeService";
import "./RolePages.css";

export const StorePage: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();
  const location = useLocation();
  const platform = usePlatformSettings();
  const productsEnabled = platform.features.products;

  useEffect(() => {
    document.title = "Meko Shop | Compra y vende productos nuevos y de segunda en Colombia";
  }, []);

  // Comprobar si la tienda del usuario actual está suspendida por moderación administrativa
  const isUserStoreBlocked = Boolean(
    user && (
      isSellerStoreBlocked(user.id, `${user.first_name || ""} ${user.last_name || ""}`.trim()) ||
      isSellerStoreBlocked(user.email) ||
      isSellerStoreBlocked(user.username)
    )
  );

  // Estado de publicaciones
  const [serverProducts, setServerProducts] = useState<StoreProduct[]>([]);

  // Filtros
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [selectedCity, setSelectedCity] = useState("Bogotá");
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Modales
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [selectedProductDetail, setSelectedProductDetail] = useState<StoreProduct | null>(null);
  const [activeGalleryIdx, setActiveGalleryIdx] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | number | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Producto engañoso o información falsa");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);

  // Carrito de compras (Persistente)
  const [cartItems, setCartItems] = useState<MekoCartItem[]>(() => getMekoCart());
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  // Historial de Pedidos y Pagos
  const [orders, setOrders] = useState<MekoOrder[]>(() => getMekoOrders());
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false);

  const [payments, setPayments] = useState<MekoPaymentRecord[]>(() => getMekoPayments());
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);

  // Modal de Pedido a Domicilio con Wompi
  const [deliveryCheckoutOpen, setDeliveryCheckoutOpen] = useState(false);
  const [checkoutItems, setCheckoutItems] = useState<MekoCartItem[]>([]);

  const cartTotalCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const handleAddToCart = (product: StoreProduct) => {
    const existingIndex = cartItems.findIndex((i) => i.productId === product.id);
    let nextCart: MekoCartItem[];
    if (existingIndex >= 0) {
      nextCart = cartItems.map((item, idx) =>
        idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      const newItem: MekoCartItem = {
        id: `cart-${Date.now()}-${product.id}`,
        productId: product.id,
        title: product.title,
        price: product.price,
        image: product.image,
        city: product.city,
        category: product.category,
        quantity: 1,
        sellerName: product.sellerName,
        phone: product.phone,
      };
      nextCart = [newItem, ...cartItems];
    }
    setCartItems(nextCart);
    saveMekoCart(nextCart);
    setToastMessage(`"${product.title}" agregado al carrito de compras.`);
  };

  const handleUpdateCartQty = (productId: string | number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }
    const nextCart = cartItems.map((item) =>
      item.productId === productId ? { ...item, quantity: newQty } : item
    );
    setCartItems(nextCart);
    saveMekoCart(nextCart);
  };

  const handleRemoveFromCart = (productId: string | number) => {
    const nextCart = cartItems.filter((item) => item.productId !== productId);
    setCartItems(nextCart);
    saveMekoCart(nextCart);
  };

  const handleOpenDeliveryForProduct = (product: StoreProduct) => {
    setSelectedProductDetail(null);
    setCheckoutItems([
      {
        id: `checkout-${product.id}`,
        productId: product.id,
        title: product.title,
        price: product.price,
        image: product.image,
        city: product.city,
        category: product.category,
        quantity: 1,
        sellerName: product.sellerName,
        phone: product.phone,
      },
    ]);
    setDeliveryCheckoutOpen(true);
  };

  const handleOpenDeliveryForCart = () => {
    setCartDrawerOpen(false);
    setCheckoutItems([...cartItems]);
    setDeliveryCheckoutOpen(true);
  };

  const handleOrderSuccess = () => {
    setOrders(getMekoOrders());
    setPayments(getMekoPayments());
    // Si la orden contenía los items del carrito, vaciar carrito
    setCartItems([]);
    saveMekoCart([]);
    setToastMessage("¡Pedido confirmado con Wompi! Puedes ver su estado en Historia de Pedidos.");
  };

  // Favoritos guardados localmente
  const [favorites, setFavorites] = useState<Record<string | number, boolean>>(() => {
    try {
      const saved = localStorage.getItem("sp_store_favorites");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleFavorite = (productId: string | number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites((prev) => {
      const next = { ...prev, [productId]: !prev[productId] };
      try {
        localStorage.setItem("sp_store_favorites", JSON.stringify(next));
      } catch {
        // noop
      }
      return next;
    });
  };

  // Toast
  const [toastMessage, setToastMessage] = useState("");
  const [publishing, setPublishing] = useState(false);

  // Carga de productos desde el servidor (SQLite / VM) con imágenes persistentes
  const isUserOwner = useCallback(
    (product: StoreProduct) => {
      if (product.isOwner) return true;
      if (!user) return false;
      if (user.role === "staff" || user.is_staff || user.is_superuser) return true;
      if (product.ownerId && Number(product.ownerId) === Number(user.id)) return true;
      if (
        product.sellerEmail &&
        user.email &&
        product.sellerEmail.toLowerCase() === user.email.toLowerCase()
      ) {
        return true;
      }
      return false;
    },
    [user]
  );

  const loadProducts = useCallback(async () => {
    const { products } = await storeService.listProducts({ includeAll: false });
    const visible = products.filter(
      (p) => p.isActive !== false && p.reviewStatus !== "rechazado"
    );
    setServerProducts(visible);
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  // Si la URL contiene ?action=publish, abrir el modal de publicación
  useEffect(() => {
    if (location.search.includes("action=publish")) {
      setPublishModalOpen(true);
    }
  }, [location.search]);

  // Formulario de publicación / edición de producto
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Tecnología");
  const [newPrice, setNewPrice] = useState(150000);
  const [newStock, setNewStock] = useState(1);
  const [newCondition, setNewCondition] = useState("Nuevo");
  const [newDescription, setNewDescription] = useState("");
  const [newPhone, setNewPhone] = useState("+57 310 123 4567");
  const [newCity, setNewCity] = useState("Bogotá");
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState("");

  const openNewPublishModal = () => {
    if (isUserStoreBlocked) {
      setToastMessage("Tu tienda en Meko Shop se encuentra suspendida por reportes de publicaciones. Solo tu tienda está bloqueada; tu cuenta general y servicios de Serviprox siguen activos.");
      return;
    }
    setEditingProduct(null);
    setNewTitle("");
    setNewCategory("Tecnología");
    setNewPrice(150000);
    setNewStock(1);
    setNewCondition("Nuevo");
    setNewDescription("");
    setNewPhone(user?.phone || "+57 310 123 4567");
    setNewCity(selectedCity === ALL_COLOMBIA_OPTION ? "Bogotá" : selectedCity);
    setGalleryPreviews([]);
    setGalleryFiles([]);
    setImageUrlInput("");
    setPublishModalOpen(true);
  };

  const openEditPublishModal = (product: StoreProduct) => {
    setSelectedProductDetail(null);
    setEditingProduct(product);
    setNewTitle(product.title);
    setNewCategory(product.category || "Otros");
    setNewPrice(product.price);
    setNewStock(product.stock ?? 1);
    setNewCondition(product.condition || "Nuevo");
    setNewDescription(product.description);
    setNewPhone(product.phone || "+57 310 123 4567");
    setNewCity(product.city || "Bogotá");
    const imgs =
      product.images && product.images.length > 0
        ? product.images
        : product.image && product.image !== PLACEHOLDER_PRODUCT_IMAGE
          ? [product.image]
          : [];
    setGalleryPreviews(imgs);
    setGalleryFiles([]);
    setImageUrlInput("");
    setPublishModalOpen(true);
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    const remaining = Math.max(0, 4 - galleryPreviews.length);
    if (remaining === 0) {
      setToastMessage("Puedes cargar máximo 4 imágenes por producto.");
      return;
    }

    const addedUrls: string[] = [];
    const validFiles: File[] = [];
    for (const file of files.slice(0, remaining)) {
      if (!file.type.startsWith("image/")) {
        setToastMessage("Selecciona archivos de imagen válidos (JPG, PNG o WEBP).");
        continue;
      }
      validFiles.push(file);
      try {
        const compressed = await compressProductImage(file);
        const dataUrl = await fileToDataUrl(compressed);
        if (dataUrl) addedUrls.push(dataUrl);
      } catch {
        setToastMessage("No pudimos procesar una de las imágenes. Intenta con otra.");
      }
    }

    if (addedUrls.length > 0) {
      setGalleryPreviews((prev) => Array.from(new Set([...prev, ...addedUrls])).slice(0, 4));
      setGalleryFiles((prev) => [...prev, ...validFiles].slice(0, 4));
    }
  };

  const handleAddImageUrl = () => {
    const clean = imageUrlInput.trim();
    if (!clean) return;
    if (!/^https?:\/\/|^data:image\/|^\/assets\//i.test(clean)) {
      setToastMessage("Ingresa una URL de imagen válida (https://...).");
      return;
    }
    if (galleryPreviews.length >= 4) {
      setToastMessage("Máximo 4 imágenes por producto.");
      return;
    }
    setGalleryPreviews((prev) => Array.from(new Set([...prev, clean])).slice(0, 4));
    setImageUrlInput("");
  };

  const closePublishModal = () => {
    setPublishModalOpen(false);
    setEditingProduct(null);
    setGalleryPreviews([]);
    setGalleryFiles([]);
    setImageUrlInput("");
  };

  const handleCreateOrUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (publishing) return;
    if (isUserStoreBlocked) {
      setToastMessage("Tu tienda en Meko Shop se encuentra suspendida por reportes de publicaciones. Solo tu tienda está bloqueada; tu cuenta general sigue activa.");
      return;
    }
    if (!newTitle.trim()) {
      setToastMessage("Por favor ingresa el título del producto.");
      return;
    }
    if (!user) {
      setToastMessage("Inicia sesión para publicar en la tienda.");
      return;
    }

    setPublishing(true);

    const sellerName =
      `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email || "Usuario";
    const sellerRole: StoreProduct["sellerRole"] =
      user.role === "professional"
        ? "Contratista"
        : user.role === "staff"
          ? "Administrador"
          : "Cliente";

    try {
      if (editingProduct) {
        const updated = await storeService.updateProduct(editingProduct.id, {
          title: newTitle.trim(),
          category: newCategory,
          price: Math.round(Number(newPrice)) || 0,
          stock: Math.max(0, Math.round(Number(newStock)) || 1),
          condition: newCondition,
          description:
            newDescription.trim() || "Producto garantizado por el vendedor en Meko Shop.",
          phone: newPhone.trim(),
          city: newCity.trim() || selectedCity,
          imageUrls: galleryPreviews,
          imageFiles: galleryFiles,
        });
        setServerProducts((current) =>
          current.map((item) => (String(item.id) === String(updated.id) ? updated : item))
        );
        closePublishModal();
        setToastMessage("Publicación actualizada y guardada correctamente.");
      } else {
        const created = await storeService.createProduct({
          title: newTitle.trim(),
          category: newCategory,
          price: Math.round(Number(newPrice)) || 0,
          stock: Math.max(0, Math.round(Number(newStock)) || 1),
          condition: newCondition,
          description:
            newDescription.trim() || "Producto garantizado por el vendedor en Meko Shop.",
          phone: newPhone.trim(),
          city: newCity.trim() || selectedCity,
          sellerName,
          sellerEmail: user.email || "",
          sellerUsername: user.username || "",
          sellerRole,
          ownerId: user.id,
          imageUrls: galleryPreviews,
          imageFiles: galleryFiles,
        });
        setServerProducts((current) => [
          created,
          ...current.filter((p) => String(p.id) !== String(created.id)),
        ]);
        closePublishModal();
        setNewTitle("");
        setNewDescription("");
        setToastMessage("¡Producto publicado y guardado con sus imágenes en Meko Shop!");
      }
    } catch (err) {
      setToastMessage(
        err instanceof Error ? err.message : "No se pudo guardar el producto. Intenta de nuevo."
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteProduct = async (product: StoreProduct) => {
    try {
      await storeService.deleteProduct(product.id);
      setServerProducts((current) =>
        current.filter((item) => String(item.id) !== String(product.id))
      );
      setConfirmDeleteId(null);
      if (selectedProductDetail && String(selectedProductDetail.id) === String(product.id)) {
        setSelectedProductDetail(null);
      }
      setToastMessage("Publicación eliminada correctamente.");
    } catch {
      setToastMessage("No se pudo eliminar la publicación. Inténtalo nuevamente.");
    }
  };

  const handleSubmitClientReport = async (product: StoreProduct) => {
    if (reporting) return;
    if (!reportDetails.trim()) {
      setToastMessage("Describe brevemente el motivo del reporte.");
      return;
    }
    setReporting(true);
    try {
      const reporterName = user
        ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email || "Cliente"
        : "Cliente de Meko Shop";
      await storeService.reportProductAndPublisher(product, {
        reason: reportReason,
        description: reportDetails.trim(),
        priority: "Media",
        hideProduct: false,
        blockPublisher: false,
        reporterName,
        reporterEmail: user?.email || "",
      });
      setReportOpen(false);
      setReportDetails("");
      setToastMessage("Reporte enviado al equipo administrativo de Serviprox.");
      await loadProducts();
    } catch {
      setToastMessage("No pudimos enviar el reporte. Intenta de nuevo.");
    } finally {
      setReporting(false);
    }
  };

  // Filtrado de productos por Categoría, Ciudad (toda Colombia o municipio) y Búsqueda
  const filteredProducts = useMemo(() => {
    return serverProducts.filter((p) => {
      // Filtro por categoría
      const matchCat =
        selectedCategory === "Todos" ||
        selectedCategory === "Todas" ||
        p.category.toLowerCase() === selectedCategory.toLowerCase();

      // Filtro por ciudad (toda Colombia o coincidencia de municipio/departamento)
      const matchCity = isLocationMatch(p.city, selectedCity);

      // Filtro por búsqueda de texto
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.sellerName.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q);

      return matchCat && matchCity && matchSearch;
    });
  }, [serverProducts, selectedCategory, selectedCity, search]);

  // Si la tienda está desactivada por el administrador, mostrar bloqueo
  if (!productsEnabled) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonMenuButton autoHide={false} menu="main-menu" />
            </IonButtons>
            <div style={{ fontWeight: 800, fontSize: "1.1rem", padding: "0 12px" }}>Meko Shop</div>
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
              Meko Shop Desactivada
            </h2>
            <p style={{ color: "#64748b", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "24px" }}>
              La plataforma de compra y venta Meko Shop ha sido desactivada temporalmente por la administración de Serviprox.
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

  const locationDisplayText =
    selectedCity === ALL_COLOMBIA_OPTION ? "Toda Colombia" : `${selectedCity}, Colombia`;

  return (
    <IonPage>
      {/* HEADER SUPERIOR CON LOGO MEKO SHOP, BUSCADOR Y SELECTOR DE CIUDAD EN TODA COLOMBIA */}
      <IonHeader className="ion-no-border" style={{ background: "#ffffff", borderBottom: "1px solid #f1f5f9" }}>
        <IonToolbar style={{ "--background": "#ffffff", padding: "6px 12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              width: "100%",
              maxWidth: "1200px",
              margin: "0 auto",
            }}
          >
            {/* Botón de Menú */}
            <div style={{ display: "flex", alignItems: "center" }}>
              <IonButtons slot="start">
                <IonMenuButton autoHide={false} menu="main-menu" />
              </IonButtons>
            </div>

            {/* Logo de Marca Meko Shop */}
            <div
              onClick={() => {
                setSelectedCategory("Todos");
                setSelectedCity(ALL_COLOMBIA_OPTION);
                setSearch("");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: "12px",
                userSelect: "none",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
              title="Meko Shop Colombia"
            >
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 3px 8px rgba(37,99,235,0.3)",
                  flexShrink: 0,
                }}
              >
                <ShoppingBag size={18} strokeWidth={2.4} />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  lineHeight: 1,
                }}
              >
                <span
                  style={{
                    fontSize: "1.15rem",
                    fontWeight: 900,
                    color: "#0f172a",
                    letterSpacing: "-0.03em",
                  }}
                >
                  Meko <span style={{ color: "#2563eb" }}>Shop</span>
                </span>
                <span
                  style={{
                    fontSize: "0.6rem",
                    color: "#64748b",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginTop: "2px",
                  }}
                >
                  Colombia
                </span>
              </div>
            </div>

            {/* Barra de Búsqueda Principal */}
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                background: "#f8fafc",
                borderRadius: "30px",
                padding: "8px 16px",
                border: "1px solid #e2e8f0",
                gap: "10px",
                transition: "all 0.2s",
              }}
            >
              <Search size={18} color="#64748b" />
              <input
                type="text"
                placeholder="Buscar productos, marcas o categorías..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: "0.9rem",
                  color: "#0f172a",
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Selector de Ciudad (Toda Colombia) */}
            <button
              type="button"
              onClick={() => setCityModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: "24px",
                padding: "8px 14px",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#1e293b",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "background 0.15s",
              }}
            >
              <MapPin size={16} color="#2563eb" />
              <span>{locationDisplayText}</span>
              <ChevronDown size={14} color="#64748b" />
            </button>

            {/* Botón Carrito de Compras (SOLO ICONO) con badge */}
            <button
              type="button"
              onClick={() => setCartDrawerOpen(true)}
              aria-label="Carrito de compras"
              title="Carrito de compras"
              style={{
                position: "relative",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#1e293b",
                flexShrink: 0,
                transition: "all 0.15s",
              }}
            >
              <ShoppingCart size={19} />
              {cartTotalCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "-3px",
                    right: "-3px",
                    minWidth: "18px",
                    height: "18px",
                    borderRadius: "10px",
                    background: "#2563eb",
                    color: "#ffffff",
                    fontSize: "0.68rem",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 4px",
                    border: "2px solid #ffffff",
                  }}
                >
                  {cartTotalCount}
                </span>
              )}
            </button>

            {/* Icono de Notificaciones con punto rojo */}
            <button
              type="button"
              onClick={() => setToastMessage("No tienes notificaciones pendientes en Meko Shop.")}
              aria-label="Notificaciones"
              style={{
                position: "relative",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#334155",
              }}
            >
              <Bell size={18} />
              <span
                style={{
                  position: "absolute",
                  top: "9px",
                  right: "9px",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#ef4444",
                  border: "2px solid #ffffff",
                }}
              />
            </button>

            {/* Avatar / Perfil de usuario */}
            <button
              type="button"
              onClick={() => history.push(user ? (user.role === "professional" ? "/profesional/inicio" : "/cliente/inicio") : "/login")}
              aria-label="Perfil"
              style={{
                background: "#e0e7ff",
                border: "1px solid #c7d2fe",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#4338ca",
                fontWeight: 700,
                fontSize: "0.9rem",
              }}
            >
              {user?.first_name ? user.first_name[0].toUpperCase() : <User size={18} />}
            </button>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="sp-role-content" style={{ "--background": "#f8fafc" }}>
        <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
          {/* BARRA SUPERIOR DE ACCESOS RÁPIDOS: HISTORIA DE PEDIDOS Y PAGOS */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              marginBottom: "14px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              {/* Botón Historia de Pedidos */}
              <button
                type="button"
                onClick={() => setOrderHistoryOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "20px",
                  padding: "7px 14px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#1e293b",
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  transition: "all 0.15s",
                }}
              >
                <Package size={15} color="#2563eb" />
                <span>Historia de pedidos</span>
                {orders.length > 0 && (
                  <span
                    style={{
                      background: "#eff6ff",
                      color: "#2563eb",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      padding: "1px 6px",
                      borderRadius: "10px",
                    }}
                  >
                    {orders.length}
                  </span>
                )}
              </button>

              {/* Botón Historia Pago Productos */}
              <button
                type="button"
                onClick={() => setPaymentHistoryOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "20px",
                  padding: "7px 14px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#1e293b",
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  transition: "all 0.15s",
                }}
              >
                <CreditCard size={15} color="#16a34a" />
                <span>Historia pago productos</span>
                {payments.length > 0 && (
                  <span
                    style={{
                      background: "#f0fdf4",
                      color: "#16a34a",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      padding: "1px 6px",
                      borderRadius: "10px",
                    }}
                  >
                    {payments.length}
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={openNewPublishModal}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "20px",
                padding: "8px 16px",
                fontSize: "0.84rem",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 3px 10px rgba(37,99,235,0.25)",
              }}
            >
              <Plus size={16} /> Publicar producto
            </button>
          </div>

          {/* CARRUSEL OFICIAL MEKO SHOP: BANNERS 1, 2, 3 Y 4 */}
          <MekoShopCarousel
            onPublishClick={openNewPublishModal}
            onExploreClick={() => {
              const el = document.getElementById("publicaciones-recientes-section");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
          />

          {/* SECCIÓN CATEGORÍAS */}
          <section style={{ marginBottom: "32px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Categorías
              </h2>
              <button
                type="button"
                onClick={() => setShowAllCategories((prev) => !prev)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#2563eb",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {showAllCategories ? "Mostrar menos ↑" : "Ver todas →"}
              </button>
            </div>

            {/* Fila interactiva de Categorías con colores y estilos idénticos al diseño */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: showAllCategories
                  ? "repeat(auto-fill, minmax(100px, 1fr))"
                  : "repeat(8, 1fr)",
                gap: "10px",
                overflowX: "auto",
                scrollbarWidth: "none",
                paddingBottom: "4px",
              }}
            >
              {(showAllCategories
                ? [...MAIN_STORE_CATEGORIES, ...EXTRA_STORE_CATEGORIES]
                : MAIN_STORE_CATEGORIES
              ).map((cat) => {
                const isSelected = selectedCategory.toLowerCase() === cat.id.toLowerCase();
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      padding: "12px 6px 10px",
                      minWidth: showAllCategories ? "90px" : "80px",
                      borderRadius: "16px",
                      background: cat.bgColor,
                      border: isSelected ? "2px solid #0f172a" : `1px solid ${cat.borderColor}`,
                      cursor: "pointer",
                      transition: "transform 0.15s, box-shadow 0.15s",
                      boxShadow: isSelected
                        ? "0 4px 12px rgba(15,23,42,0.15)"
                        : "0 1px 3px rgba(0,0,0,0.02)",
                      transform: isSelected ? "translateY(-2px)" : "none",
                    }}
                  >
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <StoreCategoryIcon name={cat.iconName} size={24} color={cat.iconColor} />
                    </div>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: isSelected ? 800 : 700,
                        color: cat.textColor,
                        textAlign: "center",
                        lineHeight: 1.15,
                      }}
                    >
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* BARRA DE FILTROS ACTIVOS */}
          {(selectedCategory !== "Todos" || selectedCity !== ALL_COLOMBIA_OPTION || search) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "8px",
                padding: "10px 16px",
                background: "#ffffff",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                marginBottom: "20px",
              }}
            >
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#64748b" }}>
                Filtros activos:
              </span>

              {selectedCategory !== "Todos" && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    padding: "4px 10px",
                    borderRadius: "16px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                  }}
                >
                  Categoría: {selectedCategory}
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("Todos")}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8" }}
                  >
                    ×
                  </button>
                </span>
              )}

              {selectedCity !== ALL_COLOMBIA_OPTION && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "#f0fdf4",
                    color: "#15803d",
                    padding: "4px 10px",
                    borderRadius: "16px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                  }}
                >
                  📍 {selectedCity}
                  <button
                    type="button"
                    onClick={() => setSelectedCity(ALL_COLOMBIA_OPTION)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#15803d" }}
                  >
                    ×
                  </button>
                </span>
              )}

              {search && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "#f1f5f9",
                    color: "#334155",
                    padding: "4px 10px",
                    borderRadius: "16px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                  }}
                >
                  Búsqueda: "{search}"
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#334155" }}
                  >
                    ×
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("Todos");
                  setSelectedCity(ALL_COLOMBIA_OPTION);
                  setSearch("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#ef4444",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  marginLeft: "auto",
                }}
              >
                Limpiar filtros
              </button>
            </div>
          )}

          {/* SECCIÓN PUBLICACIONES RECIENTES */}
          <section id="publicaciones-recientes-section">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: "16px",
              }}
            >
              <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Publicaciones recientes
              </h2>
              <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>
                {filteredProducts.length} {filteredProducts.length === 1 ? "producto" : "productos"} en{" "}
                <strong>{selectedCity}</strong>
              </span>
            </div>

            {filteredProducts.length === 0 ? (
              <div
                style={{
                  background: "#ffffff",
                  padding: "48px 24px",
                  borderRadius: "20px",
                  border: "1px dashed #cbd5e1",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "#eff6ff",
                    color: "#2563eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                  }}
                >
                  <ShoppingBag size={28} />
                </div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: "0 0 8px" }}>
                  No hay productos que coincidan con tus filtros
                </h3>
                <p style={{ color: "#64748b", fontSize: "0.92rem", margin: "0 0 20px" }}>
                  Intenta cambiar la categoría o selecciona <strong>Toda Colombia</strong> para ver ofertas en todo el país.
                </p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCity(ALL_COLOMBIA_OPTION);
                      setSelectedCategory("Todos");
                      setSearch("");
                    }}
                    style={{
                      background: "#2563eb",
                      color: "#ffffff",
                      border: "none",
                      padding: "10px 20px",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Ver en Toda Colombia
                  </button>
                  <button
                    type="button"
                    onClick={openNewPublishModal}
                    style={{
                      background: "#f1f5f9",
                      color: "#1e293b",
                      border: "1px solid #cbd5e1",
                      padding: "10px 20px",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Publicar producto aquí
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(215px, 1fr))",
                  gap: "16px",
                }}
              >
                {filteredProducts.map((p) => {
                  const isFav = !!favorites[p.id];
                  const ownerFlag = isUserOwner(p);
                  return (
                    <article
                      key={p.id}
                      onClick={() => {
                        setActiveGalleryIdx(0);
                        setConfirmDeleteId(null);
                        setReportOpen(false);
                        setReportDetails("");
                        setSelectedProductDetail(p);
                      }}
                      style={{
                        background: "#ffffff",
                        borderRadius: "16px",
                        overflow: "hidden",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
                        display: "flex",
                        flexDirection: "column",
                        cursor: "pointer",
                        transition: "transform 0.15s, box-shadow 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-3px)";
                        e.currentTarget.style.boxShadow = "0 10px 20px -4px rgba(15,23,42,0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "none";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(15, 23, 42, 0.04)";
                      }}
                    >
                      {/* Imagen limpia de producto */}
                      <div
                        style={{
                          position: "relative",
                          aspectRatio: "4 / 3",
                          background: "#f8fafc",
                          overflow: "hidden",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <img
                          src={p.image || getCuratedProductImage(p.title, p.category)}
                          alt={p.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = getCuratedProductImage(p.title, p.category);
                          }}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />

                        {(p.images?.length || 0) > 1 && (
                          <span
                            style={{
                              position: "absolute",
                              bottom: "8px",
                              left: "8px",
                              background: "rgba(15,23,42,0.75)",
                              color: "#ffffff",
                              borderRadius: "6px",
                              padding: "2px 7px",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {p.images?.length} fotos
                          </span>
                        )}

                        {ownerFlag && (
                          <span
                            style={{
                              position: "absolute",
                              top: "8px",
                              left: "8px",
                              background: "rgba(37,99,235,0.92)",
                              color: "#ffffff",
                              borderRadius: "6px",
                              padding: "2px 8px",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                            }}
                          >
                            Tu publicación
                          </span>
                        )}

                        {/* Botón Favorito / Corazón */}
                        <button
                          type="button"
                          onClick={(e) => toggleFavorite(p.id, e)}
                          aria-label={isFav ? "Quitar de favoritos" : "Guardar en favoritos"}
                          style={{
                            position: "absolute",
                            top: "8px",
                            right: "8px",
                            background: "#ffffff",
                            border: "1px solid #e2e8f0",
                            borderRadius: "50%",
                            width: "30px",
                            height: "30px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            boxShadow: "0 2px 5px rgba(0,0,0,0.08)",
                          }}
                        >
                          <Heart
                            size={15}
                            strokeWidth={2}
                            color={isFav ? "#ef4444" : "#475569"}
                            fill={isFav ? "#ef4444" : "none"}
                          />
                        </button>
                      </div>

                      {/* Información del Producto */}
                      <div
                        style={{
                          padding: "12px 14px 14px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          flex: 1,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              color: "#64748b",
                              marginBottom: "4px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {p.category} · {p.condition || "Nuevo"}
                          </div>
                          <h3
                            style={{
                              fontSize: "0.94rem",
                              fontWeight: 700,
                              color: "#0f172a",
                              margin: "0 0 6px",
                              lineHeight: 1.3,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                            title={p.title}
                          >
                            {p.title}
                          </h3>

                          <div
                            style={{
                              fontSize: "1.06rem",
                              fontWeight: 800,
                              color: "#15803d",
                              marginBottom: "10px",
                              letterSpacing: "-0.01em",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            ${p.price.toLocaleString("es-CO")} COP
                          </div>

                          {/* Perfil del cliente/vendedor publicador */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              marginBottom: "8px",
                              fontSize: "0.75rem",
                              color: "#334155",
                            }}
                          >
                            <div
                              style={{
                                width: "18px",
                                height: "18px",
                                borderRadius: "50%",
                                background: "#eff6ff",
                                color: "#2563eb",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.65rem",
                                fontWeight: 800,
                                flexShrink: 0,
                              }}
                            >
                              {(p.sellerName || "U").charAt(0).toUpperCase()}
                            </div>
                            <span
                              style={{
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={`${p.sellerName || "Usuario"} · ${p.sellerRole || "Cliente"}`}
                            >
                              {p.sellerName || "Usuario Serviprox"}
                              <span style={{ color: "#64748b", fontWeight: 500, fontSize: "0.7rem", marginLeft: "4px" }}>
                                ({p.sellerRole === "Contratista" ? "Profesional" : p.sellerRole || "Cliente"})
                              </span>
                            </span>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: "0.76rem",
                            color: "#64748b",
                            borderTop: "1px solid #f1f5f9",
                            paddingTop: "8px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <MapPin size={13} color="#64748b" />
                            <span style={{ fontWeight: 600 }}>{p.city}</span>
                          </div>
                          <span style={{ fontVariantNumeric: "tabular-nums", color: "#475569", fontWeight: 600 }}>
                            Stock: {p.stock ?? 1}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        {/* MODAL PARA SELECCIONAR UBICACIÓN (COLOMBIA COMPLETA) */}
        <ColombiaCityModal
          isOpen={cityModalOpen}
          selectedCity={selectedCity}
          onSelectCity={(city) => setSelectedCity(city)}
          onClose={() => setCityModalOpen(false)}
        />

        {/* MODAL DETALLES DEL PRODUCTO */}
        <IonModal
          isOpen={!!selectedProductDetail}
          onDidDismiss={() => {
            setSelectedProductDetail(null);
            setConfirmDeleteId(null);
            setReportOpen(false);
          }}
        >
          {selectedProductDetail && (() => {
            const gallery =
              selectedProductDetail.images && selectedProductDetail.images.length > 0
                ? selectedProductDetail.images
                : [selectedProductDetail.image || PLACEHOLDER_PRODUCT_IMAGE];
            const currentImg = gallery[activeGalleryIdx] || gallery[0] || PLACEHOLDER_PRODUCT_IMAGE;
            const ownerFlag = isUserOwner(selectedProductDetail);
            const cleanPhone = selectedProductDetail.phone.replace(/[^0-9]/g, "");
            const waHref = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
              `¡Hola ${selectedProductDetail.sellerName}! Me interesa tu publicación "${selectedProductDetail.title}" vista en Meko Shop (${selectedProductDetail.city}). ¿Sigue disponible?`
            )}`;

            return (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  background: "#ffffff",
                  maxWidth: "600px",
                  width: "100%",
                  margin: "0 auto",
                }}
              >
                {/* Header modal */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 20px",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <div style={{ fontSize: "0.82rem", color: "#475569", fontWeight: 600 }}>
                    {selectedProductDetail.category} · {selectedProductDetail.city} ·{" "}
                    {selectedProductDetail.condition || "Nuevo"}
                  </div>
                  <button
                    type="button"
                    aria-label="Cerrar detalle"
                    onClick={() => setSelectedProductDetail(null)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  >
                    <IonIcon icon={closeOutline} style={{ fontSize: "1.5rem" }} />
                  </button>
                </div>

                {/* Contenido scrolleable */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                  {/* Imagen principal del producto */}
                  <div
                    style={{
                      height: "260px",
                      background: "#f8fafc",
                      borderRadius: "14px",
                      overflow: "hidden",
                      marginBottom: gallery.length > 1 ? "10px" : "18px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <img
                      src={currentImg}
                      alt={selectedProductDetail.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = getCuratedProductImage(
                          selectedProductDetail.title,
                          selectedProductDetail.category
                        );
                      }}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </div>

                  {gallery.length > 1 && (
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginBottom: "18px",
                        overflowX: "auto",
                      }}
                    >
                      {gallery.map((imgUrl, idx) => (
                        <button
                          key={`${imgUrl.slice(0, 32)}-${idx}`}
                          type="button"
                          onClick={() => setActiveGalleryIdx(idx)}
                          style={{
                            width: "60px",
                            height: "48px",
                            padding: 0,
                            borderRadius: "8px",
                            overflow: "hidden",
                            border:
                              idx === activeGalleryIdx
                                ? "2px solid #2563eb"
                                : "1px solid #cbd5e1",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src={imgUrl}
                            alt={`Miniatura ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = getCuratedProductImage(
                                selectedProductDetail.title,
                                selectedProductDetail.category
                              );
                            }}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Título, Precio y Stock */}
                  <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a", margin: "0 0 8px" }}>
                    {selectedProductDetail.title}
                  </h2>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: "12px",
                      marginBottom: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "1.55rem",
                        fontWeight: 900,
                        color: "#15803d",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      ${selectedProductDetail.price.toLocaleString("es-CO")} COP
                    </div>
                    <span
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        color: "#475569",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      Unidades disponibles: {selectedProductDetail.stock ?? 1}
                    </span>
                  </div>

                  {/* Ubicación */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "#475569",
                      fontSize: "0.88rem",
                      marginBottom: "16px",
                    }}
                  >
                    <MapPin size={18} color="#2563eb" />
                    <span>
                      Ubicación: <strong>{selectedProductDetail.city}, Colombia</strong>
                    </span>
                  </div>

                  {/* Descripción */}
                  <div style={{ marginBottom: "20px" }}>
                    <h4 style={{ fontSize: "0.88rem", fontWeight: 700, color: "#334155", margin: "0 0 6px" }}>
                      Descripción del producto
                    </h4>
                    <p style={{ fontSize: "0.9rem", color: "#475569", lineHeight: 1.6, margin: 0 }}>
                      {selectedProductDetail.description}
                    </p>
                  </div>

                  {/* Datos del Vendedor */}
                  <div
                    style={{
                      padding: "14px 16px",
                      background: "#f8fafc",
                      borderRadius: "14px",
                      border: "1px solid #e2e8f0",
                      marginBottom: "20px",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        color: "#64748b",
                        marginBottom: "6px",
                      }}
                    >
                      Publicado por
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          background: "#e0e7ff",
                          color: "#3730a3",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: "0.95rem",
                        }}
                      >
                        {selectedProductDetail.sellerName.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <span style={{ fontWeight: 800, color: "#0f172a", display: "block", fontSize: "0.95rem" }}>
                          {selectedProductDetail.sellerName}
                        </span>
                        <span
                          style={{
                            fontSize: "0.78rem",
                            color:
                              selectedProductDetail.sellerRole === "Administrador" ? "#2563eb" : "#64748b",
                            fontWeight: selectedProductDetail.sellerRole === "Administrador" ? 700 : 500,
                            display: "block",
                          }}
                        >
                          {selectedProductDetail.sellerRole === "Administrador"
                            ? "Tienda Oficial Meko Shop"
                            : selectedProductDetail.sellerRole || "Cliente"}
                        </span>
                        {selectedProductDetail.sellerEmail && (
                          <span style={{ fontSize: "0.76rem", color: "#475569", display: "block", marginTop: "2px" }}>
                            ✉️ {selectedProductDetail.sellerEmail}
                          </span>
                        )}
                        {selectedProductDetail.phone && (
                          <span style={{ fontSize: "0.76rem", color: "#475569", display: "block", marginTop: "1px" }}>
                            📞 {selectedProductDetail.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* AVISO DE SEGURIDAD PARA EL CLIENTE */}
                  <div
                    style={{
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      borderRadius: "14px",
                      padding: "14px 16px",
                      marginBottom: "20px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "#b45309",
                        fontWeight: 800,
                        fontSize: "0.88rem",
                        marginBottom: "6px",
                      }}
                    >
                      <ShieldAlert size={18} color="#d97706" />
                      <span>Aviso de Seguridad para el Cliente</span>
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: "18px",
                        fontSize: "0.8rem",
                        color: "#92400e",
                        lineHeight: 1.55,
                      }}
                    >
                      <li>Nunca envíes dinero por adelantado a cuentas desconocidas sin verificar la publicación.</li>
                      <li>
                        Usa nuestro botón oficial de <strong>"Pedido a Domicilio con Wompi"</strong> donde tus fondos quedan custodiados.
                      </li>
                      <li>Revisa el funcionamiento y estado físico del artículo antes de finalizar la compra.</li>
                    </ul>
                  </div>

                  {/* Botones de Acción */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={() => handleOpenDeliveryForProduct(selectedProductDetail)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                        color: "#ffffff",
                        border: "none",
                        padding: "14px",
                        borderRadius: "14px",
                        fontWeight: 900,
                        fontSize: "0.98rem",
                        cursor: "pointer",
                        boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
                      }}
                    >
                      <Truck size={20} /> Pedido a Domicilio · Pagar con Wompi
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddToCart(selectedProductDetail)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        border: "1px solid #bfdbfe",
                        padding: "12px",
                        borderRadius: "14px",
                        fontWeight: 800,
                        fontSize: "0.92rem",
                        cursor: "pointer",
                      }}
                    >
                      <ShoppingCart size={18} /> Agregar al Carrito de Compras
                    </button>

                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        background: "#16a34a",
                        color: "#ffffff",
                        textDecoration: "none",
                        padding: "13px",
                        borderRadius: "14px",
                        fontWeight: 800,
                        fontSize: "0.95rem",
                        boxShadow: "0 4px 12px rgba(22,163,74,0.25)",
                      }}
                    >
                      <MessageCircle size={20} /> Contactar por WhatsApp ({selectedProductDetail.phone})
                    </a>

                    <a
                      href={`tel:${selectedProductDetail.phone}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        background: "#0f172a",
                        color: "#ffffff",
                        textDecoration: "none",
                        padding: "12px",
                        borderRadius: "12px",
                        fontWeight: 700,
                        fontSize: "0.9rem",
                      }}
                    >
                      <Phone size={18} /> Llamar al vendedor
                    </a>

                    {ownerFlag && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
                        <button
                          type="button"
                          onClick={() => openEditPublishModal(selectedProductDetail)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            background: "#f8fafc",
                            border: "1px solid #cbd5e1",
                            color: "#0f172a",
                            padding: "10px",
                            borderRadius: "12px",
                            fontWeight: 700,
                            fontSize: "0.86rem",
                            cursor: "pointer",
                          }}
                        >
                          <Pencil size={15} /> Editar publicación e imágenes
                        </button>

                        {confirmDeleteId === selectedProductDetail.id ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              background: "#fef2f2",
                              border: "1px solid #fecaca",
                              padding: "10px",
                              borderRadius: "12px",
                            }}
                          >
                            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#991b1b", flex: 1 }}>
                              ¿Confirmas eliminar este producto?
                            </span>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: "8px",
                                border: "1px solid #cbd5e1",
                                background: "#ffffff",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              No
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteProduct(selectedProductDetail)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: "8px",
                                border: "none",
                                background: "#dc2626",
                                color: "#ffffff",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Sí, eliminar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(selectedProductDetail.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                              background: "#fef2f2",
                              border: "1px solid #fecaca",
                              color: "#dc2626",
                              padding: "10px",
                              borderRadius: "12px",
                              fontWeight: 700,
                              fontSize: "0.85rem",
                              cursor: "pointer",
                            }}
                          >
                            <IonIcon icon={trashOutline} /> Eliminar publicación
                          </button>
                        )}
                      </div>
                    )}

                    {/* Reportar publicación / cliente vendedor */}
                    <div style={{ marginTop: "6px", borderTop: "1px solid #f1f5f9", paddingTop: "10px" }}>
                      {!reportOpen ? (
                        <button
                          type="button"
                          onClick={() => setReportOpen(true)}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            background: "transparent",
                            border: "1px dashed #cbd5e1",
                            color: "#475569",
                            padding: "9px",
                            borderRadius: "10px",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            cursor: "pointer",
                          }}
                        >
                          <Flag size={14} color="#dc2626" /> Reportar publicación o vendedor
                        </button>
                      ) : (
                        <div
                          style={{
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            borderRadius: "12px",
                            padding: "12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#0f172a" }}>
                            Reportar a {selectedProductDetail.sellerName} ante Moderación
                          </div>
                          <select
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: "8px",
                              border: "1px solid #cbd5e1",
                              background: "#ffffff",
                              fontSize: "0.82rem",
                            }}
                          >
                            <option value="Producto engañoso o información falsa">Producto engañoso o información falsa</option>
                            <option value="Imágenes no corresponden al producto">Imágenes no corresponden al producto</option>
                            <option value="Posible estafa o cobro irregular">Posible estafa o cobro irregular</option>
                            <option value="Artículo prohibido o inapropiado">Artículo prohibido o inapropiado</option>
                            <option value="Otro motivo">Otro motivo</option>
                          </select>
                          <textarea
                            rows={2}
                            placeholder="Cuéntanos qué sucede con esta publicación..."
                            value={reportDetails}
                            onChange={(e) => setReportDetails(e.target.value)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: "8px",
                              border: "1px solid #cbd5e1",
                              fontSize: "0.82rem",
                              resize: "vertical",
                            }}
                          />
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={() => setReportOpen(false)}
                              style={{
                                flex: 1,
                                padding: "8px",
                                borderRadius: "8px",
                                border: "1px solid #cbd5e1",
                                background: "#ffffff",
                                fontSize: "0.8rem",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={reporting}
                              onClick={() => void handleSubmitClientReport(selectedProductDetail)}
                              style={{
                                flex: 2,
                                padding: "8px",
                                borderRadius: "8px",
                                border: "none",
                                background: "#dc2626",
                                color: "#ffffff",
                                fontSize: "0.8rem",
                                fontWeight: 700,
                                cursor: reporting ? "wait" : "pointer",
                              }}
                            >
                              {reporting ? "Enviando reporte..." : "Enviar reporte a Admin"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </IonModal>

        {/* MODAL: PUBLICAR O EDITAR PRODUCTO */}
        <IonModal isOpen={publishModalOpen} onDidDismiss={closePublishModal}>
          <div
            style={{
              padding: "24px",
              maxWidth: "560px",
              width: "100%",
              margin: "0 auto",
              background: "#ffffff",
              height: "100%",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  {editingProduct ? "Editar Publicación en Meko Shop" : "Publicar Producto en Meko Shop"}
                </h2>
                <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                  Sube hasta 4 imágenes nítidas para que tu publicación destaque y se guarde en la tienda
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar formulario"
                onClick={closePublishModal}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                <IonIcon icon={closeOutline} style={{ fontSize: "1.3rem" }} />
              </button>
            </div>

            {isUserStoreBlocked && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "12px",
                  padding: "14px 16px",
                  marginBottom: "18px",
                  color: "#991b1b",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: "0.92rem", marginBottom: "4px" }}>
                  🚫 Tu tienda en Meko Shop se encuentra suspendida
                </div>
                <div style={{ fontSize: "0.82rem", lineHeight: 1.5 }}>
                  Un administrador ha pausado tu tienda debido a reportes en tus publicaciones. Solo tu tienda está bloqueada; tu cuenta general para contratar servicios, solicitar soporte y tus reservas en Serviprox continúan 100% activas.
                </div>
              </div>
            )}

            <form onSubmit={handleCreateOrUpdateProduct}>
              {/* Título */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Título del Producto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Portátil Lenovo i5 / Sofá de 3 puestos / Taladro Bosch..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              {/* Categoría y Precio */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Categoría *
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      fontSize: "0.88rem",
                      fontWeight: 600,
                    }}
                  >
                    {ALL_PUBLISH_CATEGORIES.map((cat) => (
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
                    min={1000}
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.9rem",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />
                </div>
              </div>

              {/* Estado y Stock */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Estado del producto
                  </label>
                  <select
                    value={newCondition}
                    onChange={(e) => setNewCondition(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      fontSize: "0.88rem",
                      fontWeight: 600,
                    }}
                  >
                    <option value="Nuevo">Nuevo</option>
                    <option value="Como nuevo">Como nuevo</option>
                    <option value="Usado">Usado</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Cantidad disponible (Stock)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={newStock}
                    onChange={(e) => setNewStock(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.9rem",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />
                </div>
              </div>

              {/* Ubicación / Ciudad en Colombia */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Ciudad / Ubicación en Colombia *
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <select
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "11px 14px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      fontSize: "0.88rem",
                      fontWeight: 600,
                    }}
                  >
                    <option value={ALL_COLOMBIA_OPTION}>Toda Colombia (Envíos a todo el país)</option>
                    <optgroup label="Principales Ciudades">
                      <option value="Bogotá">Bogotá D.C.</option>
                      <option value="Medellín">Medellín (Antioquia)</option>
                      <option value="Cali">Cali (Valle)</option>
                      <option value="Barranquilla">Barranquilla (Atlántico)</option>
                      <option value="Cartagena">Cartagena (Bolívar)</option>
                      <option value="Bucaramanga">Bucaramanga (Santander)</option>
                      <option value="Pereira">Pereira (Risaralda)</option>
                      <option value="Manizales">Manizales (Caldas)</option>
                      <option value="Santa Marta">Santa Marta (Magdalena)</option>
                      <option value="Cúcuta">Cúcuta (Norte de Santander)</option>
                      <option value="Ibagué">Ibagué (Tolima)</option>
                      <option value="Pasto">Pasto (Nariño)</option>
                      <option value="Villavicencio">Villavicencio (Meta)</option>
                      <option value="Neiva">Neiva (Huila)</option>
                      <option value="Armenia">Armenia (Quindío)</option>
                      <option value="Montería">Montería (Córdoba)</option>
                      <option value="Valledupar">Valledupar (Cesar)</option>
                      <option value="Popayán">Popayán (Cauca)</option>
                      <option value="Sincelejo">Sincelejo (Sucre)</option>
                      <option value="Tunja">Tunja (Boyacá)</option>
                      <option value="Riohacha">Riohacha (La Guajira)</option>
                    </optgroup>
                    <optgroup label="Todos los Municipios de Colombia">
                      {ALL_COLOMBIA_CITIES_FLAT.map(({ city, department }) => (
                        <option key={`${city}-${department}`} value={city}>
                          {city} ({department})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Teléfono / WhatsApp */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Teléfono / WhatsApp de Contacto *
                </label>
                <input
                  type="text"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              {/* Descripción */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Descripción detallada
                </label>
                <textarea
                  rows={3}
                  placeholder="Estado del producto, accesorios, garantía, condiciones de entrega..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.88rem",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Imágenes del Producto (archivo o URL, hasta 4) */}
              <div style={{ marginBottom: "22px" }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Imágenes del producto ({galleryPreviews.length}/4)
                </label>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    minHeight: "104px",
                    border: "2px dashed #cbd5e1",
                    borderRadius: "12px",
                    cursor: "pointer",
                    color: "#475569",
                    fontSize: "0.84rem",
                    background: "#f8fafc",
                    padding: "12px",
                  }}
                >
                  <ImagePlus size={26} color="#2563eb" />
                  <span style={{ fontWeight: 600 }}>
                    Subir fotos desde tu dispositivo (JPG, PNG o WEBP)
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    Se optimizan y guardan directamente en la tienda
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    style={{ display: "none" }}
                    aria-label="Subir imágenes del producto"
                  />
                </label>

                {/* Opción agregar imagen por enlace */}
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      padding: "0 10px",
                      background: "#ffffff",
                    }}
                  >
                    <Link2 size={15} color="#64748b" />
                    <input
                      type="url"
                      placeholder="O pega URL de imagen (https://...)"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      style={{
                        flex: 1,
                        border: "none",
                        outline: "none",
                        padding: "9px 0",
                        fontSize: "0.84rem",
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddImageUrl}
                    style={{
                      padding: "0 14px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      background: "#f1f5f9",
                      color: "#1e293b",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                    }}
                  >
                    Añadir URL
                  </button>
                </div>

                {/* Miniaturas con opción de eliminar o establecer como portada */}
                {galleryPreviews.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: "8px",
                      marginTop: "10px",
                    }}
                  >
                    {galleryPreviews.map((url, idx) => (
                      <div
                        key={`${url.slice(0, 28)}-${idx}`}
                        style={{
                          position: "relative",
                          aspectRatio: "4 / 3",
                          borderRadius: "10px",
                          overflow: "hidden",
                          border: idx === 0 ? "2px solid #2563eb" : "1px solid #cbd5e1",
                          background: "#f8fafc",
                        }}
                      >
                        <img
                          src={url}
                          alt={`Vista previa ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                        {idx === 0 ? (
                          <span
                            style={{
                              position: "absolute",
                              bottom: "4px",
                              left: "4px",
                              background: "#2563eb",
                              color: "#ffffff",
                              fontSize: "0.65rem",
                              fontWeight: 700,
                              padding: "1px 5px",
                              borderRadius: "4px",
                            }}
                          >
                            Portada
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setGalleryPreviews((prev) => [
                                url,
                                ...prev.filter((_, i) => i !== idx),
                              ])
                            }
                            style={{
                              position: "absolute",
                              bottom: "4px",
                              left: "4px",
                              background: "rgba(15,23,42,0.75)",
                              color: "#ffffff",
                              border: "none",
                              fontSize: "0.65rem",
                              fontWeight: 700,
                              padding: "2px 5px",
                              borderRadius: "4px",
                              cursor: "pointer",
                            }}
                          >
                            Principal
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label="Quitar imagen"
                          onClick={() =>
                            setGalleryPreviews((prev) => prev.filter((_, i) => i !== idx))
                          }
                          style={{
                            position: "absolute",
                            top: "4px",
                            right: "4px",
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            border: "none",
                            background: "rgba(15,23,42,0.8)",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <button
                type="submit"
                disabled={publishing}
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: "12px",
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: "0.98rem",
                  cursor: publishing ? "wait" : "pointer",
                  opacity: publishing ? 0.7 : 1,
                  marginBottom: "10px",
                  boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
                }}
              >
                {publishing
                  ? "Guardando producto e imágenes..."
                  : editingProduct
                    ? "Guardar Cambios"
                    : "Publicar Producto Ahora"}
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

        {/* MODAL CHECKOUT / PEDIDO A DOMICILIO CON WOMPI */}
        <StoreDeliveryCheckoutModal
          isOpen={deliveryCheckoutOpen}
          onClose={() => setDeliveryCheckoutOpen(false)}
          items={checkoutItems}
          defaultCity={selectedCity === ALL_COLOMBIA_OPTION ? "Bogotá" : selectedCity}
          onOrderSuccess={handleOrderSuccess}
        />

        {/* MODAL CARRITO DE COMPRAS */}
        <StoreCartDrawerModal
          isOpen={cartDrawerOpen}
          onClose={() => setCartDrawerOpen(false)}
          items={cartItems}
          onUpdateQuantity={handleUpdateCartQty}
          onRemoveItem={handleRemoveFromCart}
          onCheckout={handleOpenDeliveryForCart}
        />

        {/* MODAL HISTORIA DE PEDIDOS */}
        <StoreOrderHistoryModal
          isOpen={orderHistoryOpen}
          onClose={() => setOrderHistoryOpen(false)}
          orders={orders}
        />

        {/* MODAL HISTORIA PAGO PRODUCTOS */}
        <StorePaymentHistoryModal
          isOpen={paymentHistoryOpen}
          onClose={() => setPaymentHistoryOpen(false)}
          payments={payments}
        />

        {/* Toast de notificaciones */}
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
