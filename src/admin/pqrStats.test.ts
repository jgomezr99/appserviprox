import { describe, expect, it } from "vitest";
import { computePqrStats, sparklinePath, trendLabel } from "./pqrStats";

const NOW = new Date("2026-11-10T12:00:00Z").getTime();
const daysAgo = (days: number) => new Date(NOW - days * 86400000).toISOString();

describe("computePqrStats", () => {
  it("cuenta por tipo con las solicitudes reales y el total", () => {
    const stats = computePqrStats(
      [
        { type: "queja", createdAt: daysAgo(2) },
        { type: "queja", createdAt: daysAgo(40) },
        { type: "reclamo", createdAt: daysAgo(5) },
        { type: "reporte", createdAt: daysAgo(1) },
        { type: "peticion" },
      ],
      NOW
    );
    expect(stats.total.count).toBe(5);
    expect(stats.queja.count).toBe(2);
    expect(stats.reclamo.count).toBe(1);
    expect(stats.peticion.count).toBe(1);
    expect(stats.reporte.count).toBe(1);
  });

  it("calcula la tendencia contra los 30 días anteriores", () => {
    const stats = computePqrStats(
      [
        { type: "queja", createdAt: daysAgo(1) },
        { type: "queja", createdAt: daysAgo(3) },
        { type: "queja", createdAt: daysAgo(5) },
        { type: "queja", createdAt: daysAgo(40) },
        { type: "queja", createdAt: daysAgo(45) },
      ],
      NOW
    );
    expect(stats.queja.trend).toBe(50);
    expect(trendLabel(stats.queja.trend)).toBe("↗ +50%");
    expect(trendLabel(-20)).toBe("↘ -20%");
    expect(trendLabel(null)).toBe("—");
  });

  it("sin datos no inventa cifras", () => {
    const stats = computePqrStats([], NOW);
    expect(stats.total).toEqual({ count: 0, trend: null, weekly: Array(8).fill(0) });
    expect(sparklinePath(stats.total.weekly)).toMatch(/^M 0\.0 27\.0/);
  });

  it("agrupa la actividad por semana, de la más antigua a la más reciente", () => {
    const stats = computePqrStats(
      [
        { type: "queja", createdAt: daysAgo(1) },
        { type: "queja", createdAt: daysAgo(2) },
        { type: "queja", createdAt: daysAgo(15) },
      ],
      NOW
    );
    expect(stats.queja.weekly[7]).toBe(2);
    expect(stats.queja.weekly[5]).toBe(1);
  });
});
