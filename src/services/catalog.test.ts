import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";
import { adminCatalog } from "./adminCatalog";
import { catalogService } from "./serviprox";

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

beforeEach(() => { vi.resetAllMocks(); });

describe("Conexión del catálogo", () => {
  it("recorre todas las páginas administrativas sin seguir hosts de next", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ results: [{ id: 1 }], next: "http://backend:8000/api/v1/admin/catalog/categories/?page=2" })
      .mockResolvedValueOnce({ results: [{ id: 2 }], next: null });
    expect(await adminCatalog.categories()).toEqual([{ id: 1 }, { id: 2 }]);
    expect(api.get).toHaveBeenNthCalledWith(1, "admin/catalog/categories/", { params: { page: 1, page_size: 100 } });
    expect(api.get).toHaveBeenNthCalledWith(2, "admin/catalog/categories/", { params: { page: 2, page_size: 100 } });
  });

  it("carga todo el catálogo de servicios manteniendo el filtro de categoría", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ results: [{ id: 1 }], next: "https://api.example.com/api/v1/services/?category=7&page=2" })
      .mockResolvedValueOnce({ results: [{ id: 2 }], next: null });
    expect(await catalogService.listServices({ category: 7 })).toEqual([{ id: 1 }, { id: 2 }]);
    expect(api.get).toHaveBeenNthCalledWith(1, "services/?category=7&page=1");
    expect(api.get).toHaveBeenNthCalledWith(2, "services/?category=7&page=2");
  });

  it("acepta listas públicas sin paginar", async () => {
    vi.mocked(api.get).mockResolvedValue([{ id: 1 }, { id: 2 }]);
    expect(await catalogService.listCategories()).toEqual([{ id: 1 }, { id: 2 }]);
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it("propaga los fallos de permisos y de páginas intermedias", async () => {
    const error = new ApiError(403, "Forbidden", {});
    vi.mocked(api.get).mockRejectedValueOnce(error);
    await expect(adminCatalog.services()).rejects.toBe(error);
    vi.mocked(api.get).mockResolvedValueOnce({ results: [{ id: 1 }], next: "?page=2" }).mockRejectedValueOnce(error);
    await expect(catalogService.listCategories()).rejects.toBe(error);
  });

  it("envía las ediciones y la vista previa a los endpoints administrativos", async () => {
    vi.mocked(api.patch).mockResolvedValue({ id: 7 });
    vi.mocked(api.post).mockResolvedValue({ service_ranking: [] });
    await adminCatalog.updateService(7, { keywords: ["llave goteando"] });
    await adminCatalog.preview("Tengo una llave goteando");
    expect(api.patch).toHaveBeenCalledWith("admin/catalog/services/7/", { keywords: ["llave goteando"] });
    expect(api.post).toHaveBeenCalledWith("admin/catalog/suggestions/preview/", { description: "Tengo una llave goteando" });
  });
});
