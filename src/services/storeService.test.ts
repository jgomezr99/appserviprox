import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { saveCustomStoredProduct, getCustomStoredProducts } from "../data/storeStorage";

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => false } }));

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("storeService", () => {
  it("normaliza productos con imágenes, metadatos del publicador y respaldo de catálogo", async () => {
    const { normalizeStoreProduct } = await import("./storeService");

    const custom = normalizeStoreProduct({
      id: 99,
      title: "Soldadora Inverter 200A",
      category: "Herramientas",
      price: 540000,
      stock: 3,
      condition: "Nuevo",
      description: "Equipo compacto con cables y careta.",
      seller_name: "Marta Quintero",
      seller_email: "marta@demo.co",
      seller_role: "Cliente",
      seller_blocked: true,
      phone: "+57 310 555 1234",
      city: "Medellín",
      image_url: "data:image/jpeg;base64,AAA",
      images: ["data:image/jpeg;base64,AAA", "https://cdn.example.com/2.jpg"],
      review_status: "observado",
      reports_count: 2,
      last_report_reason: "Precio inconsistente",
      is_active: false,
      created_at: "2026-11-16T10:00:00Z",
    });

    expect(custom.image).toBe("data:image/jpeg;base64,AAA");
    expect(custom.images).toHaveLength(2);
    expect(custom.sellerEmail).toBe("marta@demo.co");
    expect(custom.sellerBlocked).toBe(true);
    expect(custom.reviewStatus).toBe("observado");
    expect(custom.reportsCount).toBe(2);
    expect(custom.isActive).toBe(false);
    expect(custom.stock).toBe(3);

    const seededFallback = normalizeStoreProduct({
      id: 1,
      title: 'Ultrabook Pro 14" Core i5',
      category: "Tecnología",
      price: 1450000,
      description: "Laptop",
      seller_name: "Carlos Mendoza",
      seller_role: "Cliente",
      phone: "3100000000",
      city: "Bogotá",
      image_url: "",
      created_at: "2026-11-16T10:00:00Z",
    });

    expect(seededFallback.image).toBe("/assets/products/laptop-pro.jpg");
  });

  it("consulta SQLite local cuando la MV devuelve vacío en listProducts", async () => {
    vi.stubEnv("PROD", "false");
    vi.stubEnv("VITEST", "");
    localStorage.setItem("serviprox_api_host", "https://serviprox-pte.duckdns.org/api/v1");

    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://serviprox-pte.duckdns.org/api/v1/store/products/")) {
        return json([]);
      }
      if (url.includes("/api/v1/store/products/?include_all=true")) {
        return json([
          {
            id: 1,
            title: 'Ultrabook Pro 14" Core i5',
            category: "Tecnología",
            price: 1450000,
            description: "Portátil",
            seller_name: "Carlos Mendoza",
            seller_email: "carlos@demo.co",
            seller_role: "Cliente",
            phone: "+57 310 000 0000",
            city: "Bogotá",
            image_url: "/assets/products/laptop-pro.jpg",
            created_at: "2026-11-16T10:00:00Z",
          },
        ]);
      }
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { storeService } = await import("./storeService");
    const result = await storeService.listProducts({ includeAll: true });

    expect(result.fromServer).toBe(true);
    expect(result.products).toHaveLength(1);
    expect(result.products[0].image).toBe("/assets/products/laptop-pro.jpg");
  });

  it("guarda la imagen del producto al publicar y sincroniza con SQLite si el primario la omite", async () => {
    vi.stubEnv("PROD", "false");
    vi.stubEnv("VITEST", "");
    localStorage.setItem("serviprox_api_host", "https://serviprox-pte.duckdns.org/api/v1");

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("https://serviprox-pte.duckdns.org/api/v1/store/products/") && init?.method === "POST") {
        return json({
          id: 50,
          title: "Taladro 20V",
          category: "Herramientas",
          price: 420000,
          description: "Con batería",
          seller_name: "Ana",
          seller_role: "Cliente",
          phone: "3001112233",
          city: "Bogotá",
          image_url: "",
          created_at: "2026-11-16T12:00:00Z",
        }, 201);
      }
      if (url.includes("/api/v1/store/products/") && init?.method === "POST") {
        return json({
          id: 51,
          title: "Taladro 20V",
          category: "Herramientas",
          price: 420000,
          description: "Con batería",
          seller_name: "Ana",
          seller_role: "Cliente",
          phone: "3001112233",
          city: "Bogotá",
          image_url: "data:image/jpeg;base64,SAVEDIMG",
          images: ["data:image/jpeg;base64,SAVEDIMG"],
          created_at: "2026-11-16T12:00:00Z",
        }, 201);
      }
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { storeService } = await import("./storeService");
    const created = await storeService.createProduct({
      title: "Taladro 20V",
      category: "Herramientas",
      price: 420000,
      description: "Con batería",
      phone: "3001112233",
      city: "Bogotá",
      sellerName: "Ana",
      sellerEmail: "ana@demo.co",
      sellerRole: "Cliente",
      imageUrls: ["data:image/jpeg;base64,SAVEDIMG"],
    });

    expect(created.image).toBe("data:image/jpeg;base64,SAVEDIMG");
    expect(getCustomStoredProducts()[0].image).toBe("data:image/jpeg;base64,SAVEDIMG");
  });

  it("actualiza, reporta al cliente publicador y elimina publicaciones", async () => {
    vi.stubEnv("PROD", "true");
    vi.stubEnv("VITE_API_URL", "https://api.example.com/api/v1");

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/store/products/77/") && init?.method === "PATCH") {
        return json({
          id: 77,
          title: "Esmeril Angular Editado",
          category: "Herramientas",
          price: 290000,
          stock: 5,
          condition: "Nuevo",
          description: "Actualizado",
          seller_name: "Pedro",
          seller_email: "pedro@demo.co",
          seller_role: "Cliente",
          phone: "3009998877",
          city: "Cali",
          image_url: "https://img.example.com/esmeril.jpg",
          review_status: "aprobado",
          is_active: true,
          created_at: "2026-11-16T10:00:00Z",
        });
      }
      if (url.endsWith("/store/products/77/report/") && init?.method === "POST") {
        return json({
          ok: true,
          message: "Reporte PQR-2026-0050 generado contra Pedro.",
          publisher_blocked: true,
          product: {
            id: 77,
            title: "Esmeril Angular Editado",
            category: "Herramientas",
            price: 290000,
            description: "Actualizado",
            seller_name: "Pedro",
            seller_email: "pedro@demo.co",
            seller_role: "Cliente",
            seller_blocked: true,
            phone: "3009998877",
            city: "Cali",
            image_url: "https://img.example.com/esmeril.jpg",
            review_status: "observado",
            reports_count: 1,
            is_active: false,
            created_at: "2026-11-16T10:00:00Z",
          },
        });
      }
      if (url.endsWith("/store/products/77/") && init?.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { storeService } = await import("./storeService");

    const updated = await storeService.updateProduct(77, {
      title: "Esmeril Angular Editado",
      price: 290000,
      stock: 5,
      reviewStatus: "aprobado",
      isActive: true,
      imageUrls: ["https://img.example.com/esmeril.jpg"],
    });
    expect(updated.title).toBe("Esmeril Angular Editado");
    expect(updated.price).toBe(290000);

    saveCustomStoredProduct(updated);

    const reportResult = await storeService.reportProductAndPublisher(updated, {
      reason: "Producto engañoso",
      description: "Fotos no coinciden",
      hideProduct: true,
      blockPublisher: true,
      reporterName: "Admin",
    });
    expect(reportResult.ok).toBe(true);
    expect(reportResult.publisherBlocked).toBe(true);
    expect(reportResult.product?.reportsCount).toBe(1);
    expect(reportResult.product?.isActive).toBe(false);

    await storeService.deleteProduct(77);
    expect(getCustomStoredProducts().some((p) => Number(p.id) === 77)).toBe(false);
  });
});
