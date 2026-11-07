export interface StoreCategoryDef {
  id: string;
  label: string;
  iconName: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  iconColor: string;
}

export const MAIN_STORE_CATEGORIES: StoreCategoryDef[] = [
  {
    id: "Todos",
    label: "Todos",
    iconName: "grid",
    bgColor: "#e0f2fe",
    textColor: "#0369a1",
    borderColor: "#bae6fd",
    iconColor: "#0284c7",
  },
  {
    id: "Tecnología",
    label: "Tecnología",
    iconName: "laptop",
    bgColor: "#ede9fe",
    textColor: "#5b21b6",
    borderColor: "#ddd6fe",
    iconColor: "#7c3aed",
  },
  {
    id: "Muebles",
    label: "Muebles",
    iconName: "armchair",
    bgColor: "#fef3c7",
    textColor: "#92400e",
    borderColor: "#fde68a",
    iconColor: "#b45309",
  },
  {
    id: "Multimedia",
    label: "Multimedia",
    iconName: "play-circle",
    bgColor: "#e0e7ff",
    textColor: "#3730a3",
    borderColor: "#c7d2fe",
    iconColor: "#4f46e5",
  },
  {
    id: "Libros",
    label: "Libros",
    iconName: "book-open",
    bgColor: "#e0f7fa",
    textColor: "#00695c",
    borderColor: "#b2ebf2",
    iconColor: "#00897b",
  },
  {
    id: "Ropa",
    label: "Ropa",
    iconName: "shirt",
    bgColor: "#f3e8ff",
    textColor: "#6b21a8",
    borderColor: "#e9d5ff",
    iconColor: "#9333ea",
  },
  {
    id: "Juguetes",
    label: "Juguetes",
    iconName: "bear",
    bgColor: "#ffedd5",
    textColor: "#9a3412",
    borderColor: "#fed7aa",
    iconColor: "#ea580c",
  },
  {
    id: "Deportes",
    label: "Deportes",
    iconName: "basketball",
    bgColor: "#ffe4e6",
    textColor: "#9f1239",
    borderColor: "#fecdd3",
    iconColor: "#e11d48",
  },
];

export const EXTRA_STORE_CATEGORIES: StoreCategoryDef[] = [
  {
    id: "Herramientas",
    label: "Herramientas",
    iconName: "hammer",
    bgColor: "#f1f5f9",
    textColor: "#334155",
    borderColor: "#cbd5e1",
    iconColor: "#475569",
  },
  {
    id: "Electrodomésticos",
    label: "Electrodomésticos",
    iconName: "tv",
    bgColor: "#ecfdf5",
    textColor: "#065f46",
    borderColor: "#a7f3d0",
    iconColor: "#059669",
  },
  {
    id: "Hogar y decoración",
    label: "Hogar y decoración",
    iconName: "home",
    bgColor: "#fef9c3",
    textColor: "#713f12",
    borderColor: "#fde047",
    iconColor: "#ca8a04",
  },
  {
    id: "Materiales",
    label: "Materiales",
    iconName: "package",
    bgColor: "#f0fdf4",
    textColor: "#166534",
    borderColor: "#bbf7d0",
    iconColor: "#16a34a",
  },
  {
    id: "Repuestos",
    label: "Repuestos",
    iconName: "cog",
    bgColor: "#f8fafc",
    textColor: "#475569",
    borderColor: "#e2e8f0",
    iconColor: "#64748b",
  },
  {
    id: "Equipos",
    label: "Equipos",
    iconName: "truck",
    bgColor: "#eff6ff",
    textColor: "#1e40af",
    borderColor: "#bfdbfe",
    iconColor: "#2563eb",
  },
  {
    id: "Otros",
    label: "Otros",
    iconName: "tag",
    bgColor: "#f3f4f6",
    textColor: "#374151",
    borderColor: "#e5e7eb",
    iconColor: "#4b5563",
  },
];

export const ALL_PUBLISH_CATEGORIES = [
  "Tecnología",
  "Muebles",
  "Multimedia",
  "Libros",
  "Ropa",
  "Juguetes",
  "Deportes",
  "Herramientas",
  "Electrodomésticos",
  "Hogar y decoración",
  "Materiales",
  "Repuestos",
  "Equipos",
  "Otros",
];
