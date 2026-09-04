export type Tipo = "servicio" | "espacio";

export type Favorito = {
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
};

export const DATA: Favorito[] = [
  {
    id: "svc-plomeria-fuga",
    tipo: "servicio",
    titulo: "Reparación de fuga",
    categoria: "Plomería",
    descripcion: "Atención de fugas y goteos en baños y cocinas.",
    profesional: "Marcela Gómez",
    remoto: false,
    tarifa: 90000,
    unidad: "por visita",
    rating: 4.8,
    ciudad: "Bogotá",
    ubicacion: "Kennedy",
    img: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?q=80&w=1200&auto=format&fit=crop"
  },
];
