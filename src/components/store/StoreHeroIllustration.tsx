import React from "react";

export const StoreHeroIllustration: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 540 320"
      width="100%"
      height="100%"
      style={{ overflow: "visible", ...style }}
    >
      <defs>
        <linearGradient id="heroLaptopScreen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id="armchairGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <filter id="heroDropShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodOpacity="0.25" floodColor="#000" />
        </filter>
      </defs>

      {/* Sombra de piso suave */}
      <ellipse cx="270" cy="285" rx="250" ry="22" fill="#000000" opacity="0.12" />

      {/* SILLÓN ELEGANTE (DERECHA) */}
      <g filter="url(#heroDropShadow)">
        {/* Patas de madera */}
        <line x1="420" y1="230" x2="405" y2="280" stroke="#78350f" stroke-width="5" stroke-linecap="round" />
        <line x1="495" y1="230" x2="510" y2="280" stroke="#78350f" stroke-width="5" stroke-linecap="round" />
        <line x1="440" y1="225" x2="435" y2="275" stroke="#451a03" stroke-width="4" stroke-linecap="round" />
        <line x1="480" y1="225" x2="485" y2="275" stroke="#451a03" stroke-width="4" stroke-linecap="round" />
        {/* Respaldo curvado moderno */}
        <path
          d="M400 170 C400 80 515 80 515 170 L515 220 C515 235 400 235 400 220 Z"
          fill="url(#armchairGrad)"
        />
        {/* Cojín del asiento */}
        <rect x="405" y="200" width="105" height="30" rx="12" fill="#94a3b8" />
        {/* Cojín decorativo pequeño */}
        <rect x="420" y="165" width="40" height="40" rx="8" fill="#e2e8f0" transform="rotate(-10 420 165)" />
      </g>

      {/* CAJAS DE ENVÍO / PAQUETES (CENTRO-DERECHA) */}
      <g filter="url(#heroDropShadow)">
        {/* Caja grande */}
        <rect x="330" y="145" width="85" height="75" rx="6" fill="#d97706" />
        <rect x="330" y="145" width="85" height="18" fill="#b45309" opacity="0.3" />
        <line x1="372" y1="145" x2="372" y2="220" stroke="#92400e" stroke-width="3" stroke-dasharray="4,2" />
        {/* Cinta de sellado */}
        <rect x="365" y="145" width="15" height="75" fill="#fef3c7" opacity="0.6" />

        {/* Libros apilados */}
        <rect x="340" y="222" width="90" height="15" rx="3" fill="#0284c7" />
        <rect x="342" y="238" width="88" height="15" rx="3" fill="#dc2626" />
        <rect x="338" y="254" width="94" height="16" rx="3" fill="#ca8a04" />
      </g>

      {/* PLANTA DECORATIVA */}
      <g filter="url(#heroDropShadow)">
        <polygon points="325,185 345,185 342,215 328,215" fill="#ffffff" />
        {/* Hojas verdes */}
        <ellipse cx="335" cy="165" rx="7" ry="18" fill="#16a34a" transform="rotate(-20 335 165)" />
        <ellipse cx="340" cy="160" rx="8" ry="20" fill="#22c55e" transform="rotate(25 340 160)" />
        <ellipse cx="330" cy="160" rx="6" ry="16" fill="#15803d" transform="rotate(-45 330 160)" />
      </g>

      {/* LAPTOP MODERNA (CENTRO-IZQUIERDA) */}
      <g filter="url(#heroDropShadow)">
        {/* Pantalla abierta */}
        <rect x="150" y="90" width="170" height="110" rx="6" fill="#0f172a" stroke="#334155" stroke-width="2" />
        <rect x="156" y="96" width="158" height="98" rx="3" fill="url(#heroLaptopScreen)" />
        {/* Gráfico abstracto pantalla */}
        <path d="M156 150 C190 120 230 180 314 130 L314 194 L156 194 Z" fill="#ffffff" opacity="0.3" />
        <circle cx="235" cy="93" r="1.8" fill="#94a3b8" />
        {/* Base laptop */}
        <polygon points="130,201 340,201 325,216 145,216" fill="#64748b" />
        <rect x="215" y="202" width="40" height="3" rx="1.5" fill="#cbd5e1" />
      </g>

      {/* AUDÍFONOS WIRELESS (CENTRO) */}
      <g filter="url(#heroDropShadow)">
        {/* Diadema */}
        <path d="M285 210 C285 170 335 170 335 210" fill="none" stroke="#0f172a" stroke-width="8" stroke-linecap="round" />
        {/* Auriculares */}
        <rect x="278" y="205" width="16" height="28" rx="8" fill="#1e293b" />
        <rect x="326" y="205" width="16" height="28" rx="8" fill="#1e293b" />
      </g>

      {/* CONTROL DE VIDEOJUEGOS (FRENTE) */}
      <g filter="url(#heroDropShadow)">
        <path
          d="M210 245 C200 230 205 215 220 215 C235 215 255 215 270 215 C285 215 290 230 280 245 C275 255 265 250 260 240 C255 235 245 235 240 235 C235 235 225 235 220 240 C215 250 205 255 200 245 Z"
          fill="#020617"
          stroke="#334155"
          stroke-width="1.5"
        />
        {/* Botones e iluminación */}
        <circle cx="225" cy="225" r="3.5" fill="#3b82f6" />
        <circle cx="265" cy="225" r="3.5" fill="#10b981" />
        <circle cx="235" cy="235" r="5" fill="#1e293b" stroke="#475569" stroke-width="1" />
        <circle cx="255" cy="235" r="5" fill="#1e293b" stroke="#475569" stroke-width="1" />
        <rect x="240" y="220" width="10" height="4" rx="2" fill="#60a5fa" />
      </g>
    </svg>
  );
};
