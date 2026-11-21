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

export interface AdminOverviewRequestItem {
  id: string;
  raw_id?: number;
  type: "Servicio" | "Producto" | "PQR" | "Falla";
  typeIcon: string;
  typeColor: string;
  title: string;
  userName: string;
  userAvatar: string;
  date: string;
  status: "En revisión" | "Aprobado" | "Abierto" | "En proceso" | "Rechazado";
  statusClass: string;
}

export interface AdminOverviewTopProfessional {
  id: string;
  raw_id?: number;
  name: string;
  specialty: string;
  rating: number;
  tier: "Nivel Oro" | "Nivel Plata" | "Nivel Bronce";
  avatar: string;
  points: number;
  completedJobs: number;
  verified: boolean;
  blocked?: boolean;
}

export interface AdminOverviewAuditLog {
  id: string;
  adminName: string;
  action: string;
  target: string;
  date: string;
  reason: string;
}

export interface AdminUserSummary {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  admin_role?: string | null;
  is_staff?: boolean;
  is_superuser?: boolean;
  phone: string;
  city: string;
  address: string;
  document_id: string;
  is_active: boolean;
  is_identity_verified: boolean;
  requests_count: number;
  date_joined: string;
  avatar_url?: string;
  username?: string;
  is_pro_verified?: boolean;
  is_blocked?: boolean;
  block_type?: string;
  block_duration_days?: number;
  block_reason?: string;
  blocked_until?: string | null;
  blocked_at?: string | null;
}

export interface AdminActionResult {
  ok: boolean;
  message: string;
  user?: AdminUserSummary;
  attachments?: Array<{ name: string; url?: string; type: "image" | "file" }>;
  [key: string]: unknown;
}

export interface AdminNotificationItem {
  id: number;
  title: string;
  text: string;
  type: string;
  link?: string;
  target_id?: string;
  unread: boolean;
  time: string;
  created_at: string;
}

export interface AdminRolesResponse {
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
  requests_list: AdminOverviewRequestItem[];
  top_professionals: AdminOverviewTopProfessional[];
  audit_logs: AdminOverviewAuditLog[];
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
  cities?: Array<{
    id: string;
    name: string;
    center: [number, number];
    zoom: number;
    households: number;
    professionals: number;
    located?: number;
    zones: Array<{ name: string; count: number }>;
    points: Array<{ lat: number; lng: number; kind: "home" | "pro" }>;
  }>;
  cities_other?: { households: number; professionals: number };
}

