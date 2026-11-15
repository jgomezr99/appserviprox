import React, { useState, useMemo } from "react";
import { IonModal, IonIcon } from "@ionic/react";
import { closeOutline, searchOutline, checkmarkCircle, chevronForwardOutline, chevronDownOutline } from "ionicons/icons";
import { MapPin, Globe, Check } from "lucide-react";
import {
  ALL_COLOMBIA_OPTION,
  TOP_COLOMBIA_CITIES,
  COLOMBIA_DEPARTMENTS,
} from "../../data/colombiaLocations";

interface ColombiaCityModalProps {
  isOpen: boolean;
  selectedCity: string;
  onSelectCity: (city: string) => void;
  onClose: () => void;
}

export const ColombiaCityModal: React.FC<ColombiaCityModalProps> = ({
  isOpen,
  selectedCity,
  onSelectCity,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({
    "Bogotá D.C.": true,
    "Antioquia": true,
  });

  const toggleDept = (dept: string) => {
    setExpandedDepts((prev) => ({ ...prev, [dept]: !prev[dept] }));
  };

  const filteredDepts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return COLOMBIA_DEPARTMENTS;

    const result: Record<string, string[]> = {};
    for (const [dept, cities] of Object.entries(COLOMBIA_DEPARTMENTS)) {
      const matchDept = dept.toLowerCase().includes(q);
      const matchingCities = cities.filter((c) => c.toLowerCase().includes(q));
      if (matchDept || matchingCities.length > 0) {
        result[dept] = matchDept ? cities : matchingCities;
      }
    }
    return result;
  }, [searchTerm]);

  const handleSelect = (city: string) => {
    onSelectCity(city);
    onClose();
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          background: "#ffffff",
          maxWidth: "560px",
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 20px 14px",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "#eff6ff",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MapPin size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Ubicación en Colombia
              </h2>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
                Selecciona tu ciudad o explora todo el país
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
            }}
          >
            <IonIcon icon={closeOutline} style={{ fontSize: "1.3rem" }} />
          </button>
        </header>

        {/* Buscador */}
        <div style={{ padding: "14px 20px 10px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "#f1f5f9",
              borderRadius: "12px",
              padding: "10px 14px",
              gap: "8px",
            }}
          >
            <IonIcon icon={searchOutline} style={{ color: "#64748b", fontSize: "1.1rem" }} />
            <input
              type="text"
              placeholder="Buscar ciudad o departamento (ej. Medellín, Cali, Santander...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: "0.9rem",
                width: "100%",
                color: "#0f172a",
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
              >
                <IonIcon icon={closeOutline} />
              </button>
            )}
          </div>
        </div>

        {/* Contenido scrolleable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 24px" }}>
          {/* Opción destacada: Toda Colombia */}
          <div style={{ marginBottom: "16px" }}>
            <button
              type="button"
              onClick={() => handleSelect(ALL_COLOMBIA_OPTION)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderRadius: "14px",
                border: selectedCity === ALL_COLOMBIA_OPTION ? "2px solid #2563eb" : "1px solid #e2e8f0",
                background: selectedCity === ALL_COLOMBIA_OPTION ? "#eff6ff" : "#ffffff",
                cursor: "pointer",
                textAlign: "left",
                boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "1.6rem" }}>🇨🇴</span>
                <div>
                  <span
                    style={{
                      display: "block",
                      fontWeight: 800,
                      fontSize: "0.98rem",
                      color: selectedCity === ALL_COLOMBIA_OPTION ? "#1d4ed8" : "#0f172a",
                    }}
                  >
                    Toda Colombia
                  </span>
                  <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                    Ver publicaciones de todos los departamentos y ciudades
                  </span>
                </div>
              </div>
              {selectedCity === ALL_COLOMBIA_OPTION && (
                <div
                  style={{
                    background: "#2563eb",
                    color: "#ffffff",
                    borderRadius: "50%",
                    width: "24px",
                    height: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check size={16} />
                </div>
              )}
            </button>
          </div>

          {/* Ciudades Populares */}
          {!searchTerm && (
            <div style={{ marginBottom: "20px" }}>
              <span
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: "#94a3b8",
                  letterSpacing: "0.05em",
                  marginBottom: "8px",
                }}
              >
                Principales Ciudades
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {TOP_COLOMBIA_CITIES.filter((c) => c !== ALL_COLOMBIA_OPTION).map((city) => {
                  const isSelected = selectedCity.toLowerCase() === city.toLowerCase();
                  return (
                    <button
                      key={city}
                      type="button"
                      onClick={() => handleSelect(city)}
                      style={{
                        padding: "7px 14px",
                        borderRadius: "20px",
                        fontSize: "0.85rem",
                        fontWeight: isSelected ? 700 : 500,
                        border: isSelected ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                        background: isSelected ? "#2563eb" : "#f8fafc",
                        color: isSelected ? "#ffffff" : "#334155",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {city}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lista agrupada por Departamento */}
          <div>
            <span
              style={{
                display: "block",
                fontSize: "0.75rem",
                fontWeight: 800,
                textTransform: "uppercase",
                color: "#94a3b8",
                letterSpacing: "0.05em",
                marginBottom: "8px",
              }}
            >
              Todos los Departamentos y Municipios ({Object.keys(filteredDepts).length})
            </span>

            {Object.keys(filteredDepts).length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b" }}>
                <p style={{ margin: 0 }}>No encontramos municipios con "{searchTerm}".</p>
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  style={{
                    marginTop: "8px",
                    background: "none",
                    border: "none",
                    color: "#2563eb",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Limpiar búsqueda
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {Object.entries(filteredDepts).map(([dept, cities]) => {
                  const isExpanded = !!expandedDepts[dept] || !!searchTerm;
                  return (
                    <div
                      key={dept}
                      style={{
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        overflow: "hidden",
                        background: "#ffffff",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleDept(dept)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 16px",
                          background: "#f8fafc",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: "0.9rem",
                          color: "#1e293b",
                          textAlign: "left",
                        }}
                      >
                        <span>
                          {dept}{" "}
                          <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 400 }}>
                            ({cities.length} {cities.length === 1 ? "ciudad" : "ciudades"})
                          </span>
                        </span>
                        <IonIcon
                          icon={isExpanded ? chevronDownOutline : chevronForwardOutline}
                          style={{ color: "#94a3b8" }}
                        />
                      </button>

                      {isExpanded && (
                        <div
                          style={{
                            padding: "8px 12px",
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                            gap: "6px",
                            background: "#ffffff",
                          }}
                        >
                          {cities.map((city) => {
                            const isSelected = selectedCity.toLowerCase() === city.toLowerCase();
                            return (
                              <button
                                key={city}
                                type="button"
                                onClick={() => handleSelect(city)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "8px 10px",
                                  borderRadius: "8px",
                                  border: isSelected ? "1.5px solid #2563eb" : "1px solid #f1f5f9",
                                  background: isSelected ? "#eff6ff" : "#ffffff",
                                  color: isSelected ? "#1d4ed8" : "#334155",
                                  fontWeight: isSelected ? 700 : 500,
                                  fontSize: "0.84rem",
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                              >
                                <span>{city}</span>
                                {isSelected && <Check size={14} color="#2563eb" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </IonModal>
  );
};
