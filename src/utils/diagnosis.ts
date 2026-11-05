import type { DiagnosticSession, Service, ServiceCategory, ServiceSuggestion } from "../types/serviprox";

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const validId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const text = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;

function category(value: unknown): ServiceCategory | null {
  const item = record(value);
  if (!item || !validId(item.id) || typeof item.name !== "string") return null;
  return {
    id: item.id, name: item.name, slug: text(item.slug), description: text(item.description),
    icon_key: text(item.icon_key), professionals_count: number(item.professionals_count),
  };
}

/** La API puede ser de una versión anterior: nunca entregar listas o textos inválidos al render. */
export function normalizeDiagnosticSession(payload: unknown, description: string): DiagnosticSession {
  const session = record(payload);
  if (!session || !validId(session.id)) throw new Error("La respuesta de orientación no contiene una sesión válida.");
  if (session.service_ranking != null && !Array.isArray(session.service_ranking)) {
    throw new Error("La respuesta de orientación contiene sugerencias inválidas.");
  }
  const suggestedCategory = category(session.suggested_category);
  const serviceRanking: ServiceSuggestion[] = [];
  for (const value of session.service_ranking || []) {
    const item = record(value);
    const serviceCategory = item && category(item.category);
    if (!item || !validId(item.id) || typeof item.name !== "string" || !serviceCategory) continue;
    serviceRanking.push({
      id: item.id, name: item.name, category: serviceCategory, score: number(item.score),
      matched_terms: Array.isArray(item.matched_terms) ? item.matched_terms.filter((term): term is string => typeof term === "string") : [],
    });
  }
  const rawService = record(session.suggested_service);
  const suggestedService: Service | null = rawService && validId(rawService.id) && validId(rawService.category) && typeof rawService.name === "string" ? {
    id: rawService.id, category: rawService.category, category_slug: text(rawService.category_slug),
    name: rawService.name, slug: text(rawService.slug), description: text(rawService.description),
    price_min: typeof rawService.price_min === "string" ? rawService.price_min : null,
    price_max: typeof rawService.price_max === "string" ? rawService.price_max : null,
    estimated_hours: typeof rawService.estimated_hours === "string" ? rawService.estimated_hours : null,
  } : null;
  const status = ["draft", "suggested", "confirmed", "discarded"].includes(text(session.status))
    ? session.status as DiagnosticSession["status"] : "suggested";
  return {
    id: session.id, description: text(session.description, description), status,
    suggested_category: suggestedCategory, suggested_service: suggestedService,
    confidence: number(session.confidence), rationale: text(session.rationale), service_ranking: serviceRanking,
    ranking: Array.isArray(session.ranking) ? session.ranking.flatMap((value) => {
      const item = record(value);
      return item && typeof item.slug === "string" && typeof item.name === "string"
        ? [{ slug: item.slug, name: item.name, score: number(item.score) }] : [];
    }) : [],
  };
}
