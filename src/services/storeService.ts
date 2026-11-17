import { api, getApiBaseUrl, getConnectionMode, getLocalFallbackApiUrl, tokenStorage } from "./api";
import { adminService } from "./adminService";
import {
  DEFAULT_MOCK_PRODUCTS,
  type MockStoreProduct,
} from "../data/mockStoreProducts";
import {
  getCustomStoredProducts,
  removeCustomStoredProduct,
  saveCustomStoredProduct,
} from "../data/storeStorage";

export type StoreProduct = MockStoreProduct;

export interface ApiStoreProduct {
  id: number;
  owner_id?: number;
  title: string;
  category: string;
  price: number;
  stock?: number;
  condition?: string;
  description: string;
  seller_name: string;
  seller_email?: string;
  seller_username?: string;
  seller_role: StoreProduct["sellerRole"];
  seller_user_id?: number;
  seller_blocked?: boolean;
  phone: string;
  city: string;
  image_url: string;
  images?: string[];
  is_owner?: boolean;
  is_active?: boolean;
  review_status?: "aprobado" | "en_revision" | "observado" | "rechazado";
  review_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string | null;
  reports_count?: number;
  last_report_reason?: string;
  created_at: string;
  updated_at?: string;
}

export interface SaveStoreProductInput {
  title: string;
  category: string;
  price: number;
  stock?: number;
  condition?: string;
  description: string;
  phone: string;
  city: string;
  sellerName?: string;
  sellerEmail?: string;
  sellerUsername?: string;
  sellerRole?: StoreProduct["sellerRole"];
  ownerId?: number;
  imageFiles?: File[];
  imageUrls?: string[];
  isActive?: boolean;
  reviewStatus?: StoreProduct["reviewStatus"];
  reviewNotes?: string;
  reviewedBy?: string;
}

export interface ReportStoreProductInput {
  reason: string;
  description: string;
  priority?: "Alta" | "Media" | "Baja";
  hideProduct?: boolean;
  blockPublisher?: boolean;
  reporterName?: string;
  blockDurationDays?: number;
}

export const PLACEHOLDER_PRODUCT_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='260'><rect width='100%' height='100%' fill='#f1f5f9'/><text x='50%' y='50%' fill='#64748b' font-family='sans-serif' font-size='16' font-weight='600' text-anchor='middle' dominant-baseline='middle'>Sin imagen disponible</text></svg>"
  );

const MAX_IMAGE_SIDE = 1280;

export const compressProductImage = (file: File): Promise<File> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
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
          resolve(
            new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
              type: "image/jpeg",
            })
          );
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

export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });

export const normalizeStoreProduct = (item: ApiStoreProduct): StoreProduct => {
  const rawImages = Array.isArray(item.images)
    ? item.images.filter((url): url is string => typeof url === "string" && Boolean(url.trim()))
    : [];
  const primaryImage = (item.image_url || rawImages[0] || PLACEHOLDER_PRODUCT_IMAGE).trim();
  const images =
    rawImages.length > 0
      ? rawImages
      : primaryImage && primaryImage !== PLACEHOLDER_PRODUCT_IMAGE
        ? [primaryImage]
        : [];
  const seedFallback = DEFAULT_MOCK_PRODUCTS.find((p) => Number(p.id) === Number(item.id));
  const resolvedImage =
    primaryImage && primaryImage !== PLACEHOLDER_PRODUCT_IMAGE
      ? primaryImage
      : seedFallback?.image || PLACEHOLDER_PRODUCT_IMAGE;

  return {
    id: item.id,
    ownerId: item.owner_id ?? item.seller_user_id,
    title: item.title,
    category: item.category,
    price: Number(item.price || 0),
    stock: item.stock ?? 1,
    condition: item.condition || "Nuevo",
    description: item.description || "",
    sellerName: item.seller_name || "Usuario",
    sellerEmail: item.seller_email || "",
    sellerUsername: item.seller_username || "",
    sellerRole: item.seller_role || "Cliente",
    sellerBlocked: Boolean(item.seller_blocked),
    phone: item.phone || "",
    city: item.city || "Bogotá",
    image: resolvedImage,
    images: images.length > 0 ? images : seedFallback?.images || (resolvedImage !== PLACEHOLDER_PRODUCT_IMAGE ? [resolvedImage] : []),
    date: item.created_at ? new Date(item.created_at).toLocaleDateString("es-CO") : "Hoy",
    createdAt: item.created_at,
    updatedAt: item.updated_at || item.created_at,
    isOwner: Boolean(item.is_owner),
    isActive: item.is_active !== false,
    reviewStatus: item.review_status || "aprobado",
    reviewNotes: item.review_notes || "",
    reviewedBy: item.reviewed_by || "",
    reportsCount: Number(item.reports_count || 0),
    lastReportReason: item.last_report_reason || "",
    featured: Number(item.id) % 2 === 1,
  };
};

