import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => false } }));
const BASE = "https://api.example.com/api/v1";
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("PROD", "true");
  vi.stubEnv("VITE_API_URL", BASE);
  localStorage.clear();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("API de produccion", () => {
  it("usa solo la API compilada aunque exista un host guardado", async () => {
    localStorage.setItem("serviprox_api_host", "http://localhost:8000");
    const client = await import("./api");
    expect(client.getCandidateBaseUrls()).toEqual([BASE]);
    expect(client.normalizeApiUrl(BASE + "///")).toBe(BASE);
    client.setWorkingBaseUrl("https://otro.example.com");
    expect(client.getApiBaseUrl()).toBe(BASE);
  });

  it("construye URL y Authorization sin enviar cookies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ id: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const { api, tokenStorage } = await import("./api");
    tokenStorage.setTokens("access-test", "refresh-test");
    await api.get("professionals/", { params: { lat: 4.6, lng: -74, service: 7 } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(BASE + "/professionals/?lat=4.6&lng=-74&service=7");
    expect(init.headers.get("Authorization")).toBe("Bearer access-test");
    expect(init.credentials).toBeUndefined();
  });

  it("rechaza URLs absolutas ajenas antes de transmitir un JWT", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("./api");
    await expect(api.blob("https://otro.example.com/api/v1/photo/")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no repite una escritura cuando se pierde la respuesta", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Network failed"));
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("./api");
    await expect(api.post("requests/", { description: "Solicitud" })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("comparte refresh concurrente, persiste rotacion y reintenta con access nuevo", async () => {
    let refreshCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/token/refresh/")) {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return json({ access: "new-access", refresh: "new-refresh" });
      }
      return (init.headers as Headers).get("Authorization") === "Bearer new-access"
        ? json({ id: 1 }) : json({ detail: "expired" }, 401);
    }));
    const { api, tokenStorage } = await import("./api");
    tokenStorage.setTokens("old-access", "old-refresh");
    await Promise.all([api.get("auth/me/"), api.get("households/")]);
    expect(refreshCalls).toBe(1);
    expect(tokenStorage.getAccessToken()).toBe("new-access");
    expect(tokenStorage.getRefreshToken()).toBe("new-refresh");
  });

  it("borra tokens y avisa si refresh ya no es valido", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ detail: "expired" }, 401)));
    const expired = vi.fn();
    window.addEventListener("serviprox:auth-expired", expired);
    const { api, tokenStorage } = await import("./api");
    tokenStorage.setTokens("old", "invalid");
    await expect(api.get("auth/me/")).rejects.toThrow();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
    window.removeEventListener("serviprox:auth-expired", expired);
  });
});
