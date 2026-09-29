/**
 * GlobalChatButton
 *
 * Botón flotante fijo "Chat de Reporte en Vivo / Quejas & Problemas App"
 * con el diseño exacto de la captura del usuario.
 *
 * Visible en todas las vistas de cliente autenticado.
 * Conectado a la base de datos oficial de contratistas registrados de Bogotá.
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LiveSupportChatModal } from './pqr/LiveSupportChatModal';
import type { AppProblemReport, PqrReport } from '../types/serviprox';
import {
  REGISTERED_CONTRACTORS_REF,
  getStoredPqrReports,
  saveStoredPqrReports,
  getStoredAppProblems,
  saveStoredAppProblems,
} from '../data/pqrInitialData';

const HIDDEN_PATHS = ['/login', '/ingresar', '/register'];

export const GlobalChatButton: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => {
      setChatOpen(true);
    };
    window.addEventListener('serviprox:open-live-chat', handleOpen);
    return () => {
      window.removeEventListener('serviprox:open-live-chat', handleOpen);
    };
  }, []);

  const isHidden =
    HIDDEN_PATHS.some((p) => location.pathname.startsWith(p)) ||
    location.pathname.startsWith('/onboarding') ||
    (user && user.role !== 'client');

  if (isHidden) return null;

  const handlePqrCreated = (
    data: Omit<PqrReport, 'id' | 'radicadoNumber' | 'status' | 'createdAt' | 'estimatedResponseDays'>
  ) => {
    const radicado = `PQR-BOG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newReport: PqrReport = {
      ...data,
      id: `pqr-${Date.now()}`,
      radicadoNumber: radicado,
      status: 'radicado',
      createdAt: new Date().toISOString(),
      estimatedResponseDays: 2,
      messages: [
        {
          id: `msg-${Date.now()}`,
          sender: 'system',
          senderName: 'Servicio Contratista Bogotá',
          senderRole: 'Defensoría',
          text: `Radicado oficial ${radicado} registrado. Notificado al contratista ${data.contractorCompany}.`,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const current = getStoredPqrReports();
    saveStoredPqrReports([newReport, ...current]);
  };

  const handleAppProblem = (problem: AppProblemReport) => {
    const current = getStoredAppProblems();
    saveStoredAppProblems([problem, ...current]);
  };

  return (
    <>
      {/* ── Botón Flotante Fijo ── */}
      <button
        id="global-chat-btn"
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setChatOpen(true);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          setChatOpen(true);
        }}
        aria-label="Abrir Chat de Reporte en Vivo"
        style={{
          position: 'fixed',
          bottom: '88px',
          right: '16px',
          zIndex: 99999,
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: '#09090b',
          color: '#ffffff',
          border: '1.5px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '9999px',
          padding: '8px 18px',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          cursor: 'pointer',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.55)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}

        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px) scale(1.02)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 36px rgba(0, 0, 0, 0.7)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'none';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.55)';
        }}
        onMouseDown={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)';
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'none';
        }}
      >
        {/* Ícono de Robot con punto verde superior */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {/* Punto verde pulsante de "En Línea" */}
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 6px #10b981',
            }}
          />
          {/* Robot SVG icon */}
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fda4af"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="12" x="3" y="6" rx="2" />
            <path d="M12 6V2" />
            <path d="M2 12h1" />
            <path d="M21 12h1" />
            <path d="M9 13v-2" />
            <path d="M15 13v-2" />
          </svg>
        </div>

        {/* Dos líneas de texto: Título blanco + Subtítulo verde esmeralda */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.2,
              letterSpacing: '-0.2px',
            }}
          >
            Chat de Reporte en Vivo
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#10b981',
              lineHeight: 1.2,
              letterSpacing: '-0.1px',
            }}
          >
            Quejas &amp; Problemas App
          </span>
        </div>
      </button>

      {/* ── Modal de Chat en Vivo ── */}
      <LiveSupportChatModal
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        contractors={REGISTERED_CONTRACTORS_REF}
        onPqrCreatedFromChat={handlePqrCreated}
        onAppProblemReported={handleAppProblem}
      />
    </>
  );
};
