import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ServiceProgress from "./ServiceProgress";

afterEach(cleanup);

describe("Etapas visibles del servicio", () => {
  it("sitúa el formulario en Solicitud y la solicitud enviada en Confirmación", () => {
    const { rerender } = render(<ServiceProgress />);
    expect(screen.getByText("Solicitud").closest("li")).toHaveAttribute("aria-current", "step");
    rerender(<ServiceProgress status="open" />);
    expect(screen.getByText("Confirmación").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Visita").closest("li")).toHaveAttribute("data-state", "upcoming");
  });

  it.each(["accepted", "scheduled"])("%s no presenta la visita como iniciada", (status) => {
    render(<ServiceProgress status={status} />);
    expect(screen.getByText("Visita").closest("li")).toHaveAttribute("data-state", "upcoming");
    expect(screen.getByText("Cierre").closest("li")).toHaveAttribute("data-state", "upcoming");
  });

  it.each(["traveling", "arrived", "in_progress", "break"])("%s conserva la etapa Visita sin anticipar el cierre", (status) => {
    render(<ServiceProgress status={status} />);
    expect(screen.getByText("Visita").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Cierre").closest("li")).toHaveAttribute("data-state", "upcoming");
  });

  it("muestra el cierre completo cuando termina el trabajo", () => {
    render(<ServiceProgress status="completed" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    screen.getAllByRole("listitem").forEach((item) => expect(item).toHaveAttribute("data-state", "done"));
  });

  it.each(["cancelled", "rejected"])("%s no aparenta haber completado las etapas", (status) => {
    render(<ServiceProgress status={status} />);
    expect(screen.getByText("Este servicio se cerró sin completar todas las etapas.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
