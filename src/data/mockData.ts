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
    id: "svc-frontend",
    tipo: "servicio",
    titulo: "Desarrollo Web Frontend",
    categoria: "Tecnología",
    descripcion: "Creación de interfaces de usuario interactivas y responsivas para tu sitio web.",
    profesional: "Carlos Rodrígueez",
    remoto: true,
    tarifa: 75000,
    unidad: "por hora",
    rating: 4.7,
    ciudad: "Remoto",
    img: "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?q=80&w=1200&auto=format&fit=crop"
  },
  // ...resto de los datos...
];
