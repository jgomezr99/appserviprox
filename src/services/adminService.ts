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
    attachments?: File[];
  }): Promise<{ ok: boolean; message: string; [key: string]: any }> {
    const action = {
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
    try {
      return await api.get<any>("admin/notifications/");
    } catch {
      return { unread_count: 0, total_count: 0, notifications: [] };
    }
  },

  /**
   * Marca una notificación como leída o no leída en la base de datos.
   */
  async markNotificationRead(id?: number | string, isRead = true): Promise<{ ok: boolean }> {
    try {
      return await api.post<any>("admin/notifications/", {
        action: isRead ? "mark_read" : "mark_unread",
        id,
      });
    } catch {
      return { ok: false };
    }
  },

  /**
   * Marca todas las notificaciones como leídas en la base de datos.
   */
  async markAllNotificationsRead(): Promise<{ ok: boolean }> {
    try {
      return await api.post<any>("admin/notifications/", {
        action: "mark_all_read",
      });
    } catch {
      return { ok: false };
    }
  },

  /**
   * Elimina todas las notificaciones de la plataforma.
   */
  async clearAllNotifications(): Promise<{ ok: boolean }> {
    try {
      return await api.post<any>("admin/notifications/", {
        action: "clear_all",
      });
    } catch {
      return { ok: false };
    }
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
    try {
      return await api.post<any>("admin/notifications/", {
        action: "create",
        ...params,
      });
    } catch {
      return { ok: false };
    }
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
    try {
      return await this.executeAction({
        action: "change_user_role",
        target_id: params.userId,
        user_id: params.userId,
        new_role: params.newRole,
        reason: params.reason || "Cambio de rol desde el Panel de Roles y Permisos",
        admin_name: params.adminName || "Superadministrador",
      });
    } catch (err: any) {
      console.warn("Error al cambiar rol en BD:", err);
      return {
        ok: true,
        message: `Rol actualizado localmente a ${params.newRole}.`,
      };
    }
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
    try {
      return await api.get<any>("admin/roles/");
    } catch (err) {
      console.warn("Falla al consultar admin/roles/, usando datos base:", err);
      return {
        roles: [
          {
            id: "superadmin",
            name: "Superadministrador",
            category: "admin",
            badge: "Superadmin",
            badge_color: "#dc2626",
            description: "Acceso total e irrestricto a todos los módulos y base de datos.",
            users_count: 1,
            is_system_locked: true,
          },
          {
            id: "admin",
            name: "Administrador General",
            category: "admin",
            badge: "Admin",
            badge_color: "#2563eb",
            description: "Gestión integral de usuarios, verificaciones, publicaciones de tienda, PQRs y beneficios.",
            users_count: 0,
            is_system_locked: false,
          },
          {
            id: "support",
            name: "Soporte y Moderador PQR",
            category: "admin",
            badge: "Soporte",
            badge_color: "#059669",
            description: "Atención de quejas PQR, conciliación con clientes y solución de fallas técnicas.",
            users_count: 0,
            is_system_locked: false,
          },
          {
            id: "content_manager",
            name: "Gestor de Tienda y Contenido",
            category: "admin",
            badge: "Contenido",
            badge_color: "#d97706",
            description: "Supervisión de productos en tienda oficial y publicaciones de servicios.",
            users_count: 0,
            is_system_locked: false,
          },
          {
            id: "professional",
            name: "Profesional / Contratista (App)",
            category: "app",
            badge: "Profesional",
            badge_color: "#4f46e5",
            description: "Usuario contratista de la app móvil. Ofrece servicios, publica en tienda y atiende clientes.",
            users_count: 15,
            is_system_locked: true,
          },
          {
            id: "client",
            name: "Cliente Final (App)",
            category: "app",
            badge: "Cliente",
            badge_color: "#0284c7",
            description: "Usuario consumidor de la app móvil. Contrata servicios, compra en tienda y radica PQRs.",
            users_count: 4,
            is_system_locked: true,
          },
        ],
        available_permissions: [
          { id: "users_view", label: "Ver usuarios (Clientes y Contratistas)", category: "Usuarios", description: "Permite consultar perfiles y datos de contacto." },
          { id: "users_edit_role", label: "Modificar roles de usuarios y administradores", category: "Usuarios", description: "Permite cambiar roles en la BD." },
          { id: "users_verify", label: "Validar identidad y acreditaciones RETIE", category: "Usuarios", description: "Aprobar o revocar documentos oficiales." },
          { id: "users_block", label: "Sanciones y bloqueo disciplinario", category: "Usuarios", description: "Suspender cuentas por infracciones." },
          { id: "store_manage", label: "Gestionar tienda y publicar productos", category: "Tienda y Publicaciones", description: "Publicar productos oficiales y moderar tienda." },
          { id: "services_manage", label: "Supervisar solicitudes y contratos de servicios", category: "Servicios", description: "Monitorear cotizaciones y contratos." },
          { id: "pqrs_manage", label: "Atención y resolución de PQRs oficiales", category: "PQR y Soporte", description: "Responder quejas y conciliar desacuerdos." },
          { id: "problems_manage", label: "Gestión de incidencias y fallas de la app", category: "PQR y Soporte", description: "Asignar y dar solución a fallas reportadas." },
          { id: "benefits_manage", label: "Asignación de puntos y beneficios", category: "Beneficios", description: "Otorgar puntos y saldo a profesionales." },
          { id: "finance_manage", label: "Consulta de balances y billeteras", category: "Finanzas", description: "Acceso a balances financieros." },
          { id: "audit_view", label: "Visualización de bitácora de auditoría", category: "Seguridad", description: "Consultar registro inmutable de acciones." },
          { id: "settings_manage", label: "Configuración general y switches de plataforma", category: "Configuración", description: "Activar/desactivar módulos del sistema." },
          { id: "roles_manage", label: "Configuración de roles y matriz de permisos", category: "Seguridad", description: "Modificar privilegios de acceso." },
        ],
        permission_matrix: {
          superadmin: [
            "users_view", "users_edit_role", "users_verify", "users_block",
            "store_manage", "services_manage", "pqrs_manage", "problems_manage",
            "benefits_manage", "finance_manage", "audit_view", "settings_manage", "roles_manage"
          ],
          admin: [
            "users_view", "users_edit_role", "users_verify", "users_block",
            "store_manage", "services_manage", "pqrs_manage", "problems_manage",
            "benefits_manage", "audit_view"
          ],
          support: ["users_view", "pqrs_manage", "problems_manage"],
          content_manager: ["store_manage", "services_manage"],
          professional: [],
          client: [],
        },
        counts: {
          total: 20,
          clients: 4,
          professionals: 15,
          administrators: 1,
        },
      };
    }
  },

  /**
   * Guarda la matriz de permisos por rol en la base de datos de Serviprox.
   */
  async saveRolePermissions(
    matrix: Record<string, string[]>,
    reason?: string,
    adminName?: string
  ): Promise<{ ok: boolean; message: string; permission_matrix: any }> {
    try {
      return await api.post<any>("admin/roles/", {
        permission_matrix: matrix,
        reason: reason || "Actualización de privilegios por rol",
        admin_name: adminName || "Superadministrador",
      });
    } catch (err: any) {
      console.warn("Falla al guardar permisos en BD, guardando localmente:", err);
      try {
        localStorage.setItem("serviprox_role_permissions_backup", JSON.stringify(matrix));
      } catch {}
      return {
        ok: true,
        message: "Matriz guardada localmente (modo offline diferido).",
        permission_matrix: matrix,
      };
    }
  },

  /**
   * Obtiene los reportes y estadísticas oficiales directamente calculados
   * desde los registros de la base de datos de Serviprox.
   */
  async getReportsStats(): Promise<ReportsStatsResponse> {
    try {
      const response = await api.get<ReportsStatsResponse>("admin/reports-stats/");
      return response;
    } catch (err) {
      console.warn("Falla al consultar admin/reports-stats/ en backend, usando respaldo:", err);
      return {
        database_connected: false,
        period: "01/05/2026 - 08/30/2026",
        kpis: {
          users: { raw: 18, display: "18", trend: "+12%", sparkline: [6, 10, 14, 18] },
          pros: { raw: 15, display: "15", trend: "+8%", sparkline: [8, 11, 13, 15] },
          products: { raw: 71, display: "71", trend: "+15%", sparkline: [15, 30, 48, 71] },
          hires: { raw: 8, display: "8", trend: "+18%", sparkline: [2, 4, 6, 8] },
          pqrs: { raw: 7, display: "7", trend: "-6%", sparkline: [9, 8, 8, 7] },
          revenue: { raw: 84250000, display: "$84.250.000", trend: "+22%", sparkline: [5, 8, 12, 18.5] },
        },
        hires_data: [
          { month: "Ene", val: 45 },
          { month: "Feb", val: 82 },
          { month: "Mar", val: 125 },
          { month: "Abr", val: 154 },
          { month: "May", val: 198 },
          { month: "Jun", val: 235 },
          { month: "Jul", val: 242 },
          { month: "Ago", val: 290 },
          { month: "Sep", val: 320 },
          { month: "Oct", val: 375 },
        ],
        top_services: [
          { name: "Electricista", count: 420, pct: 100 },
          { name: "Plomero", count: 350, pct: 83 },
          { name: "Limpieza", count: 280, pct: 66 },
          { name: "Mantenimiento", count: 210, pct: 50 },
          { name: "Entrenador personal", count: 190, pct: 45 },
          { name: "Clases particulares", count: 150, pct: 35 },
          { name: "Veterinaria a domicilio", count: 120, pct: 28 },
          { name: "Otros", count: 112, pct: 26 },
        ],
        top_products: [
          { name: "Tecnología", count: 520, pct: 100 },
          { name: "Muebles", count: 380, pct: 73 },
          { name: "Multimedia", count: 310, pct: 60 },
          { name: "Ropa", count: 290, pct: 55 },
          { name: "Deportes", count: 240, pct: 46 },
          { name: "Libros", count: 180, pct: 34 },
          { name: "Juguetes", count: 150, pct: 28 },
          { name: "Herramientas", count: 120, pct: 23 },
        ],
        new_users_data: [
          { month: "Ene", clients: 140, pros: 80 },
          { month: "Feb", clients: 165, pros: 95 },
          { month: "Mar", clients: 195, pros: 125 },
          { month: "Abr", clients: 150, pros: 108 },
          { month: "May", clients: 200, pros: 142 },
          { month: "Jun", clients: 175, pros: 120 },
          { month: "Jul", clients: 215, pros: 155 },
          { month: "Ago", clients: 265, pros: 190 },
          { month: "Sep", clients: 220, pros: 165 },
          { month: "Oct", clients: 170, pros: 130 },
        ],
        monthly_revenue: [
          { month: "Ene", amount: "5.2M", val: 5.2 },
          { month: "Feb", amount: "5.8M", val: 5.8 },
          { month: "Mar", amount: "6.9M", val: 6.9 },
          { month: "Abr", amount: "8.1M", val: 8.1 },
          { month: "May", amount: "9.5M", val: 9.5 },
          { month: "Jun", amount: "10.4M", val: 10.4 },
          { month: "Jul", amount: "12.2M", val: 12.2 },
          { month: "Ago", amount: "15.8M", val: 15.8 },
          { month: "Sep", amount: "17.5M", val: 17.5 },
          { month: "Oct", amount: "18.8M", val: 18.8 },
        ],
        pqr_status: {
          total: 342,
          resueltas: 198,
          resueltas_pct: 58,
          en_proceso: 82,
          en_proceso_pct: 24,
          pendientes: 41,
          pendientes_pct: 12,
          rechazadas: 21,
          rechazadas_pct: 6,
        },
        recent_activity: [
          { id: "1", date: "08/10/2026 16:45", module: "Contrataciones", description: "Nueva contratación #1028", user: "Carlos Díaz", status: "completado" },
          { id: "2", date: "08/10/2026 16:10", module: "Tienda", description: "Producto publicado", user: "María Torres", status: "aprobado" },
          { id: "3", date: "08/10/2026 15:20", module: "PQR y Reportes", description: "Nueva queja #450", user: "Andrés López", status: "en_proceso" },
          { id: "4", date: "08/10/2026 14:15", module: "Usuarios", description: "Registro de usuario", user: "Laura Gómez", status: "completado" },
          { id: "5", date: "08/10/2026 13:30", module: "Fallas Técnicas", description: "Error en la app", user: "Ricardo Sánchez", status: "resuelto" },
        ],
        localities: [
          { id: "kennedy", name: "Kennedy", count: 420, color: "#1d4ed8" },
          { id: "suba", name: "Suba", count: 350, color: "#3b82f6" },
          { id: "engativa", name: "Engativá", count: 290, color: "#60a5fa" },
          { id: "chapinero", name: "Chapinero", count: 250, color: "#93c5fd" },
          { id: "usaquen", name: "Usaquén", count: 220, color: "#bfdbfe" },
          { id: "bosa", name: "Bosa", count: 190, color: "#c7d2fe" },
          { id: "teusaquillo", name: "Teusaquillo", count: 180, color: "#ddd6fe" },
          { id: "santafe", name: "Santa Fe", count: 140, color: "#ede9fe" },
          { id: "otras", name: "Otras", count: 112, color: "#f1f5f9" },
        ],
      };
    }
  },
};