async function requestLocalSqlite<T>(
  path: string,
  init: { method?: string; body?: BodyInit | null; headers?: Record<string, string> } = {}
): Promise<T | null> {
  const localBase = getLocalFallbackApiUrl();
  if (!localBase) return null;
  const url = `${localBase}/${path.replace(/^\//, "")}`;
  const token = tokenStorage.getAccessToken();
  const headers: Record<string, string> = { ...(init.headers || {}) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url, {
    method: init.method || "GET",
    body: init.body,
    headers,
  });
  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = await response.text().catch(() => null);
    }
    const detail =
      payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : `Error HTTP ${response.status}`;
    throw new Error(detail);
  }
  if (response.status === 204) return null;
  return (await response.json()) as T;
}

function buildProductFormData(input: SaveStoreProductInput, dataUrls: string[]): FormData {
  const form = new FormData();
  form.append("title", input.title.trim());
  form.append("category", input.category);
  form.append("price", String(Math.max(0, Math.round(Number(input.price) || 0))));
  if (input.stock !== undefined) form.append("stock", String(Math.max(0, Math.round(Number(input.stock)))));
  if (input.condition !== undefined) form.append("condition", input.condition);
  form.append("description", input.description.trim());
  form.append("phone", input.phone.trim());
  form.append("city", input.city.trim() || "Bogotá");
  if (input.sellerName) form.append("seller_name", input.sellerName);
  if (input.sellerEmail) form.append("seller_email", input.sellerEmail);
  if (input.sellerUsername) form.append("seller_username", input.sellerUsername);
  if (input.sellerRole) form.append("seller_role", input.sellerRole);
  if (input.ownerId) form.append("owner_id", String(input.ownerId));
  if (input.isActive !== undefined) form.append("is_active", String(input.isActive));
  if (input.reviewStatus) form.append("review_status", input.reviewStatus);
  if (input.reviewNotes !== undefined) form.append("review_notes", input.reviewNotes);
  if (input.reviewedBy) form.append("reviewed_by", input.reviewedBy);

  if (dataUrls.length > 0) {
    form.append("image_url", dataUrls[0]);
    form.append("images", JSON.stringify(dataUrls));
  }
  (input.imageFiles || []).forEach((file) => {
    form.append("image", file, file.name);
  });
  return form;
}

async function resolveImageDataUrls(input: SaveStoreProductInput): Promise<string[]> {
  const urls: string[] = [];
  for (const url of input.imageUrls || []) {
    if (typeof url === "string" && url.trim() && url !== PLACEHOLDER_PRODUCT_IMAGE) {
      urls.push(url.trim());
    }
  }
  for (const file of input.imageFiles || []) {
    try {
      const dataUrl = await fileToDataUrl(file);
      if (dataUrl) urls.push(dataUrl);
    } catch {
      // ignore conversion failure; multipart file still gets uploaded
    }
  }
  return Array.from(new Set(urls)).slice(0, 6);
}

