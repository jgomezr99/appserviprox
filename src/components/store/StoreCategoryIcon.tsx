import React from "react";
import { Laptop, Armchair, BookOpen, Shirt } from "lucide-react";

interface StoreCategoryIconProps {
  name: string;
  size?: number;
  color?: string;
}

export const StoreCategoryIcon: React.FC<StoreCategoryIconProps> = ({
  name,
  size = 24,
  color = "currentColor",
}) => {
  switch (name) {
    case "grid":
      // 4 cuadritos redondeados exactos al diseño
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="2" />
          <rect x="14" y="3" width="7" height="7" rx="2" />
          <rect x="3" y="14" width="7" height="7" rx="2" />
          <rect x="14" y="14" width="7" height="7" rx="2" />
        </svg>
      );
    case "laptop":
      return <Laptop size={size} color={color} strokeWidth={2.2} />;
    case "armchair":
      return <Armchair size={size} color={color} strokeWidth={2.2} />;
    case "play-circle":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polygon points="10 8 16 12 10 16 10 8" fill="none" />
        </svg>
      );
    case "book-open":
      return <BookOpen size={size} color={color} strokeWidth={2.2} />;
    case "shirt":
      return <Shirt size={size} color={color} strokeWidth={2.2} />;
    case "sparkles":
    case "bear":
    case "toy":
      // Osito de peluche exacto a la tarjeta de Juguetes del diseño
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {/* Orejas */}
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          {/* Cabeza */}
          <circle cx="12" cy="12" r="7" />
          {/* Ojos */}
          <circle cx="9.5" cy="10.5" r="0.8" fill={color} />
          <circle cx="14.5" cy="10.5" r="0.8" fill={color} />
          {/* Hocico */}
          <ellipse cx="12" cy="14" rx="2.5" ry="1.8" />
          <circle cx="12" cy="13.2" r="0.6" fill={color} />
        </svg>
      );
    case "bike":
    case "sports":
    case "basketball":
      // Balón de baloncesto exacto a la tarjeta de Deportes del diseño
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <line x1="12" y1="2" x2="12" y2="22" />
          <path d="M4.93 4.93 C7.5 7.5 7.5 16.5 4.93 19.07" />
          <path d="M19.07 4.93 C16.5 7.5 16.5 16.5 19.07 19.07" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2">
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
};
