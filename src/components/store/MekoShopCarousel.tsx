import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface MekoBannerSlide {
  id: number;
  image: string;
  alt: string;
  actionType: "publish" | "explore";
}

const SLIDES: MekoBannerSlide[] = [
  {
    id: 1,
    image: "/assets/ref-banner-1.jpg",
    alt: "Meko Shop - Compra y vende productos nuevos y de segunda",
    actionType: "publish",
  },
  {
    id: 2,
    image: "/assets/meko-banner-2.jpg",
    alt: "Meko Shop - Dale una segunda vida a lo que ya no usas",
    actionType: "publish",
  },
  {
    id: 3,
    image: "/assets/meko-banner-3.jpg",
    alt: "Meko Shop - Todo lo que necesitas en un solo lugar",
    actionType: "explore",
  },
  {
    id: 4,
    image: "/assets/meko-banner-4.jpg",
    alt: "Meko Shop - Compra, vende e intercambia de forma segura",
    actionType: "publish",
  },
];

interface MekoShopCarouselProps {
  onPublishClick: () => void;
  onExploreClick: () => void;
}

export const MekoShopCarousel: React.FC<MekoShopCarouselProps> = ({
  onPublishClick,
  onExploreClick,
}) => {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Auto-avance cada 5 segundos
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isPaused]);

  const goToPrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrent((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
  };

  const goToNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrent((prev) => (prev + 1) % SLIDES.length);
  };

  const handleAction = (slide: MekoBannerSlide) => {
    if (slide.actionType === "publish") {
      onPublishClick();
    } else {
      onExploreClick();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) goToNext();
      else goToPrev();
    }
    touchStartX.current = null;
  };

  const currentSlide = SLIDES[current];

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: "relative",
        marginBottom: "20px",
      }}
      aria-label="Carrusel Meko Shop"
    >
      {/* Contenedor del Banner con bordes redondeados exactos */}
      <div
        style={{
          position: "relative",
          width: "100%",
          borderRadius: "18px",
          overflow: "hidden",
          cursor: "pointer",
          aspectRatio: "810 / 167",
          minHeight: "140px",
          maxHeight: "220px",
          boxShadow: "0 6px 16px -4px rgba(0,0,0,0.08)",
          background: "#1e293b",
        }}
        onClick={() => handleAction(currentSlide)}
        title="Toca para publicar o explorar productos en Meko Shop"
      >
        {SLIDES.map((slide, index) => {
          const isActive = index === current;
          return (
            <div
              key={slide.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                opacity: isActive ? 1 : 0,
                transition: "opacity 0.5s ease-in-out",
                pointerEvents: isActive ? "auto" : "none",
              }}
            >
              <img
                src={slide.image}
                alt={slide.alt}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
                loading={index === 0 ? "eager" : "lazy"}
              />

              {/* Hotspot clicable sobre el botón del banner */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction(slide);
                }}
                aria-label="Acción del banner"
                style={{
                  position: "absolute",
                  bottom: "12%",
                  left: "4%",
                  width: "22%",
                  height: "28%",
                  opacity: 0,
                  cursor: "pointer",
                  borderRadius: "20px",
                  border: "none",
                }}
              />
            </div>
          );
        })}

        {/* Flechas de navegación elegantes en hover */}
        <button
          type="button"
          onClick={goToPrev}
          aria-label="Anterior"
          style={{
            position: "absolute",
            top: "50%",
            left: "8px",
            transform: "translateY(-50%)",
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(4px)",
            color: "#ffffff",
            border: "none",
            borderRadius: "50%",
            width: "30px",
            height: "30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 5,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(15, 23, 42, 0.75)";
            e.currentTarget.style.transform = "translateY(-50%) scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(15, 23, 42, 0.45)";
            e.currentTarget.style.transform = "translateY(-50%) scale(1)";
          }}
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
        </button>

        <button
          type="button"
          onClick={goToNext}
          aria-label="Siguiente"
          style={{
            position: "absolute",
            top: "50%",
            right: "8px",
            transform: "translateY(-50%)",
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(4px)",
            color: "#ffffff",
            border: "none",
            borderRadius: "50%",
            width: "30px",
            height: "30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 5,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(15, 23, 42, 0.75)";
            e.currentTarget.style.transform = "translateY(-50%) scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(15, 23, 42, 0.45)";
            e.currentTarget.style.transform = "translateY(-50%) scale(1)";
          }}
        >
          <ChevronRight size={18} strokeWidth={2.5} />
        </button>
      </div>

      {/* Puntos indicadores del carrusel exactos a la imagen de referencia */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "6px",
          marginTop: "10px",
        }}
      >
        {SLIDES.map((_, index) => {
          const isActive = index === current;
          return (
            <button
              key={index}
              type="button"
              onClick={() => setCurrent(index)}
              aria-label={`Banner ${index + 1}`}
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: isActive ? "#2563eb" : "#cbd5e1",
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "all 0.2s ease",
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
