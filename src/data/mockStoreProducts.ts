export interface MockStoreProduct {
  id: string | number;
  title: string;
  category: string;
  price: number;
  description: string;
  sellerName: string;
  sellerRole: "Contratista" | "Cliente" | "Ferretería Aliada" | "Administrador";
  phone: string;
  city: string;
  image: string;
  date: string;
  isOwner?: boolean;
  featured?: boolean;
}

export const DEFAULT_MOCK_PRODUCTS: MockStoreProduct[] = [
  {
    id: 1,
    title: "Portátil Lenovo i5",
    category: "Tecnología",
    price: 1200000,
    description: "Intel Core i5 11va gen, 8GB RAM, SSD 256GB. Estado 9/10 en caja con cargador original.",
    sellerName: "Carlos Mendoza",
    sellerRole: "Cliente",
    phone: "+57 310 456 7890",
    city: "Bogotá",
    image: "/assets/prod-lenovo.jpg",
    date: "Hoy",
    featured: true,
  },
  {
    id: 2,
    title: "Sofá de 3 puestos",
    category: "Muebles",
    price: 850000,
    description: "Sofá nórdico tapizado en tela antifluidos gris claro, patas en madera roble.",
    sellerName: "Valentina Gómez",
    sellerRole: "Cliente",
    phone: "+57 312 987 6543",
    city: "Bogotá",
    image: "/assets/prod-sofa.jpg",
    date: "Ayer",
    featured: false,
  },
  {
    id: 3,
    title: "iPhone 13 – 128 GB",
    category: "Tecnología",
    price: 2300000,
    description: "Batería al 89%, color azul medianoche, libre para todo operador con factura.",
    sellerName: "Andrés Morales",
    sellerRole: "Cliente",
    phone: "+57 300 234 5678",
    city: "Medellín",
    image: "/assets/prod-iphone.jpg",
    date: "Hace 2 días",
    featured: true,
  },
  {
    id: 4,
    title: "Bicicleta MTB",
    category: "Deportes",
    price: 700000,
    description: "Marco en aluminio talla M, cambios Shimano 21 vel, frenos de disco hidráulicos.",
    sellerName: "David Quintero",
    sellerRole: "Cliente",
    phone: "+57 315 876 5432",
    city: "Cali",
    image: "/assets/prod-bike.jpg",
    date: "Hace 3 días",
    featured: false,
  },
  {
    id: 5,
    title: "Control PS5",
    category: "Multimedia",
    price: 320000,
    description: "Control inalámbrico DualSense original blanco, gatillos adaptativos y feedback háptico.",
    sellerName: "Sebastián Arias",
    sellerRole: "Cliente",
    phone: "+57 311 345 6789",
    city: "Bogotá",
    image: "/assets/prod-ps5.jpg",
    date: "Hace 4 días",
    featured: false,
  },
];
