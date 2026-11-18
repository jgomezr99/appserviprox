export interface ProductReportItem {
  id: string;
  productId: string | number;
  productTitle: string;
  productPrice: number;
  productCategory: string;
  productImage: string;
  sellerId?: string | number;
  sellerName: string;
  sellerEmail?: string;
  sellerPhone?: string;
  sellerRole?: string;
  reporterName: string;
  reporterEmail?: string;
  reason: string;
  description: string;
  priority: "Alta" | "Media" | "Baja";
  createdAt: string;
  status: "pendiente" | "en_revision" | "resuelto" | "desestimado";
  adminResponse?: string;
  adminRespondedAt?: string;
  adminName?: string;
  actionTaken?: "ninguna" | "producto_oculto" | "tienda_bloqueada" | "producto_eliminado";
}

const REPORTS_KEY = "serviprox_store_product_reports";
const BLOCKED_STORES_KEY = "serviprox_store_blocked_sellers";

export interface BlockedSellerStore {
  sellerIdOrName: string;
  sellerName: string;
  reason: string;
  blockedAt: string;
  adminName?: string;
}

const INITIAL_REPORTS: ProductReportItem[] = [
  {
    id: "REP-PROD-101",
    productId: 13,
    productTitle: "Sierra Circular Profesional 7-1/4\"",
    productPrice: 490000,
    productCategory: "Herramientas",
    productImage: "/assets/products/sierra-circular.jpg",
    sellerId: 3,
    sellerName: "Carlos Mendoza",
    sellerEmail: "carlos.mendoza@demo.serviprox.co",
    sellerPhone: "+57 310 456 7890",
    sellerRole: "Cliente",
    reporterName: "Mariana Silva",
    reporterEmail: "mariana.silva@gmail.com",
    reason: "Información engañosa o especificaciones dudosas",
    description: "El vendedor indica que es nueva pero en las fotos de detalle parece de segunda mano con desgaste en el disco.",
    priority: "Alta",
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    status: "pendiente",
  },
  {
    id: "REP-PROD-102",
    productId: 7,
    productTitle: "Control PS5 DualSense",
    productPrice: 320000,
    productCategory: "Multimedia",
    productImage: "/assets/products/control-gamer.jpg",
    sellerId: 9001,
    sellerName: "Sebastián Arias",
    sellerEmail: "sebastian.arias@demo.serviprox.co",
    sellerPhone: "+57 311 345 6789",
    sellerRole: "Cliente",
    reporterName: "Julián Castro",
    reporterEmail: "julian.castro@gmail.com",
    reason: "Precio sospechoso / posible estafa",
    description: "El precio está muy por debajo del mercado y el vendedor pide consignación previa antes de mostrar el producto.",
    priority: "Alta",
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    status: "en_revision",
    adminResponse: "Caso en investigación por el equipo de moderación. Se contactó al vendedor para verificación de factura.",
    adminRespondedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    adminName: "Administrador Serviprox",
  },
];

export const getProductReports = (): ProductReportItem[] => {
  if (typeof window === "undefined") return INITIAL_REPORTS;
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    if (!raw) {
      localStorage.setItem(REPORTS_KEY, JSON.stringify(INITIAL_REPORTS));
      return INITIAL_REPORTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    localStorage.setItem(REPORTS_KEY, JSON.stringify(INITIAL_REPORTS));
    return INITIAL_REPORTS;
  } catch {
    return INITIAL_REPORTS;
  }
};

export const saveProductReport = (
  input: Omit<ProductReportItem, "id" | "createdAt" | "status"> & {
    id?: string;
    status?: ProductReportItem["status"];
  }
): ProductReportItem => {
  const current = getProductReports();
  const newReport: ProductReportItem = {
    ...input,
    id: input.id || `REP-PROD-${Date.now().toString().slice(-4)}`,
    createdAt: new Date().toISOString(),
    status: input.status || "pendiente",
  };

  const updated = [newReport, ...current.filter((r) => r.id !== newReport.id)];
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent("serviprox:product-reports-updated", { detail: newReport })
    );
  } catch {
    // ignore storage quota
  }
  return newReport;
};

