import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";
import { orderService, serviceRequestService } from "./serviprox";
import { apiMessage, completedAt, coordinates, trackingPath } from "../utils/workflow";
import { makeOrder, makeRequest } from "../test/workflowFixtures";

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } };
});
beforeEach(() => { vi.resetAllMocks(); });

describe("Solicitudes y órdenes guardadas", () => {
  it("recupera solicitudes antiguas después de la primera página conservando el filtro", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ results: [{ id: 31 }], next: "https://untrusted.example/requests/?page=2" })
      .mockResolvedValueOnce({ results: [{ id: 1 }], next: null });
    expect(await serviceRequestService.list({ status: "accepted" })).toEqual([{ id: 31 }, { id: 1 }]);
    expect(api.get).toHaveBeenNthCalledWith(1, "requests/?status=accepted&page=1");
    expect(api.get).toHaveBeenNthCalledWith(2, "requests/?status=accepted&page=2");
  });

  it("recupera todo el historial de órdenes y propaga errores de páginas intermedias", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ results: [{ id: 21 }], next: "?page=2" })
      .mockResolvedValueOnce({ results: [{ id: 1 }], next: null });
    expect(await orderService.list()).toEqual([{ id: 21 }, { id: 1 }]);
    const failure = new ApiError(503, "Sin conexión", {});
    vi.mocked(api.get).mockResolvedValueOnce({ results: [{ id: 21 }], next: "?page=2" }).mockRejectedValueOnce(failure);
    await expect(orderService.list()).rejects.toBe(failure);
  });

  it("distingue los identificadores de solicitud y orden incluso si coinciden", () => {
    expect(trackingPath(makeRequest({ id: 7 }))).toBe("/seguimiento/solicitud/7");
    expect(trackingPath(makeRequest({ id: 7, order: makeOrder({ id: 42 }) }))).toBe("/seguimiento/42");
  });

  it("envía agenda, código de llegada y precio a la orden correcta", async () => {
    await orderService.transition(7, "arrived", "", { arrival_code: "1234" });
    expect(api.post).toHaveBeenCalledWith("orders/7/transition/", { status: "arrived", note: "", arrival_code: "1234" });
    await orderService.transition(7, "scheduled", "", { scheduled_for: "2026-12-01T15:00:00Z" });
    expect(api.post).toHaveBeenCalledWith("orders/7/transition/", { status: "scheduled", note: "", scheduled_for: "2026-12-01T15:00:00Z" });
    await orderService.setFinalPrice(7, "75000");
    expect(api.post).toHaveBeenCalledWith("orders/7/price/", { final_price: "75000" });
  });

  it("envía las fotos originales y los datos de la solicitud en un único multipart", async () => {
    const files = [new File(["photo-a"], "problema-a.png", { type: "image/png" }), new File(["photo-b"], "problema-b.png", { type: "image/png" })];
    await serviceRequestService.create({ household: 3, selected_service: 5, professional: null, description: "Fuga de agua" }, files);
    const [path, body] = vi.mocked(api.post).mock.calls[0];
    expect(path).toBe("requests/");
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get("description")).toBe("Fuga de agua");
    expect(form.get("household")).toBe("3");
    expect(form.has("professional")).toBe(false);
    expect(form.getAll("images")).toEqual(files);
  });

  it("conserva coordenadas cero y rechaza coordenadas ausentes o imposibles", () => {
    expect(coordinates(0, "0")).toEqual([0, 0]);
    expect(coordinates(4.65, -74.06)).toEqual([4.65, -74.06]);
    for (const [lat, lng] of [[null, -74], [4, ""], [91, 0], [0, -181], [NaN, 0], [0, Infinity]]) expect(coordinates(lat, lng)).toBeNull();
  });

  it("explica errores de validación y toma la fecha real del evento de cierre", () => {
    expect(apiMessage(new ApiError(400, "Error genérico", { status: "El código es incorrecto." }), "Error")).toBe("El código es incorrecto.");
    expect(completedAt(makeOrder({ events: [{ id: 1, status: "completed", status_label: "Completada", note: "", created_at: "2026-11-04T15:00:00Z" }] }))).toBe("2026-11-04T15:00:00Z");
    expect(completedAt(makeOrder())).toBeUndefined();
  });
});
