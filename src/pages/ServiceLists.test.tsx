import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import ProfessionalJobsPage from "./ProfessionalJobsPage";
import MisReserva from "../components/misreservas/misreserva";
import { useAuth } from "../context/AuthContext";
import { orderService, serviceRequestService } from "../services/serviprox";
import { ApiError } from "../services/api";
import { customer, makeOrder, makeRequest } from "../test/workflowFixtures";
import { enterView, leaveView } from "../test/ionicMock";

vi.mock("@ionic/react", async () => import("../test/ionicMock"));
vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../services/serviprox", () => ({ orderService: { list: vi.fn() }, serviceRequestService: { list: vi.fn() } }));
vi.mock("../components/MaintenanceNotice", () => ({ MaintenanceNotice: () => null, useMaintenance: () => ({ active: false }) }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useAuth).mockReturnValue({ user: customer, isAuthenticated: true } as ReturnType<typeof useAuth>);
  vi.mocked(orderService.list).mockResolvedValue([]);
  vi.mocked(serviceRequestService.list).mockResolvedValue([]);
});
afterEach(cleanup);

describe("Accesos permanentes a servicios", () => {
  it("el cliente puede volver a una solicitud que todavía no tiene orden", async () => {
    vi.mocked(serviceRequestService.list).mockResolvedValue([makeRequest()]);
    render(<MisReserva />);
    expect(await screen.findByRole("link", { name: "Ver seguimiento" })).toHaveAttribute("href", "/seguimiento/solicitud/31");
  });

  it("un error de API no se presenta como una lista vacía", async () => {
    vi.mocked(serviceRequestService.list).mockRejectedValue(new ApiError(503, "Sin conexión", { detail: "Sin conexión" }));
    render(<MisReserva />);
    expect(await screen.findByText("Sin conexión")).toBeInTheDocument();
    expect(screen.queryByText(/No tienes solicitudes.*registradas/)).not.toBeInTheDocument();
  });

  it("el profesional retoma activos y abre resúmenes desde el historial", async () => {
    vi.mocked(orderService.list).mockResolvedValue([makeOrder(), makeOrder({ id: 8, status: "completed", status_label: "Completada" })]);
    render(<ProfessionalJobsPage />);
    expect(await screen.findByRole("link", { name: "Continuar seguimiento" })).toHaveAttribute("href", "/seguimiento/7");
    fireEvent.change(screen.getByLabelText("Mostrar"), { target: { value: "history" } });
    expect(screen.getByRole("link", { name: "Ver resumen" })).toHaveAttribute("href", "/seguimiento/8");
    expect(screen.queryByRole("link", { name: "Continuar seguimiento" })).not.toBeInTheDocument();
  });

  it("actualiza la lista profesional al regresar a una vista conservada", async () => {
    render(<ProfessionalJobsPage />);
    await screen.findByText("No tienes trabajos activos.");
    act(() => leaveView());
    vi.mocked(orderService.list).mockResolvedValue([makeOrder({ id: 99 })]);
    act(() => enterView());
    expect(await screen.findByRole("link", { name: "Continuar seguimiento" })).toHaveAttribute("href", "/seguimiento/99");
  });
});