export const storeService = {
  async listProducts(options?: { includeAll?: boolean }): Promise<{
    products: StoreProduct[];
    fromServer: boolean;
  }> {
    const includeAll = Boolean(options?.includeAll);
    const params = includeAll ? { include_all: "true" } : undefined;
    const mode = getConnectionMode(getApiBaseUrl());

    let primaryRows: ApiStoreProduct[] = [];
    let primaryOk = false;
    try {
      const resp = await api.get<ApiStoreProduct[]>("store/products/", { params });
      if (Array.isArray(resp)) {
        primaryRows = resp;
        primaryOk = true;
      }
    } catch {
      primaryOk = false;
    }

    let localRows: ApiStoreProduct[] = [];
    let localOk = false;
    if (mode !== "local-sqlite" && (!primaryOk || primaryRows.length === 0 || includeAll)) {
      try {
        const localResp = await requestLocalSqlite<ApiStoreProduct[]>(
          includeAll ? "store/products/?include_all=true" : "store/products/"
        );
        if (Array.isArray(localResp)) {
          localRows = localResp;
          localOk = true;
        }
      } catch {
        localOk = false;
      }
    }

    const mergedApiRows =
      primaryRows.length > 0
        ? [
            ...primaryRows,
            ...localRows.filter((lr) => !primaryRows.some((pr) => Number(pr.id) === Number(lr.id))),
          ]
        : localRows;

    if (mergedApiRows.length > 0 || primaryOk || localOk) {
      const normalized = mergedApiRows.map(normalizeStoreProduct);
      const customLocal = getCustomStoredProducts() as StoreProduct[];
      const extraCustom = customLocal.filter(
        (cp) => !normalized.some((np) => String(np.id) === String(cp.id))
      );
      return {
        products: [...extraCustom, ...normalized],
        fromServer: true,
      };
    }

    const custom = getCustomStoredProducts() as StoreProduct[];
    return {
      products: [...custom, ...DEFAULT_MOCK_PRODUCTS],
      fromServer: false,
    };
  },

  async createProduct(input: SaveStoreProductInput): Promise<StoreProduct> {
    const imageUrls = await resolveImageDataUrls(input);
    const mode = getConnectionMode(getApiBaseUrl());

    const form = buildProductFormData(input, imageUrls);
    let saved: ApiStoreProduct | null = null;

    try {
      saved = await api.post<ApiStoreProduct>("store/products/", form);
    } catch {
      saved = null;
    }

    const needsLocalSync =
      mode !== "local-sqlite" &&
      (!saved || (!saved.image_url && imageUrls.length > 0));

    if (needsLocalSync) {
      try {
        const localForm = buildProductFormData(input, imageUrls);
        const localSaved = await requestLocalSqlite<ApiStoreProduct>("store/products/", {
          method: "POST",
          body: localForm,
        });
        if (localSaved) {
          saved = localSaved;
        }
      } catch {
        // handled below if still null
      }
    }

    if (saved) {
      const normalized = normalizeStoreProduct(saved);
      if (
        (!normalized.image || normalized.image === PLACEHOLDER_PRODUCT_IMAGE) &&
        imageUrls[0]
      ) {
        normalized.image = imageUrls[0];
        normalized.images = imageUrls;
      }
      saveCustomStoredProduct(normalized);
      return normalized;
    }

    // Fallback final en almacenamiento local del navegador
    const fallbackProduct: StoreProduct = {
      id: `prod-${Date.now()}`,
      ownerId: input.ownerId,
      title: input.title.trim(),
      category: input.category,
      price: Math.max(0, Math.round(Number(input.price) || 0)),
      stock: input.stock ?? 1,
      condition: input.condition || "Nuevo",
      description: input.description.trim(),
      sellerName: input.sellerName || "Usuario",
      sellerEmail: input.sellerEmail || "",
      sellerUsername: input.sellerUsername || "",
      sellerRole: input.sellerRole || "Cliente",
      phone: input.phone.trim(),
      city: input.city.trim() || "Bogotá",
      image: imageUrls[0] || PLACEHOLDER_PRODUCT_IMAGE,
      images: imageUrls,
      date: "Hoy",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isOwner: true,
      isActive: input.isActive !== false,
      reviewStatus: input.reviewStatus || "aprobado",
      reportsCount: 0,
      featured: true,
    };
    saveCustomStoredProduct(fallbackProduct);
    return fallbackProduct;
  },

  async updateProduct(
    id: string | number,
    input: Partial<SaveStoreProductInput>
  ): Promise<StoreProduct> {
    const hasNewFiles = Boolean(input.imageFiles && input.imageFiles.length > 0);
    const hasExplicitUrls = Boolean(input.imageUrls && input.imageUrls.length > 0);
    const resolvedUrls =
      hasNewFiles || hasExplicitUrls
        ? await resolveImageDataUrls({
            title: input.title || "",
            category: input.category || "Otros",
            price: input.price ?? 0,
            description: input.description || "",
            phone: input.phone || "",
            city: input.city || "Bogotá",
            imageFiles: input.imageFiles,
            imageUrls: input.imageUrls,
          })
        : [];

    const payloadObj: Record<string, unknown> = {};
    if (input.title !== undefined) payloadObj.title = input.title.trim();
    if (input.category !== undefined) payloadObj.category = input.category;
    if (input.price !== undefined) payloadObj.price = Math.max(0, Math.round(Number(input.price) || 0));
    if (input.stock !== undefined) payloadObj.stock = Math.max(0, Math.round(Number(input.stock) || 0));
    if (input.condition !== undefined) payloadObj.condition = input.condition;
    if (input.description !== undefined) payloadObj.description = input.description.trim();
    if (input.phone !== undefined) payloadObj.phone = input.phone.trim();
    if (input.city !== undefined) payloadObj.city = input.city.trim() || "Bogotá";
    if (input.isActive !== undefined) payloadObj.is_active = input.isActive;
    if (input.reviewStatus !== undefined) payloadObj.review_status = input.reviewStatus;
    if (input.reviewNotes !== undefined) payloadObj.review_notes = input.reviewNotes;
    if (input.reviewedBy !== undefined) payloadObj.reviewed_by = input.reviewedBy;
    if (resolvedUrls.length > 0) {
      payloadObj.image_url = resolvedUrls[0];
      payloadObj.images = resolvedUrls;
    }

    const mode = getConnectionMode(getApiBaseUrl());
    let updatedApi: ApiStoreProduct | null = null;

    if (hasNewFiles) {
      const form = new FormData();
      Object.entries(payloadObj).forEach(([k, v]) => {
        if (k === "images" && Array.isArray(v)) {
          form.append(k, JSON.stringify(v));
        } else if (v !== undefined) {
          form.append(k, String(v));
        }
      });
      (input.imageFiles || []).forEach((f) => form.append("image", f, f.name));
      try {
        updatedApi = await api.patch<ApiStoreProduct>(`store/products/${id}/`, form);
      } catch {
        updatedApi = null;
      }
      if (!updatedApi && mode !== "local-sqlite") {
        updatedApi = await requestLocalSqlite<ApiStoreProduct>(`store/products/${id}/`, {
          method: "PATCH",
          body: form,
        });
      }
    } else {
      try {
        updatedApi = await api.patch<ApiStoreProduct>(`store/products/${id}/`, payloadObj);
      } catch {
        updatedApi = null;
      }
      if (!updatedApi && mode !== "local-sqlite") {
        updatedApi = await requestLocalSqlite<ApiStoreProduct>(`store/products/${id}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadObj),
        });
      }
    }

    if (updatedApi) {
      const normalized = normalizeStoreProduct(updatedApi);
      const customExisting = getCustomStoredProducts().find((c) => String(c.id) === String(id));
      if (customExisting) {
        saveCustomStoredProduct(normalized);
      }
      return normalized;
    }

    // Fallback para publicaciones almacenadas solo en caché local
    const customExisting = getCustomStoredProducts().find((c) => String(c.id) === String(id));
    if (customExisting) {
      const merged: StoreProduct = {
        ...customExisting,
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.stock !== undefined ? { stock: input.stock } : {}),
        ...(input.condition !== undefined ? { condition: input.condition } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.reviewStatus !== undefined ? { reviewStatus: input.reviewStatus } : {}),
        ...(input.reviewNotes !== undefined ? { reviewNotes: input.reviewNotes } : {}),
        ...(resolvedUrls.length > 0 ? { image: resolvedUrls[0], images: resolvedUrls } : {}),
        updatedAt: new Date().toISOString(),
      };
      saveCustomStoredProduct(merged);
      return merged;
    }

    throw new Error("No se pudo actualizar el producto en el servidor.");
  },

  async deleteProduct(id: string | number): Promise<void> {
    const mode = getConnectionMode(getApiBaseUrl());
    let deletedOnPrimary = false;
    try {
      await api.delete(`store/products/${id}/`);
      deletedOnPrimary = true;
    } catch {
      deletedOnPrimary = false;
    }
    if (mode !== "local-sqlite" || !deletedOnPrimary) {
      try {
        await requestLocalSqlite(`store/products/${id}/`, { method: "DELETE" });
      } catch {
        // ignore if already removed or browser-only item
      }
    }
    removeCustomStoredProduct(id);
  },

  async reportProductAndPublisher(
    product: StoreProduct,
    input: ReportStoreProductInput
  ): Promise<{
    ok: boolean;
    message: string;
    product?: StoreProduct;
    publisherBlocked?: boolean;
  }> {
    const bodyPayload = {
      reason: input.reason,
      description: input.description,
      priority: input.priority || "Alta",
      hide_product: Boolean(input.hideProduct),
      block_publisher: Boolean(input.blockPublisher),
      reporter_name: input.reporterName || "Administrador",
      admin_name: input.reporterName || "Administrador",
      block_duration: input.blockDurationDays || 7,
    };

    const mode = getConnectionMode(getApiBaseUrl());

    try {
      const resp = await api.post<{
        ok: boolean;
        message: string;
        product?: ApiStoreProduct;
        publisher_blocked?: boolean;
      }>(`store/products/${product.id}/report/`, bodyPayload);
      return {
        ok: Boolean(resp?.ok ?? true),
        message: resp?.message || `Reporte registrado contra ${product.sellerName}.`,
        product: resp?.product ? normalizeStoreProduct(resp.product) : undefined,
        publisherBlocked: Boolean(resp?.publisher_blocked),
      };
    } catch {
      if (mode !== "local-sqlite") {
        try {
          const localResp = await requestLocalSqlite<{
            ok: boolean;
            message: string;
            product?: ApiStoreProduct;
            publisher_blocked?: boolean;
          }>(`store/products/${product.id}/report/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyPayload),
          });
          if (localResp) {
            return {
              ok: Boolean(localResp.ok ?? true),
              message: localResp.message || `Reporte registrado contra ${product.sellerName}.`,
              product: localResp.product ? normalizeStoreProduct(localResp.product) : undefined,
              publisherBlocked: Boolean(localResp.publisher_blocked),
            };
          }
        } catch {
          // continue to PQR fallback below
        }
      }
    }

    // Respaldo: crear PQR formal contra el cliente que publicó
    await adminService.createPqr({
      type: "queja",
      reason: `Reporte publicación tienda: ${input.reason}`,
      description: `Reporte contra el publicador ${product.sellerName} (${product.sellerEmail || product.sellerRole}) por el producto "${product.title}" (#${product.id}). ${input.description}`,
      clientName: product.sellerName,
      clientEmail: product.sellerEmail || "",
      relatedTo: `Tienda Meko Shop - Publicación #${product.id} (${product.title})`,
      priority: input.priority || "Alta",
    });

    if (input.hideProduct) {
      try {
        await this.updateProduct(product.id, {
          isActive: false,
          reviewStatus: "observado",
          reviewNotes: input.description,
          reviewedBy: input.reporterName,
        });
      } catch {
        // ignore if unsupported remotely
      }
    }

    return {
      ok: true,
      message: `Reporte creado en PQR contra ${product.sellerName}.`,
    };
  },
};
