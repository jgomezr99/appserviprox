import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import OrientacionGuiadaModal from "./OrientacionGuiadaModal";
import { catalogService, diagnosisService } from "../../services/serviprox";
import type { DiagnosticSession, ServiceCategory } from "../../types/serviprox";

vi.mock("../../services/serviprox", () => ({
  diagnosisService: { create: vi.fn() }, catalogService: { listServices: vi.fn() },
}));

vi.mock("@ionic/react", () => {
  const Container = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  return {
    IonModal: ({ isOpen, children }: React.PropsWithChildren<{ isOpen: boolean }>) => isOpen ? <div role="dialog">{children}</div> : null,
    IonButton: ({ children, onClick, disabled, "aria-label": label }: React.PropsWithChildren<{
      onClick?: () => void; disabled?: boolean; "aria-label"?: string;
    }>) => <button type="button" onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>,
    IonButtons: Container, IonContent: Container, IonHeader: Container, IonTitle: Container,
    IonToolbar: Container, IonIcon: () => null, IonSpinner: () => null,
  };
});

const category: ServiceCategory = {
  id: 1, name: "Plomería", slug: "plomeria", description: "Servicios de agua", icon_key: "water", professionals_count: 0,
};
const diagnosis: DiagnosticSession = {
  id: 31, description: "Tengo una fuga de agua", status: "suggested",
  suggested_category: category,
  suggested_service: { id: 7, category: 1, category_slug: "plomeria", name: "Reparar fuga", slug: "reparar-fuga", description: "Reparaciones", price_min: null, price_max: null, estimated_hours: null },
  confidence: 1, rationale: "Coincidencia con: fuga de agua.", ranking: [{ slug: "plomeria", name: "Plomería", score: 6 }],
  service_ranking: [{ id: 7, name: "Reparar fuga", category, score: 6, matched_terms: ["fuga de agua"] }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(diagnosisService.create).mockResolvedValue(diagnosis);
  vi.mocked(catalogService.listServices).mockResolvedValue([]);
});
afterEach(() => { cleanup(); });

function mount() {
  const onTakeService = vi.fn();
  render(<OrientacionGuiadaModal isOpen onClose={vi.fn()} categories={[category]} onTakeService={onTakeService} />);
  return onTakeService;
}

