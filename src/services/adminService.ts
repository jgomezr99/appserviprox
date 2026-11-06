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
  reports: {
    blocked_accounts_today: number;
    complaints: number;
    rejected_publications: number;
    cancelled_services: number;
    technical_issues: number;
  };
  requests_list: any[];
  top_professionals: any[];
  audit_logs: any[];
}

export interface ReportsStatsKPI {
  raw: number;
  display: string;
  trend: string;
  sparkline: number[];
}

export interface ReportsStatsResponse {
  database_connected: boolean;
  database_engine?: string;
  period: string;
  kpis: {
    users: ReportsStatsKPI;
    pros: ReportsStatsKPI;
    products: ReportsStatsKPI;
    hires: ReportsStatsKPI;
    pqrs: ReportsStatsKPI;
    revenue: ReportsStatsKPI;
  };
  hires_data: Array<{ month: string; val: number }>;
  top_services: Array<{ name: string; count: number; pct: number }>;
  top_products: Array<{ name: string; count: number; pct: number }>;
  new_users_data: Array<{ month: string; clients: number; pros: number }>;
  monthly_revenue: Array<{ month: string; amount: string; val: number }>;
  pqr_status: {
    total: number;
    raw_total?: number;
    resueltas: number;
    resueltas_pct: number;
    en_proceso: number;
    en_proceso_pct: number;
    pendientes: number;
    pendientes_pct: number;
    rechazadas: number;
    rechazadas_pct: number;
  };
  recent_activity: Array<{
    id: string;
    date: string;
    module: string;
    description: string;
    user: string;
    status: string;
  }>;
  localities: Array<{
    id: string;
    name: string;
    count: number;
    color: string;
  }>;
}

