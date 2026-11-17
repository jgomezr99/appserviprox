import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Switch } from "react-router-dom";
import AdministrativeLoginPage from "./AdministrativeLoginPage";
import { LiveSupportChatModal } from "../components/pqr/LiveSupportChatModal";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/auth";
import { ApiError } from "../services/api";

vi.mock("@ionic/react", async () => {
  const mod = await import("../test/ionicMock");
  return {
    ...mod,
    IonImg: ({ src, alt }: { src?: string; alt?: string }) => <img src={src} alt={alt} />,
    IonInput: ({
      value,
      placeholder,
      type = "text",
      onIonInput,
    }: {
      value?: string;
      placeholder?: string;
      type?: string;
      onIonInput?: (event: { detail: { value: string } }) => void;
    }) => (
      <input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) => onIonInput?.({ detail: { value: event.target.value } })}
      />
    ),
  };
});
vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../components/ServerConnectionModal", () => ({
  ServerConnectionModal: () => null,
}));
vi.mock("../services/adminService", () => ({
  adminService: { respondPqr: vi.fn().mockResolvedValue({ ok: true }) },
}));
vi.mock("../services/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/auth")>();
  return {
    ...actual,
    authService: {
      ...actual.authService,
      registerAdminWorker: vi.fn(),
    },
  };
});

async function submitChatText(text: string) {
  const input = screen.getByPlaceholderText(/^Escribe |^Define /i);
  fireEvent.change(input, { target: { value: text } });
  const form = input.closest("form")!;
  await act(async () => {
    fireEvent.submit(form);
    await new Promise((resolve) => setTimeout(resolve, 320));
  });
}