/** El backend pagina de 20 en 20; se recorren todas las páginas para que los totales sean reales. */
async function fetchAllPages<T = Record<string, unknown>>(
  path: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const response = await api.get<T[] | { results?: T[]; next?: string | null }>(path, {
      params: { ...params, page: String(page) },
    });
    if (Array.isArray(response)) return response;
    const results = Array.isArray(response?.results) ? response.results : [];
    rows.push(...results);
    if (!response?.next || results.length === 0) break;
  }
  return rows;
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
    action:
      | "approve_request"
      | "reject_request"
      | "block_user"
      | "unblock_user"
      | "assign_benefits"
      | "respond_pqr"
      | "assign_problem"
      | "update_problem_status"
      | "create_problem"
      | "toggle_user_verification"
      | string;
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
    [key: string]: unknown;
  }): Promise<AdminActionResult> {
    return api.post<AdminActionResult>("admin/action/", params);
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
  }): Promise<AdminActionResult> {
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
  async getUsers(role?: string): Promise<{ count: number; users: AdminUserSummary[] }> {
    return api.get<{ count: number; users: AdminUserSummary[] }>("admin/users/", {
      params: role ? { role } : undefined,
    });
  },

  /**
   * Consulta listado de PQRs de la base de datos.
   */
  async getPqrs(): Promise<Array<Record<string, unknown>>> {
    return fetchAllPages<Record<string, unknown>>("pqrs/");
  },

  async createPqr(params: {
    type: "queja" | "reclamo" | "peticion";
    subjectType?: "servicio" | "producto";
    productId?: number | null;
    productName?: string;
    contractorName?: string;
    reason: string;
    description: string;
    clientName: string;
    clientEmail?: string;
    relatedTo?: string;
    priority?: string;
  }): Promise<Record<string, unknown>> {
    return api.post<Record<string, unknown>>("pqrs/", {
      type: params.type,
      subjectType: params.subjectType || "servicio",
      productId: params.productId ?? null,
      productName: params.productName || "",
      reason: params.reason,
      description: params.description,
      clientName: params.clientName,
      clientEmail: params.clientEmail || "",
      relatedTo: params.relatedTo || "",
      priority: params.priority || "",
      contractorId: "",
      contractorName: params.contractorName || "",
      contractorCompany: "",
      contractorSpecialty: "",
      contractorAvatar: "",
    });
  },

  async assignPqr(params: {
    targetId: string | number;
    assignedTo: string;
    adminName?: string;
  }): Promise<AdminActionResult> {
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
  }): Promise<AdminActionResult> {
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
  async getProblems(): Promise<Array<Record<string, unknown>>> {
    return fetchAllPages<Record<string, unknown>>("app-problems/", { all: "true" });
  },

  /**
   * Asigna un técnico responsable a una incidencia técnica en la base de datos.
   */
  async assignProblem(params: {
    targetId: string | number;
    assignedTo: string;
    adminName?: string;
    reason?: string;
  }): Promise<AdminActionResult> {
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
  }): Promise<AdminActionResult> {
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
  }): Promise<AdminActionResult> {
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
  }): Promise<AdminActionResult> {
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

    return await api.post<AdminActionResult>("admin/action/", formData);
  },

  async uploadProblemAttachments(params: {
    targetId: string | number;
    attachments: File[];
    adminName?: string;
  }): Promise<{ ok: boolean; message: string; attachments: Array<{ name: string; url?: string; type: "image" | "file" }> }> {
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
  async getProfessionals<T = Record<string, unknown>>(): Promise<T[]> {
    const res = await api.get<T[] | { results?: T[] }>("professionals/");
    return Array.isArray(res) ? res : (res && Array.isArray(res.results) ? res.results : []);
  },

  /**
   * Elimina una cuenta de cliente, profesional o cuenta administrativa (requiere sesión de staff).
   * Usa POST /api/v1/admin/action/ (respuesta JSON 200) para evitar problemas de proxies con DELETE/204.
   */
  async deleteAccount(kind: "client" | "professional" | "admin" | "staff", id: number | string): Promise<AdminActionResult> {
    try {
      return await this.executeAction({
        action: "delete_account",
        kind,
        target_id: id,
      });
    } catch (primaryErr) {
      // Fallback a ruta POST dedicada si el servidor anterior no conoce la acción delete_account
      const msg = primaryErr instanceof Error ? primaryErr.message : "";
      if (msg.includes("Acción administrativa no soportada")) {
        return await api.post<AdminActionResult>(`admin/accounts/${kind}/${id}/delete/`, {});
      }
      throw primaryErr;
    }
  },

  /**
   * Cambia el estado de verificación de un profesional o cliente en la base de datos.
   */
  async toggleVerification(targetId: string | number, reason?: string): Promise<AdminActionResult> {
    return await this.executeAction({
      action: "toggle_user_verification",
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
    notifications: AdminNotificationItem[];
  }> {
    return api.get<{
      unread_count: number;
      total_count: number;
      notifications: AdminNotificationItem[];
    }>("admin/notifications/");
  },

  /**
   * Marca una notificación como leída o no leída en la base de datos.
   */
  async markNotificationRead(id?: number | string, isRead = true): Promise<{ ok: boolean }> {
    return api.post<{ ok: boolean }>("admin/notifications/", {
      action: isRead ? "mark_read" : "mark_unread",
      id,
    });
  },

  /**
   * Marca todas las notificaciones como leídas en la base de datos.
   */
  async markAllNotificationsRead(): Promise<{ ok: boolean }> {
    return api.post<{ ok: boolean }>("admin/notifications/", {
      action: "mark_all_read",
    });
  },

  /**
   * Elimina todas las notificaciones de la plataforma.
   */
  async clearAllNotifications(): Promise<{ ok: boolean }> {
    return api.post<{ ok: boolean }>("admin/notifications/", {
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
    return api.post<{ ok: boolean; id?: number }>("admin/notifications/", {
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
  }): Promise<AdminActionResult> {
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
  async getRolesAndPermissions(): Promise<AdminRolesResponse> {
    return api.get<AdminRolesResponse>("admin/roles/");
  },

  /**
   * Guarda la matriz de permisos por rol en la base de datos de Serviprox.
   */
  async saveRolePermissions(
    matrix: Record<string, string[]>,
    reason?: string,
    adminName?: string
  ): Promise<{ ok: boolean; message: string; permission_matrix: Record<string, string[]> }> {
    return api.post<{ ok: boolean; message: string; permission_matrix: Record<string, string[]> }>("admin/roles/", {
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
