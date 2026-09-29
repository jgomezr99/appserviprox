export type Tipo = "servicio" | "espacio";

export interface Servicio {
  id: string;
  tipo: Tipo;
  titulo: string;
  categoria?: string;
  descripcion?: string;
  profesional?: string;
  ubicacion?: string;
  ciudad?: string;
  tarifa: number;
  unidad?: string;
  rating?: number;
  img?: string;
  etiquetas?: string[];
  remoto?: boolean;
}

export const SERVICIOS_DATA: Servicio[] = [
  {
    id: "svc-plomeria-fuga",
    tipo: "servicio",
    titulo: "Reparación de fuga",
    categoria: "Plomería",
    descripcion: "Atención de fugas, goteos y conexiones hidráulicas en viviendas.",
    profesional: "Marcela Gómez",
    ubicacion: "Kennedy",
    ciudad: "Bogotá",
    tarifa: 90000,
    unidad: "por visita",
    rating: 4.8,
    img: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?q=80&w=1200&auto=format&fit=crop",
    etiquetas: ["plomería", "fugas", "hogar"],
    remoto: false,
  },
  {
    id: "svc-electricidad-revision",
    tipo: "servicio",
    titulo: "Revisión eléctrica residencial",
    categoria: "Electricidad",
    descripcion: "Revisión de tomas, interruptores, iluminación y tableros eléctricos.",
    profesional: "Diego Salcedo",
    ubicacion: "Timiza",
    ciudad: "Bogotá",
    tarifa: 120000,
    unidad: "por visita",
    rating: 4.7,
    img: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?q=80&w=1200&auto=format&fit=crop",
    etiquetas: ["electricidad", "mantenimiento", "hogar"],
    remoto: false,
  },
  {
    id: "svc-limpieza-profunda",
    tipo: "servicio",
    titulo: "Limpieza profunda",
    categoria: "Limpieza",
    descripcion: "Limpieza residencial profunda para apartamentos y casas.",
    profesional: "Laura Méndez",
    ubicacion: "Chapinero",
    ciudad: "Bogotá",
    tarifa: 160000,
    unidad: "por servicio",
    rating: 4.6,
    img: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=1200&auto=format&fit=crop",
    etiquetas: ["limpieza", "aseo", "hogar"],
    remoto: false,
  },
];

export const getServicioById = (id: string): Servicio | undefined => {
  return SERVICIOS_DATA.find(s => s.id === id);
};
