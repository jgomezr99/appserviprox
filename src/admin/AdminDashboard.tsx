import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { adminService } from "../services/adminService";
import "./AdminDashboard.css";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE DATOS ADMINISTRATIVOS
// ─────────────────────────────────────────────────────────────────────────────
type AdminMenuId =
  | "inicio"
  | "usuarios_clientes"
  | "usuarios_profesionales"
  | "publicaciones_servicios"
  | "publicaciones_productos"
  | "contrataciones"
  | "pqr"
  | "beneficios"
  | "fallas"
  | "roles"
  | "auditoria"
  | "reportes"
  | "configuracion";

interface RequestItem {
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

interface TopProfessional {
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

interface AuditLogEntry {
  id: string;
  adminName: string;
  action: string;
  target: string;
  date: string;
  reason: string;
}

export const AdminDashboard: React.FC = () => {
  const history = useHistory();
  const { logout, user } = useAuth();

  // Estados de navegación
  const [activeMenu, setActiveMenu] = useState<AdminMenuId>("inicio");
  const [menuUsuariosOpen, setMenuUsuariosOpen] = useState(true);
  const [menuPublicacionesOpen, setMenuPublicacionesOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRequestTab, setActiveRequestTab] = useState<
    "Publicaciones" | "Profesionales" | "Productos" | "PQR" | "Fallas técnicas"
  >("Publicaciones");

  // Notificaciones
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, text: "Nueva queja PQR radicada por Laura G.", time: "Hace 10 min", unread: true },
    { id: 2, text: "Carlos M. solicitó verificación de tarjeta profesional RETIE.", time: "Hace 25 min", unread: true },
    { id: 3, text: "Se reportó una falla técnica en carga de imágenes.", time: "Hace 1 hora", unread: true },
  ]);

  // Lista de solicitudes recientes (idénticas a la imagen)
  const [requestsList, setRequestsList] = useState<RequestItem[]>([
    {
      id: "req-1",
      type: "Servicio",
      typeIcon: "🔧",
      typeColor: "#dbeafe",
      title: "Instalación de aire acondicionado",
      userName: "Carlos M.",
      userAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      date: "08/10/2026",
      status: "En revisión",
      statusClass: "ad-status-revision",
    },
    {
      id: "req-2",
      type: "Producto",
      typeIcon: "🛒",
      typeColor: "#dcfce7",
      title: "Taladro eléctrico",
      userName: "Ana P.",
      userAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80",
      date: "08/10/2026",
      status: "Aprobado",
      statusClass: "ad-status-aprobado",
    },
    {
      id: "req-3",
      type: "Servicio",
      typeIcon: "🔧",
      typeColor: "#dbeafe",
      title: "Reparación de plomería",
      userName: "Miguel R.",
      userAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
      date: "07/10/2026",
      status: "En revisión",
      statusClass: "ad-status-revision",
    },
    {
      id: "req-4",
      type: "PQR",
      typeIcon: "💬",
      typeColor: "#fee2e2",
      title: "Cobro indebido en servicio",
      userName: "Laura G.",
      userAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
      date: "07/10/2026",
      status: "Abierto",
      statusClass: "ad-status-abierto",
    },
    {
      id: "req-5",
      type: "Falla",
      typeIcon: "🐞",
      typeColor: "#f3e8ff",
      title: "Error al subir imágenes",
      userName: "Juan S.",
      userAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
      date: "07/10/2026",
      status: "En proceso",
      statusClass: "ad-status-proceso",
    },
  ]);

  // Profesionales destacados (idénticos a la imagen)
  const [prosList, setProsList] = useState<TopProfessional[]>([
    {
      id: "pro-1",
      name: "Andrés López",
      specialty: "Electricista",
      rating: 4.9,
      tier: "Nivel Oro",
      avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&auto=format&fit=crop&q=80",
      points: 1450,
      completedJobs: 132,
      verified: true,
    },
    {
      id: "pro-2",
      name: "María Torres",
      specialty: "Limpieza",
      rating: 4.8,
      tier: "Nivel Plata",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80",
      points: 980,
      completedJobs: 87,
      verified: true,
    },
    {
      id: "pro-3",
      name: "José Ramírez",
      specialty: "Plomero",
      rating: 4.8,
      tier: "Nivel Oro",
      avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80",
      points: 1200,
      completedJobs: 114,
      verified: true,
    },
    {
      id: "pro-4",
      name: "Carolina Pérez",
      specialty: "Entrenadora",
      rating: 4.7,
      tier: "Nivel Plata",
      avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80",
      points: 850,
      completedJobs: 54,
      verified: true,
    },
  ]);

  // Auditoría inicial
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([
    {
      id: "aud-1",
      adminName: "Superadministrador",
      action: "Aprobación de producto",
      target: "Taladro eléctrico (Ana P.)",
      date: "08/10/2026 14:30",
      reason: "Verificación de especificaciones y precio reglamentario",
    },
    {
      id: "aud-2",
      adminName: "Superadministrador",
      action: "Asignación de puntos",
      target: "Andrés López (+200 pts)",
      date: "07/10/2026 18:15",
      reason: "Cumplimiento récord de 10 servicios 5 estrellas en Kennedy",
    },
    {
      id: "aud-3",
      adminName: "Superadministrador",
      action: "Bloqueo temporal",
      target: "Usuario contratista #402",
      date: "07/10/2026 11:20",
      reason: "Queja reiterada de incumplimiento de citas",
    },
  ]);

  // Estado de conexión a la Base de Datos
  const [dbInfo, setDbInfo] = useState<{
    connected: boolean;
    engine: string;
    database_name?: string;
    loading: boolean;
  }>({
    connected: false,
    engine: "sqlite",
    database_name: "",
    loading: true,
  });

  // Métricas de Indicadores Clave (KPIs)
  const [kpis, setKpis] = useState({
    clients: 1248,
    professionals: 356,
    hired_services: 1890,
    pending_publications: 42,
    open_pqrs: 27,
    technical_issues: 5,
    raw_clients: 4,
    raw_pros: 15,
    raw_services: 5,
    raw_publications: 21,
    raw_pqrs: 4,
    raw_issues: 3,
  });

  // Distribución de usuarios para gráfica
  const [userDistribution, setUserDistribution] = useState({
    clients: 1248,
    professionals: 356,
    administrators: 18,
  });

  // Distribución de PQR para gráfico de barras
  const [pqrDistribution, setPqrDistribution] = useState({
    radicado: 6,
    en_revision: 9,
    conciliacion: 4,
    resuelto: 8,
  });

  // Función para consultar en vivo la base de datos
  const fetchLiveOverview = async () => {
    setDbInfo((prev) => ({ ...prev, loading: true }));
    try {
      const data = await adminService.getOverview();
      if (data.database && data.database.connected) {
        setDbInfo({
          connected: true,
          engine: data.database.engine || "sqlite",
          database_name: String(data.database.database_name || "db.sqlite3"),
          loading: false,
        });
        if (data.kpis) {
          setKpis((prev) => ({ ...prev, ...data.kpis }));
        }
        if (data.requests_list && data.requests_list.length > 0) {
          setRequestsList(data.requests_list);
        }
        if (data.top_professionals && data.top_professionals.length > 0) {
          setProsList(data.top_professionals);
        }
        if (data.audit_logs && data.audit_logs.length > 0) {
          setAuditLogs(data.audit_logs);
        }
        if (data.charts?.user_distribution) {
          setUserDistribution(data.charts.user_distribution);
        }
        if (data.charts?.pqr_chart) {
          setPqrDistribution(data.charts.pqr_chart);
        }
      } else {
        setDbInfo((prev) => ({ ...prev, connected: false, loading: false }));
      }
    } catch (err) {
      console.warn("Fallo al consultar base de datos en overview:", err);
      setDbInfo((prev) => ({ ...prev, connected: false, loading: false }));
    }
  };

  useEffect(() => {
    fetchLiveOverview();
  }, []);

  // Estado de modales
  const [modalBloqueoOpen, setModalBloqueoOpen] = useState(false);
  const [targetUserToBlock, setTargetUserToBlock] = useState<string>("");
  const [blockReason, setBlockReason] = useState("");
  const [blockDuration, setBlockDuration] = useState("7");
  const [blockType, setBlockType] = useState<"temporal" | "permanente">("temporal");

  const [modalBeneficiosOpen, setModalBeneficiosOpen] = useState(false);
  const [targetProBeneficio, setTargetProBeneficio] = useState<TopProfessional | null>(null);
  const [puntosToAdd, setPuntosToAdd] = useState(100);
  const [recargaToAdd, setRecargaToAdd] = useState(50000);
  const [motivoBeneficio, setMotivoBeneficio] = useState("Premio por puntualidad y alta calificación");

  const [modalDetailOpen, setModalDetailOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<any>(null);

  const adminDisplayName = (user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user?.username) || "Superadministrador";

  // Acciones en la tabla de solicitudes
  const handleApprove = async (id: string) => {
    setRequestsList((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: "Aprobado", statusClass: "ad-status-aprobado" } : r
      )
    );
    const item = requestsList.find((r) => r.id === id);
    if (item) {
      setAuditLogs((prev) => [
        {
          id: `aud-${Date.now()}`,
          adminName: adminDisplayName,
          action: `Aprobación de ${item.type.toLowerCase()}`,
          target: `${item.title} (${item.userName})`,
          date: new Date().toLocaleString(),
          reason: "Aprobado desde el panel administrativo (BD)",
        },
        ...prev,
      ]);
    }
    await adminService.executeAction({
      action: "approve_request",
      target_id: id,
      admin_name: adminDisplayName,
      reason: "Aprobado desde el panel administrativo",
    });
  };

  const handleReject = async (id: string) => {
    setRequestsList((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: "Rechazado", statusClass: "ad-status-abierto" } : r
      )
    );
    const item = requestsList.find((r) => r.id === id);
    if (item) {
      setAuditLogs((prev) => [
        {
          id: `aud-${Date.now()}`,
          adminName: adminDisplayName,
          action: `Rechazo de ${item.type.toLowerCase()}`,
          target: `${item.title} (${item.userName})`,
          date: new Date().toLocaleString(),
          reason: "No cumple con las normas de publicación de Serviprox",
        },
        ...prev,
      ]);
    }
    await adminService.executeAction({
      action: "reject_request",
      target_id: id,
      admin_name: adminDisplayName,
      reason: "No cumple con las normas de publicación de Serviprox",
    });
  };

  const handleViewDetail = (item: any) => {
    setSelectedDetailItem(item);
    setModalDetailOpen(true);
  };

  const confirmBlockUser = async () => {
    if (!blockReason.trim()) return;
    const reasonText = blockReason;
    const target = targetUserToBlock || "Usuario seleccionado";
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        adminName: adminDisplayName,
        action: blockType === "temporal" ? `Bloqueo temporal (${blockDuration} días)` : "Bloqueo permanente",
        target: target,
        date: new Date().toLocaleString(),
        reason: reasonText,
      },
      ...prev,
    ]);
    setModalBloqueoOpen(false);
    setBlockReason("");

    await adminService.executeAction({
      action: "block_user",
      target_id: target,
      admin_name: adminDisplayName,
      reason: reasonText,
    });
    alert(`Cuenta de ${target} bloqueada con éxito en la base de datos.`);
    fetchLiveOverview();
  };

  const confirmAssignBenefits = async () => {
    if (!targetProBeneficio) return;
    const proId = targetProBeneficio.id;
    const proName = targetProBeneficio.name;
    const targetPro = targetProBeneficio;
    setProsList((prev) =>
      prev.map((p) =>
        p.id === proId
          ? { ...p, points: p.points + puntosToAdd }
          : p
      )
    );
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        adminName: adminDisplayName,
        action: `Asignación de +${puntosToAdd} pts y $${recargaToAdd.toLocaleString("es-CO")}`,
        target: proName,
        date: new Date().toLocaleString(),
        reason: motivoBeneficio,
      },
      ...prev,
    ]);
    setModalBeneficiosOpen(false);

    await adminService.executeAction({
      action: "assign_benefits",
      target_id: targetPro.raw_id || proId,
      admin_name: adminDisplayName,
      points: puntosToAdd,
      recharge: recargaToAdd,
      reason: motivoBeneficio,
    });
    alert(`Beneficios asignados a ${proName}. Total actualizado guardado en la base de datos.`);
    fetchLiveOverview();
  };

  const handleLogout = () => {
    logout();
    history.replace("/login");
  };

  // Filtrado de solicitudes según pestaña activa y búsqueda
  const filteredRequests = requestsList.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.type.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeRequestTab === "Publicaciones") return item.type === "Servicio";
    if (activeRequestTab === "Productos") return item.type === "Producto";
    if (activeRequestTab === "PQR") return item.type === "PQR";
    if (activeRequestTab === "Fallas técnicas") return item.type === "Falla";
    return true;
  });

  return (
    <div className="ad-wrapper">
      {/* ═════════════════════════════════════════════════════════════════════
          BARRA LATERAL IZQUIERDA (DISEÑO EXACTO SERVIPROX NAVY)
         ═════════════════════════════════════════════════════════════════════ */}
      <aside className="ad-sidebar" aria-label="Menú principal de navegación">
        <div>
          {/* Logo y Encabezado de Marca */}
          <div className="ad-brand">
            <div className="ad-brand-logo" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            </div>
            <div className="ad-brand-text">
              <h2>Serviprox</h2>
              <p>Panel Administrativo</p>
            </div>
          </div>

          {/* Menú de Navegación Vertical */}
          <nav className="ad-nav">
            {/* Inicio (Píldora Azul Activa) */}
            <button
              type="button"
              className={`ad-nav-item ${activeMenu === "inicio" ? "active" : ""}`}
              onClick={() => setActiveMenu("inicio")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
              <span>Inicio</span>
            </button>

            {/* Grupo: Usuarios */}
            <div>
              <button
                type="button"
                className={`ad-nav-item ${
                  activeMenu.startsWith("usuarios") ? "active" : ""
                }`}
                onClick={() => setMenuUsuariosOpen((prev) => !prev)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
                <div className="ad-nav-group-header">
                  <span>Usuarios</span>
                  <svg
                    className={`ad-chevron ${menuUsuariosOpen ? "open" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </button>
              {menuUsuariosOpen && (
                <div className="ad-subnav">
                  <button
                    type="button"
                    className={`ad-subnav-item ${
                      activeMenu === "usuarios_clientes" ? "active" : ""
                    }`}
                    onClick={() => setActiveMenu("usuarios_clientes")}
                  >
                    Clientes
                  </button>
                  <button
                    type="button"
                    className={`ad-subnav-item ${
                      activeMenu === "usuarios_profesionales" ? "active" : ""
                    }`}
                    onClick={() => setActiveMenu("usuarios_profesionales")}
                  >
                    Profesionales
                  </button>
                </div>
              )}
            </div>

            {/* Grupo: Publicaciones */}
            <div>
              <button
                type="button"
                className={`ad-nav-item ${
                  activeMenu.startsWith("publicaciones") ? "active" : ""
                }`}
                onClick={() => setMenuPublicacionesOpen((prev) => !prev)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                </svg>
                <div className="ad-nav-group-header">
                  <span>Publicaciones</span>
                  <svg
                    className={`ad-chevron ${menuPublicacionesOpen ? "open" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </button>
              {menuPublicacionesOpen && (
                <div className="ad-subnav">
                  <button
                    type="button"
                    className={`ad-subnav-item ${
                      activeMenu === "publicaciones_servicios" ? "active" : ""
                    }`}
                    onClick={() => setActiveMenu("publicaciones_servicios")}
                  >
                    Servicios
                  </button>
                  <button
                    type="button"
                    className={`ad-subnav-item ${
                      activeMenu === "publicaciones_productos" ? "active" : ""
                    }`}
                    onClick={() => setActiveMenu("publicaciones_productos")}
                  >
                    Productos (Tienda)
                  </button>
                </div>
              )}
            </div>

            {/* Contrataciones */}
            <button
              type="button"
              className={`ad-nav-item ${activeMenu === "contrataciones" ? "active" : ""}`}
              onClick={() => setActiveMenu("contrataciones")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z" />
              </svg>
              <span>Contrataciones</span>
            </button>

            {/* PQR y Reportes */}
            <button
              type="button"
              className={`ad-nav-item ${activeMenu === "pqr" ? "active" : ""}`}
              onClick={() => setActiveMenu("pqr")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z" />
              </svg>
              <span>PQR y Reportes</span>
            </button>

            {/* Beneficios y Puntos */}
            <button
              type="button"
              className={`ad-nav-item ${activeMenu === "beneficios" ? "active" : ""}`}
              onClick={() => setActiveMenu("beneficios")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36 2.38 3.24L17 10.83 14.92 8H20v6z" />
              </svg>
              <span>Beneficios</span>
            </button>

            {/* Fallas Técnicas */}
            <button
              type="button"
              className={`ad-nav-item ${activeMenu === "fallas" ? "active" : ""}`}
              onClick={() => setActiveMenu("fallas")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5c-.49 0-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z" />
              </svg>
              <span>Fallas Técnicas</span>
            </button>

            {/* Roles y Permisos */}
            <button
              type="button"
              className={`ad-nav-item ${activeMenu === "roles" ? "active" : ""}`}
              onClick={() => setActiveMenu("roles")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
              </svg>
              <span>Roles y Permisos</span>
            </button>

            {/* Historial de Auditoría */}
            <button
              type="button"
              className={`ad-nav-item ${activeMenu === "auditoria" ? "active" : ""}`}
              onClick={() => setActiveMenu("auditoria")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
              </svg>
              <span>Historial de Auditoría</span>
            </button>

            {/* Reportes y Estadísticas */}
            <button
              type="button"
              className={`ad-nav-item ${activeMenu === "reportes" ? "active" : ""}`}
              onClick={() => setActiveMenu("reportes")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20h4V4h-4v16zm-6 0h4v-8H4v8zM16 9v11h4V9h-4z" />
              </svg>
              <span>Reportes y Estadísticas</span>
            </button>

            {/* Configuración */}
            <button
              type="button"
              className={`ad-nav-item ${activeMenu === "configuracion" ? "active" : ""}`}
              onClick={() => setActiveMenu("configuracion")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
              <span>Configuración</span>
            </button>
          </nav>
        </div>

        {/* Pie del Sidebar: Perfil de Administrador y Cerrar Sesión */}
        <div className="ad-sidebar-footer">
          <div className="ad-user-card">
            <div className="ad-user-avatar">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <div className="ad-user-info">
              <h4>Administrador</h4>
              <p>admin@serviprox.com</p>
            </div>
          </div>
          <button type="button" className="ad-logout-btn" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ═════════════════════════════════════════════════════════════════════
          CONTENIDO PRINCIPAL
         ═════════════════════════════════════════════════════════════════════ */}
      <main className="ad-main-content">
        {/* Barra Superior con Búsqueda y Perfil */}
        <header className="ad-topbar">
          <div className="ad-search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Buscar usuarios, servicios, publicaciones, PQR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="ad-topbar-actions">
            {/* Campana de Notificaciones con Badge 3 */}
            <button
              type="button"
              className="ad-notification-btn"
              onClick={() => setNotificationsOpen((prev) => !prev)}
              aria-label="Ver notificaciones"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
              </svg>
              <span className="ad-badge-count">3</span>
            </button>

            {/* Perfil del Administrador en la barra superior */}
            <div className="ad-topbar-user" onClick={() => setActiveMenu("configuracion")}>
              <div className="ad-topbar-avatar">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
              <div className="ad-topbar-user-info">
                <strong>Administrador</strong>
                <span>Rol: Superadministrador</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dropdown de Notificaciones */}
        {notificationsOpen && (
          <div
            style={{
              position: "absolute",
              top: "70px",
              right: "40px",
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
              border: "1px solid #e2e8f0",
              width: "320px",
              padding: "16px",
              zIndex: 100,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>Notificaciones Recientes</strong>
              <button
                type="button"
                onClick={() => setNotificationsOpen(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1rem" }}
              >
                ✕
              </button>
            </div>
            {notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: "10px",
                  borderRadius: "10px",
                  background: n.unread ? "#f0fdf4" : "#f8fafc",
                  marginBottom: "8px",
                  fontSize: "0.82rem",
                  border: "1px solid #e2e8f0",
                }}
              >
                <p style={{ margin: 0, fontWeight: 600, color: "#1e293b" }}>{n.text}</p>
                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{n.time}</span>
              </div>
            ))}
          </div>
        )}

        {/* Cuerpo del Panel */}
        <div className="ad-dashboard-body">
          {/* Fila de Bienvenida, Fecha y Estado de BD */}
          <div className="ad-welcome-row">
            <div className="ad-welcome-text">
              <h1>Bienvenido, Administrador</h1>
              <p>Aquí puedes supervisar y gestionar toda la información de Serviprox en tiempo real.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              {/* Indicador de conexión a Base de Datos en vivo */}
              <div
                className={`ad-db-status-pill ${dbInfo.connected ? "connected" : "offline"}`}
                title={
                  dbInfo.connected
                    ? `Base de datos SQLite activa (${dbInfo.database_name || "db.sqlite3"})`
                    : "Servidor local desconectado o en modo demo"
                }
              >
                <span className="ad-status-dot" />
                <span>
                  {dbInfo.connected
                    ? `Base de Datos: Conectada (${dbInfo.engine.toUpperCase()})`
                    : "Base de Datos: Modo Demostración"}
                </span>
                <button
                  type="button"
                  onClick={fetchLiveOverview}
                  disabled={dbInfo.loading}
                  className="ad-refresh-db-btn"
                  title="Recargar consultas en vivo desde la base de datos"
                >
                  {dbInfo.loading ? "⏳" : "🔄"}
                </button>
              </div>

              {/* Fecha actual */}
              <div className="ad-date-card">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
                </svg>
                <span>Miércoles, 8 de octubre de 2026</span>
              </div>
            </div>
          </div>

          {/* Tarjetas KPI Superiores (6 Columnas exactas a la imagen) */}
          <section className="ad-kpi-grid" aria-label="Indicadores clave">
            {/* 1. Clientes registrados */}
            <div className="ad-kpi-card">
              <div className="ad-kpi-icon-box" style={{ background: "#dbeafe", color: "#2563eb" }}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
              </div>
              <div className="ad-kpi-value">{kpis.clients.toLocaleString("es-CO")}</div>
              <p className="ad-kpi-label">Clientes registrados</p>
              <div className="ad-kpi-trend positive">
                <span>↗</span> +12%
              </div>
            </div>

            {/* 2. Profesionales activos */}
            <div className="ad-kpi-card">
              <div className="ad-kpi-icon-box" style={{ background: "#dcfce7", color: "#16a34a" }}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2c-4.42 0-8 3.58-8 8v3h16v-3c0-4.42-3.58-8-8-8zm-1 16H3v2c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-2h-8v-2h-2v2z" />
                </svg>
              </div>
              <div className="ad-kpi-value">{kpis.professionals.toLocaleString("es-CO")}</div>
              <p className="ad-kpi-label">Profesionales activos</p>
              <div className="ad-kpi-trend positive">
                <span>↗</span> +8%
              </div>
            </div>

            {/* 3. Publicaciones en revisión */}
            <div className="ad-kpi-card">
              <div className="ad-kpi-icon-box" style={{ background: "#ffedd5", color: "#ea580c" }}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                </svg>
              </div>
              <div className="ad-kpi-value">{kpis.pending_publications.toLocaleString("es-CO")}</div>
              <p className="ad-kpi-label">Publicaciones en revisión</p>
              <div className="ad-kpi-trend warning">
                <span>↗</span> +24%
              </div>
            </div>

            {/* 4. Servicios contratados */}
            <div className="ad-kpi-card">
              <div className="ad-kpi-icon-box" style={{ background: "#f3e8ff", color: "#9333ea" }}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />
                </svg>
              </div>
              <div className="ad-kpi-value">{kpis.hired_services.toLocaleString("es-CO")}</div>
              <p className="ad-kpi-label">Servicios contratados</p>
              <div className="ad-kpi-trend" style={{ color: "#9333ea" }}>
                <span>↗</span> +15%
              </div>
            </div>

            {/* 5. PQR pendientes */}
            <div className="ad-kpi-card">
              <div className="ad-kpi-icon-box" style={{ background: "#fee2e2", color: "#dc2626" }}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                </svg>
              </div>
              <div className="ad-kpi-value">{kpis.open_pqrs.toLocaleString("es-CO")}</div>
              <p className="ad-kpi-label">PQR pendientes</p>
              <div className="ad-kpi-trend danger">
                <span>↘</span> +8%
              </div>
            </div>

            {/* 6. Fallas técnicas */}
            <div className="ad-kpi-card">
              <div className="ad-kpi-icon-box" style={{ background: "#ccfbf1", color: "#0d9488" }}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5c-.49 0-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z" />
                </svg>
              </div>
              <div className="ad-kpi-value">{kpis.technical_issues.toLocaleString("es-CO")}</div>
              <p className="ad-kpi-label">Fallas técnicas</p>
              <div className="ad-kpi-trend teal">
                <span>↘</span> -20%
              </div>
            </div>
          </section>

          {/* Cuadrícula Principal (Izquierda ancha y Derecha lateral) */}
          <div className="ad-content-grid">
            {/* ────────── COLUMNA IZQUIERDA ────────── */}
            <div className="ad-left-col">
              {/* Card 1: Solicitudes Recientes */}
              <div className="ad-card">
                <div className="ad-card-header">
                  <h3>Solicitudes recientes</h3>
                  <button
                    type="button"
                    className="ad-card-link"
                    onClick={() => setActiveMenu("publicaciones_servicios")}
                  >
                    Ver todas
                  </button>
                </div>

                {/* Filtros de Pestaña */}
                <div className="ad-tabs" role="tablist">
                  {(
                    [
                      "Publicaciones",
                      "Profesionales",
                      "Productos",
                      "PQR",
                      "Fallas técnicas",
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={activeRequestTab === tab}
                      className={`ad-tab-btn ${
                        activeRequestTab === tab ? "active" : ""
                      }`}
                      onClick={() => setActiveRequestTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Tabla de Datos */}
                <div className="ad-table-responsive">
                  <table className="ad-table">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Título</th>
                        <th>Usuario</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <div className="ad-type-badge">
                              <span
                                className="ad-type-icon"
                                style={{ background: row.typeColor }}
                              >
                                {row.typeIcon}
                              </span>
                              <span>{row.type}</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 600, color: "#1e293b" }}>
                            {row.title}
                          </td>
                          <td>
                            <div className="ad-user-cell">
                              <img
                                src={row.userAvatar}
                                alt={row.userName}
                                className="ad-table-avatar"
                              />
                              <span style={{ fontWeight: 600 }}>{row.userName}</span>
                            </div>
                          </td>
                          <td style={{ color: "#64748b", fontSize: "0.82rem" }}>
                            {row.date}
                          </td>
                          <td>
                            <span className={`ad-status-pill ${row.statusClass}`}>
                              {row.status}
                            </span>
                          </td>
                          <td>
                            <div className="ad-actions-cell">
                              <button
                                type="button"
                                className="ad-action-btn"
                                title="Ver detalles"
                                onClick={() => handleViewDetail(row)}
                              >
                                👁
                              </button>
                              {row.status === "En revisión" && (
                                <>
                                  <button
                                    type="button"
                                    className="ad-action-btn approve"
                                    title="Aprobar"
                                    onClick={() => handleApprove(row.id)}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    type="button"
                                    className="ad-action-btn reject"
                                    title="Rechazar"
                                    onClick={() => handleReject(row.id)}
                                  >
                                    ✕
                                  </button>
                                </>
                              )}
                              {row.status !== "En revisión" && (
                                <>
                                  <button
                                    type="button"
                                    className="ad-action-btn"
                                    title="Moderar o Editar"
                                    onClick={() => handleViewDetail(row)}
                                  >
                                    ✎
                                  </button>
                                  <button
                                    type="button"
                                    className="ad-action-btn"
                                    title="Más opciones"
                                    onClick={() => {
                                      setTargetUserToBlock(row.userName);
                                      setModalBloqueoOpen(true);
                                    }}
                                  >
                                    •••
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fila Inferior con Profesionales Destacados y Reportes Importantes */}
              <div className="ad-bottom-subgrid">
                {/* Profesionales Destacados */}
                <div className="ad-card">
                  <div className="ad-card-header">
                    <h3>Profesionales destacados</h3>
                    <button
                      type="button"
                      className="ad-card-link"
                      onClick={() => setActiveMenu("usuarios_profesionales")}
                    >
                      Ver todos
                    </button>
                  </div>
                  <div className="ad-pro-list">
                    {prosList.map((pro) => (
                      <div key={pro.id} className="ad-pro-item">
                        <div className="ad-pro-identity">
                          <img
                            src={pro.avatar}
                            alt={pro.name}
                            className="ad-pro-avatar"
                          />
                          <div className="ad-pro-meta">
                            <h5>{pro.name}</h5>
                            <p>{pro.specialty}</p>
                          </div>
                        </div>
                        <div className="ad-pro-badges">
                          <div className="ad-pro-rating">
                            <span>★</span> {pro.rating}
                          </div>
                          <span
                            className={`ad-tier-badge ${
                              pro.tier === "Nivel Oro"
                                ? "ad-tier-oro"
                                : "ad-tier-plata"
                            }`}
                          >
                            {pro.tier}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reportes Importantes */}
                <div className="ad-card">
                  <div className="ad-card-header">
                    <h3>Reportes importantes</h3>
                    <button
                      type="button"
                      className="ad-card-link"
                      onClick={() => setActiveMenu("pqr")}
                    >
                      Ver todos
                    </button>
                  </div>
                  <div className="ad-reports-list">
                    <div className="ad-report-item">
                      <div className="ad-report-left">
                        <div
                          className="ad-report-icon"
                          style={{ background: "#fee2e2", color: "#dc2626" }}
                        >
                          👤
                        </div>
                        <span>Cuentas bloqueadas hoy</span>
                      </div>
                      <span className="ad-report-count" style={{ color: "#dc2626" }}>
                        5
                      </span>
                    </div>

                    <div className="ad-report-item">
                      <div className="ad-report-left">
                        <div
                          className="ad-report-icon"
                          style={{ background: "#ffedd5", color: "#ea580c" }}
                        >
                          ⚠️
                        </div>
                        <span>Quejas por mala práctica</span>
                      </div>
                      <span className="ad-report-count" style={{ color: "#ea580c" }}>
                        8
                      </span>
                    </div>

                    <div className="ad-report-item">
                      <div className="ad-report-left">
                        <div
                          className="ad-report-icon"
                          style={{ background: "#fef3c7", color: "#d97706" }}
                        >
                          📋
                        </div>
                        <span>Publicaciones rechazadas</span>
                      </div>
                      <span className="ad-report-count" style={{ color: "#d97706" }}>
                        14
                      </span>
                    </div>

                    <div className="ad-report-item">
                      <div className="ad-report-left">
                        <div
                          className="ad-report-icon"
                          style={{ background: "#dbeafe", color: "#2563eb" }}
                        >
                          🛍️
                        </div>
                        <span>Servicios cancelados</span>
                      </div>
                      <span className="ad-report-count" style={{ color: "#2563eb" }}>
                        11
                      </span>
                    </div>

                    <div className="ad-report-item">
                      <div className="ad-report-left">
                        <div
                          className="ad-report-icon"
                          style={{ background: "#f3e8ff", color: "#9333ea" }}
                        >
                          🐞
                        </div>
                        <span>Incidencias app</span>
                      </div>
                      <span className="ad-report-count" style={{ color: "#9333ea" }}>
                        12
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ────────── COLUMNA DERECHA ────────── */}
            <div className="ad-right-col">
              {/* Card 1: Distribución de Usuarios (Donut) */}
              <div className="ad-card">
                <div className="ad-card-header">
                  <h3>Distribución de usuarios</h3>
                </div>
                <div className="ad-donut-wrapper">
                  <div className="ad-donut-chart">
                    {(() => {
                      const totalUsers = (userDistribution.clients || 0) + (userDistribution.professionals || 0);
                      const clientPct = totalUsers > 0 ? Math.round((userDistribution.clients / totalUsers) * 100) : 78;
                      const proPct = 100 - clientPct;
                      return (
                        <>
                          <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%" }}>
                            {/* Fondo */}
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="#e2e8f0"
                              strokeWidth="4"
                            />
                            {/* Porción Clientes (Azul) */}
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth="4.5"
                              strokeDasharray={`${clientPct}, 100`}
                              strokeLinecap="round"
                            />
                            {/* Porción Profesionales (Verde) */}
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="#22c55e"
                              strokeWidth="4.5"
                              strokeDasharray={`${proPct}, 100`}
                              strokeDashoffset={`-${clientPct}`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="ad-donut-center">
                            <strong>{totalUsers.toLocaleString("es-CO")}</strong>
                            <span>Usuarios</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className="ad-donut-legend">
                    {(() => {
                      const totalUsers = (userDistribution.clients || 0) + (userDistribution.professionals || 0);
                      const clientPct = totalUsers > 0 ? Math.round((userDistribution.clients / totalUsers) * 100) : 78;
                      const proPct = 100 - clientPct;
                      return (
                        <>
                          <div className="ad-legend-item">
                            <span className="ad-legend-dot" style={{ background: "#2563eb" }} />
                            <div className="ad-legend-text">
                              <strong>Clientes</strong>
                              <span>{userDistribution.clients.toLocaleString("es-CO")} ({clientPct}%)</span>
                            </div>
                          </div>
                          <div className="ad-legend-item">
                            <span className="ad-legend-dot" style={{ background: "#22c55e" }} />
                            <div className="ad-legend-text">
                              <strong>Profesionales</strong>
                              <span>{userDistribution.professionals.toLocaleString("es-CO")} ({proPct}%)</span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Card 2: PQR por Estado (Bar Chart SVG) */}
              <div className="ad-card">
                <div className="ad-card-header">
                  <h3>PQR por estado</h3>
                </div>
                <div className="ad-barchart-container">
                  <svg className="ad-barchart-svg" viewBox="0 0 320 180">
                    {/* Líneas horizontales de guía */}
                    <line x1="30" y1="20" x2="310" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                    <text x="15" y="24" fontSize="10" fill="#94a3b8" textAnchor="end">40</text>

                    <line x1="30" y1="55" x2="310" y2="55" stroke="#f1f5f9" strokeWidth="1" />
                    <text x="15" y="59" fontSize="10" fill="#94a3b8" textAnchor="end">30</text>

                    <line x1="30" y1="90" x2="310" y2="90" stroke="#f1f5f9" strokeWidth="1" />
                    <text x="15" y="94" fontSize="10" fill="#94a3b8" textAnchor="end">20</text>

                    <line x1="30" y1="125" x2="310" y2="125" stroke="#f1f5f9" strokeWidth="1" />
                    <text x="15" y="129" fontSize="10" fill="#94a3b8" textAnchor="end">10</text>

                    <line x1="30" y1="150" x2="310" y2="150" stroke="#cbd5e1" strokeWidth="1" />
                    <text x="15" y="153" fontSize="10" fill="#94a3b8" textAnchor="end">0</text>

                    {/* Barra 1: Radicados / Abiertos - Rojo */}
                    <rect x="55" y={Math.max(30, 150 - Math.min(120, pqrDistribution.radicado * 4))} width="36" height={Math.min(120, pqrDistribution.radicado * 4)} rx="4" fill="#ef4444" />
                    <text x="73" y={Math.max(22, 142 - Math.min(120, pqrDistribution.radicado * 4))} fontSize="11" fontWeight="700" fill="#ef4444" textAnchor="middle">{pqrDistribution.radicado}</text>
                    <text x="73" y="165" fontSize="10" fill="#64748b" textAnchor="middle">Abiertos</text>

                    {/* Barra 2: En revisión - Amarillo */}
                    <rect x="125" y={Math.max(30, 150 - Math.min(120, pqrDistribution.en_revision * 4))} width="36" height={Math.min(120, pqrDistribution.en_revision * 4)} rx="4" fill="#f59e0b" />
                    <text x="143" y={Math.max(22, 142 - Math.min(120, pqrDistribution.en_revision * 4))} fontSize="11" fontWeight="700" fill="#f59e0b" textAnchor="middle">{pqrDistribution.en_revision}</text>
                    <text x="143" y="165" fontSize="10" fill="#64748b" textAnchor="middle">Revisión</text>

                    {/* Barra 3: Conciliación - Azul */}
                    <rect x="195" y={Math.max(30, 150 - Math.min(120, pqrDistribution.conciliacion * 4))} width="36" height={Math.min(120, pqrDistribution.conciliacion * 4)} rx="4" fill="#3b82f6" />
                    <text x="213" y={Math.max(22, 142 - Math.min(120, pqrDistribution.conciliacion * 4))} fontSize="11" fontWeight="700" fill="#3b82f6" textAnchor="middle">{pqrDistribution.conciliacion}</text>
                    <text x="213" y="165" fontSize="10" fill="#64748b" textAnchor="middle">Concilia</text>

                    {/* Barra 4: Resueltos - Verde */}
                    <rect x="265" y={Math.max(30, 150 - Math.min(120, pqrDistribution.resuelto * 4))} width="36" height={Math.min(120, pqrDistribution.resuelto * 4)} rx="4" fill="#10b981" />
                    <text x="283" y={Math.max(22, 142 - Math.min(120, pqrDistribution.resuelto * 4))} fontSize="11" fontWeight="700" fill="#10b981" textAnchor="middle">{pqrDistribution.resuelto}</text>
                    <text x="283" y="165" fontSize="10" fill="#64748b" textAnchor="middle">Resueltos</text>
                  </svg>
                </div>
              </div>

              {/* Card 3: Accesos Rápidos (4 Botones con Flecha) */}
              <div className="ad-card">
                <div className="ad-card-header">
                  <h3>Accesos rápidos</h3>
                </div>
                <div className="ad-quick-grid">
                  {/* Gestionar usuarios */}
                  <button
                    type="button"
                    className="ad-quick-btn ad-quick-blue"
                    onClick={() => setActiveMenu("usuarios_clientes")}
                  >
                    <div className="ad-quick-btn-content">
                      <div className="ad-quick-icon">👥</div>
                      <span>Gestionar usuarios</span>
                    </div>
                    <span>›</span>
                  </button>

                  {/* Verificar profesionales */}
                  <button
                    type="button"
                    className="ad-quick-btn ad-quick-green"
                    onClick={() => setActiveMenu("usuarios_profesionales")}
                  >
                    <div className="ad-quick-btn-content">
                      <div className="ad-quick-icon">🛡️</div>
                      <span>Verificar profesionales</span>
                    </div>
                    <span>›</span>
                  </button>

                  {/* Revisar publicaciones */}
                  <button
                    type="button"
                    className="ad-quick-btn ad-quick-orange"
                    onClick={() => setActiveMenu("publicaciones_servicios")}
                  >
                    <div className="ad-quick-btn-content">
                      <div className="ad-quick-icon">🛍️</div>
                      <span>Revisar publicaciones</span>
                    </div>
                    <span>›</span>
                  </button>

                  {/* Asignar beneficios */}
                  <button
                    type="button"
                    className="ad-quick-btn ad-quick-purple"
                    onClick={() => setActiveMenu("beneficios")}
                  >
                    <div className="ad-quick-btn-content">
                      <div className="ad-quick-icon">🎁</div>
                      <span>Asignar beneficios</span>
                    </div>
                    <span>›</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ═════════════════════════════════════════════════════════════════════
          MODAL: BLOQUEAR CUENTA (SEGÚN REQUERIMIENTO OFICIAL)
         ═════════════════════════════════════════════════════════════════════ */}
      {modalBloqueoOpen && (
        <div className="ad-modal-backdrop" onClick={() => setModalBloqueoOpen(false)}>
          <div className="ad-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ad-modal-header">
              <h3>🔒 Bloqueo Disciplinario de Cuenta</h3>
              <button
                type="button"
                className="ad-modal-close"
                onClick={() => setModalBloqueoOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="ad-modal-body">
              <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569" }}>
                Aplica sanciones o suspensiones temporales/permanentes por incumplimiento de normas.
                Esta acción se registrará formalmente en el <strong>Historial de Auditoría</strong>.
              </p>

              <div className="ad-form-group">
                <label>Usuario / Contratista:</label>
                <input
                  type="text"
                  className="ad-form-control"
                  value={targetUserToBlock}
                  onChange={(e) => setTargetUserToBlock(e.target.value)}
                  placeholder="Nombre o correo del usuario"
                />
              </div>

              <div className="ad-form-group">
                <label>Tipo de Sanción:</label>
                <select
                  className="ad-form-control"
                  value={blockType}
                  onChange={(e) => setBlockType(e.target.value as any)}
                >
                  <option value="temporal">Suspensión Temporal</option>
                  <option value="permanente">Bloqueo Definitivo y Expulsión</option>
                </select>
              </div>

              {blockType === "temporal" && (
                <div className="ad-form-group">
                  <label>Duración de la suspensión:</label>
                  <select
                    className="ad-form-control"
                    value={blockDuration}
                    onChange={(e) => setBlockDuration(e.target.value)}
                  >
                    <option value="3">3 Días (Amonestación leve)</option>
                    <option value="7">7 Días (Reiteración de falta)</option>
                    <option value="15">15 Días (Falta grave a cliente)</option>
                    <option value="30">30 Días (Investigación en Defensoría)</option>
                  </select>
                </div>
              )}

              <div className="ad-form-group">
                <label>Motivo justificado (Requerido para trazabilidad):</label>
                <textarea
                  className="ad-form-control"
                  rows={3}
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Describe detalladamente los hechos, pruebas o radicados PQR que sustentan la sanción..."
                />
              </div>
            </div>
            <div className="ad-modal-footer">
              <button
                type="button"
                className="ad-btn ad-btn-secondary"
                onClick={() => setModalBloqueoOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="ad-btn ad-btn-danger"
                disabled={!blockReason.trim()}
                onClick={confirmBlockUser}
              >
                Aplicar Bloqueo y Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          MODAL: ASIGNAR BENEFICIOS Y PUNTOS
         ═════════════════════════════════════════════════════════════════════ */}
      {modalBeneficiosOpen && targetProBeneficio && (
        <div className="ad-modal-backdrop" onClick={() => setModalBeneficiosOpen(false)}>
          <div className="ad-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ad-modal-header">
              <h3>🎁 Asignar Puntos y Beneficios</h3>
              <button
                type="button"
                className="ad-modal-close"
                onClick={() => setModalBeneficiosOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="ad-modal-body">
              <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "#f8fafc", padding: "12px", borderRadius: "12px" }}>
                <img src={targetProBeneficio.avatar} alt="" style={{ width: "44px", height: "44px", borderRadius: "50%" }} />
                <div>
                  <strong style={{ fontSize: "0.95rem" }}>{targetProBeneficio.name}</strong>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
                    {targetProBeneficio.specialty} • Puntos actuales: {targetProBeneficio.points} pts
                  </p>
                </div>
              </div>

              <div className="ad-form-group">
                <label>Puntos a acreditar:</label>
                <input
                  type="number"
                  className="ad-form-control"
                  value={puntosToAdd}
                  onChange={(e) => setPuntosToAdd(Number(e.target.value))}
                />
              </div>

              <div className="ad-form-group">
                <label>Bono o Recarga en COP:</label>
                <input
                  type="number"
                  className="ad-form-control"
                  value={recargaToAdd}
                  onChange={(e) => setRecargaToAdd(Number(e.target.value))}
                />
              </div>

              <div className="ad-form-group">
                <label>Motivo del reconocimiento:</label>
                <input
                  type="text"
                  className="ad-form-control"
                  value={motivoBeneficio}
                  onChange={(e) => setMotivoBeneficio(e.target.value)}
                  placeholder="Ej. Cumplimiento de metas de calidad mensual"
                />
              </div>
            </div>
            <div className="ad-modal-footer">
              <button
                type="button"
                className="ad-btn ad-btn-secondary"
                onClick={() => setModalBeneficiosOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="ad-btn ad-btn-primary"
                onClick={confirmAssignBenefits}
              >
                Acreditar Beneficios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          MODAL: DETALLES DE SOLICITUD / PQR / FALLA
         ═════════════════════════════════════════════════════════════════════ */}
      {modalDetailOpen && selectedDetailItem && (
        <div className="ad-modal-backdrop" onClick={() => setModalDetailOpen(false)}>
          <div className="ad-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ad-modal-header">
              <h3>Detalles de {selectedDetailItem.type || "Elemento"}</h3>
              <button
                type="button"
                className="ad-modal-close"
                onClick={() => setModalDetailOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="ad-modal-body">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "24px" }}>{selectedDetailItem.typeIcon}</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: "1.05rem" }}>{selectedDetailItem.title}</h4>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                    Publicado por {selectedDetailItem.userName} el {selectedDetailItem.date}
                  </span>
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <strong style={{ fontSize: "0.82rem", color: "#475569", textTransform: "uppercase" }}>Estado actual:</strong>
                <div style={{ marginTop: "4px" }}>
                  <span className={`ad-status-pill ${selectedDetailItem.statusClass}`}>
                    {selectedDetailItem.status}
                  </span>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: "0.88rem", color: "#334155", lineHeight: 1.5 }}>
                Este registro ha sido evaluado bajo los lineamientos técnicos de Serviprox. Puedes aprobarlo
                inmediatamente para publicación en el catálogo o solicitar ajustes al usuario.
              </p>
            </div>
            <div className="ad-modal-footer">
              <button
                type="button"
                className="ad-btn ad-btn-secondary"
                onClick={() => setModalDetailOpen(false)}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="ad-btn ad-btn-primary"
                onClick={() => {
                  handleApprove(selectedDetailItem.id);
                  setModalDetailOpen(false);
                }}
              >
                Aprobar Publicación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

