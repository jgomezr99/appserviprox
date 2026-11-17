export interface MockStoreProduct {
  id: string | number;
  ownerId?: number;
  title: string;
  category: string;
  price: number;
  stock?: number;
  condition?: string;
  description: string;
  sellerName: string;
  sellerEmail?: string;
  sellerUsername?: string;
  sellerRole: "Contratista" | "Cliente" | "Ferretería Aliada" | "Administrador";
  sellerBlocked?: boolean;
  phone: string;
  city: string;
  image: string;
  images?: string[];
  date: string;
  createdAt?: string;
  updatedAt?: string;
  isOwner?: boolean;
  isActive?: boolean;
  reviewStatus?: "aprobado" | "en_revision" | "observado" | "rechazado";
  reviewNotes?: string;
  reviewedBy?: string;
  reportsCount?: number;
  lastReportReason?: string;
  featured?: boolean;
}

export const DEFAULT_MOCK_PRODUCTS: MockStoreProduct[] = [
  {
    id: 1,
    ownerId: 9001,
    title: 'Ultrabook Pro 14" Core i5',
    category: "Tecnología",
    price: 1450000,
    stock: 2,
    condition: "Como nuevo",
    description:
      "Procesador Intel Core i5 11va gen, 16GB RAM, SSD 512GB NVMe y chasis en aluminio. Incluye cargador USB-C original.",
    sellerName: "Carlos Mendoza",
    sellerEmail: "carlos.mendoza@demo.serviprox.co",
    sellerRole: "Cliente",
    phone: "+57 310 456 7890",
    city: "Bogotá",
    image: "/assets/products/laptop-pro.jpg",
    images: ["/assets/products/laptop-pro.jpg"],
    date: "Hoy",
    isActive: true,
    reviewStatus: "aprobado",
    reportsCount: 0,
    featured: true,
  },
  {
    id: 2,
    ownerId: 101,
    title: "Sofá Modular Nórdico 3 Puestos",
    category: "Muebles",
    price: 920000,
    stock: 1,
    condition: "Nuevo",
    description:
      "Tapizado en tela lino gris cálido antifluidos con base y patas macizas en roble natural.",
    sellerName: "Valentina Gómez",
    sellerEmail: "valentina.gomez@demo.serviprox.co",
    sellerRole: "Cliente",
    phone: "+57 312 987 6543",
    city: "Bogotá",
    image: "/assets/products/sofa-nordico.jpg",
    images: ["/assets/products/sofa-nordico.jpg"],
    date: "Ayer",
    isActive: true,
    reviewStatus: "aprobado",
    reportsCount: 0,
    featured: false,
  },
  {
    id: 3,
    ownerId: 102,
    title: "Smartphone Pro 256 GB Titanio Azul",
    category: "Tecnología",
    price: 2350000,
    stock: 1,
    condition: "Como nuevo",
    description:
      "Triple cámara profesional, marco en titanio cepillado, libre para todo operador y con factura verificada.",
    sellerName: "Andrés Morales",
    sellerEmail: "andres.morales@demo.serviprox.co",
    sellerRole: "Cliente",
    phone: "+57 300 234 5678",
    city: "Medellín",
    image: "/assets/products/smartphone-pro.jpg",
    images: ["/assets/products/smartphone-pro.jpg"],
    date: "Hace 2 días",
    isActive: true,
    reviewStatus: "aprobado",
    reportsCount: 0,
    featured: true,
  },
  {
    id: 4,
    ownerId: 9001,
    title: "Bicicleta MTB Aluminio Hidráulica",
    category: "Deportes",
    price: 880000,
    stock: 1,
    condition: "Como nuevo",
    description:
      "Marco hidroformado talla M, suspensión bloqueable, transmisión 1x12 y frenos de disco hidráulicos.",
    sellerName: "David Quintero",
    sellerEmail: "david.quintero@demo.serviprox.co",
    sellerRole: "Cliente",
    phone: "+57 315 876 5432",
    city: "Cali",
    image: "/assets/products/bicicleta-mtb.jpg",
    images: ["/assets/products/bicicleta-mtb.jpg"],
    date: "Hace 3 días",
    isActive: true,
    reviewStatus: "aprobado",
    reportsCount: 0,
    featured: false,
  },
  {
    id: 5,
    ownerId: 9001,
    title: "Control Inalámbrico Pro DualSense",
    category: "Multimedia",
    price: 340000,
    stock: 3,
    condition: "Nuevo",
    description:
      "Control ergonómico inalámbrico edición bicolor con respuesta háptica y batería recargable USB-C.",
    sellerName: "Sebastián Arias",
    sellerEmail: "sebastian.arias@demo.serviprox.co",
    sellerRole: "Cliente",
    phone: "+57 311 345 6789",
    city: "Bogotá",
    image: "/assets/products/control-gamer.jpg",
    images: ["/assets/products/control-gamer.jpg"],
    date: "Hace 4 días",
    isActive: true,
    reviewStatus: "aprobado",
    reportsCount: 0,
    featured: false,
  },
  {
    id: 6,
    ownerId: 9002,
    title: "Taladro Percutor Inalámbrico 20V + Estuche",
    category: "Herramientas",
    price: 420000,
    stock: 4,
    condition: "Nuevo",
    description:
      "Taladro profesional de 20V con batería de litio 5.0Ah, cargador rápido y estuche completo con brocas y puntas.",
    sellerName: "Andrés Ruiz",
    sellerEmail: "andres.ruiz@demo.serviprox.co",
    sellerRole: "Contratista",
    phone: "+57 300 441 2290",
    city: "Bogotá",
    image: "/assets/products/taladro-percutor.jpg",
    images: ["/assets/products/taladro-percutor.jpg"],
    date: "Hace 5 días",
    isActive: true,
    reviewStatus: "aprobado",
    reportsCount: 0,
    featured: true,
  },
];
