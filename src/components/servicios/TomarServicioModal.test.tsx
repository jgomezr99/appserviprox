import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TomarServicioModal from "./TomarServicioModal";
import { useAuth } from "../../context/AuthContext";
import { catalogService, householdService, professionalSearchService, serviceRequestService } from "../../services/serviprox";
import { ApiError } from "../../services/api";
import { customer, makeRequest } from "../../test/workflowFixtures";

vi.mock("@ionic/react", async () => import("../../test/ionicMock"));
vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../services/serviprox", () => ({ catalogService: { listServices: vi.fn() }, householdService: { list: vi.fn(), update: vi.fn(), create: vi.fn() }, professionalSearchService: { list: vi.fn() }, serviceRequestService: { create: vi.fn() } }));
const NativeURL = URL;
const request = makeRequest();
const category = request.selected_category;
const service = { id: 5, category: category.id, category_slug: category.slug, name: "Reparar fuga", slug: "reparar-fuga", description: "Reparación", price_min: null, price_max: null, estimated_hours: null };
const revokeURL = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  let nextUrl = 0;
  vi.stubGlobal("URL", class extends NativeURL {
    static createObjectURL = () => `blob:request-photo-${++nextUrl}`;
    static revokeObjectURL = revokeURL;
  });
  vi.mocked(useAuth).mockReturnValue({ user: customer, isAuthenticated: true } as ReturnType<typeof useAuth>);
  vi.mocked(householdService.list).mockResolvedValue([request.household]);
  vi.mocked(catalogService.listServices).mockResolvedValue([service]);
  vi.mocked(professionalSearchService.list).mockResolvedValue([]);
  vi.mocked(serviceRequestService.create).mockResolvedValue(request);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function mount() {
  const close = vi.fn();
  const success = vi.fn();
  const props = { isOpen: true, onClose: close, onSuccess: success, category, initialDescription: "Fuga debajo del lavamanos" };
  const view = render(<MemoryRouter><TomarServicioModal {...props} /></MemoryRouter>);
  return { ...view, close, success, props };
}
const photo = (name: string) => new File(["image"], name, { type: "image/png" });
const problemPhotoInput = () => screen.getByLabelText("Fotos del problema", { selector: "input" });

describe("Fotos antes de enviar Tomar servicio", () => {
  it("el perfil profesional propio nunca aparece entre los candidatos seleccionables", async () => {
    const { professional } = await import("../../test/workflowFixtures");
    let finish!: (profiles: typeof professional[]) => void;
    vi.mocked(professionalSearchService.list).mockImplementation(() => new Promise<typeof professional[]>((resolve) => { finish = resolve; }));
    mount();
    await screen.findByText(service.name);
    await waitFor(() => expect(professionalSearchService.list).toHaveBeenCalled());
    await act(async () => { finish([{ ...professional, display_name: "Mi propio perfil", is_own_profile: true }]); });
    expect(screen.queryByText("Mi propio perfil")).not.toBeInTheDocument();
  });

  it("permite previsualizar fotos, quitar una y enviar las restantes con la solicitud", async () => {
    const { close, success } = mount();
    await screen.findByText(service.name);
    const removed = photo("antes.png");
    const retained = photo("problema.png");
    fireEvent.change(problemPhotoInput(), { target: { files: [removed, retained] } });
    expect(await screen.findByAltText("Foto adjunta 2")).toBeInTheDocument();
    expect(serviceRequestService.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Quitar foto 1" }));
    expect(await screen.findByText("1 de 6 fotos adjuntas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar dirección y tomar servicio/ }));
    await waitFor(() => expect(serviceRequestService.create).toHaveBeenCalledWith(expect.objectContaining({ household: request.household.id, selected_service: 5, description: "Fuga debajo del lavamanos" }), [retained]));
    expect(close).toHaveBeenCalled();
    expect(success).toHaveBeenCalledWith("/seguimiento/solicitud/31");
    expect(revokeURL).toHaveBeenCalled();
  });

  it("permite tomar una foto con la cámara antes de confirmar", async () => {
    mount();
    await screen.findByText(service.name);
    const image = photo("camara.png");
    fireEvent.change(screen.getByLabelText("Foto desde la cámara"), { target: { files: [image] } });
    expect(await screen.findByAltText("Foto adjunta 1")).toBeInTheDocument();
    expect(serviceRequestService.create).not.toHaveBeenCalled();
  });

  it("conserva las fotos si falla el envío para poder reintentar", async () => {
    const { close } = mount();
    await screen.findByText(service.name);
    fireEvent.change(problemPhotoInput(), { target: { files: [photo("problema.png")] } });
    vi.mocked(serviceRequestService.create).mockRejectedValue(new ApiError(503, "Error", { detail: "No se pudo guardar la solicitud." }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar dirección y tomar servicio/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar la solicitud.");
    expect(screen.getByAltText("Foto adjunta 1")).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });

  it("limpia las fotos y sus vistas previas al cerrar y volver a abrir", async () => {
    const view = mount();
    await screen.findByText(service.name);
    fireEvent.change(problemPhotoInput(), { target: { files: [photo("problema.png")] } });
    await screen.findByAltText("Foto adjunta 1");
    view.rerender(<MemoryRouter><TomarServicioModal {...view.props} isOpen={false} /></MemoryRouter>);
    await waitFor(() => expect(revokeURL).toHaveBeenCalled());
    view.rerender(<MemoryRouter><TomarServicioModal {...view.props} /></MemoryRouter>);
    expect(await screen.findByText("0 de 6 fotos adjuntas")).toBeInTheDocument();
    expect(screen.queryByAltText("Foto adjunta 1")).not.toBeInTheDocument();
  });

  it("rechaza archivos que no son fotos y evita superar el límite de adjuntos", async () => {
    mount();
    await screen.findByText(service.name);
    const input = problemPhotoInput();
    fireEvent.change(input, { target: { files: [new File(["text"], "nota.txt", { type: "text/plain" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("únicamente archivos de imagen");
    fireEvent.change(input, { target: { files: Array.from({ length: 6 }, (_, index) => photo(`${index}.png`)) } });
    expect(await screen.findByText("6 de 6 fotos adjuntas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adjuntar fotos" })).toBeDisabled();
    fireEvent.change(input, { target: { files: [photo("otra.png")] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("hasta 6 fotos");
    expect(serviceRequestService.create).not.toHaveBeenCalled();
  });
});
