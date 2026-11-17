import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => false } }));

const VM_BASE = "https://serviprox-pte.duckdns.org/api/v1";
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("PROD", "false");
  vi.stubEnv("VITEST", "");
  vi.stubEnv("VITE_API_URL", VM_BASE);
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Registro administrativo por chat y autenticación", () => {
  it("crea la cuenta en respaldo SQLite local cuando la MV responde 404 sin sesión y permite login", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === `${VM_BASE}/auth/admin/register-worker/` || url === `${VM_BASE}/admin/register-worker/` || url === `${VM_BASE}/auth/register-worker/`) {
        return json({ detail: "Recurso no encontrado." }, 404);
      }
      if (url === "http://localhost/api/v1/auth/admin/register-worker/") {
        const body = JSON.parse(String(init?.body || "{}"));
        expect(body.worker_key).toBe("Juanpablo9*");
        return json(
          {
            success: true,
            message: "Cuenta administrativa creada exitosamente.",
            user: {
              id: 10001,
              username: body.username,
              email: body.email,
              full_name: body.full_name,
              role: "staff",
              is_staff: true,
              is_superuser: true,
              area: body.area,
              phone: body.phone,
            },
          },
          201
        );
      }
      if (url === `${VM_BASE}/auth/token/`) {
        return json({ detail: "No active account found with the given credentials" }, 401);
      }
      if (url === "http://localhost/api/v1/auth/token/") {
        const body = JSON.parse(String(init?.body || "{}"));
        expect(body.strict_password).toBe(true);
        expect(body.require_admin).toBe(true);
        return json({ access: "local-access-jwt", refresh: "local-refresh-jwt" }, 200);
      }
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { authService, isRememberedLocalAdminAccount } = await import("./auth");
    const { tokenStorage, getConnectionMode } = await import("./api");

    const created = await authService.registerAdminWorker({
      worker_key: "Juanpablo9*",
      username: "admin_chat1",
      full_name: "Ana María López",
      email: "ana.lopez@serviprox.com",
      phone: "3101234567",
      area: "Defensoría y Mesa Técnica",
      password: "ClaveSegura2026",
    });

    expect(created.success).toBe(true);
    expect(created.storage_mode).toBe("local-sqlite");
    expect(created.user.role).toBe("staff");
    expect(created.user.is_staff).toBe(true);
    expect(isRememberedLocalAdminAccount("admin_chat1")).toBe(true);

    const tokens = await authService.login(
      { username: "admin_chat1", email: "admin_chat1", password: "ClaveSegura2026" },
      { allowLocalWorkerFallback: true }
    );
    expect(tokens.access).toBe("local-access-jwt");
    expect(tokenStorage.getAccessToken()).toBe("local-access-jwt");
    expect(getConnectionMode()).toBe("local-sqlite");
  });

  it("propaga errores 403/400 sin ocultarlos al registrar trabajador", async () => {
    const fetchMock = vi.fn(async () =>
      json({ detail: "Clave de trabajador autorizado incorrecta." }, 403)
    );
    vi.stubGlobal("fetch", fetchMock);

    const { authService } = await import("./auth");
    await expect(
      authService.registerAdminWorker({
        worker_key: "INCORRECTA",
        username: "admin_bad",
        full_name: "Test",
        email: "bad@serviprox.com",
        area: "Soporte",
        password: "ClaveSegura2026",
      })
    ).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("crea y promueve cuenta administrativa directo en MV si hay sesión admin activa", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("register-worker/")) {
        return json({ detail: "Recurso no encontrado." }, 404);
      }
      if (url === `${VM_BASE}/auth/me/`) {
        return json({ id: 1, username: "superadmin", role: "staff", is_staff: true, is_superuser: true });
      }
      if (url === `${VM_BASE}/auth/register/`) {
        const body = JSON.parse(String(init?.body || "{}"));
        return json({ id: 555, username: body.username, email: body.email, role: "client" }, 201);
      }
      if (url === `${VM_BASE}/admin/action/`) {
        const body = JSON.parse(String(init?.body || "{}"));
        expect(body).toMatchObject({
          action: "change_user_role",
          user_id: 555,
          new_role: "superadmin",
        });
        return json({ ok: true, message: "Rol actualizado a Superadministrador" }, 200);
      }
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { tokenStorage } = await import("./api");
    tokenStorage.setTokens("vm-admin-access", "vm-admin-refresh");
    const { authService } = await import("./auth");

    const res = await authService.registerAdminWorker({
      worker_key: "Juanpablo9*",
      username: "admin_vm_nuevo",
      full_name: "Carlos Gómez",
      email: "carlos.gomez@serviprox.com",
      phone: "3009998877",
      area: "Supervisión y Control Staff",
      password: "ClaveSegura2026",
    });

    expect(res.success).toBe(true);
    expect(res.storage_mode).toBe("vm");
    expect(res.user.id).toBe(555);
    expect(res.user.is_staff).toBe(true);
  });

  it("mantiene fijado el backend local SQLite tras login de trabajador aunque checkBackendHealth pruebe la MV o se recargue el módulo", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === `${VM_BASE}/auth/token/`) {
        return json({ detail: "No active account found" }, 401);
      }
      if (url === "http://localhost/api/v1/auth/token/") {
        return json({ access: "local-jwt", refresh: "local-refresh" }, 200);
      }
      if (url === "http://localhost/api/v1/health/") {
        return json({ status: "ok", database: "connected", engine: "sqlite", source: "local-sqlite" }, 200);
      }
      if (url === `${VM_BASE}/health/`) {
        return json({ status: "ok", database: "connected", engine: "postgresql" }, 200);
      }
      if (url === "http://localhost/api/v1/auth/me/") {
        return json({ id: 10002, username: "jpablo", role: "staff", is_staff: true }, 200);
      }
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { authService } = await import("./auth");
    const apiMod = await import("./api");

    await authService.login(
      { username: "jpablo", email: "jpablo", password: "ClaveSegura2026" },
      { allowLocalWorkerFallback: true }
    );

    expect(apiMod.getSessionAuthMode()).toBe("local-sqlite");
    const health = await apiMod.checkBackendHealth();
    expect(health.mode).toBe("local-sqlite");
    expect(apiMod.getCandidateBaseUrls()[0]).toBe("http://localhost/api/v1");

    vi.resetModules();
    const reloadedApi = await import("./api");
    expect(reloadedApi.getApiBaseUrl()).toBe("http://localhost/api/v1");
    await reloadedApi.api.get("auth/me/");
    expect(fetchMock).toHaveBeenCalledWith("http://localhost/api/v1/auth/me/", expect.any(Object));
  });
});
