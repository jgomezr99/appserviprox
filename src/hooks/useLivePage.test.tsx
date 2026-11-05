import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLivePage } from "./useLivePage";
import { enterView, leaveView } from "../test/ionicMock";

vi.mock("@ionic/react", async () => import("../test/ionicMock"));
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Páginas conservadas por Ionic", () => {
  it("actualiza al volver, pausa consultas al salir y limpia el intervalo al desmontar", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() => useLivePage(refresh));
    await act(async () => { await Promise.resolve(); });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(8000); });
    expect(refresh).toHaveBeenCalledTimes(2);
    act(() => leaveView());
    await act(async () => { vi.advanceTimersByTime(16000); });
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => enterView());
    expect(refresh).toHaveBeenCalledTimes(3);
    unmount();
    await act(async () => { vi.advanceTimersByTime(16000); });
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("no acumula consultas si la respuesta tarda más que el intervalo", async () => {
    vi.useFakeTimers();
    let resolve: () => void = () => undefined;
    const refresh = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    renderHook(() => useLivePage(refresh));
    act(() => { vi.advanceTimersByTime(24000); });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
    act(() => vi.advanceTimersByTime(8000));
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
