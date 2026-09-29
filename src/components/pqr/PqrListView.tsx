import React, { useState } from 'react';
import {
  ShieldAlert,
  Search,
  PlusCircle,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  ShieldCheck,
  ArrowUpRight,
  Smartphone,
  Bot,
  Scale,
  Sparkles,
  MapPin,
  DollarSign,
} from 'lucide-react';
import type {
  PqrReport,
  PqrStatus,
  PqrType,
  AppProblemReport,
  PqrContractorRef,
} from '../../types/serviprox';
import { useAuth } from '../../context/AuthContext';

interface PqrListViewProps {
  pqrReports: PqrReport[];
  appProblemReports?: AppProblemReport[];
  onOpenNewPqrModal: (contractor?: PqrContractorRef) => void;
  onOpenLiveSupportChat: () => void;
  onInspectReport: (report: PqrReport) => void;
}

export function PqrListView({
  pqrReports,
  appProblemReports = [],
  onOpenNewPqrModal,
  onOpenLiveSupportChat,
  onInspectReport,
}: PqrListViewProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pqrs' | 'app_problemas'>('pqrs');
  const [filterType, setFilterType] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Estadísticas rápidas
  const enTramiteCount = pqrReports.filter(
    (r) => r.status === 'en_revision' || r.status === 'conciliacion'
  ).length;
  const resueltosCount = pqrReports.filter((r) => r.status === 'resuelto').length;

  const filteredReports = pqrReports.filter((rep) => {
    if (filterType !== 'todos' && rep.type !== filterType) return false;
    if (filterStatus !== 'todos' && rep.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRadicado = rep.radicadoNumber.toLowerCase().includes(q);
      const matchContractor =
        rep.contractorName.toLowerCase().includes(q) ||
        rep.contractorCompany.toLowerCase().includes(q);
      const matchDesc = rep.description.toLowerCase().includes(q);
      if (!matchRadicado && !matchContractor && !matchDesc) return false;
    }
    return true;
  });

  const getStatusBadge = (status: PqrStatus) => {
    switch (status) {
      case 'radicado':
        return (
          <span className="bg-amber-100/90 text-amber-950 border border-amber-300 text-[11px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            Radicado / En espera
          </span>
        );
      case 'en_revision':
        return (
          <span className="bg-blue-100/90 text-blue-950 border border-blue-300 text-[11px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-blue-600 animate-spin" />
            En Revisión Jurídica
          </span>
        );
      case 'conciliacion':
        return (
          <span className="bg-purple-100/90 text-purple-950 border border-purple-300 text-[11px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
            <AlertTriangle className="w-3.5 h-3.5 text-purple-600" />
            En Mesa de Conciliación
          </span>
        );
      case 'resuelto':
        return (
          <span className="bg-emerald-100/90 text-emerald-950 border border-emerald-300 text-[11px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Resuelto a Satisfacción
          </span>
        );
      case 'sancionado':
        return (
          <span className="bg-rose-100/90 text-rose-950 border border-rose-300 text-[11px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            Contratista Sancionado
          </span>
        );
    }
  };

  const getStatusBorderColor = (status: PqrStatus) => {
    switch (status) {
      case 'radicado':
        return 'border-l-amber-500';
      case 'en_revision':
        return 'border-l-blue-500';
      case 'conciliacion':
        return 'border-l-purple-500';
      case 'resuelto':
        return 'border-l-emerald-500';
      case 'sancionado':
        return 'border-l-rose-500';
    }
  };

  const getTypeLabel = (type: PqrType) => {
    switch (type) {
      case 'queja':
        return 'Queja de Trato / Servicio';
      case 'reclamo':
        return 'Reclamo Técnico de Obra';
      case 'recurso_garantia':
        return 'Recurso de Garantía 6 Meses';
      case 'peticion':
        return 'Petición Formal';
    }
  };

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* ── Banner con Profundidad y Estadísticas Rápidas ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-neutral-950 via-zinc-900 to-rose-950 text-white rounded-3xl p-6 sm:p-7 border border-white/10 shadow-xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-black uppercase px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                Defensoría del Usuario Bogotá
              </span>
              <span className="text-xs text-neutral-400 font-semibold">
                Ley 1480 del Consumidor · Garantía Vinculante
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              PQRS, Reclamos &amp; Respuestas Oficiales
            </h2>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-2xl leading-relaxed">
              Expedientes auditados contra contratistas registrados en Bogotá. Respuestas en tiempo real con mediación pericial respaldada.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-shrink-0">
            {/* Botón Chat en Vivo */}
            <button
              id="btn-open-live-report-chat"
              type="button"
              onClick={onOpenLiveSupportChat}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black text-xs sm:text-sm py-3.5 px-5 rounded-2xl shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/30 hover:scale-[1.02]"
            >
              <Bot className="w-4 h-4" />
              <span>💬 Chat de Reporte en Vivo</span>
            </button>

            {/* Botón Radicar Formal */}
            <button
              id="btn-open-new-pqr-view"
              type="button"
              onClick={() => onOpenNewPqrModal()}
              className="bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 active:scale-95 text-white font-black text-xs sm:text-sm py-3.5 px-5 rounded-2xl shadow-lg shadow-rose-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer border border-rose-400/30 hover:scale-[1.02]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Radicar Queja Formal</span>
            </button>
          </div>
        </div>

        {/* Ribbon de Métricas Rápidas */}
        <div className="relative z-10 mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 uppercase font-black block">Total Radicados</span>
              <strong className="text-base font-black text-white">{pqrReports.length}</strong>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Scale className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 uppercase font-black block">En Mediación</span>
              <strong className="text-base font-black text-white">{enTramiteCount}</strong>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 uppercase font-black block">Resueltos</span>
              <strong className="text-base font-black text-white">{resueltosCount}</strong>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 uppercase font-black block">Problemas App</span>
              <strong className="text-base font-black text-white">{appProblemReports.length}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub-Tabs Modernos con Sombra y Badge ── */}
      <div className="flex items-center gap-3 bg-neutral-100/90 p-1.5 rounded-2xl border border-neutral-200/80 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('pqrs')}
          className={`px-4 py-2 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'pqrs'
              ? 'bg-white text-neutral-900 shadow-md scale-[1.02]'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-600" />
          <span>Quejas y Recursos de Contratistas</span>
          <span className="bg-rose-100 text-rose-700 text-[11px] font-black px-2 py-0.5 rounded-full">
            {pqrReports.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('app_problemas')}
          className={`px-4 py-2 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'app_problemas'
              ? 'bg-white text-neutral-900 shadow-md scale-[1.02]'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <Smartphone className="w-4 h-4 text-blue-600" />
          <span>Problemas con la App</span>
          <span className="bg-blue-100 text-blue-700 text-[11px] font-black px-2 py-0.5 rounded-full">
            {appProblemReports.length}
          </span>
        </button>
      </div>

      {/* ── Pestaña PQRS ── */}
      {activeTab === 'pqrs' && (
        <>
          {/* Barra de Búsqueda y Filtros con Estilo Moderno */}
          <div className="bg-white rounded-3xl p-4 border border-neutral-200/90 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por radicado (PQR-BOG-...), contratista o motivo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 text-xs sm:text-sm bg-neutral-50 border border-neutral-300 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:bg-white focus:outline-none transition-all"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-xs bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2.5 font-bold text-neutral-700 focus:outline-none cursor-pointer"
              >
                <option value="todos">Todos los Tipos</option>
                <option value="queja">Solo Quejas</option>
                <option value="reclamo">Solo Reclamos de Obra</option>
                <option value="recurso_garantia">Recursos de Garantía</option>
                <option value="peticion">Peticiones</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2.5 font-bold text-neutral-700 focus:outline-none cursor-pointer"
              >
                <option value="todos">Todos los Estados</option>
                <option value="radicado">Radicado</option>
                <option value="en_revision">En Revisión</option>
                <option value="conciliacion">En Conciliación</option>
                <option value="resuelto">Resuelto</option>
                <option value="sancionado">Sancionado</option>
              </select>
            </div>
          </div>

          {/* Lista de Tarjetas de Reclamos con Elevación y Borde de Estado */}
          <div className="space-y-4">
            {filteredReports.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-neutral-200 shadow-sm space-y-3">
                <div className="w-14 h-14 bg-neutral-100 text-neutral-500 rounded-2xl flex items-center justify-center mx-auto">
                  <FileText className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black text-neutral-800">
                  No se encontraron reclamos con los filtros seleccionados
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Puedes radicar una queja oficial directamente con el formulario o mediante el chat de asistencia en vivo.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onOpenLiveSupportChat}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Bot className="w-4 h-4" />
                    <span>Reportar por Chat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenNewPqrModal()}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    Formulario Formal
                  </button>
                </div>
              </div>
            ) : (
              filteredReports.map((rep) => (
                <div
                  key={rep.id}
                  className={`bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/90 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 space-y-4 border-l-6 ${getStatusBorderColor(
                    rep.status
                  )}`}
                >
                  {/* Fila 1: Radicado, Tipo y Badge de Estado */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-black text-xs sm:text-sm bg-neutral-900 text-white px-3 py-1 rounded-xl shadow-xs">
                        {rep.radicadoNumber}
                      </span>
                      <span className="text-xs font-black text-neutral-700 uppercase tracking-wide">
                        {getTypeLabel(rep.type)}
                      </span>
                    </div>
                    <div>{getStatusBadge(rep.status)}</div>
                  </div>

                  {/* Fila 2: Contratista Involucrado y Metadatos */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <img
                        src={
                          rep.contractorAvatar ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(rep.contractorName)}&background=0284c7&color=fff&bold=true&rounded=true`
                        }
                        alt={rep.contractorName}
                        className="w-13 h-13 rounded-2xl object-cover border-2 border-white shadow-md flex-shrink-0"
                      />
                      <div>
                        <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest block">
                          Contratista Involucrado (BD Oficial)
                        </span>
                        <h4 className="text-sm sm:text-base font-black text-neutral-900 leading-tight">
                          {rep.contractorCompany}
                        </h4>
                        <p className="text-xs text-neutral-600 font-medium mt-0.5">
                          Maestro: <strong className="text-neutral-900">{rep.contractorName}</strong>
                          {rep.contractorSpecialty ? ` • ${rep.contractorSpecialty}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right text-xs text-neutral-500 space-y-1">
                      <div>
                        Fecha del hecho: <strong className="text-neutral-900">{rep.incidentDate}</strong>
                      </div>
                      {rep.amountDisputed != null && (
                        <div className="text-rose-700 font-black text-xs bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-lg inline-block">
                          Monto reclamado: ${rep.amountDisputed.toLocaleString('es-CO')} COP
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fila Ciudadano Titular Registrado en Base de Datos (Solo datos reales) */}
                  {(() => {
                    const clientName = rep.clientName;
                    const clientDoc = rep.clientDocumentId;
                    const clientAddress = rep.clientAddress;
                    const clientPhone = rep.clientPhone;

                    if (!clientName && !clientDoc) return null;

                    return (
                      <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center font-black text-[10px]">
                            CC
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-neutral-500 text-[11px] font-semibold">Ciudadano Afectado:</span>
                            <strong className="text-neutral-900 font-black">{clientName}</strong>
                            {clientDoc && (
                              <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-neutral-300 text-neutral-700 font-bold">
                                {clientDoc}
                              </span>
                            )}
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                              ✓ BD Conectada
                            </span>
                          </div>
                        </div>
                        {(clientAddress || clientPhone) && (
                          <div className="text-[11px] text-neutral-500 flex items-center gap-2 flex-wrap">
                            {clientAddress && <span>📍 {clientAddress}</span>}
                            {clientAddress && clientPhone && <span className="text-neutral-300">•</span>}
                            {clientPhone && <span>📞 {clientPhone}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Fila 3: Descripción de Hechos y Solución */}
                  <div className="bg-gradient-to-r from-neutral-50 via-white to-neutral-50 p-4 rounded-2xl border border-neutral-200/80 text-xs text-neutral-800 space-y-2">
                    <div>
                      <strong className="text-rose-950 font-black uppercase tracking-wider block text-[11px] mb-1">
                        Motivo: {rep.reason.replace(/_/g, ' ').toUpperCase()}
                      </strong>
                      <p className="leading-relaxed text-neutral-700">{rep.description}</p>
                    </div>

                    <div className="pt-2 border-t border-neutral-200 flex flex-wrap items-center justify-between text-[11px] text-neutral-600 gap-2">
                      <span>
                        <strong>Solución solicitada:</strong> {rep.desiredResolution}
                      </span>
                      {rep.evidenceFiles && rep.evidenceFiles.length > 0 && (
                        <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                          📎 {rep.evidenceFiles.length} archivo(s) de evidencia
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Fila 4: Footer Interactivo con Respuestas y Botón de Apertura */}
                  <div className="bg-gradient-to-r from-rose-50/60 via-amber-50/30 to-rose-50/60 p-3.5 rounded-2xl border border-rose-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-rose-600/10 flex items-center justify-center text-rose-600">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div className="text-xs">
                        <strong className="text-neutral-900 font-black block">
                          Respuestas Oficiales en la App: {rep.messages?.length ?? 0}
                        </strong>
                        <span className="text-neutral-500 text-[11px]">
                          {rep.adminResolutionNotes
                            ? 'Cuenta con dictamen pericial vinculante'
                            : 'En proceso de trámite y descargos'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onInspectReport(rep)}
                      className="bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer ml-auto"
                    >
                      <span>Ver Respuestas &amp; Expediente</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ── Pestaña Problemas con la App ── */}
      {activeTab === 'app_problemas' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-neutral-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-neutral-900 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <span>Tickets de Problemas Técnicos con la App</span>
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Reportes sobre fallas del mapa de Bogotá, errores de geolocalización, pasarela de pago o problemas de conexión.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenLiveSupportChat}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0 shadow-md"
            >
              <Bot className="w-4 h-4" />
              <span>Reportar Fallo por Chat</span>
            </button>
          </div>

          {appProblemReports.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-neutral-200 space-y-3">
              <Smartphone className="w-8 h-8 text-neutral-400 mx-auto" />
              <h4 className="text-sm font-bold text-neutral-800">
                No tienes reportes de problemas técnicos activos
              </h4>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                Si experimentas lentitud, fallas en el mapa o error al pagar, abre el chat en vivo.
              </p>
            </div>
          ) : (
            appProblemReports.map((prob) => (
              <div
                key={prob.id}
                className="bg-white rounded-3xl p-5 border border-neutral-200/90 shadow-sm space-y-3 border-l-6 border-l-blue-500"
              >
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-black text-xs bg-neutral-900 text-white px-2.5 py-1 rounded-lg">
                      {prob.ticketNumber}
                    </span>
                    <span className="text-xs font-black text-neutral-800">
                      {prob.categoryLabel}
                    </span>
                  </div>
                  <span className="bg-blue-100 text-blue-900 text-[10px] font-black px-2.5 py-1 rounded-full">
                    {prob.status === 'recibido'
                      ? 'En Análisis Técnico'
                      : prob.status === 'en_proceso'
                      ? 'En Corrección'
                      : 'Corregido en Producción'}
                  </span>
                </div>
                <p className="text-xs text-neutral-700 bg-neutral-50 p-3.5 rounded-2xl border border-neutral-100 leading-relaxed">
                  {prob.description}
                </p>
                {prob.responseNotes && (
                  <div className="bg-emerald-50 text-emerald-950 text-xs p-3 rounded-2xl border border-emerald-200 leading-relaxed font-medium">
                    <strong className="text-emerald-900 block font-black mb-0.5">Respuesta de Ingeniería:</strong> {prob.responseNotes}
                  </div>
                )}
                <div className="text-[10px] text-neutral-400 flex items-center justify-between pt-1">
                  <span>Dispositivo: {prob.deviceInfo}</span>
                  <span>{new Date(prob.createdAt).toLocaleString('es-CO')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
