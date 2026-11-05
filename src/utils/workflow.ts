import type { Order, ServiceRequest } from "../types/serviprox";
import { ApiError } from "../services/api";

export const workLabels: Record<string, string> = {
  requested: "Pendiente de aceptación", accepted: "Aceptado", scheduled: "Visita agendada",
  traveling: "En camino", arrived: "Profesional en el lugar", in_progress: "Trabajando",
  break: "En pausa", lunch: "Almuerzo", other_service: "En pausa por otro servicio",
  completed: "Trabajo terminado", cancelled: "Servicio cancelado",
};

export const actionLabels: Record<string, string> = {
  traveling: "Iniciar desplazamiento", arrived: "Confirmar llegada", in_progress: "Comenzar o reanudar trabajo",
  break: "Tomar pausa", lunch: "Pausa de almuerzo", other_service: "Pausar por otro servicio",
  completed: "Terminar trabajo", cancelled: "Cancelar servicio",
};

export const isTerminal = (status: string) => ["completed", "cancelled", "closed", "rejected"].includes(status);
export const trackingPath = (request: Pick<ServiceRequest, "id" | "order">) =>
  request.order ? `/seguimiento/${request.order.id}` : `/seguimiento/solicitud/${request.id}`;

export function coordinates(lat: unknown, lng: unknown): [number, number] | null {
  if (lat === null || lat === undefined || lat === "" || lng === null || lng === undefined || lng === "") return null;
  const pair: [number, number] = [Number(lat), Number(lng)];
  return pair.every(Number.isFinite) && Math.abs(pair[0]) <= 90 && Math.abs(pair[1]) <= 180 ? pair : null;
}

export function apiMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.payload && typeof error.payload === "object") {
    const values = Object.values(error.payload).flat().filter((value) => typeof value === "string");
    if (values.length) return values.join(" ");
  }
  return error instanceof Error ? error.message : fallback;
}

export const completedAt = (order: Pick<Order, "events">) =>
  [...order.events].reverse().find((event) => event.status === "completed")?.created_at;