describe("Chat administrativo de creación de cuenta", () => {
  const loginMock = vi.fn();
  const logoutMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: loginMock,
      logout: logoutMock,
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    cleanup();
  });

  it("completa los 6 pasos desde /login/administrativo, registra la cuenta y permite login inmediato a /admin", async () => {
    vi.mocked(authService.registerAdminWorker).mockResolvedValue({
      success: true,
      message: "Cuenta administrativa creada exitosamente.",
      storage_mode: "local-sqlite",
      user: {
        id: 10050,
        username: "admin_sofia",
        email: "sofia.admin@serviprox.com",
        full_name: "Sofía Ramírez",
        role: "staff",
        is_staff: true,
        is_superuser: true,
        area: "Defensoría y Mesa Técnica",
        phone: "3105559988",
      },
    });
    loginMock.mockResolvedValue({
      id: 10050,
      username: "admin_sofia",
      email: "sofia.admin@serviprox.com",
      role: "staff",
      is_staff: true,
      is_superuser: true,
    });

    render(
      <MemoryRouter initialEntries={["/login/administrativo"]}>
        <Switch>
          <Route path="/login/administrativo" exact component={AdministrativeLoginPage} />
          <Route path="/admin" exact render={() => <div>Panel Administrativo Activo</div>} />
        </Switch>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /¿Nuevo trabajador\? Crear cuenta por el chat/i }));
    expect(screen.getByText(/Módulo de Alta para Trabajadores Administrativos/i)).toBeInTheDocument();

    await submitChatText("Juanpablo9*");
    expect(screen.getByText(/Paso 1 de 6/i)).toBeInTheDocument();

    await submitChatText("admin_sofia");
    expect(screen.getByText(/Paso 2 de 6/i)).toBeInTheDocument();

    await submitChatText("Sofía Ramírez");
    expect(screen.getByText(/Paso 3 de 6/i)).toBeInTheDocument();

    await submitChatText("sofia.admin@serviprox.com");
    expect(screen.getByText(/Paso 4 de 6/i)).toBeInTheDocument();

    await submitChatText("3105559988");
    expect(screen.getByText(/Paso 5 de 6/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Defensoría y Mesa Técnica/i }));
      await new Promise((resolve) => setTimeout(resolve, 320));
    });
    expect(screen.getByText(/Paso 6 de 6/i)).toBeInTheDocument();

    await submitChatText("ClaveAdmin2026*");

    await waitFor(() => {
      expect(authService.registerAdminWorker).toHaveBeenCalledWith({
        worker_key: "Juanpablo9*",
        username: "admin_sofia",
        full_name: "Sofía Ramírez",
        email: "sofia.admin@serviprox.com",
        phone: "3105559988",
        area: "Defensoría y Mesa Técnica",
        password: "ClaveAdmin2026*",
      });
    });

    expect(await screen.findByText(/¡Cuenta administrativa creada exitosamente en Serviprox!/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Iniciar sesión ahora/i }));
    });

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith(
        {
          username: "admin_sofia",
          email: "sofia.admin@serviprox.com",
          password: "ClaveAdmin2026*",
        },
        { allowLocalWorkerFallback: true }
      );
      expect(screen.getByText("Panel Administrativo Activo")).toBeInTheDocument();
    });
  });

  it("permite corregir un nombre de usuario duplicado sin reiniciar todo el registro", async () => {
    vi.mocked(authService.registerAdminWorker)
      .mockRejectedValueOnce(new ApiError(400, "API request failed with status 400", { username: ["Ya existe una cuenta registrada con este nombre de usuario."] }))
      .mockResolvedValueOnce({
        success: true,
        message: "OK",
        storage_mode: "local-sqlite",
        user: {
          id: 10051,
          username: "admin_nuevo_2",
          email: "nuevo2@serviprox.com",
          full_name: "Ana Torres",
          role: "staff",
          is_staff: true,
          area: "Finanzas y Liquidaciones",
        },
      });

    render(
      <MemoryRouter initialEntries={["/login/administrativo"]}>
        <AdministrativeLoginPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /¿Nuevo trabajador\? Crear cuenta por el chat/i }));
    await submitChatText("Juanpablo9*");
    await submitChatText("admin_repetido");
    await submitChatText("Ana Torres");
    await submitChatText("nuevo2@serviprox.com");
    await submitChatText("3001112233");
    await submitChatText("Finanzas y Liquidaciones");
    await submitChatText("ClaveAdmin2026*");

    expect(await screen.findByText(/Escribe otro/i)).toBeInTheDocument();

    await submitChatText("admin_nuevo_2");
    expect(screen.getByText(/Usuario actualizado a/i)).toBeInTheDocument();

    await submitChatText("ClaveAdmin2026*");

    await waitFor(() => {
      expect(authService.registerAdminWorker).toHaveBeenLastCalledWith(
        expect.objectContaining({
          username: "admin_nuevo_2",
          email: "nuevo2@serviprox.com",
          password: "ClaveAdmin2026*",
        })
      );
    });
    expect(await screen.findByText(/¡Cuenta administrativa creada exitosamente en Serviprox!/i)).toBeInTheDocument();
  });

  it("en LiveSupportChatModal crea la cuenta administrativa y apunta a /login/administrativo", async () => {
    const originalLocation = window.location;
    const fakeLocation = { ...originalLocation, href: "http://localhost/cliente/inicio" };
    Object.defineProperty(window, "location", {
      value: fakeLocation,
      writable: true,
      configurable: true,
    });

    try {
      vi.mocked(authService.registerAdminWorker).mockResolvedValue({
        success: true,
        message: "OK",
        storage_mode: "local-sqlite",
        user: {
          id: 10052,
          username: "staff_modal",
          email: "modal@serviprox.com",
          full_name: "Luis Castro",
          role: "staff",
          is_staff: true,
          area: "Soporte Técnico e Infraestructura",
        },
      });

      const onClose = vi.fn();
      render(
        <LiveSupportChatModal
          isOpen={true}
          onClose={onClose}
          onPqrCreatedFromChat={vi.fn()}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Crear cuenta administrativa \(Staff\)/i }));
        await new Promise((resolve) => setTimeout(resolve, 320));
      });

      await submitChatText("Juanpablo9*");
      await submitChatText("staff_modal");
      await submitChatText("Luis Castro");
      await submitChatText("modal@serviprox.com");
      await submitChatText("3112223344");
      await submitChatText("Soporte Técnico e Infraestructura");
      await submitChatText("ClaveModal2026*");

      expect(await screen.findByText(/¡Cuenta administrativa creada exitosamente en Serviprox!/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Ir al Login Administrativo/i }));
      expect(onClose).toHaveBeenCalled();
      expect(fakeLocation.href).toBe("/login/administrativo");
    } finally {
      Object.defineProperty(window, "location", {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    }
  });
});
