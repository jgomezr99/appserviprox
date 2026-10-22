import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * RoleThemeController
 * 
 * Gestiona dinámicamente el tema visual de la aplicación según el rol:
 * - CLIENTE: Tema Rojo (Principal Rojo, interfaz/fondos blancos reemplazados por Rojo Claro)
 * - PROFESIONAL: Tema Azul (Principal Azul, interfaz/fondos blancos reemplazados por Azul Claro)
 */
export const RoleThemeController: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname.toLowerCase();

    // 1. Determinar el rol activo
    let activeRole: 'client' | 'professional' = 'client';

    if (
      path.startsWith('/profesional') ||
      path.startsWith('/onboarding/professional') ||
      (path === '/perfil' && user?.role === 'professional') ||
      (path.startsWith('/seguimiento') && user?.role === 'professional')
    ) {
      activeRole = 'professional';
    } else if (
      path.startsWith('/cliente') ||
      path.startsWith('/onboarding/client') ||
      path.startsWith('/folder/cliente')
    ) {
      activeRole = 'client';
    } else if (user?.role === 'professional') {
      activeRole = 'professional';
    } else if (user?.role === 'client') {
      activeRole = 'client';
    }

    const docEl = document.documentElement;
    const bodyEl = document.body;
    const appEl = document.querySelector('ion-app');

    // Quitar clases anteriores
    docEl.classList.remove('theme-client', 'theme-professional');
    bodyEl.classList.remove('theme-client', 'theme-professional');
    if (appEl) {
      appEl.classList.remove('theme-client', 'theme-professional');
    }

    // Agregar clase y data-theme activos
    const targetClass = activeRole === 'professional' ? 'theme-professional' : 'theme-client';
    docEl.classList.add(targetClass);
    bodyEl.classList.add(targetClass);
    if (appEl) {
      appEl.classList.add(targetClass);
    }

    docEl.setAttribute('data-theme', activeRole);
    bodyEl.setAttribute('data-theme', activeRole);
    if (appEl) {
      appEl.setAttribute('data-theme', activeRole);
    }
  }, [user?.role, location.pathname]);

  return null;
};

export default RoleThemeController;

