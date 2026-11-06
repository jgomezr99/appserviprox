import React, { useState, useEffect } from "react";
import { adminService, ReportsStatsResponse } from "../services/adminService";
import "./AdminReportsStats.css";

interface Props {
  onNavigateToAudit?: () => void;
}

export const AdminReportsStats: React.FC<Props> = ({ onNavigateToAudit }) => {
  const [dateRange, setDateRange] = useState("");
  const [contratacionesPeriod, setContratacionesPeriod] = useState("10meses");
  const [activeTooltip, setActiveTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [hoveredLocality, setHoveredLocality] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [reportsData, setReportsData] = useState<ReportsStatsResponse | null>(null);
  const [isDatabaseLive, setIsDatabaseLive] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const resp = await adminService.getReportsStats();
        if (isMounted) {
          setReportsData(resp);
          setIsDatabaseLive(resp.database_connected ?? false);
          setDateRange(resp.period);
        }
      } catch (error) {
        if (isMounted) {
          setReportsData(null);
          setIsDatabaseLive(false);
          setDateRange("");
          setLoadError(error instanceof Error ? error.message : "No se pudieron cargar los reportes desde la base de datos.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchStats();
    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  const hiresData = reportsData?.hires_data ?? [];
  const visibleHiresData = contratacionesPeriod === "6meses" ? hiresData.slice(-6) : hiresData;
  const topServices = reportsData?.top_services ?? [];
  const topProducts = reportsData?.top_products ?? [];
  const newUsersData = reportsData?.new_users_data ?? [];
  const monthlyRevenue = reportsData?.monthly_revenue ?? [];
  const localities = reportsData?.localities ?? [];
  const pqrStatus = reportsData?.pqr_status ?? {
    total: 0,
    raw_total: 0,
    resueltas: 0,
    resueltas_pct: 0,
    en_proceso: 0,
    en_proceso_pct: 0,
    pendientes: 0,
    pendientes_pct: 0,
    rechazadas: 0,
    rechazadas_pct: 0,
  };
  const emptyKpi = { raw: 0, display: "—", trend: "—", sparkline: [] as number[] };
  const kpis = reportsData?.kpis ?? {
    users: emptyKpi,
    pros: emptyKpi,
    products: emptyKpi,
    hires: emptyKpi,
    pqrs: emptyKpi,
    revenue: emptyKpi,
  };
  const recentActivity = reportsData?.recent_activity ?? [];

  // Helper para contar localidad
  const getLocalityCount = (id: string) => {
    const found = localities.find((l) => l.id === id);
    return reportsData ? found?.count ?? 0 : "—";
  };
  const renderSparkline = (values: number[], color: string) => {
    const points = values.slice(-4);
    const max = Math.max(...points, 1);
    return points.map((value, index) => (
      <span key={index} style={{ height: `${Math.max(3, (value / max) * 18)}px`, background: color }} />
    ));
  };

  // Descarga oficial del reporte en formato CSV con datos reales
  const handleExportCsv = () => {
    if (!reportsData || !isDatabaseLive) return;
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "REPORTE Y ESTADÍSTICAS OFICIALES SERVIPROX\n" +
      `Periodo,${dateRange}\n` +
      `Origen de datos,Base de datos ${reportsData.database_engine || "conectada"}\n\n` +
      "MÉTRICAS CLAVE (KPIS)\n" +
      "Métrica,Valor,Tendencia,Registros BD\n" +
      `Usuarios registrados,${kpis.users.display},${kpis.users.trend},${kpis.users.raw}\n` +
      `Profesionales activos,${kpis.pros.display},${kpis.pros.trend},${kpis.pros.raw}\n` +
      `Productos publicados,${kpis.products.display},${kpis.products.trend},${kpis.products.raw}\n` +
      `Contrataciones realizadas,${kpis.hires.display},${kpis.hires.trend},${kpis.hires.raw}\n` +
      `PQR recibidas,${kpis.pqrs.display},${kpis.pqrs.trend},${kpis.pqrs.raw}\n` +
      `Ingresos totales (COP),${kpis.revenue.display},${kpis.revenue.trend},${kpis.revenue.raw}\n\n` +
      "SERVICIOS MÁS SOLICITADOS\n" +
      "Servicio,Contrataciones\n" +
      topServices.map((s) => `${s.name},${s.count}`).join("\n") +
      "\n\nPRODUCTOS MÁS PUBLICADOS\n" +
      "Categoría,Publicaciones\n" +
      topProducts.map((p) => `${p.name},${p.count}`).join("\n") +
      "\n\nCONTRATACIONES POR LOCALIDAD (BOGOTÁ)\n" +
      "Localidad,Contrataciones\n" +
      localities.map((l) => `${l.name},${l.count}`).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_serviprox_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="ad-reports-wrapper">
      {/* ═════════════════════════════════════════════════════════════════════
          HEADER SUPERIOR
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="ad-reports-header">
        <div className="ad-reports-header-left">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <h1>Reportes y Estadísticas</h1>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "3px 10px",
                borderRadius: "16px",
                fontSize: "0.74rem",
                fontWeight: 700,
                background: isDatabaseLive ? "#dcfce7" : "#f1f5f9",
                color: isDatabaseLive ? "#15803d" : "#64748b",
                border: isDatabaseLive ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: isDatabaseLive ? "#16a34a" : "#94a3b8",
                  boxShadow: isDatabaseLive ? "0 0 6px #22c55e" : "none",
                }}
              />
              {isDatabaseLive ? `Base de datos conectada (${reportsData?.database_engine || "activa"})` : loading ? "Conectando..." : "Sin conexión a base de datos"}
            </span>
          </div>
          <p>
            Métricas analíticas consolidadas directamente desde los registros de usuarios, contrataciones, PQR y auditoría.
          </p>
        </div>

        <div className="ad-reports-header-actions">
          {/* Selector de Fecha */}
          <div>
            <div className="ad-reports-date-btn" aria-label="Periodo de datos">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
              </svg>
              <span>{dateRange || (loading ? "Consultando base de datos..." : "Periodo no disponible")}</span>
            </div>
          </div>

          {/* Botón Exportar Reporte */}
          <button type="button" className="ad-reports-export-btn" onClick={handleExportCsv} disabled={!isDatabaseLive || loading}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
            </svg>
            <span>Exportar reporte</span>
          </button>
        </div>
      </div>
      {loadError && (
        <div role="alert" className="ad-reports-error">
          <span>{loadError}</span>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>
            {loading ? "Conectando..." : "Reintentar"}
          </button>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          FILA 1: 6 TARJETAS DE INDICADORES CLAVE (KPIS)
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="ad-reports-kpi-grid">
        {/* KPI 1: Usuarios registrados */}
        <div className="ad-reports-kpi-card">
          <div>
            <div className="ad-reports-kpi-top">
              <div className="ad-reports-kpi-icon" style={{ background: "#eff6ff", color: "#3b82f6" }}>
                👥
              </div>
            </div>
            <div className="ad-reports-kpi-val">{kpis.users.display}</div>
            <div className="ad-reports-kpi-label">Usuarios registrados</div>
          </div>
          <div className="ad-reports-kpi-bottom">
            <span className={`ad-reports-kpi-trend ${kpis.users.trend.startsWith("-") ? "down" : "up"}`}>
            {kpis.users.trend}
            </span>
            <div className="ad-reports-kpi-sparkline">
              {renderSparkline(kpis.users.sparkline, "#3b82f6")}
            </div>
          </div>
        </div>

        {/* KPI 2: Profesionales activos */}
        <div className="ad-reports-kpi-card">
          <div>
            <div className="ad-reports-kpi-top">
              <div className="ad-reports-kpi-icon" style={{ background: "#ecfdf5", color: "#10b981" }}>
                ⛑️
              </div>
            </div>
            <div className="ad-reports-kpi-val">{kpis.pros.display}</div>
            <div className="ad-reports-kpi-label">Profesionales activos</div>
          </div>
          <div className="ad-reports-kpi-bottom">
            <span className={`ad-reports-kpi-trend ${kpis.pros.trend.startsWith("-") ? "down" : "up"}`}>
              {kpis.pros.trend}
            </span>
            <div className="ad-reports-kpi-sparkline">
              {renderSparkline(kpis.pros.sparkline, "#10b981")}
            </div>
          </div>
        </div>

        {/* KPI 3: Productos publicados */}
        <div className="ad-reports-kpi-card">
          <div>
            <div className="ad-reports-kpi-top">
              <div className="ad-reports-kpi-icon" style={{ background: "#faf5ff", color: "#a855f7" }}>
                🛍️
              </div>
            </div>
            <div className="ad-reports-kpi-val">{kpis.products.display}</div>
            <div className="ad-reports-kpi-label">Productos publicados</div>
          </div>
          <div className="ad-reports-kpi-bottom">
            <span className={`ad-reports-kpi-trend ${kpis.products.trend.startsWith("-") ? "down" : "up"}`}>
              {kpis.products.trend}
            </span>
            <div className="ad-reports-kpi-sparkline">
              {renderSparkline(kpis.products.sparkline, "#a855f7")}
            </div>
          </div>
        </div>

        {/* KPI 4: Contrataciones realizadas */}
        <div className="ad-reports-kpi-card">
          <div>
            <div className="ad-reports-kpi-top">
              <div className="ad-reports-kpi-icon" style={{ background: "#fff7ed", color: "#f97316" }}>
                🤝
              </div>
            </div>
            <div className="ad-reports-kpi-val">{kpis.hires.display}</div>
            <div className="ad-reports-kpi-label">Contrataciones realizadas</div>
          </div>
          <div className="ad-reports-kpi-bottom">
            <span className={`ad-reports-kpi-trend ${kpis.hires.trend.startsWith("-") ? "down" : "up"}`}>
              {kpis.hires.trend}
            </span>
            <div className="ad-reports-kpi-sparkline">
              {renderSparkline(kpis.hires.sparkline, "#f97316")}
            </div>
          </div>
        </div>

        {/* KPI 5: PQR recibidas */}
        <div className="ad-reports-kpi-card">
          <div>
            <div className="ad-reports-kpi-top">
              <div className="ad-reports-kpi-icon" style={{ background: "#fef2f2", color: "#ef4444" }}>
                💬
              </div>
            </div>
            <div className="ad-reports-kpi-val">{kpis.pqrs.display}</div>
            <div className="ad-reports-kpi-label">PQR recibidas</div>
          </div>
          <div className="ad-reports-kpi-bottom">
            <span className={`ad-reports-kpi-trend ${kpis.pqrs.trend.startsWith("-") ? "down" : "up"}`}>
              {kpis.pqrs.trend}
            </span>
            <div className="ad-reports-kpi-sparkline">
              {renderSparkline(kpis.pqrs.sparkline, "#dc2626")}
            </div>
          </div>
        </div>

        {/* KPI 6: Ingresos totales (COP) */}
        <div className="ad-reports-kpi-card">
          <div>
            <div className="ad-reports-kpi-top">
              <div className="ad-reports-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>
                💲
              </div>
            </div>
            <div className="ad-reports-kpi-val" style={{ fontSize: "1.25rem" }}>
              {kpis.revenue.display}
            </div>
            <div className="ad-reports-kpi-label">Ingresos totales (COP)</div>
          </div>
          <div className="ad-reports-kpi-bottom">
            <span className={`ad-reports-kpi-trend ${kpis.revenue.trend.startsWith("-") ? "down" : "up"}`}>
              {kpis.revenue.trend}
            </span>
            <div className="ad-reports-kpi-sparkline">
              {renderSparkline(kpis.revenue.sparkline, "#059669")}
            </div>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          FILA 2: CONTRATACIONES POR MES + SERVICIOS RANKING + PRODUCTOS RANKING
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="ad-reports-row-2">
        {/* Contrataciones por mes (Línea con Área Suave y Puntos) */}
        <div className="ad-reports-card">
          <div className="ad-reports-card-header">
            <h3 className="ad-reports-card-title">Contrataciones por mes</h3>
            <select
              className="ad-reports-dropdown-filter"
              value={contratacionesPeriod}
              onChange={(e) => setContratacionesPeriod(e.target.value)}
            >
              <option value="10meses">Últimos 10 meses</option>
              <option value="6meses">Últimos 6 meses</option>
            </select>
          </div>

          <div style={{ position: "relative", width: "100%", height: "220px" }}>
            <svg viewBox="0 0 500 200" style={{ width: "100%", height: "100%", overflow: "visible" }}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Guías horizontales del eje Y */}
              {[400, 300, 200, 100, 0].map((val, idx) => {
                const y = 20 + idx * 38;
                return (
                  <g key={val}>
                    <line x1="35" y1={y} x2="490" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                    <text x="5" y={y + 4} fill="#94a3b8" fontSize="10" fontWeight="600">
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Área y Línea de datos */}
              {(() => {
                const points = visibleHiresData.map((d, i) => {
                  const x = 50 + i * (440 / Math.max(visibleHiresData.length - 1, 1));
                  const y = 172 - (d.val / 400) * 152;
                  return { x, y, ...d };
                });
                if (!points.length) return null;

                const dArea = `M ${points[0].x} 172 ` + points.map((p) => `L ${p.x} ${p.y}`).join(" ") + ` L ${points[points.length - 1].x} 172 Z`;
                const dLine = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");

                return (
                  <>
                    <path d={dArea} fill="url(#areaGradient)" />
                    <path d={dLine} fill="none" stroke="#2563eb" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                    {points.map((p) => (
                      <circle
                        key={p.month}
                        cx={p.x}
                        cy={p.y}
                        r="4.5"
                        fill="#2563eb"
                        stroke="#ffffff"
                        strokeWidth="2"
                        style={{ cursor: "pointer", transition: "r 0.15s ease" }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setActiveTooltip({ x: rect.left, y: rect.top, text: `${p.month}: ${p.val} contrataciones` });
                        }}
                        onMouseLeave={() => setActiveTooltip(null)}
                      />
                    ))}
                    {/* Etiquetas eje X */}
                    {points.map((p) => (
                      <text key={`lbl-${p.month}`} x={p.x} y="194" fill="#64748b" fontSize="10.5" fontWeight="600" textAnchor="middle">
                        {p.month}
                      </text>
                    ))}
                  </>
                );
              })()}
            </svg>
          </div>
        </div>

        {/* Servicios más solicitados (Ranking de barras horizontales) */}
        <div className="ad-reports-card">
          <div className="ad-reports-card-header">
            <h3 className="ad-reports-card-title">Servicios más solicitados</h3>
          </div>
          <div className="ad-reports-ranking-list">
            {topServices.map((svc) => (
              <div key={svc.name} className="ad-reports-ranking-item">
                <span className="ad-reports-ranking-name">{svc.name}</span>
                <div className="ad-reports-ranking-track">
                  <div
                    className="ad-reports-ranking-fill"
                    style={{ width: `${svc.pct}%`, background: "#2563eb" }}
                  />
                </div>
                <span className="ad-reports-ranking-val">{svc.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Productos más publicados (Ranking de barras horizontales) */}
        <div className="ad-reports-card">
          <div className="ad-reports-card-header">
            <h3 className="ad-reports-card-title">Productos más publicados</h3>
          </div>
          <div className="ad-reports-ranking-list">
            {topProducts.map((prod) => (
              <div key={prod.name} className="ad-reports-ranking-item">
                <span className="ad-reports-ranking-name">{prod.name}</span>
                <div className="ad-reports-ranking-track">
                  <div
                    className="ad-reports-ranking-fill"
                    style={{ width: `${prod.pct}%`, background: "#3b82f6" }}
                  />
                </div>
                <span className="ad-reports-ranking-val">{prod.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          FILA 3: NUEVOS USUARIOS + INGRESOS MENSUALES + ESTADO DE PQR
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="ad-reports-row-3">
        {/* Nuevos usuarios (Barras agrupadas Clientes vs Profesionales) */}
        <div className="ad-reports-card">
          <div className="ad-reports-card-header">
            <h3 className="ad-reports-card-title">Nuevos usuarios</h3>
            <div className="ad-reports-legend">
              <div className="ad-reports-legend-item">
                <span className="ad-reports-legend-dot" style={{ background: "#2563eb" }} />
                <span>Clientes</span>
              </div>
              <div className="ad-reports-legend-item">
                <span className="ad-reports-legend-dot" style={{ background: "#10b981" }} />
                <span>Profesionales</span>
              </div>
            </div>
          </div>

          <div style={{ width: "100%", height: "200px" }}>
            <svg viewBox="0 0 380 180" style={{ width: "100%", height: "100%", overflow: "visible" }}>
              {/* Líneas guía eje Y */}
              {[300, 200, 100, 0].map((val, idx) => {
                const y = 20 + idx * 43;
                return (
                  <g key={val}>
                    <line x1="28" y1={y} x2="375" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                    <text x="4" y={y + 4} fill="#94a3b8" fontSize="9.5" fontWeight="600">
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Barras dobles por mes */}
              {newUsersData.map((d, i) => {
                const x = 36 + i * 34;
                const hClient = (d.clients / 300) * 128;
                const hPro = (d.pros / 300) * 128;
                const yClient = 149 - hClient;
                const yPro = 149 - hPro;
                return (
                  <g key={d.month}>
                    {/* Barra Azul Cliente */}
                    <rect
                      x={x}
                      y={yClient}
                      width="9"
                      height={hClient}
                      rx="2.5"
                      fill="#2563eb"
                      style={{ cursor: "pointer" }}
                      onMouseEnter={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setActiveTooltip({ x: r.left, y: r.top, text: `${d.month}: ${d.clients} clientes` });
                      }}
                      onMouseLeave={() => setActiveTooltip(null)}
                    />
                    {/* Barra Verde Profesional */}
                    <rect
                      x={x + 11}
                      y={yPro}
                      width="9"
                      height={hPro}
                      rx="2.5"
                      fill="#10b981"
                      style={{ cursor: "pointer" }}
                      onMouseEnter={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setActiveTooltip({ x: r.left, y: r.top, text: `${d.month}: ${d.pros} profesionales` });
                      }}
                      onMouseLeave={() => setActiveTooltip(null)}
                    />
                    <text x={x + 10} y="168" fill="#64748b" fontSize="9.5" fontWeight="600" textAnchor="middle">
                      {d.month}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Ingresos por mes (COP) */}
        <div className="ad-reports-card">
          <div className="ad-reports-card-header">
            <h3 className="ad-reports-card-title">Ingresos por mes (COP)</h3>
          </div>

          <div style={{ width: "100%", height: "200px" }}>
            <svg viewBox="0 0 380 180" style={{ width: "100%", height: "100%", overflow: "visible" }}>
              {/* Guías eje Y */}
              {["20M", "15M", "10M", "5M", "0"].map((lbl, idx) => {
                const y = 20 + idx * 32;
                return (
                  <g key={lbl}>
                    <line x1="32" y1={y} x2="375" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                    <text x="4" y={y + 4} fill="#94a3b8" fontSize="9.5" fontWeight="600">
                      {lbl}
                    </text>
                  </g>
                );
              })}

              {/* Barras púrpuras por mes */}
              {monthlyRevenue.map((d, i) => {
                const x = 44 + i * 33;
                const h = (d.val / 20) * 128;
                const y = 148 - h;
                return (
                  <g key={d.month}>
                    <rect
                      x={x}
                      y={y}
                      width="18"
                      height={h}
                      rx="3.5"
                      fill="#8b5cf6"
                      style={{ cursor: "pointer", transition: "fill 0.15s ease" }}
                      onMouseEnter={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setActiveTooltip({ x: r.left, y: r.top, text: `${d.month}: $${d.amount} COP` });
                      }}
                      onMouseLeave={() => setActiveTooltip(null)}
                    />
                    <text x={x + 9} y="168" fill="#64748b" fontSize="9.5" fontWeight="600" textAnchor="middle">
                      {d.month}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Estado de PQR (Donut Chart con Centro) */}
        <div className="ad-reports-card">
          <div className="ad-reports-card-header">
            <h3 className="ad-reports-card-title">Estado de PQR</h3>
          </div>

          <div className="ad-reports-donut-container">
            {/* Donut SVG */}
            {(() => {
              const C = 301.59;
              const arc1 = (pqrStatus.resueltas_pct / 100) * C;
              const arc2 = (pqrStatus.en_proceso_pct / 100) * C;
              const arc3 = (pqrStatus.pendientes_pct / 100) * C;
              const arc4 = (pqrStatus.rechazadas_pct / 100) * C;

              const offset1 = 0;
              const offset2 = -arc1;
              const offset3 = -(arc1 + arc2);
              const offset4 = -(arc1 + arc2 + arc3);

              return (
                <div style={{ width: "140px", height: "140px", position: "relative" }}>
                  <svg viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="70" cy="70" r="48" fill="none" stroke="#f1f5f9" strokeWidth="18" />
                    <circle
                      cx="70"
                      cy="70"
                      r="48"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="18"
                      strokeDasharray={`${arc1} ${C}`}
                      strokeDashoffset={offset1}
                    />
                    <circle
                      cx="70"
                      cy="70"
                      r="48"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="18"
                      strokeDasharray={`${arc2} ${C}`}
                      strokeDashoffset={offset2}
                    />
                    <circle
                      cx="70"
                      cy="70"
                      r="48"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="18"
                      strokeDasharray={`${arc3} ${C}`}
                      strokeDashoffset={offset3}
                    />
                    <circle
                      cx="70"
                      cy="70"
                      r="48"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="18"
                      strokeDasharray={`${arc4} ${C}`}
                      strokeDashoffset={offset4}
                    />
                  </svg>

                  {/* Texto central en el Donut */}
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
                      {reportsData ? pqrStatus.total : "—"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>PQR</div>
                  </div>
                </div>
              );
            })()}

            {/* Leyenda a la derecha */}
            <div className="ad-reports-donut-legend">
              <div className="ad-reports-donut-legend-item">
                <span className="ad-reports-legend-dot" style={{ background: "#10b981" }} />
                <strong>Resueltas</strong>
                <span>{reportsData ? `${pqrStatus.resueltas_pct}%` : "—"}</span>
              </div>
              <div className="ad-reports-donut-legend-item">
                <span className="ad-reports-legend-dot" style={{ background: "#3b82f6" }} />
                <strong>En proceso</strong>
                <span>{reportsData ? `${pqrStatus.en_proceso_pct}%` : "—"}</span>
              </div>
              <div className="ad-reports-donut-legend-item">
                <span className="ad-reports-legend-dot" style={{ background: "#f59e0b" }} />
                <strong>Pendientes</strong>
                <span>{reportsData ? `${pqrStatus.pendientes_pct}%` : "—"}</span>
              </div>
              <div className="ad-reports-donut-legend-item">
                <span className="ad-reports-legend-dot" style={{ background: "#ef4444" }} />
                <strong>Rechazadas</strong>
                <span>{reportsData ? `${pqrStatus.rechazadas_pct}%` : "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          FILA 4: ACTIVIDAD RECIENTE + MAPA DE BOGOTÁ POR LOCALIDAD
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="ad-reports-row-4">
        {/* Tabla: Actividad reciente */}
        <div className="ad-reports-card">
          <div className="ad-reports-card-header">
            <h3 className="ad-reports-card-title">Actividad reciente</h3>
            <button
              type="button"
              className="ad-reports-link"
              style={{ background: "none", border: "none" }}
              onClick={onNavigateToAudit}
            >
              Ver historial completo →
            </button>
          </div>

          <div className="ad-reports-table-wrap">
            <table className="ad-reports-table">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Módulo</th>
                  <th>Descripción</th>
                  <th>Usuario</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((item) => {
                  const badgeClass =
                    item.status === "completado"
                      ? "completado"
                      : item.status === "aprobado"
                      ? "aprobado"
                      : item.status === "resuelto"
                      ? "resuelto"
                      : item.status === "pendiente"
                      ? "pendiente"
                      : "en_proceso";

                  const badgeLabel =
                    item.status === "completado"
                      ? "Completado"
                      : item.status === "aprobado"
                      ? "Aprobado"
                      : item.status === "resuelto"
                      ? "Resuelto"
                      : item.status === "pendiente"
                      ? "Pendiente"
                      : "En proceso";

                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.date}</td>
                      <td style={{ color: "#64748b" }}>{item.module}</td>
                      <td style={{ fontWeight: 600, color: "#1e293b" }}>{item.description}</td>
                      <td>{item.user}</td>
                      <td>
                        <span className={`ad-reports-badge ${badgeClass}`}>{badgeLabel}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ad-reports-dots-btn"
                          title="Detalles"
                          onClick={onNavigateToAudit}
                        >
                          •••
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Distribución de registros por localidad */}
        <div className="ad-reports-card">
          <div className="ad-reports-card-header">
            <h3 className="ad-reports-card-title">Perfiles y hogares por localidad</h3>
          </div>

          <div className="ad-reports-map-container">
            {/* Mapa Vectorial Interactivo SVG de Bogotá */}
            <div className="ad-reports-map-svg-box">
              <svg viewBox="0 0 320 280" className="ad-reports-map-svg">
                {/* SUBA (Noroeste) */}
                <path
                  d="M 60 50 L 150 25 L 195 55 L 175 105 L 110 115 L 75 95 Z"
                  fill={hoveredLocality === "suba" ? "#2563eb" : "#3b82f6"}
                  className="ad-reports-map-path"
                  onMouseEnter={(e) => {
                    setHoveredLocality("suba");
                    const r = e.currentTarget.getBoundingClientRect();
                    const c = getLocalityCount("suba");
                    const txt = `Suba: ${c} registros`;
                    setActiveTooltip({ x: r.left + 50, y: r.top, text: txt });
                  }}
                  onMouseLeave={() => {
                    setHoveredLocality(null);
                    setActiveTooltip(null);
                  }}
                />
                <text x="135" y="75" className="ad-reports-map-text">
                  Suba
                </text>

                {/* USAQUÉN (Noreste) */}
                <path
                  d="M 195 55 L 260 70 L 250 140 L 205 130 L 175 105 Z"
                  fill={hoveredLocality === "usaquen" ? "#93c5fd" : "#bfdbfe"}
                  className="ad-reports-map-path"
                  onMouseEnter={(e) => {
                    setHoveredLocality("usaquen");
                    const r = e.currentTarget.getBoundingClientRect();
                    const c = getLocalityCount("usaquen");
                    const txt = `Usaquén: ${c} registros`;
                    setActiveTooltip({ x: r.left + 30, y: r.top, text: txt });
                  }}
                  onMouseLeave={() => {
                    setHoveredLocality(null);
                    setActiveTooltip(null);
                  }}
                />
                <text x="220" y="105" className="ad-reports-map-text-dark">
                  Usaquén
                </text>

                {/* ENGATIVÁ (Oeste) */}
                <path
                  d="M 60 110 L 120 115 L 140 160 L 85 175 L 45 145 Z"
                  fill={hoveredLocality === "engativa" ? "#3b82f6" : "#60a5fa"}
                  className="ad-reports-map-path"
                  onMouseEnter={(e) => {
                    setHoveredLocality("engativa");
                    const r = e.currentTarget.getBoundingClientRect();
                    const c = getLocalityCount("engativa");
                    const txt = `Engativá: ${c} registros`;
                    setActiveTooltip({ x: r.left + 40, y: r.top, text: txt });
                  }}
                  onMouseLeave={() => {
                    setHoveredLocality(null);
                    setActiveTooltip(null);
                  }}
                />
                <text x="95" y="145" className="ad-reports-map-text">
                  Engativá
                </text>

                {/* CHAPINERO (Centro-Este) */}
                <path
                  d="M 190 125 L 245 135 L 235 185 L 180 180 L 165 145 Z"
                  fill={hoveredLocality === "chapinero" ? "#60a5fa" : "#93c5fd"}
                  className="ad-reports-map-path"
                  onMouseEnter={(e) => {
                    setHoveredLocality("chapinero");
                    const r = e.currentTarget.getBoundingClientRect();
                    const c = getLocalityCount("chapinero");
                    const txt = `Chapinero: ${c} registros`;
                    setActiveTooltip({ x: r.left + 30, y: r.top, text: txt });
                  }}
                  onMouseLeave={() => {
                    setHoveredLocality(null);
                    setActiveTooltip(null);
                  }}
                />
                <text x="210" y="160" className="ad-reports-map-text-dark">
                  Chapinero
                </text>

                {/* TEUSAQUILLO (Centro) */}
                <path
                  d="M 135 150 L 175 145 L 170 195 L 125 190 Z"
                  fill={hoveredLocality === "teusaquillo" ? "#c7d2fe" : "#e0e7ff"}
                  className="ad-reports-map-path"
                  onMouseEnter={(e) => {
                    setHoveredLocality("teusaquillo");
                    const r = e.currentTarget.getBoundingClientRect();
                    const c = getLocalityCount("teusaquillo");
                    const txt = `Teusaquillo: ${c} registros`;
                    setActiveTooltip({ x: r.left + 20, y: r.top, text: txt });
                  }}
                  onMouseLeave={() => {
                    setHoveredLocality(null);
                    setActiveTooltip(null);
                  }}
                />
                <text x="150" y="172" className="ad-reports-map-text-dark" style={{ fontSize: "8.5px" }}>
                  Teusaquillo
                </text>

                {/* SANTA FE (Centro-Oriente) */}
                <path
                  d="M 180 190 L 245 190 L 230 235 L 175 230 Z"
                  fill={hoveredLocality === "santafe" ? "#ddd6fe" : "#ede9fe"}
                  className="ad-reports-map-path"
                  onMouseEnter={(e) => {
                    setHoveredLocality("santafe");
                    const r = e.currentTarget.getBoundingClientRect();
                    const c = getLocalityCount("santafe");
                    const txt = `Santa Fe: ${c} registros`;
                    setActiveTooltip({ x: r.left + 30, y: r.top, text: txt });
                  }}
                  onMouseLeave={() => {
                    setHoveredLocality(null);
                    setActiveTooltip(null);
                  }}
                />
                <text x="208" y="215" className="ad-reports-map-text-dark">
                  Santa Fe
                </text>

                {/* KENNEDY (Suroeste - Más oscuro / mayor volumen) */}
                <path
                  d="M 85 175 L 155 175 L 150 240 L 75 245 L 60 200 Z"
                  fill={hoveredLocality === "kennedy" ? "#1e40af" : "#1d4ed8"}
                  className="ad-reports-map-path"
                  onMouseEnter={(e) => {
                    setHoveredLocality("kennedy");
                    const r = e.currentTarget.getBoundingClientRect();
                    const c = getLocalityCount("kennedy");
                    const txt = `Kennedy: ${c} registros`;
                    setActiveTooltip({ x: r.left + 40, y: r.top, text: txt });
                  }}
                  onMouseLeave={() => {
                    setHoveredLocality(null);
                    setActiveTooltip(null);
                  }}
                />
                <text x="110" y="210" className="ad-reports-map-text" style={{ fontSize: "11px", fontWeight: 800 }}>
                  Kennedy
                </text>

                {/* BOSA (Sur) */}
                <path
                  d="M 40 230 L 85 235 L 80 270 L 30 260 Z"
                  fill={hoveredLocality === "bosa" ? "#93c5fd" : "#c7d2fe"}
                  className="ad-reports-map-path"
                  onMouseEnter={(e) => {
                    setHoveredLocality("bosa");
                    const r = e.currentTarget.getBoundingClientRect();
                    const c = getLocalityCount("bosa");
                    const txt = `Bosa: ${c} registros`;
                    setActiveTooltip({ x: r.left + 25, y: r.top, text: txt });
                  }}
                  onMouseLeave={() => {
                    setHoveredLocality(null);
                    setActiveTooltip(null);
                  }}
                />
                <text x="60" y="252" className="ad-reports-map-text-dark">
                  Bosa
                </text>
              </svg>
            </div>

            {/* Lista y Leyenda a la derecha */}
            <div className="ad-reports-map-legend-list">
              {localities.map((loc) => (
                <div
                  key={loc.id}
                  className="ad-reports-map-legend-item"
                  style={{
                    background: hoveredLocality === loc.id ? "#eff6ff" : "transparent",
                  }}
                  onMouseEnter={() => setHoveredLocality(loc.id)}
                  onMouseLeave={() => setHoveredLocality(null)}
                >
                  <div className="ad-reports-map-legend-left">
                    <span className="ad-reports-map-legend-color" style={{ background: loc.color }} />
                    <span>{loc.name}</span>
                  </div>
                  <span className="ad-reports-map-legend-count">{reportsData ? loc.count : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip Flotante */}
      {activeTooltip && (
        <div
          className="ad-reports-tooltip"
          style={{
            left: `${activeTooltip.x}px`,
            top: `${activeTooltip.y}px`,
            position: "fixed",
          }}
        >
          {activeTooltip.text}
        </div>
      )}
    </div>
  );
};

export default AdminReportsStats;
