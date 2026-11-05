import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import WorkTrackingPage from "./WorkTrackingPage";
import { useAuth } from "../context/AuthContext";
import { orderService, serviceRequestService } from "../services/serviprox";
import { ApiError } from "../services/api";
import { customer, worker, makeOrder, makeRequest } from "../test/workflowFixtures";
import { enterView, leaveView } from "../test/ionicMock";

vi.mock("@ionic/react", async () => import("../test/ionicMock"));
vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../services/serviprox", () => ({
  orderService: { get: vi.fn(), transition: vi.fn(), updateLocation: vi.fn(), setFinalPrice: vi.fn(), review: vi.fn(), addEvidence: vi.fn() },
  serviceRequestService: { get: vi.fn() },
}));
vi.mock("../components/serviprox/TravelMap", () => ({ default: () => <div data-testid="travel-map">Mapa del desplazamiento</div> }));
vi.mock("../components/serviprox/AuthenticatedImage", () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }));

function login(professional = false) {
  vi.mocked(useAuth).mockReturnValue({ user: professional ? worker : customer, isAuthenticated: true } as ReturnType<typeof useAuth>);
}
function mount(path = "/seguimiento/7", route = "/seguimiento/:id") {
  return render(<MemoryRouter initialEntries={[path]}><Route path={route}><WorkTrackingPage /></Route></MemoryRouter>);
}
beforeEach(() => {
  vi.resetAllMocks(); login();
  vi.mocked(orderService.get).mockResolvedValue(makeOrder({ available_transitions: ["cancelled"] }));
  vi.mocked(serviceRequestService.get).mockResolvedValue(makeRequest({ status: "accepted" }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Seguimiento real del servicio", () => {
  it("el cliente consulta la tarifa sin herramientas profesionales aunque reciba permisos incompatibles", async () => {
    vi.mocked(orderService.get).mockResolvedValue(makeOrder({ final_price: "75000", can_set_final_price: true,
      available_transitions: ["scheduled", "traveling", "arrived", "in_progress", "completed", "cancelled"] }));
    mount();
    expect(await screen.findByText("Tarifa confirmada por el profesional")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Opciones del cliente" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Herramientas del profesional" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Valor final acordado con el cliente (COP)")).not.toBeInTheDocument();
    for (const action of ["Guardar valor final", "Iniciar desplazamiento", "Confirmar llegada", "Terminar trabajo", "Adjuntar evidencia"]) {
      expect(screen.queryByRole("button", { name: action })).not.toBeInTheDocument();
    }
    expect(orderService.setFinalPrice).not.toHaveBeenCalled();
  });

  it("el profesional confirma tarifas con límites del rango y no recibe las acciones del cliente", async () => {
    login(true); mount();
    const input = await screen.findByLabelText("Valor final acordado con el cliente (COP)");
    expect(input).toHaveAttribute("min", "50000");
    expect(input).toHaveAttribute("max", "90000");
    expect(screen.queryByRole("region", { name: "Opciones del cliente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Código de llegada" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver pago del servicio" })).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "90000.01" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("dentro del rango publicado");
    expect(orderService.setFinalPrice).not.toHaveBeenCalled();
  });

  it("el bloqueo de tarifa indicado por el servidor oculta su edición", async () => {
    login(true);
    vi.mocked(orderService.get).mockResolvedValue(makeOrder({ final_price: "75000", can_set_final_price: false }));
    mount();
    await screen.findByRole("heading", { name: "Confirmar tarifa del trabajo" });
    expect(screen.queryByLabelText("Valor final acordado con el cliente (COP)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar valor final" })).not.toBeInTheDocument();
  });

  it("una discrepancia entre el actor del servidor y el perfil activo no habilita controles", async () => {
    vi.mocked(orderService.get).mockResolvedValue(makeOrder({ viewer_role: "professional", can_set_final_price: true }));
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("no corresponde a tu perfil activo");
    expect(screen.queryByRole("button", { name: "Guardar valor final" })).not.toBeInTheDocument();
  });

  it("cambiar al rol cliente con la misma cuenta retira los controles profesionales y recarga permisos", async () => {
    login(true);
    const view = mount();
    await screen.findByLabelText("Valor final acordado con el cliente (COP)");
    const previousCalls = vi.mocked(orderService.get).mock.calls.length;
    vi.mocked(useAuth).mockReturnValue({ user: { ...worker, role: "client" }, isAuthenticated: true } as ReturnType<typeof useAuth>);
    vi.mocked(orderService.get).mockRejectedValue(new ApiError(404, "Perfil incorrecto", { detail: "El servicio no pertenece al perfil activo." }));
    view.rerender(<MemoryRouter initialEntries={["/seguimiento/7"]}><Route path="/seguimiento/:id"><WorkTrackingPage /></Route></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("El servicio no pertenece al perfil activo.");
    expect(vi.mocked(orderService.get).mock.calls.length).toBeGreaterThan(previousCalls);
    expect(screen.queryByLabelText("Valor final acordado con el cliente (COP)")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Herramientas del profesional" })).not.toBeInTheDocument();
  });

  it("mantiene una solicitud pendiente sin fabricar una orden ni consultar un ID de orden coincidente", async () => {
    vi.mocked(serviceRequestService.get).mockResolvedValue(makeRequest());
    mount("/seguimiento/solicitud/31", "/seguimiento/solicitud/:requestId");
    expect(await screen.findByRole("heading", { name: "Pendiente de aceptación" })).toBeInTheDocument();
    expect(orderService.get).not.toHaveBeenCalled();
    expect(screen.queryByTestId("travel-map")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Terminar trabajo" })).not.toBeInTheDocument();
  });

  it("muestra asignación pendiente sin inventar un profesional", async () => {
    vi.mocked(serviceRequestService.get).mockResolvedValue(makeRequest({ professional: null }));
    mount("/seguimiento/solicitud/31", "/seguimiento/solicitud/:requestId");
    expect(await screen.findByRole("heading", { name: "Pendiente de asignación" })).toBeInTheDocument();
    expect(screen.getByText("Por asignar")).toBeInTheDocument();
  });

  it("un enlace de orden inexistente muestra el error sin reinterpretarlo como solicitud", async () => {
    vi.mocked(orderService.get).mockRejectedValue(new ApiError(404, "No existe la orden", { detail: "No existe la orden" }));
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("No existe la orden");
    expect(serviceRequestService.get).not.toHaveBeenCalled();
  });

  it.each(["accepted", "scheduled", "arrived", "in_progress", "break", "completed", "cancelled"])("oculta trayecto y distancia en estado %s", async (status) => {
    vi.mocked(orderService.get).mockResolvedValue(makeOrder({ status, available_transitions: [] }));
    mount();
    await screen.findByRole("heading", { name: "Plomería" });
    expect(screen.queryByTestId("travel-map")).not.toBeInTheDocument();
    expect(screen.queryByText("Distancia por carretera")).not.toBeInTheDocument();
  });

  it("muestra el mapa solo en camino y lo retira cuando el servidor confirma llegada", async () => {
    vi.mocked(orderService.get).mockResolvedValue(makeOrder({ status: "traveling", available_transitions: [] }));
    mount();
    expect(await screen.findByTestId("travel-map")).toBeInTheDocument();
    act(() => leaveView());
    vi.mocked(orderService.get).mockResolvedValue(makeOrder({ status: "arrived", available_transitions: [] }));
    act(() => enterView());
    expect(await screen.findByRole("heading", { name: "Profesional en el lugar" })).toBeInTheDocument();
    expect(screen.queryByTestId("travel-map")).not.toBeInTheDocument();
  });

  it("explica cuando faltan coordenadas y no dibuja una posición ficticia", async () => {
    vi.mocked(orderService.get).mockResolvedValue(makeOrder({ status: "traveling", professional_latitude: null, professional_longitude: null }));
    mount();
    expect(await screen.findByText(/Ubicación no disponible/)).toBeInTheDocument();
    expect(screen.queryByTestId("travel-map")).not.toBeInTheDocument();
  });

  it("solo ofrece transiciones autorizadas y muestra el error específico del servidor", async () => {
    login(true);
    vi.mocked(orderService.get).mockResolvedValue(makeOrder({ available_transitions: ["traveling"] }));
    vi.mocked(orderService.transition).mockRejectedValue(new ApiError(400, "Error", { status: "El profesional debe aceptar primero." }));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Iniciar desplazamiento" }));
    expect(await screen.findByRole("status")).toHaveTextContent("El profesional debe aceptar primero.");
    expect(screen.queryByRole("button", { name: "Terminar trabajo" })).not.toBeInTheDocument();
  });

  it("envía el código de llegada al servidor", async () => {
    login(true);
    vi.mocked(orderService.get).mockResolvedValue(makeOrder({ status: "traveling", arrival_code: "", available_transitions: ["arrived"] }));
    vi.mocked(orderService.transition).mockResolvedValue(makeOrder({ status: "arrived", available_transitions: ["in_progress"] }));
    mount();
    const button = await screen.findByRole("button", { name: "Confirmar llegada" });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Código de llegada del cliente"), { target: { value: "1234" } });
    fireEvent.click(button);
    await waitFor(() => expect(orderService.transition).toHaveBeenCalledWith(7, "arrived", "", { arrival_code: "1234" }));
    expect(await screen.findByRole("heading", { name: "Profesional en el lugar" })).toBeInTheDocument();
  });

  it("cierra el trabajo con pago pendiente y conserva resumen y evidencias", async () => {
    login(true);
    const completed = makeOrder({ status: "completed", available_transitions: [], events: [{ id: 1, status: "completed", status_label: "Completada", note: "", created_at: "2026-11-04T15:00:00Z" }], work_evidence: [{ id: 1, image_url: "/evidence/1", caption: "Trabajo realizado", created_at: "2026-11-04T14:00:00Z" }] });
    vi.mocked(orderService.get).mockResolvedValue(makeOrder({ status: "in_progress", available_transitions: ["completed"] }));
    vi.mocked(orderService.transition).mockResolvedValue(completed);
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Terminar trabajo" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByRole("heading", { name: "Resumen del trabajo terminado" })).toBeInTheDocument();
    expect(screen.getByText("Pendiente de pago")).toBeInTheDocument();
    expect(screen.getByAltText("Trabajo realizado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adjuntar evidencia" })).not.toBeInTheDocument();
  });

  it("permite al profesional registrar el precio y al cliente calificar el cierre", async () => {
    login(true); mount();
    fireEvent.change(await screen.findByLabelText("Valor final acordado con el cliente (COP)"), { target: { value: "75000" } });
    vi.mocked(orderService.setFinalPrice).mockResolvedValue(makeOrder({ final_price: "75000" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar valor final" }));
    await waitFor(() => expect(orderService.setFinalPrice).toHaveBeenCalledWith(7, "75000"));
    cleanup(); login();
    vi.mocked(orderService.get).mockResolvedValue(makeOrder({ status: "completed", available_transitions: [] }));
    vi.mocked(orderService.review).mockResolvedValue({ id: 3, order: 7, rating: 4, comment: "Buen trabajo", created_at: "2026-11-04T16:00:00Z" });
    mount(); fireEvent.change(await screen.findByLabelText("Puntuación"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Comentario (opcional)"), { target: { value: "Buen trabajo" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar calificación" }));
    await waitFor(() => expect(orderService.review).toHaveBeenCalledWith(7, 4, "Buen trabajo"));
    expect(await screen.findByText(/Calificación: 4\/5/)).toBeInTheDocument();
  });

  it("retoma la solicitud pendiente cuando aparece su orden aceptada", async () => {
    vi.mocked(serviceRequestService.get).mockResolvedValue(makeRequest());
    mount("/seguimiento/solicitud/31", "/seguimiento/solicitud/:requestId");
    await screen.findByRole("heading", { name: "Pendiente de aceptación" });
    act(() => leaveView());
    const order = makeOrder();
    vi.mocked(serviceRequestService.get).mockResolvedValue(makeRequest({ status: "accepted", order }));
    act(() => enterView());
    expect(await screen.findByRole("heading", { name: "Aceptado" })).toBeInTheDocument();
    expect(orderService.get).toHaveBeenCalledWith(7);
    expect(screen.getByRole("link", { name: "Volver a mis solicitudes" })).toHaveAttribute("href", "/cliente/solicitudes");
  });
});