function search(description = "Tengo una fuga de agua") {
  fireEvent.change(screen.getByLabelText("Descripción del problema"), { target: { value: description } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar sugerencias" }));
}

describe("Sugerencias en la vista de cliente", () => {
  it("conserva el botón y su contenido al entrar y salir de carga en búsquedas consecutivas", async () => {
    let finishSearch!: (result: DiagnosticSession) => void;
    vi.mocked(diagnosisService.create).mockImplementation(() => new Promise<DiagnosticSession>((resolve) => { finishSearch = resolve; }));
    mount();
    const button = screen.getByRole("button", { name: "Buscar sugerencias" });
    const content = button.querySelector(".sp-service-button-content");
    expect(content).not.toBeNull();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      search(`Tengo una fuga de agua en la tubería ${attempt + 1}`);
      expect(screen.getByRole("button", { name: "Buscando en el catálogo..." })).toBe(button);
      expect(button).toBeDisabled();
      expect(button.querySelector(".sp-service-button-content")).toBe(content);
      expect(content).toHaveAttribute("aria-busy", "true");
      await act(async () => { finishSearch(diagnosis); });
      expect(screen.getByRole("button", { name: "Buscar sugerencias" })).toBe(button);
      expect(button).not.toBeDisabled();
      expect(button.querySelector(".sp-service-button-content")).toBe(content);
      expect(content).toHaveAttribute("aria-busy", "false");
      expect(screen.getByRole("region", { name: "Resultado de la búsqueda" })).toBeInTheDocument();
    }
  });

  it("muestra los servicios recibidos y transmite la selección y la sesión al continuar", async () => {
    const onTakeService = mount();
    search();
    const suggestion = await screen.findByRole("button", { name: /Reparar fuga/ });
    expect(diagnosisService.create).toHaveBeenCalledWith("Tengo una fuga de agua");
    expect(screen.getByText(diagnosis.rationale)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar con el servicio seleccionado" })).toBeDisabled();
    fireEvent.click(suggestion);
    fireEvent.click(screen.getByRole("button", { name: "Continuar con el servicio seleccionado" }));
    expect(onTakeService).toHaveBeenCalledWith({
      category, serviceId: 7, diagnosticSessionId: 31, description: "Tengo una fuga de agua", urgency: "this_week",
    });
  });

  it("desplaza al resultado cuando llega, aunque estuviera debajo del formulario", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scroll });
    try {
      mount();
      search();
      await waitFor(() => expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" }));
      expect(screen.getByRole("region", { name: "Resultado de la búsqueda" })).toHaveTextContent("Reparar fuga");
    } finally {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", descriptor);
      else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
  });

  it("termina la carga y muestra un mensaje si la API devuelve cero coincidencias", async () => {
    vi.mocked(diagnosisService.create).mockResolvedValue({
      ...diagnosis, suggested_category: null, suggested_service: null, service_ranking: [], confidence: 0,
      rationale: "No encontramos una coincidencia clara.",
    });
    mount();
    search("Necesito aprender a tocar guitarra");
    expect(await screen.findByText("No encontramos una coincidencia clara.")).toBeInTheDocument();
    expect(screen.queryByText("Buscando en el catálogo...")).toBeNull();
    expect(screen.queryByRole("button", { name: "Continuar con el servicio seleccionado" })).toBeNull();
    expect(catalogService.listServices).not.toHaveBeenCalled();
  });

  it("permite reintentar si falla la conexión", async () => {
    vi.mocked(diagnosisService.create).mockRejectedValue(new Error("Network failed"));
    mount();
    search();
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos consultar las sugerencias");
    expect(screen.getByRole("button", { name: "Buscar sugerencias" })).not.toBeDisabled();
  });

  it.each([undefined, null])("recupera los servicios de la categoría si una API anterior omite el ranking (%s)", async (ranking) => {
    vi.mocked(diagnosisService.create).mockResolvedValue({ ...diagnosis, service_ranking: ranking } as unknown as DiagnosticSession);
    vi.mocked(catalogService.listServices).mockResolvedValue([diagnosis.suggested_service!]);
    const onTakeService = mount();
    search();
    fireEvent.click(await screen.findByRole("button", { name: /Reparar fuga/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar con el servicio seleccionado" }));
    expect(catalogService.listServices).toHaveBeenCalledWith({ category: category.id });
    expect(onTakeService).toHaveBeenCalledWith(expect.objectContaining({ serviceId: 7, diagnosticSessionId: 31 }));
  });

  it("muestra sugerencias sin términos de coincidencia y descarta entradas incompletas sin romper el modal", async () => {
    vi.mocked(diagnosisService.create).mockResolvedValue({
      ...diagnosis,
      service_ranking: [null, { id: 99, name: "Sin categoría", category: null }, { ...diagnosis.service_ranking[0], matched_terms: null }],
    } as unknown as DiagnosticSession);
    mount();
    search();
    expect(await screen.findByRole("button", { name: /Reparar fuga/ })).toBeInTheDocument();
    expect(screen.queryByText(/Coincidencias:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Sin categoría")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([null, { id: 31, service_ranking: {} }])("mantiene el formulario y permite reintentar una respuesta inválida (%s)", async (payload) => {
    vi.mocked(diagnosisService.create).mockResolvedValueOnce(payload as unknown as DiagnosticSession).mockResolvedValueOnce(diagnosis);
    mount();
    search();
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos consultar las sugerencias");
    expect(screen.queryByRole("region", { name: "Resultado de la búsqueda" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Buscar sugerencias" }));
    expect(await screen.findByRole("button", { name: /Reparar fuga/ })).toBeInTheDocument();
  });
});
