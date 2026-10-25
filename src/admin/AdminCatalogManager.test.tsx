import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AdminCatalogManager, type CatalogSection } from "./AdminCatalogManager";
import { adminCatalog, type AdminCategory, type AdminCatalogService, type SuggestionPreview } from "../services/adminCatalog";
import { ApiError } from "../services/api";

vi.mock("../services/adminCatalog", async () => {
  const actual = await vi.importActual<typeof import("../services/adminCatalog")>("../services/adminCatalog");
  return { ...actual, adminCatalog: {
    categories: vi.fn(), services: vi.fn(), createCategory: vi.fn(), updateCategory: vi.fn(), deleteCategory: vi.fn(),
    createService: vi.fn(), updateService: vi.fn(), deleteService: vi.fn(), preview: vi.fn(),
  } };
});

const category: AdminCategory = {
  id: 1, name: "Plomería", slug: "plomeria", description: "Instalaciones de agua", icon_key: "water",
  keywords: ["agua"], sort_order: 0, is_active: true, services_count: 1,
};
const service: AdminCatalogService = {
  id: 7, category: 1, category_name: "Plomería", category_active: true, name: "Reparar tubería",
  slug: "reparar-tuberia", description: "Reparaciones del hogar", keywords: ["fuga de agua"],
  price_min: "10000.00", price_max: "50000.00", estimated_hours: "2.0", is_active: true, professionals_count: 2,
};
const preview: SuggestionPreview = {
  suggested_category: { id: 1, name: "Plomería", slug: "plomeria" },
  suggested_service: { id: 7, name: "Reparar tubería", category: 1 }, confidence: 1,
  rationale: "Coincidencia con: fuga de agua.", ranking: [{ slug: "plomeria", name: "Plomería", score: 6 }],
  service_ranking: [{ id: 7, name: "Reparar tubería", category: { id: 1, name: "Plomería", slug: "plomeria" }, score: 6, matched_terms: ["fuga de agua"] }],
};

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");

beforeAll(() => {
  // jsdom no implementa el ciclo de vida de los diálogos nativos.
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); },
  });
});
afterAll(() => {
  if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminCatalog.categories).mockResolvedValue([category]);
  vi.mocked(adminCatalog.services).mockResolvedValue([service]);
  vi.mocked(adminCatalog.createCategory).mockResolvedValue({ ...category, id: 2 });
  vi.mocked(adminCatalog.updateService).mockResolvedValue(service);
  vi.mocked(adminCatalog.preview).mockResolvedValue(preview);
});

function mount(section: CatalogSection) {
  const onChanged = vi.fn();
  render(<AdminCatalogManager section={section} onSectionChange={vi.fn()} searchQuery="" onSearchChange={vi.fn()} onChanged={onChanged} />);
  return { onChanged };
}

describe("Catálogo administrativo", () => {
  it("crea una categoría con palabras clave limpias y recarga el catálogo real", async () => {
    const { onChanged } = mount("categories");
    await screen.findByRole("button", { name: "Editar" });
    fireEvent.click(screen.getByRole("button", { name: /Nueva categoría/ }));
    const dialog = within(screen.getByRole("dialog", { name: "Nueva categoría" }));
    fireEvent.change(dialog.getByLabelText(/Nombre/), { target: { value: " Electricidad " } });
    fireEvent.change(dialog.getByLabelText("Palabras y frases clave"), { target: { value: " Cable suelto\nCÁBLE SUELTO, corto circuito" } });
    fireEvent.click(dialog.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(adminCatalog.createCategory).toHaveBeenCalledWith({
      name: "Electricidad", description: "", icon_key: "", keywords: ["Cable suelto", "corto circuito"], sort_order: 0, is_active: true,
    }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(adminCatalog.categories).toHaveBeenCalledTimes(2);
  });

  it("edita las palabras de un servicio conservando su categoría y tarifas", async () => {
    mount("services");
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    const dialog = within(screen.getByRole("dialog", { name: "Editar servicio" }));
    fireEvent.change(dialog.getByLabelText("Palabras y frases clave"), { target: { value: "grifo goteando\ntubería rota" } });
    fireEvent.click(dialog.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(adminCatalog.updateService).toHaveBeenCalledWith(7, {
      category: 1, name: service.name, description: service.description, keywords: ["grifo goteando", "tubería rota"],
      price_min: "10000.00", price_max: "50000.00", estimated_hours: "2.0", is_active: true,
    }));
    expect(adminCatalog.createService).not.toHaveBeenCalled();
  });

  it("muestra el bloqueo de eliminación sin informar un éxito falso", async () => {
    vi.mocked(adminCatalog.deleteService).mockRejectedValue(new ApiError(409, "En uso", { detail: "Este elemento tiene registros relacionados. Desactívalo para conservar el historial." }));
    const { onChanged } = mount("services");
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Desactívalo");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.queryByText("Elemento eliminado del catálogo.")).toBeNull();
  });

  it("informa falta de permisos sin mostrar un catálogo de demostración", async () => {
    vi.mocked(adminCatalog.categories).mockRejectedValue(new ApiError(403, "Forbidden", {}));
    mount("categories");
    expect(await screen.findByRole("alert")).toHaveTextContent("no tiene permisos");
    expect(screen.getByRole("button", { name: /Nueva categoría/ })).toBeDisabled();
    expect(screen.queryByText(category.name)).toBeNull();
  });

  it("consulta el motor de sugerencias y permite editar el servicio recomendado", async () => {
    mount("suggestions");
    await waitFor(() => expect(adminCatalog.categories).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Actualizar" })).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText("Descripción del problema"), { target: { value: "Tengo una fuga de agua" } });
    fireEvent.click(screen.getByRole("button", { name: "Probar sugerencias" }));
    expect(await screen.findByText(preview.rationale)).toBeInTheDocument();
    expect(adminCatalog.preview).toHaveBeenCalledWith("Tengo una fuga de agua");
    fireEvent.click(screen.getByRole("button", { name: "Editar servicio" }));
    expect(screen.getByRole("dialog", { name: "Editar servicio" })).toBeInTheDocument();
    expect(adminCatalog.createCategory).not.toHaveBeenCalled();
    expect(adminCatalog.createService).not.toHaveBeenCalled();
  });

  it("descarta respuestas de sugerencias si cambia la descripción durante la consulta", async () => {
    let resolvePreview!: (value: SuggestionPreview) => void;
    vi.mocked(adminCatalog.preview).mockReturnValue(new Promise((resolve) => { resolvePreview = resolve; }));
    mount("suggestions");
    await waitFor(() => expect(screen.getByRole("button", { name: "Actualizar" })).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText("Descripción del problema"), { target: { value: "Tengo una fuga de agua" } });
    fireEvent.click(screen.getByRole("button", { name: "Probar sugerencias" }));
    fireEvent.change(screen.getByLabelText("Descripción del problema"), { target: { value: "Necesito revisar un cable" } });
    resolvePreview(preview);
    await waitFor(() => expect(screen.getByRole("button", { name: "Probar sugerencias" })).not.toBeDisabled());
    expect(screen.queryByText(preview.rationale)).toBeNull();
  });
});
