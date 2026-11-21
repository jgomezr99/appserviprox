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
  ArrowUpRight,
  Smartphone,
  Bot,
  Scale,
  Package,
  Wrench,
} from 'lucide-react';
import type {
  PqrReport,
  PqrStatus,
  PqrType,
  PqrSubjectType,
  AppProblemReport,
  PqrContractorRef,
  SupportChat,
} from '../../types/serviprox';

interface PqrListViewProps {
  pqrReports: PqrReport[];
  appProblemReports?: AppProblemReport[];
  supportChats?: SupportChat[];
  onOpenNewPqrModal: (contractor?: PqrContractorRef, subjectType?: PqrSubjectType) => void;
  onOpenLiveSupportChat: () => void;
  onOpenCreateChat?: () => void;
  onInspectReport: (report: PqrReport) => void;
  onInspectChat?: (chat: SupportChat) => void;
}

const isProductPqr = (rep: PqrReport): boolean =>
  rep.subjectType === 'producto' ||
  Boolean(rep.productId) ||
  Boolean(rep.productName) ||
  (rep.relatedTo || '').toLowerCase().startsWith('producto #') ||
  (rep.radicadoNumber || '').toUpperCase().startsWith('PQR-PROD-');

export function PqrListView({
  pqrReports,
  appProblemReports = [],
  supportChats = [],
  onOpenNewPqrModal,
  onOpenLiveSupportChat,
  onOpenCreateChat,
  onInspectReport,
  onInspectChat,
}: PqrListViewProps) {
  const [activeTab, setActiveTab] = useState<'servicios' | 'productos' | 'app_problemas' | 'chats'>('servicios');
  const [filterType, setFilterType] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  const servicePqrs = pqrReports.filter((r) => !isProductPqr(r));
  const productPqrs = pqrReports.filter((r) => isProductPqr(r));

  // Estadísticas rápidas
  const enTramiteCount = pqrReports.filter(
    (r) => r.status === 'en_revision' || r.status === 'conciliacion'
  ).length;
  const activeScopedReports = activeTab === 'productos' ? productPqrs : servicePqrs;

  const filteredReports = activeScopedReports.filter((rep) => {
    if (filterType !== 'todos' && rep.type !== filterType) return false;
    if (filterStatus !== 'todos' && rep.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRadicado = rep.radicadoNumber.toLowerCase().includes(q);
      const matchTarget =
        rep.contractorName.toLowerCase().includes(q) ||
        rep.contractorCompany.toLowerCase().includes(q) ||
        (rep.productName || '').toLowerCase().includes(q) ||
        (rep.relatedTo || '').toLowerCase().includes(q);
      const matchDesc = rep.description.toLowerCase().includes(q);
      if (!matchRadicado && !matchTarget && !matchDesc) return false;
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

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-shrink-0 flex-wrap">
            {/* Botón Radicar PQR Servicio */}
            <button
              id="btn-open-new-pqr-view"
              type="button"
              onClick={() => onOpenNewPqrModal(undefined, 'servicio')}
              className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-95 text-white font-black text-xs sm:text-sm py-3 px-4 rounded-2xl shadow-lg shadow-rose-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer border border-rose-400/30 hover:scale-[1.02]"
            >
              <Wrench className="w-4 h-4" />
              <span>PQR de Servicio</span>
            </button>

            {/* Botón Radicar PQR Producto */}
            <button
              id="btn-open-new-product-pqr-view"
              type="button"
              onClick={() => onOpenNewPqrModal(undefined, 'producto')}
              className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 active:scale-95 text-white font-black text-xs sm:text-sm py-3 px-4 rounded-2xl shadow-lg shadow-amber-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-400/30 hover:scale-[1.02]"
            >
              <Package className="w-4 h-4" />
              <span>PQR de Producto</span>
            </button>

            {/* Botón Crear Chat */}
            <button
              id="btn-create-direct-chat"
              type="button"
              onClick={onOpenCreateChat || onOpenLiveSupportChat}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-95 text-white font-black text-xs sm:text-sm py-3 px-4 rounded-2xl shadow-lg shadow-indigo-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer border border-indigo-400/30 hover:scale-[1.02]"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Crear chat</span>
            </button>

            {/* Botón Chat en Vivo */}
            <button
              id="btn-open-live-report-chat"
              type="button"
              onClick={onOpenLiveSupportChat}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black text-xs sm:text-sm py-3 px-4 rounded-2xl shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/30 hover:scale-[1.02]"
            >
              <Bot className="w-4 h-4" />
              <span>Chat Soporte</span>
            </button>
          </div>
        </div>

        {/* Ribbon de Métricas Rápidas */}
        <div className="relative z-10 mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center flex-shrink-0">
              <Wrench className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 uppercase font-black block">PQR Servicios</span>
              <strong className="text-base font-black text-white">{servicePqrs.length}</strong>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 uppercase font-black block">PQR Productos</span>
              <strong className="text-base font-black text-white">{productPqrs.length}</strong>
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
              <Smartphone className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 uppercase font-black block">Problemas App</span>
              <strong className="text-base font-black text-white">{appProblemReports.length}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub-Tabs Separados: PQR Servicios | PQR Productos | Problemas App ── */}
      <div className="flex items-center gap-2 bg-neutral-100/90 p-1.5 rounded-2xl border border-neutral-200/80 w-fit flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab('servicios')}
          className={`px-4 py-2 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'servicios'
              ? 'bg-white text-neutral-900 shadow-md scale-[1.02]'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <Wrench className="w-4 h-4 text-rose-600" />
          <span>PQR de Servicios</span>
          <span className="bg-rose-100 text-rose-700 text-[11px] font-black px-2 py-0.5 rounded-full">
            {servicePqrs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('productos')}
          className={`px-4 py-2 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'productos'
              ? 'bg-white text-neutral-900 shadow-md scale-[1.02]'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <Package className="w-4 h-4 text-amber-600" />
          <span>PQR de Productos</span>
          <span className="bg-amber-100 text-amber-800 text-[11px] font-black px-2 py-0.5 rounded-full">
            {productPqrs.length}
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

        <button
          id="tab-mis-chats"
          type="button"
          onClick={() => setActiveTab('chats')}
          className={`px-4 py-2 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'chats'
              ? 'bg-white text-neutral-900 shadow-md scale-[1.02]'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-indigo-600" />
          <span>Mis Chats</span>
          <span className="bg-indigo-100 text-indigo-700 text-[11px] font-black px-2 py-0.5 rounded-full">
            {supportChats.length}
          </span>
        </button>
      </div>

      {/* ── Pestañas PQRS (Servicios o Productos Separados) ── */}
      {(activeTab === 'servicios' || activeTab === 'productos') && (
        <>
          {/* Barra de Búsqueda y Filtros con Estilo Moderno */}
          <div className="bg-white rounded-3xl p-4 border border-neutral-200/90 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  activeTab === 'productos'
                    ? 'Buscar por radicado (PQR-PROD-...), producto, vendedor o motivo...'
                    : 'Buscar por radicado (PQR-SERV-...), contratista o motivo...'
                }
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
                <option value="reclamo">{activeTab === 'productos' ? 'Reclamos de Producto' : 'Solo Reclamos de Obra'}</option>
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
                  {activeTab === 'productos' ? <Package className="w-7 h-7 text-amber-600" /> : <FileText className="w-7 h-7" />}
                </div>
                <h3 className="text-base font-black text-neutral-800">
                  {activeTab === 'productos'
                    ? 'No tienes PQR ni reportes de productos registrados'
                    : 'No se encontraron reclamos de servicios con los filtros seleccionados'}
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  {activeTab === 'productos'
                    ? 'Si compraste o viste un producto con problemas en Meko Shop, radica un PQR de Producto y el administrador lo recibirá de inmediato.'
                    : 'Puedes radicar una queja oficial sobre un servicio directamente con el formulario o mediante el chat de asistencia en vivo.'}
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
                    onClick={() => onOpenNewPqrModal(undefined, activeTab === 'productos' ? 'producto' : 'servicio')}
                    className={`${activeTab === 'productos' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'} text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5`}
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{activeTab === 'productos' ? 'Registrar PQR de Producto' : 'Registrar PQR de Servicio'}</span>
                  </button>
                </div>
              </div>
            ) : (
              filteredReports.map((rep) => {
                const isProd = isProductPqr(rep);
                const displayEntityTitle = isProd
                  ? rep.productName || rep.relatedTo || rep.contractorCompany || 'Producto Meko Shop'
                  : rep.contractorCompany || rep.relatedTo || 'Servicio Serviprox';

                return (
                <div
                  key={rep.id}
                  className={`bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/90 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 space-y-4 border-l-6 ${getStatusBorderColor(
                    rep.status
                  )}`}
                >
                  {/* Fila 1: Radicado, Categoría (Servicio/Producto), Tipo y Badge de Estado */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono font-black text-xs sm:text-sm bg-neutral-900 text-white px-3 py-1 rounded-xl shadow-xs">
                        {rep.radicadoNumber}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                          isProd
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}
                      >
                        {isProd ? '📦 Producto' : '🔧 Servicio'}
                      </span>
                      <span className="text-xs font-black text-neutral-700 uppercase tracking-wide">
                        {getTypeLabel(rep.type)}
                      </span>
                    </div>
                    <div>{getStatusBadge(rep.status)}</div>
                  </div>

                  {/* Fila 2: Contratista o Producto Involucrado y Metadatos */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <img
                        src={
                          rep.contractorAvatar ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(isProd ? displayEntityTitle : rep.contractorName || 'Serviprox')}&background=${isProd ? 'd97706' : '0284c7'}&color=fff&bold=true&rounded=true`
                        }
                        alt={isProd ? displayEntityTitle : rep.contractorName}
                        className="w-13 h-13 rounded-2xl object-cover border-2 border-white shadow-md flex-shrink-0"
                      />
                      <div>
                        <span className={`text-[10px] font-black uppercase tracking-widest block ${isProd ? 'text-amber-700' : 'text-rose-600'}`}>
                          {isProd ? 'Producto Reportado (Meko Shop)' : 'Contratista Involucrado (BD Oficial)'}
                        </span>
                        <h4 className="text-sm sm:text-base font-black text-neutral-900 leading-tight">
                          {displayEntityTitle}
                        </h4>
                        <p className="text-xs text-neutral-600 font-medium mt-0.5">
                          {isProd ? 'Vendedor:' : 'Maestro:'}{' '}
                          <strong className="text-neutral-900">{rep.contractorName || 'Serviprox'}</strong>
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
                );
              })
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

      {/* ── Pestaña Mis Chats (Chats de Reportes y Soporte Guardados en BD) ── */}
      {activeTab === 'chats' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-neutral-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-neutral-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                <span>Chats Registrados (Reportes y Soporte Directo)</span>
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Cada reporte que radicas crea automáticamente su chat asociado, y también puedes crear nuevos chats directos con soporte.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenCreateChat || onOpenLiveSupportChat}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0 shadow-md"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Crear nuevo chat</span>
            </button>
          </div>

          {supportChats.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-neutral-200 space-y-3">
              <MessageSquare className="w-8 h-8 text-indigo-400 mx-auto" />
              <h4 className="text-sm font-bold text-neutral-800">
                Aún no tienes chats guardados
              </h4>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                Cuando radiques un reporte (Servicio, Producto o App) o presiones &ldquo;Crear chat&rdquo;, aparecerá aquí con todo su historial.
              </p>
              <button
                type="button"
                onClick={onOpenCreateChat || onOpenLiveSupportChat}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Crear mi primer chat</span>
              </button>
            </div>
          ) : (
            supportChats.map((chat) => {
              const lastMsg = chat.messages?.[chat.messages.length - 1];
              const topicColors: Record<SupportChat['topic'], string> = {
                pqr_servicio: 'bg-rose-50 text-rose-800 border-rose-200',
                pqr_producto: 'bg-amber-50 text-amber-800 border-amber-200',
                problema_app: 'bg-blue-50 text-blue-800 border-blue-200',
                cuenta: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                soporte: 'bg-indigo-50 text-indigo-800 border-indigo-200',
              };
              const topicLabels: Record<SupportChat['topic'], string> = {
                pqr_servicio: '🔧 Chat de Reporte Servicio',
                pqr_producto: '📦 Chat de Reporte Producto',
                problema_app: '📱 Chat Problema App',
                cuenta: '👤 Chat de Cuenta',
                soporte: '💬 Chat Directo',
              };

              return (
                <div
                  key={chat.id}
                  className="bg-white rounded-3xl p-5 border border-neutral-200/90 shadow-sm hover:shadow-md transition-all space-y-3 border-l-6 border-l-indigo-500"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                          topicColors[chat.topic] || topicColors.soporte
                        }`}
                      >
                        {topicLabels[chat.topic] || '💬 Chat'}
                      </span>
                      {chat.relatedRadicado && (
                        <span className="font-mono font-black text-[11px] bg-neutral-900 text-white px-2.5 py-1 rounded-lg">
                          {chat.relatedRadicado}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-neutral-500 font-semibold">
                      {chat.messagesCount || chat.messages?.length || 0} mensaje(s) ·{' '}
                      {new Date(chat.updatedAt || chat.createdAt).toLocaleString('es-CO', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-sm sm:text-base font-black text-neutral-900 truncate">
                        {chat.title}
                      </h4>
                      <p className="text-xs text-neutral-600 mt-1 line-clamp-2">
                        {lastMsg
                          ? `${lastMsg.senderName}: ${lastMsg.text}`
                          : chat.lastMessage || 'Chat listo para conversar.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onInspectChat?.(chat)}
                      className="bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                    >
                      <MessageSquare className="w-4 h-4 text-emerald-400" />
                      <span>Abrir chat</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
