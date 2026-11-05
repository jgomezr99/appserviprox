import React, { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import ProfessionalRequestDetailPage from "./ProfessionalRequestDetailPage";
import { serviceRequestService } from "../services/serviprox";
import { ApiError } from "../services/api";
import { makeOrder, makeRequest } from "../test/workflowFixtures";

vi.mock("@ionic/react", async () => {
  const base = await import("../test/ionicMock");
  return { ...base, IonAlert: (props: React.ComponentProps<typeof base.IonAlert>) => {
    // El overlay nativo puede conservar callbacks creados antes de abrirse.
    const buttons = useRef(props.buttons).current;
    return props.isOpen ? <div role="dialog"><h2>{props.header}</h2>{buttons.map((button, index) => typeof button === "string"
      ? <button key={index}>{button}</button> : <button key={index} onClick={button.handler}>{button.text}</button>)}</div> : null;
  } };
});
vi.mock("../services/serviprox", () => ({ serviceRequestService: { get: vi.fn(), accept: vi.fn(), reject: vi.fn() } }));
vi.mock("../components/serviprox/RequestImageGallery", () => ({ default: () => null }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(serviceRequestService.get).mockResolvedValue(makeRequest());
  vi.mocked(serviceRequestService.accept).mockResolvedValue(makeRequest({ status: "accepted", order: makeOrder() }));
  vi.mocked(serviceRequestService.reject).mockImplementation(async () => {
    const rejected = makeRequest({ status: "rejected", status_label: "Rechazada" });
    vi.mocked(serviceRequestService.get).mockResolvedValue(rejected);
    return rejected;
  });
});
afterEach(cleanup);
function mount() {
  return render(<MemoryRouter initialEntries={["/profesional/solicitudes/31"]}>
    <Route path="/profesional/solicitudes/:id"><ProfessionalRequestDetailPage /></Route>
    <Route path="/seguimiento/:id"><p>Seguimiento de la orden aceptada</p></Route>
  </MemoryRouter>);
}

describe("Confirmaciones independientes del profesional", () => {
  it("aceptar siempre llama accept y abre seguimiento, con callbacks conservados por el overlay", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Aceptar solicitud" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Aceptar solicitud" }));
    expect(await screen.findByText("Seguimiento de la orden aceptada")).toBeInTheDocument();
    expect(serviceRequestService.accept).toHaveBeenCalledWith("31");
    expect(serviceRequestService.reject).not.toHaveBeenCalled();
  });

  it("rechaza únicamente después de confirmar Rechazar solicitud", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Rechazar solicitud" }));
    expect(serviceRequestService.reject).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Rechazar solicitud" }));
    await waitFor(() => expect(serviceRequestService.reject).toHaveBeenCalledWith("31"));
    expect(serviceRequestService.accept).not.toHaveBeenCalled();
  });

  it("volver de las dos confirmaciones no acepta ni rechaza y después permite aceptar", async () => {
    mount();
    for (const label of ["Aceptar solicitud", "Rechazar solicitud"]) {
      fireEvent.click(await screen.findByRole("button", { name: label }));
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Volver" }));
    }
    expect(serviceRequestService.accept).not.toHaveBeenCalled();
    expect(serviceRequestService.reject).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Aceptar solicitud" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Aceptar solicitud" }));
    await waitFor(() => expect(serviceRequestService.accept).toHaveBeenCalledTimes(1));
    expect(serviceRequestService.reject).not.toHaveBeenCalled();
  });

  it("un error al aceptar se informa y nunca se convierte en un rechazo", async () => {
    vi.mocked(serviceRequestService.accept).mockRejectedValue(new ApiError(400, "Error", { status: "La solicitud ya no se puede aceptar." }));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Aceptar solicitud" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Aceptar solicitud" }));
    expect(await screen.findByRole("status")).toHaveTextContent("La solicitud ya no se puede aceptar.");
    expect(serviceRequestService.reject).not.toHaveBeenCalled();
  });
});
