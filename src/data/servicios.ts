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
    id: "svc-frontend",
    tipo: "servicio",
    titulo: "Desarrollo Web Frontend",
    categoria: "Desarrollo",
    descripcion: "Creación de la parte visual y de interacción de tu sitio web.",
    profesional: "Juan Pérez",
    ubicacion: "Remoto",
    ciudad: "Cualquier ciudad",
    tarifa: 300,
    unidad: "hora",
    rating: 4.5,
    img: "url_imagen_servicio_frontend",
    etiquetas: ["desarrollo", "frontend", "web"],
    remoto: true,
  },
  {
    id: "svc-backend",
    tipo: "servicio",
    titulo: "Desarrollo Web Backend",
    categoria: "Desarrollo",
    descripcion: "Implementación de la lógica de servidor y base de datos.",
    profesional: "Ana Gómez",
    ubicacion: "Oficina",
    ciudad: "Madrid",
    tarifa: 350,
    unidad: "hora",
    rating: 4.7,
    img: "url_imagen_servicio_backend",
    etiquetas: ["desarrollo", "backend", "web"],
    remoto: false,
  },
  {
    id: "espacio-oficina",
    tipo: "espacio",
    titulo: "Alquiler de Oficina",
    categoria: "Espacios",
    descripcion: "Espacio de oficina privado y compartido en el centro de la ciudad.",
    profesional: "Espacios Coworking",
    ubicacion: "Calle Ejemplo 123",
    ciudad: "Madrid",
    tarifa: 50,
    unidad: "hora",
    rating: 4.8,
    img: "url_imagen_oficina",
    etiquetas: ["oficina", "alquiler", "espacio"],
    remoto: false,
  },
  // ...rest of the services data
  

];

export const getServicioById = (id: string): Servicio | undefined => {
  return SERVICIOS_DATA.find(s => s.id === id);
};