export const updateProductReport = (
  id: string,
  updates: Partial<ProductReportItem>
): ProductReportItem | null => {
  const current = getProductReports();
  const idx = current.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  const updatedItem: ProductReportItem = {
    ...current[idx],
    ...updates,
  };
  current[idx] = updatedItem;

  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(current));
    window.dispatchEvent(
      new CustomEvent("serviprox:product-reports-updated", { detail: updatedItem })
    );
  } catch {
    // ignore
  }
  return updatedItem;
};

export const respondToProductReport = (
  id: string,
  response: string,
  adminName = "Administrador",
  newStatus: ProductReportItem["status"] = "resuelto",
  actionTaken: ProductReportItem["actionTaken"] = "ninguna"
): ProductReportItem | null => {
  return updateProductReport(id, {
    adminResponse: response,
    adminRespondedAt: new Date().toISOString(),
    adminName,
    status: newStatus,
    actionTaken,
  });
};

/* ─────────────────────────────────────────────────────────────────────────────
   BLOQUEO EXCLUSIVO DE TIENDA (Solo se bloquea la tienda del usuario)
   ───────────────────────────────────────────────────────────────────────────── */

export const getStoreBlockedSellers = (): BlockedSellerStore[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BLOCKED_STORES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const normalizeSellerKey = (val: string | number | undefined | null): string => {
  return String(val || "").trim().toLowerCase();
};

export const isSellerStoreBlocked = (
  sellerIdentifier: string | number | undefined | null,
  sellerName?: string
): boolean => {
  const list = getStoreBlockedSellers();
  const key = normalizeSellerKey(sellerIdentifier);
  const nameKey = normalizeSellerKey(sellerName);

  return list.some(
    (b) =>
      (key && normalizeSellerKey(b.sellerIdOrName) === key) ||
      (nameKey && normalizeSellerKey(b.sellerName) === nameKey) ||
      (nameKey && normalizeSellerKey(b.sellerIdOrName) === nameKey)
  );
};

export const blockSellerStore = (
  sellerIdentifier: string | number,
  sellerName: string,
  reason: string,
  adminName = "Administrador"
): void => {
  const list = getStoreBlockedSellers();
  const key = normalizeSellerKey(sellerIdentifier);
  const entry: BlockedSellerStore = {
    sellerIdOrName: String(sellerIdentifier),
    sellerName: sellerName || String(sellerIdentifier),
    reason: reason || "Suspensión de tienda por reportes de publicaciones",
    blockedAt: new Date().toISOString(),
    adminName,
  };

  const filtered = list.filter(
    (b) => normalizeSellerKey(b.sellerIdOrName) !== key && normalizeSellerKey(b.sellerName) !== normalizeSellerKey(sellerName)
  );
  filtered.push(entry);

  try {
    localStorage.setItem(BLOCKED_STORES_KEY, JSON.stringify(filtered));
    window.dispatchEvent(
      new CustomEvent("serviprox:store-block-changed", { detail: { blocked: true, entry } })
    );
  } catch {
    // ignore
  }
};

export const unblockSellerStore = (sellerIdentifier: string | number, sellerName?: string): void => {
  const list = getStoreBlockedSellers();
  const key = normalizeSellerKey(sellerIdentifier);
  const nameKey = normalizeSellerKey(sellerName);

  const filtered = list.filter(
    (b) =>
      normalizeSellerKey(b.sellerIdOrName) !== key &&
      (!nameKey || normalizeSellerKey(b.sellerName) !== nameKey)
  );

  try {
    localStorage.setItem(BLOCKED_STORES_KEY, JSON.stringify(filtered));
    window.dispatchEvent(
      new CustomEvent("serviprox:store-block-changed", { detail: { blocked: false, sellerIdentifier } })
    );
  } catch {
    // ignore
  }
};
