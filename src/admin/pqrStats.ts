export type PqrKind = "queja" | "reclamo" | "peticion" | "reporte";

export type PqrKpi = {
  count: number;
  /** Variación porcentual de los últimos 30 días frente a los 30 anteriores; null si no hay con qué comparar. */
  trend: number | null;
  /** Solicitudes por semana, de la más antigua a la más reciente. */
  weekly: number[];
};

export type PqrStats = { total: PqrKpi } & Record<PqrKind, PqrKpi>;

const DAY = 24 * 60 * 60 * 1000;
const WEEKS = 8;

const kpi = (dates: number[], now: number): PqrKpi => {
  const recent = dates.filter((time) => time > now - 30 * DAY && time <= now).length;
  const previous = dates.filter((time) => time > now - 60 * DAY && time <= now - 30 * DAY).length;
  let trend: number | null = null;
  if (previous > 0) trend = Math.round(((recent - previous) / previous) * 100);
  else if (recent > 0) trend = 100;

  const weekly = Array.from({ length: WEEKS }, () => 0);
  for (const time of dates) {
    const weeksAgo = Math.floor((now - time) / (7 * DAY));
    if (weeksAgo >= 0 && weeksAgo < WEEKS) weekly[WEEKS - 1 - weeksAgo] += 1;
  }
  return { count: dates.length, trend, weekly };
};

/** Totales, tendencia y actividad semanal por tipo, calculados con las solicitudes reales de la base de datos. */
export const computePqrStats = (items: Array<{ type: PqrKind; createdAt?: string }>, now = Date.now()): PqrStats => {
  const time = (item: { createdAt?: string }) => (item.createdAt ? new Date(item.createdAt).getTime() : NaN);
  const byKind = (kind?: PqrKind) =>
    items.filter((item) => !kind || item.type === kind).map(time).filter((value) => !Number.isNaN(value));
  const counted = (kind?: PqrKind) => {
    const result = kpi(byKind(kind), now);
    // Las solicitudes sin fecha válida también cuentan en el total.
    result.count = items.filter((item) => !kind || item.type === kind).length;
    return result;
  };
  return {
    total: counted(),
    queja: counted("queja"),
    reclamo: counted("reclamo"),
    peticion: counted("peticion"),
    reporte: counted("reporte"),
  };
};

export const trendLabel = (trend: number | null): string =>
  trend === null ? "—" : `${trend >= 0 ? "↗ +" : "↘ "}${trend}%`;

/** Trazo SVG suave (viewBox 100x30) con la actividad semanal. */
export const sparklinePath = (weekly: number[]): string => {
  const max = Math.max(...weekly, 1);
  const step = 100 / Math.max(weekly.length - 1, 1);
  const points = weekly.map((value, index) => [index * step, 27 - (value / max) * 24] as const);
  return points
    .map(([x, y], index) => {
      if (index === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      const [px, py] = points[index - 1];
      const mid = (px + x) / 2;
      return `C ${mid.toFixed(1)} ${py.toFixed(1)} ${mid.toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
};