export const adminService = {
  /**
   * Obtiene la visión general en vivo directamente consultada de la base de datos de Serviprox.
   */
  async getOverview(): Promise<AdminOverviewResponse> {
    return api.get<AdminOverviewResponse>("admin/overview/");
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
    return api.post("admin/action/", params);
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
    return api.get<{ count: number; users: any[] }>("admin/users/", {
      params: role ? { role } : undefined,
    });
  },

  /**
   * Consulta listado de PQRs de la base de datos.
   */
  async getPqrs(): Promise<any[]> {
    const response = await api.get<any>("pqrs/");
    return Array.isArray(response) ? response : (Array.isArray(response?.results) ? response.results : []);
  },

  async createPqr(params: {
    type: "queja" | "reclamo" | "peticion";
    reason: string;
    description: string;
    clientName: string;
    clientEmail?: string;
    relatedTo?: string;
    priority?: string;
  }): Promise<any> {
    return api.post("pqrs/", {
      type: params.type,
      reason: params.reason,
      description: params.description,
      clientName: params.clientName,
      clientEmail: params.clientEmail || "",
      relatedTo: params.relatedTo || "",
      priority: params.priority || "",
      contractorId: "",
      contractorName: "",
      contractorCompany: "",
      contractorSpecialty: "",
      contractorAvatar: "",
    });
  },

  async assignPqr(params: {
    targetId: string | number;
    assignedTo: string;
    adminName?: string;
  }): Promise<{ ok: boolean; message: string; [key: string]: any }> {
    return this.executeAction({
      action: "assign_pqr",
      target_id: params.targetId,
      assigned_to: params.assignedTo,
      admin_name: params.adminName || "Superadministrador",
      reason: `Asignado a ${params.assignedTo}`,
    });
  },

  async updatePqrPriority(params: {
    targetId: string | number;
    priority: "Alta" | "Media" | "Baja";
    adminName?: string;
  }): Promise<{ ok: boolean; message: string; [key: string]: any }> {
    return this.executeAction({
      action: "update_pqr_priority",
      target_id: params.targetId,
      priority: params.priority,
      admin_name: params.adminName || "Superadministrador",
      reason: `Prioridad actualizada a ${params.priority}`,
    });
  },

  /**
   * Consulta fallas técnicas de la aplicación desde la base de datos.
   */
  async getProblems(): Promise<any[]> {
    const response = await api.get<any>("app-problems/", { params: { all: "true" } });
    return Array.isArray(response) ? response : (Array.isArray(response?.results) ? response.results : []);
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

  async addProblemNote(params: {
    targetId: string | number;
    note: string;
    adminName?: string;
  }): Promise<{ ok: boolean; message: string; [key: string]: any }> {
    return this.executeAction({
      action: "add_problem_note",
      target_id: params.targetId,
      note: params.note,
      admin_name: params.adminName || "Superadministrador",
      reason: params.note,
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
    version?: string;
    adminName?: string;
    attachments?: File[];
  }): Promise<{ ok: boolean; message: string; [key: string]: any }> {
    const action = {
      action: "create_problem",
      target_id: params.ticketNumber || `fal-${Date.now()}`,
      ticket_number: params.ticketNumber,
      category_label: params.module,
      module: params.module,
      title: params.title,
      description: params.description,
      reported_by: params.reportedBy,
      device_info: params.deviceInfo || "",
      version: params.version || "",
      priority: params.priority || "",
      admin_name: params.adminName || "Superadministrador",
      status: "recibido",
    };

    if (!params.attachments?.length) return await this.executeAction(action);

    const formData = new FormData();
    Object.entries(action).forEach(([key, value]) => formData.append(key, String(value ?? "")));
    params.attachments?.forEach((file) => formData.append("attachments", file, file.name));

    return await api.post("admin/action/", formData);
  },

  async uploadProblemAttachments(params: {
    targetId: string | number;
    attachments: File[];
    adminName?: string;
  }): Promise<{ ok: boolean; message: string; attachments: any[] }> {
    const formData = new FormData();
    formData.append("action", "upload_problem_files");
    formData.append("target_id", String(params.targetId));
    formData.append("admin_name", params.adminName || "Superadministrador");
    params.attachments.forEach((file) => formData.append("attachments", file, file.name));

    return await api.post("admin/action/", formData);
  },

  /**
   * Consulta listado completo de profesionales desde la base de datos.
   */
  async getProfessionals(): Promise<any[]> {
    const res = await api.get<any>("professionals/");
    return Array.isArray(res) ? res : (res && Array.isArray(res.results) ? res.results : []);
  },

  /**
   * Elimina una cuenta de cliente o profesional (requiere sesión de staff).
   */
  async deleteAccount(kind: "client" | "professional", id: number | string): Promise<void> {
    await api.delete(`admin/accounts/${kind}/${id}/`);
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

  /**
   * Consulta notificaciones de la plataforma con contador de no leídas en la base de datos.
   */
  async getNotifications(): Promise<{
    unread_count: number;
    total_count: number;
    notifications: Array<{
      id: number;
      title: string;
      text: string;
      type: string;
      link?: string;
      target_id?: string;
      unread: boolean;
      time: string;
      created_at: string;
    }>;
  }> {
    return api.get<any>("admin/notifications/");
  },

  /**
   * Marca una notificación como leída o no leída en la base de datos.
   */
  async markNotificationRead(id?: number | string, isRead = true): Promise<{ ok: boolean }> {
    return api.post<any>("admin/notifications/", {
      action: isRead ? "mark_read" : "mark_unread",
      id,
    });
  },

  /**
   * Marca todas las notificaciones como leídas en la base de datos.
   */
  async markAllNotificationsRead(): Promise<{ ok: boolean }> {
    return api.post<any>("admin/notifications/", {
      action: "mark_all_read",
    });
  },

  /**
   * Elimina todas las notificaciones de la plataforma.
   */
  async clearAllNotifications(): Promise<{ ok: boolean }> {
    return api.post<any>("admin/notifications/", {
      action: "clear_all",
    });
  },

  /**
   * Crea una nueva notificación en la base de datos.
   */
  async createNotification(params: {
    title: string;
    text: string;
    type?: string;
    link?: string;
    target_id?: string;
  }): Promise<{ ok: boolean; id?: number }> {
    return api.post<any>("admin/notifications/", {
      action: "create",
      ...params,
    });
  },

  /**
   * Cambia el rol de un usuario en la base de datos (Cliente, Profesional, Staff, Admin, Superadmin).
   */
  async changeUserRole(params: {
    userId: number | string;
    newRole: string;
    reason?: string;
    adminName?: string;
  }): Promise<{ ok: boolean; message: string; user?: any }> {
    return this.executeAction({
      action: "change_user_role",
      target_id: params.userId,
      user_id: params.userId,
      new_role: params.newRole,
      reason: params.reason || "Cambio de rol desde el Panel de Roles y Permisos",
      admin_name: params.adminName || "Superadministrador",
    });
  },

  /**
   * Consulta la estructura de roles y matriz de permisos desde la base de datos.
   */
  async getRolesAndPermissions(): Promise<{
    roles: Array<{
      id: string;
      name: string;
      category: "admin" | "app";
      badge: string;
      badge_color: string;
      description: string;
      users_count: number;
      is_system_locked: boolean;
    }>;
    available_permissions: Array<{
      id: string;
      label: string;
      category: string;
      description: string;
    }>;
    permission_matrix: Record<string, string[]>;
    counts: {
      total: number;
      clients: number;
      professionals: number;
      administrators: number;
    };
  }> {
    return api.get<any>("admin/roles/");
  },

  /**
   * Guarda la matriz de permisos por rol en la base de datos de Serviprox.
   */
  async saveRolePermissions(
    matrix: Record<string, string[]>,
    reason?: string,
    adminName?: string
  ): Promise<{ ok: boolean; message: string; permission_matrix: any }> {
    return api.post<any>("admin/roles/", {
      permission_matrix: matrix,
      reason: reason || "Actualización de privilegios por rol",
      admin_name: adminName || "Superadministrador",
    });
  },

  /**
   * Obtiene los reportes y estadísticas oficiales directamente calculados
   * desde los registros de la base de datos de Serviprox.
   */
  async getReportsStats(): Promise<ReportsStatsResponse> {
    return api.get<ReportsStatsResponse>("admin/reports-stats/");
  },
};
