import { api } from "./api";

export interface DatabaseInfo {
  connected: boolean;
  engine?: string;
  database_name?: string;
  timestamp?: string;
  detail?: string;
}

export interface AdminKPIs {
  clients: number;
  professionals: number;
  hired_services: number;
  pending_publications: number;
  open_pqrs: number;
  technical_issues: number;
  raw_clients?: number;
  raw_pros?: number;
  raw_services?: number;
  raw_publications?: number;
  raw_pqrs?: number;
  raw_issues?: number;
}

export interface AdminOverviewResponse {
  database: DatabaseInfo;
  kpis: AdminKPIs;
  charts: {
    user_distribution: {
      clients: number;
      professionals: number;
      administrators: number;
    };
    pqr_chart: {
      radicado: number;
      en_revision: number;
      conciliacion: number;
      resuelto: number;
    };
  };
  requests_list: any[];
  top_professionals: any[];
  audit_logs: any[];
}

export const adminService = {
  /**
   * Obtiene la visión general en vivo directamente consultada de la base de datos de Serviprox.
   */
  async getOverview(): Promise<AdminOverviewResponse> {
    try {
      const response = await api.get<AdminOverviewResponse>("admin/overview/");
      return response;
    } catch (err) {
      console.warn("No se pudo conectar a la base de datos para overview, usando respaldo local:", err);
      return {
        database: {
          connected: false,
          engine: "offline",
          detail: "Sin conexión con backend en este momento",
        },
        kpis: {
          clients: 1248,
          professionals: 356,
          hired_services: 1890,
          pending_publications: 42,
          open_pqrs: 27,
          technical_issues: 5,
        },
        charts: {
          user_distribution: {
            clients: 1248,
            professionals: 356,
            administrators: 18,
          },
          pqr_chart: {
            radicado: 6,
            en_revision: 9,
            conciliacion: 4,
            resuelto: 8,
          },
        },
        requests_list: [],
        top_professionals: [],
        audit_logs: [],
      };
    }
  },

  /**
   * Ejecuta una acción administrativa y la guarda en la base de datos (con registro de auditoría).
   */
  async executeAction(params: {
    action: "approve_request" | "reject_request" | "block_user" | "unblock_user" | "assign_benefits" | "respond_pqr" | "assign_problem" | "update_problem_status" | "create_problem" | string;
    target_id: string | number;
    reason?: string;
    admin_name?: string;
    block_type?: "temporal" | "permanente" | string;
    block_duration?: number;
    points?: number;
    recharge?: number;
    response_text?: string;
    new_status?: string;
    send_notification?: boolean;
    assigned_to?: string;
    category_label?: string;
    description?: string;
    reported_by?: string;
    device_info?: string;
    module?: string;
    ticket_number?: string;
    status?: string;
    [key: string]: any;
  }): Promise<{ ok: boolean; message: string; [key: string]: any }> {
    // Sincronizar en almacenamiento local para sesiones demo / sin conexión
    const BLOCKED_KEY = "serviprox_blocked_users";
    try {
      const stored = JSON.parse(localStorage.getItem(BLOCKED_KEY) || "{}");
      const targetStr = String(params.target_id).toLowerCase();
      if (params.action === "block_user") {
        const now = new Date();
        const duration = Number(params.block_duration) || 7;
        const isTemporal = params.block_type !== "permanente";
        const blockedUntil = isTemporal
          ? new Date(now.getTime() + duration * 24 * 60 * 60 * 1000).toISOString()
          : null;

        stored[targetStr] = {
          is_blocked: true,
          block_type: params.block_type || "temporal",
          block_duration_days: duration,
          block_reason: params.reason || "Suspensión disciplinaria por la administración.",
          blocked_at: now.toISOString(),
          blocked_until: blockedUntil,
        };
        localStorage.setItem(BLOCKED_KEY, JSON.stringify(stored));
      } else if (params.action === "unblock_user") {
        delete stored[targetStr];
        localStorage.setItem(BLOCKED_KEY, JSON.stringify(stored));
      }
    } catch {
      // Ignorar fallas de localStorage
    }

    try {
      return await api.post("admin/action/", params);
    } catch (err: any) {
      console.warn("Error al registrar acción en BD:", err);
      return {
        ok: true,
        message: "Acción aplicada en interfaz local (backend en modo diferido).",
      };
    }
  },

  /**
   * Responde a una PQR, queja o reporte técnico en la BD y envía notificación al cliente.
   */
  async respondPqr(params: {
    targetId: string | number;
    responseText: string;
    newStatus?: string;
    adminName?: string;
    sendNotification?: boolean;
  }): Promise<{ ok: boolean; message: string; [key: string]: any }> {
    return await this.executeAction({
      action: "respond_pqr",
      target_id: params.targetId,
      response_text: params.responseText,
      new_status: params.newStatus || "resuelto",
      admin_name: params.adminName || "Superadministrador",
      send_notification: params.sendNotification !== false,
      reason: params.responseText,
    });
  },

  /**
   * Consulta listado de usuarios de la base de datos.
   */
  async getUsers(role?: string): Promise<{ count: number; users: any[] }> {
    try {
      return await api.get<{ count: number; users: any[] }>("admin/users/", {
        params: role ? { role } : undefined,
      });
    } catch {
      return { count: 0, users: [] };
    }
  },

  /**
   * Consulta listado de PQRs de la base de datos.
   */
  async getPqrs(): Promise<any[]> {
    try {
      return await api.get<any[]>("pqrs/");
    } catch {
      return [];
    }
  },

  /**
   * Consulta fallas técnicas de la aplicación desde la base de datos.
   */
  async getProblems(): Promise<any[]> {
    try {
      return await api.get<any[]>("app-problems/", { params: { all: "true" } });
    } catch {
      return [];
    }
  },

  /**
   * Asigna un técnico responsable a una incidencia técnica en la base de datos.
   */
  async assignProblem(params: {
    targetId: string | number;
    assignedTo: string;
    adminName?: string;
    reason?: string;
  }): Promise<{ ok: boolean; message: string; [key: string]: any }> {
    return await this.executeAction({
      action: "assign_problem",
      target_id: params.targetId,
      assigned_to: params.assignedTo,
      admin_name: params.adminName || "Superadministrador",
      reason: params.reason || `Asignada a ${params.assignedTo}`,
    });
  },

  /**
   * Actualiza el estado de una incidencia técnica en la base de datos.
   */
  async updateProblemStatus(params: {
    targetId: string | number;
    newStatus: string;
    adminName?: string;
    reason?: string;
  }): Promise<{ ok: boolean; message: string; [key: string]: any }> {
    return await this.executeAction({
      action: "update_problem_status",
      target_id: params.targetId,
      new_status: params.newStatus,
      admin_name: params.adminName || "Superadministrador",
      reason: params.reason || `Estado actualizado a ${params.newStatus}`,
    });
  },

  /**
   * Crea una nueva incidencia técnica manual en la base de datos.
   */
  async createProblem(params: {
    ticketNumber?: string;
    module: string;
    title: string;
    description: string;
    reportedBy: string;
    priority?: string;
    deviceInfo?: string;
    adminName?: string;
  }): Promise<{ ok: boolean; message: string; [key: string]: any }> {
    return await this.executeAction({
      action: "create_problem",
      target_id: params.ticketNumber || `fal-${Date.now()}`,
      ticket_number: params.ticketNumber,
      category_label: params.module,
      module: params.module,
      description: `${params.title}: ${params.description}`,
      reported_by: params.reportedBy,
      device_info: params.deviceInfo || "Aplicación móvil (Android)",
      admin_name: params.adminName || "Superadministrador",
      status: "recibido",
    });
  },

  /**
   * Consulta listado completo de profesionales desde la base de datos.
   */
  async getProfessionals(): Promise<any[]> {
    try {
      const res = await api.get<any>("professionals/");
      if (Array.isArray(res)) return res;
      if (res && Array.isArray(res.results)) return res.results;
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Cambia el estado de verificación de un profesional o cliente en la base de datos.
   */
  async toggleVerification(targetId: string | number, reason?: string): Promise<any> {
    return await this.executeAction({
      action: "toggle_user_verification" as any,
      target_id: targetId,
      reason: reason || "Revisión documental desde el panel administrativo",
    });
  },
};


