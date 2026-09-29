import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  User,
  MapPin,
  Phone,
  Mail,
} from 'lucide-react';
import type { PqrReport, PqrStatus } from '../../types/serviprox';
import { getCitizenAvatar } from '../../data/pqrInitialData';
import './pqrStyles.css';


interface PqrDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: PqrReport | null;
  onSendMessage: (pqrId: string, text: string) => void;
}

export function PqrDetailModal({
  isOpen,
  onClose,
  report,
  onSendMessage,
}: PqrDetailModalProps) {
  const [replyText, setReplyText] = useState('');

  if (!isOpen || !report) return null;

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    onSendMessage(report.id, replyText.trim());
    setReplyText('');
  };

  const getStatusBadge = (status: PqrStatus) => {
    switch (status) {
      case 'radicado':
        return (
          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Radicado / En espera
          </span>
        );
      case 'en_revision':
        return (
          <span className="bg-blue-100 text-blue-900 border border-blue-300 text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-600 animate-spin" />
            En Revisión Técnica
          </span>
        );
      case 'conciliacion':
        return (
          <span className="bg-purple-100 text-purple-900 border border-purple-300 text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-purple-600" />
            En Mesa de Conciliación
          </span>
        );
      case 'resuelto':
        return (
          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Resuelto a Satisfacción
          </span>
        );
      case 'sancionado':
        return (
          <span className="bg-rose-100 text-rose-900 border border-rose-300 text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            Contratista Sancionado
          </span>
        );
    }
  };

  const steps = [
    { title: 'Radicación', done: true },
    { title: 'Revisión Técnica', done: report.status !== 'radicado' },
    {
      title: 'Descargos / Conciliación',
      done:
        report.status === 'conciliacion' ||
        report.status === 'resuelto' ||
        report.status === 'sancionado',
    },
    {
      title: 'Dictamen Final',
      done: report.status === 'resuelto' || report.status === 'sancionado',
    },
  ];

  return createPortal(
    <div
      id="pqr-detail-modal-backdrop"
      style={{ zIndex: 9999999 }}
      className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto font-['Plus_Jakarta_Sans',sans-serif]"
    >

      <div
        id="pqr-detail-modal-dialog"
        className="bg-white rounded-3xl shadow-2xl border border-neutral-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 my-auto max-h-[92vh] flex flex-col text-neutral-900"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-rose-950 text-white p-4 sm:p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-black text-sm bg-rose-600 text-white px-2.5 py-0.5 rounded-lg tracking-wider">
                  {report.radicadoNumber}
                </span>
                <span className="text-xs text-neutral-300 font-bold uppercase tracking-wide">
                  {report.type.replace('_', ' ')}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-1">
                Expediente y Respuestas de la Queja
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Tracker */}
        <div className="bg-neutral-100 px-4 sm:px-6 py-3 border-b border-neutral-200">
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
            {steps.map((st, idx) => (
              <div key={idx} className="flex items-center gap-2 flex-shrink-0">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    st.done
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-300 text-neutral-600'
                  }`}
                >
                  {st.done ? '✓' : idx + 1}
                </div>
                <span
                  className={`text-xs font-bold ${
                    st.done ? 'text-neutral-900' : 'text-neutral-500'
                  }`}
                >
                  {st.title}
                </span>
                {idx < steps.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-400 mx-1" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Contractor */}
            <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200 flex items-center gap-3">
              <img
                src={
                  report.contractorAvatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(report.contractorName)}&background=0284c7&color=fff&bold=true&rounded=true`
                }
                alt={report.contractorName}
                className="w-12 h-12 rounded-xl object-cover border border-neutral-300 flex-shrink-0"
              />
              <div className="min-w-0">
                <span className="text-[10px] font-black text-rose-600 uppercase tracking-wide">
                  Contratista Requerido
                </span>
                <h4 className="text-sm font-extrabold text-neutral-900 truncate">
                  {report.contractorCompany}
                </h4>
                <p className="text-xs text-neutral-600 font-medium">
                  {report.contractorName}
                  {report.contractorSpecialty
                    ? ` • ${report.contractorSpecialty}`
                    : ''}
                </p>
              </div>
            </div>

            {/* Status card */}
            <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wide">
                  Estado Actual
                </span>
                <div>{getStatusBadge(report.status)}</div>
              </div>
              <div className="text-xs text-neutral-600 mt-2">
                <p>
                  <strong>Fecha Hechos:</strong> {report.incidentDate}
                </p>
                {report.amountDisputed != null && (
                  <p className="text-rose-700 font-bold">
                    Monto Reclamado: ${report.amountDisputed.toLocaleString('es-CO')} COP
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Citizen / Claimant Card Registrado en Base de Datos */}
          <div className="bg-gradient-to-r from-neutral-900 via-neutral-950 to-rose-950 text-white p-4 rounded-2xl border border-neutral-800 shadow-md">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2.5">
              <div className="flex items-center gap-2">
                <img
                  src={getCitizenAvatar(report.clientName)}
                  alt={report.clientName || 'Ciudadano'}
                  className="w-6 h-6 rounded-full object-cover border border-rose-400"
                />
                <span className="text-[11px] font-black uppercase tracking-wider text-neutral-200">
                  Ciudadano Afectado (Registrado en Base de Datos)
                </span>
              </div>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                ✓ Verificado en BD
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-neutral-400 block font-semibold">Titular del Reclamo:</span>
                <strong className="text-white font-bold">{report.clientName || 'Ciudadano Registrado'}</strong>
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 block font-semibold">Cédula / Documento:</span>
                <span className="font-mono text-rose-300 font-bold bg-white/10 px-2 py-0.5 rounded border border-white/10 text-[11px] inline-block">
                  {report.clientDocumentId || 'No registrado en BD'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 block font-semibold">Teléfono Móvil:</span>
                <span className="text-neutral-200 font-medium flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3 text-rose-400 inline" />
                  {report.clientPhone || 'No registrado'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 block font-semibold">Correo Electrónico:</span>
                <span className="text-neutral-200 font-medium flex items-center gap-1 mt-0.5">
                  <Mail className="w-3 h-3 text-rose-400 inline" />
                  {report.clientEmail || 'No registrado'}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] text-neutral-400 block font-semibold">Dirección del Inmueble / Obra (Bogotá):</span>
                <span className="text-neutral-200 font-medium flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-rose-400 inline" />
                  {report.clientAddress || 'No registrada'}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 space-y-2 text-xs text-neutral-800">
            <strong className="block text-rose-950 font-bold uppercase tracking-wide text-[11px]">
              Motivo: {report.reason.replace(/_/g, ' ').toUpperCase()}
            </strong>
            <p className="leading-relaxed">{report.description}</p>
            <div className="pt-2 border-t border-rose-100 flex flex-wrap items-center justify-between gap-2 text-neutral-600">
              <span>
                <strong>Solución solicitada:</strong> {report.desiredResolution}
              </span>
              <span className="text-neutral-500 font-mono text-[10px]">
                Radicado el{' '}
                {new Date(report.createdAt).toLocaleDateString('es-CO')}
              </span>
            </div>
          </div>

          {/* Message Thread */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-neutral-900 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-rose-600" />
                <span>
                  Respuestas en la App y Registro de Mediación (
                  {report.messages?.length ?? 0})
                </span>
              </h3>
              <span className="text-[10px] text-neutral-500 font-bold">
                Actualizado en tiempo real
              </span>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {!report.messages || report.messages.length === 0 ? (
                <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 text-center text-xs text-neutral-500">
                  <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                  El caso se encuentra en revisión formal. La respuesta oficial
                  del contratista y del perito aparecerá aquí en un plazo de
                  hasta 48 h.
                </div>
              ) : (
                report.messages.map((msg) => {
                  const isAgent = msg.sender === 'support_agent';
                  const isContractor = msg.sender === 'contractor';
                  const isClient = msg.sender === 'client';

                  return (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-2xl text-xs space-y-1 ${
                        isAgent
                          ? 'bg-blue-50/90 border border-blue-200 text-blue-950 ml-0 sm:mr-8'
                          : isContractor
                          ? 'bg-amber-50/90 border border-amber-200 text-amber-950 ml-0 sm:mr-8'
                          : isClient
                          ? 'bg-emerald-50/90 border border-emerald-200 text-emerald-950 mr-0 sm:ml-8'
                          : 'bg-neutral-100 border border-neutral-200 text-neutral-700 text-center text-[11px]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-black/5 pb-1">
                        <div className="flex items-center gap-1.5">
                          <strong className="font-extrabold">
                            {msg.senderName}
                          </strong>
                          {msg.senderRole && (
                            <span className="text-[10px] bg-black/10 px-1.5 py-0.5 rounded-md font-semibold">
                              {msg.senderRole}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] opacity-70">
                          {new Date(msg.timestamp).toLocaleString('es-CO', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="leading-relaxed pt-0.5">{msg.text}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply form */}
            <form onSubmit={handleSendReply} className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Escribir réplica o respuesta al contratista / perito en la app..."
                className="flex-1 px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs sm:text-sm text-neutral-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
              <button
                type="submit"
                className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar</span>
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-neutral-50 p-4 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-600">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              Garantía de mediación vinculante respaldada por Servicio
              Contratista Bogotá
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-neutral-900 text-white font-bold px-4 py-2 rounded-xl text-xs hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Cerrar Expediente
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


