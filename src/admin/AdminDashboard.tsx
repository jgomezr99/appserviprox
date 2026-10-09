import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { adminService } from "../services/adminService";
import "./AdminDashboard.css";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE DATOS ADMINISTRATIVOS
// ─────────────────────────────────────────────────────────────────────────────
type AdminMenuId =
  | "inicio"
  | "usuarios_clientes"
  | "usuarios_profesionales"
  | "publicaciones_servicios"
  | "publicaciones_productos"
  | "contrataciones"
  | "pqr"
  | "beneficios"
  | "fallas"
  | "roles"
  | "auditoria"
  | "reportes"
  | "configuracion";

interface RequestItem {
  id: string;
  raw_id?: number;
  type: "Servicio" | "Producto" | "PQR" | "Falla";
  typeIcon: string;
  typeColor: string;
  title: string;
  userName: string;
  userAvatar: string;
  date: string;
  status: "En revisión" | "Aprobado" | "Abierto" | "En proceso" | "Rechazado";
  statusClass: string;
}

export interface ClientItem {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  phone: string;
  city: string;
  address: string;
  document_id: string;
  is_active: boolean;
  is_identity_verified: boolean;
  requests_count: number;
  date_joined: string;
}

export interface ProfessionalItem {
  id: number;
  slug?: string;
  display_name: string;
  initials?: string;
  headline?: string;
  company_name?: string;
  specialty_label?: string;
  avatar_url?: string;
  phone?: string;
  rating_avg: string | number;
  jobs_completed: number;
  is_verified: boolean;
  is_active: boolean;
  points: number;
  wallet_balance: string | number;
  categories?: string[];
  neighborhood?: string;
  city?: string;
}

interface TopProfessional {
  id: string;
  raw_id?: number;
  name: string;
  specialty: string;
  rating: number;
  tier: "Nivel Oro" | "Nivel Plata" | "Nivel Bronce";
  avatar: string;
  points: number;
  completedJobs: number;
  verified: boolean;
  blocked?: boolean;
}

interface AuditLogEntry {
  id: string;
  adminName: string;
  action: string;
  target: string;
  date: string;
  reason: string;
}

export interface BenefitRedeemedItem {
  id: string;
  title: string;
  date: string;
  status: string;
  icon: string;
  iconBg: string;
}

export interface BenefitProItem {
  id: number;
  name: string;
  document_id: string;
  category: string;
  city: string;
  points: number;
  level: "Oro" | "Plata" | "Bronce" | "Destacados";
  redeemed_count: number;
  status: "Activo" | "En revisión" | "Suspendido";
  rating: number;
  reviews_count: number;
  avatar: string;
  next_level_points: number;
  redeemed_history: BenefitRedeemedItem[];
}

export interface PqrItem {
  id: string;
  raw_id?: number | string;
  type: "queja" | "reclamo" | "peticion" | "reporte";
  typeLabel: "Queja" | "Reclamo" | "Petición" | "Reporte";
  typeIcon: string;
  typeBg: string;
  typeColor: string;
  title: string;
  shortDesc: string;
  description: string;
  client: {
    name: string;
    document_id: string;
    avatar: string;
    rating: number;
    reviews_count: number;
    email: string;
    phone?: string;
  };
  contractor?: {
    name: string;
    document_id: string;
    avatar: string;
    rating: number;
    reviews_count: number;
    specialty?: string;
  } | null;
  relatedTo: string;
  date: string;
  updatedDate: string;
  priority: "Alta" | "Media" | "Baja";
  status: "En revisión" | "Abierta" | "En proceso" | "Resuelta" | "Cerrada";
  city: string;
  attachments: string[];
  timeline: {
    date: string;
    text: string;
  }[];
  adminResponse?: string;
}

// Datos iniciales de la base de datos para respaldo y render inmediato
const INITIAL_DB_CLIENTS: ClientItem[] = [
  {
    id: 6,
    email: "laura.gomez@bogota.co",
    first_name: "Laura",
    last_name: "Gómez",
    full_name: "Laura Gómez",
    role: "client",
    phone: "+57 310 445 8892",
    city: "Bogotá",
    address: "Cra. 11 # 85-32, Chicó, Bogotá",
    document_id: "CC 52.894.120",
    is_active: true,
    is_identity_verified: true,
    requests_count: 1,
    date_joined: "19/09/2026",
  },
  {
    id: 5,
    email: "jgomezr21@ucentral.edu.co",
    first_name: "Juan Pablo",
    last_name: "Gomez",
    full_name: "Juan Pablo Gomez",
    role: "client",
    phone: "+57 302 850 5481",
    city: "Bogotá",
    address: "Cra. 13 # 63-39, Chapinero, Bogotá",
    document_id: "CC 1.000.257.887",
    is_active: true,
    is_identity_verified: false,
    requests_count: 1,
    date_joined: "12/09/2026",
  },
  {
    id: 2,
    email: "andres.ruiz@demo.serviprox.co",
    first_name: "Andres",
    last_name: "Ruiz",
    full_name: "Andres Ruiz",
    role: "client",
    phone: "+57 311 445 9988",
    city: "Bogotá",
    address: "Carrera 15 # 88-21, Chicó, Bogotá",
    document_id: "CC 80.124.567",
    is_active: true,
    is_identity_verified: true,
    requests_count: 0,
    date_joined: "12/09/2026",
  },
  {
    id: 1,
    email: "camila@demo.serviprox.co",
    first_name: "Camila",
    last_name: "Rojas",
    full_name: "Camila Rojas",
    role: "client",
    phone: "+57 315 220 1144",
    city: "Bogotá",
    address: "Calle 53 # 21-40, Galerías, Bogotá",
    document_id: "CC 1.018.490.123",
    is_active: true,
    is_identity_verified: false,
    requests_count: 3,
    date_joined: "12/09/2026",
  },
];

const INITIAL_DB_PROS: ProfessionalItem[] = [
  {
    id: 4,
    display_name: "Juan Pablo Gomez",
    headline: "Especialista Técnico Profesional",
    company_name: "Especialista Técnico Profesional",
    specialty_label: "Servicios Técnicos y Mantenimiento",
    avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=240&auto=format&fit=crop",
    phone: "+57 302 850 5481",
    rating_avg: "4.95",
    jobs_completed: 45,
    is_verified: true,
    is_active: true,
    points: 1000,
    wallet_balance: "0.00",
    categories: ["Cerrajería", "Electricidad", "Instalaciones", "Plomería"],
    neighborhood: "Chapinero",
    city: "Bogotá",
  },
  {
    id: 8,
    display_name: "Maestro Néstor Caicedo",
    headline: "Maestro de Obra y Acabados",
    specialty_label: "Construcción y Remodelaciones",
    avatar_url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=240&auto=format&fit=crop&q=80",
    phone: "+57 313 555 1208",
    rating_avg: "4.88",
    jobs_completed: 92,
    is_verified: true,
    is_active: true,
    points: 1150,
    wallet_balance: "0.00",
    categories: ["Pintura", "Albañilería", "Acabados"],
    neighborhood: "Suba",
    city: "Bogotá",
  },
  {
    id: 6,
    display_name: "Ing. Carlos Mendoza",
    headline: "Técnico Electricista RETIE",
    specialty_label: "Electricidad y Redes",
    avatar_url: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=240&auto=format&fit=crop&q=80",
    phone: "+57 310 889 4432",
    rating_avg: "4.92",
    jobs_completed: 130,
    is_verified: true,
    is_active: true,
    points: 1450,
    wallet_balance: "50000.00",
    categories: ["Electricidad", "Instalaciones"],
    neighborhood: "Kennedy",
    city: "Bogotá",
  },
  {
    id: 5,
    display_name: "Jorge Morales",
    headline: "Técnico en Cerrajería Residencial y Automotriz",
    specialty_label: "Cerrajería",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80",
    phone: "+57 311 223 3445",
    rating_avg: "4.85",
    jobs_completed: 78,
    is_verified: true,
    is_active: true,
    points: 920,
    wallet_balance: "0.00",
    categories: ["Cerrajería"],
    neighborhood: "Teusaquillo",
    city: "Bogotá",
  },
  {
    id: 7,
    display_name: "Rodrigo Salamanca",
    headline: "Plomero Certificado SENA",
    specialty_label: "Plomería y Redes Hidráulicas",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&auto=format&fit=crop&q=80",
    phone: "+57 318 776 5544",
    rating_avg: "4.79",
    jobs_completed: 65,
    is_verified: false,
    is_active: true,
    points: 800,
    wallet_balance: "0.00",
    categories: ["Plomería"],
    neighborhood: "Engativá",
    city: "Bogotá",
  },
];

// Datos del panel de Beneficios y Puntos sincronizados con la captura oficial
const INITIAL_BENEFIT_PROS: BenefitProItem[] = [
  {
    id: 1,
    name: "Andrés López",
    document_id: "CC 1023456789",
    category: "Electricidad",
    city: "Bogotá",
    points: 2450,
    level: "Oro",
    redeemed_count: 8,
    status: "Activo",
    rating: 4.9,
    reviews_count: 120,
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    next_level_points: 3000,
    redeemed_history: [
      { id: "b1", title: "Bono de descuento 20% en herramientas", date: "15 May 2024", status: "Entregado", icon: "🛠️", iconBg: "#fef3c7" },
      { id: "b2", title: "Recarga de datos móviles 10GB", date: "02 May 2024", status: "Entregado", icon: "📱", iconBg: "#e0f2fe" },
      { id: "b3", title: "Seguro contra accidentes 1 mes", date: "18 Abr 2024", status: "Entregado", icon: "🛡️", iconBg: "#dcfce7" },
    ],
  },
  {
    id: 2,
    name: "María Torres",
    document_id: "CC 1039876543",
    category: "Limpieza",
    city: "Medellín",
    points: 1820,
    level: "Plata",
    redeemed_count: 5,
    status: "Activo",
    rating: 4.8,
    reviews_count: 85,
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    next_level_points: 2000,
    redeemed_history: [
      { id: "b4", title: "Recarga de datos móviles 10GB", date: "28 Abr 2024", status: "Entregado", icon: "📱", iconBg: "#e0f2fe" },
      { id: "b5", title: "Bono de supermercado $50.000", date: "10 Mar 2024", status: "Entregado", icon: "🛒", iconBg: "#fef3c7" },
      { id: "b5b", title: "Seguro contra accidentes 1 mes", date: "15 Feb 2024", status: "Entregado", icon: "🛡️", iconBg: "#dcfce7" },
    ],
  },
  {
    id: 3,
    name: "José Ramírez",
    document_id: "CC 1045678901",
    category: "Plomería",
    city: "Cali",
    points: 980,
    level: "Bronce",
    redeemed_count: 2,
    status: "Activo",
    rating: 4.7,
    reviews_count: 42,
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    next_level_points: 1000,
    redeemed_history: [
      { id: "b6", title: "Recarga de minutos $15.000", date: "12 Feb 2024", status: "Entregado", icon: "📞", iconBg: "#e0f2fe" },
      { id: "b6b", title: "Bono de descuento ferretería", date: "10 Ene 2024", status: "Entregado", icon: "🛠️", iconBg: "#fef3c7" },
    ],
  },
  {
    id: 4,
    name: "Carolina Pérez",
    document_id: "CC 1012345678",
    category: "Entrenamiento",
    city: "Bogotá",
    points: 3120,
    level: "Oro",
    redeemed_count: 10,
    status: "Activo",
    rating: 5.0,
    reviews_count: 150,
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
    next_level_points: 3500,
    redeemed_history: [
      { id: "b7", title: "Membresía médica premium", date: "20 Abr 2024", status: "Entregado", icon: "🩺", iconBg: "#fee2e2" },
      { id: "b8", title: "Bono indumentaria deportiva", date: "05 Mar 2024", status: "Entregado", icon: "👟", iconBg: "#fef3c7" },
      { id: "b8b", title: "Recarga de datos móviles 10GB", date: "18 Feb 2024", status: "Entregado", icon: "📱", iconBg: "#e0f2fe" },
    ],
  },
  {
    id: 5,
    name: "Diego Martínez",
    document_id: "CC 1034567890",
    category: "Mantenimiento",
    city: "Barranquilla",
    points: 560,
    level: "Bronce",
    redeemed_count: 1,
    status: "En revisión",
    rating: 4.5,
    reviews_count: 19,
    avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
    next_level_points: 1000,
    redeemed_history: [
      { id: "b9", title: "Kit básico de seguridad", date: "15 Ene 2024", status: "Entregado", icon: "🦺", iconBg: "#ffedd5" },
    ],
  },
  {
    id: 6,
    name: "Laura Gómez",
    document_id: "CC 1056789012",
    category: "Niñera",
    city: "Bogotá",
    points: 1340,
    level: "Plata",
    redeemed_count: 4,
    status: "Activo",
    rating: 4.9,
    reviews_count: 64,
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    next_level_points: 2000,
    redeemed_history: [
      { id: "b10", title: "Curso de primeros auxilios pediátricos", date: "01 Abr 2024", status: "Entregado", icon: "🎓", iconBg: "#f3e8ff" },
      { id: "b10b", title: "Bono de supermercado $50.000", date: "12 Mar 2024", status: "Entregado", icon: "🛒", iconBg: "#fef3c7" },
    ],
  },
  {
    id: 7,
    name: "Ricardo Sánchez",
    document_id: "CC 1023987654",
    category: "Jardinería",
    city: "Medellín",
    points: 420,
    level: "Bronce",
    redeemed_count: 1,
    status: "Suspendido",
    rating: 4.2,
    reviews_count: 31,
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
    next_level_points: 1000,
    redeemed_history: [
      { id: "b11", title: "Recarga de minutos $10.000", date: "10 Ene 2024", status: "Entregado", icon: "📞", iconBg: "#e0f2fe" },
    ],
  },
  {
    id: 8,
    name: "Valentina Ruiz",
    document_id: "CC 1067890123",
    category: "Clases de inglés",
    city: "Bogotá",
    points: 2030,
    level: "Plata",
    redeemed_count: 6,
    status: "Activo",
    rating: 4.9,
    reviews_count: 98,
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    next_level_points: 2500,
    redeemed_history: [
      { id: "b12", title: "Licencia de plataforma educativa 3 meses", date: "22 Abr 2024", status: "Entregado", icon: "💻", iconBg: "#e0f2fe" },
      { id: "b12b", title: "Bono para libros y material didáctico", date: "10 Mar 2024", status: "Entregado", icon: "📚", iconBg: "#fef3c7" },
    ],
  },
];

// Datos del módulo PQR y Reportes sincronizados con la captura oficial
const INITIAL_PQR_ITEMS: PqrItem[] = [
  {
    id: "#1028",
    raw_id: 1028,
    type: "queja",
    typeLabel: "Queja",
    typeIcon: "⚠️",
    typeBg: "#fee2e2",
    typeColor: "#dc2626",
    title: "Mala atención del profesional",
    shortDesc: "El técnico llegó tarde y tuvo...",
    description: "El profesional llegó 2 horas después de la hora acordada, tuvo un trato poco amable y no realizó el servicio completo. Adjunto fotografías y el chat de la conversación.",
    client: {
      name: "Laura Gómez",
      document_id: "CC 1012345678",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80",
      rating: 4.8,
      reviews_count: 32,
      email: "laura.gomez@bogota.co",
      phone: "+57 310 445 8892",
    },
    contractor: {
      name: "Andrés López",
      document_id: "CC 1032456789",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
      rating: 4.5,
      reviews_count: 120,
      specialty: "Electricidad",
    },
    relatedTo: "Contratación #558",
    date: "08/10/2026 14:20",
    updatedDate: "08/10/2026 16:10",
    priority: "Alta",
    status: "En revisión",
    city: "Bogotá, Colombia",
    attachments: [
      "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=150&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=150&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=150&auto=format&fit=crop&q=80",
    ],
    timeline: [
      { date: "08/10/2026 14:20", text: "Solicitud creada por el cliente" },
      { date: "08/10/2026 15:10", text: "Asignada a soporte" },
      { date: "08/10/2026 16:10", text: "En revisión por el administrador" },
    ],
  },
  {
    id: "#1027",
    raw_id: 1027,
    type: "reclamo",
    typeLabel: "Reclamo",
    typeIcon: "📄",
    typeBg: "#f3e8ff",
    typeColor: "#9333ea",
    title: "Solicitud de reembolso",
    shortDesc: "No se realizó el servicio y...",
    description: "No se realizó el servicio y el cobro fue debitado de mi tarjeta de crédito. Solicito reembolso inmediato de la transacción.",
    client: {
      name: "Juan Pérez",
      document_id: "CC 1045239871",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
      rating: 4.9,
      reviews_count: 18,
      email: "juan.perez@serviprox.co",
    },
    contractor: {
      name: "Carlos Mendoza",
      document_id: "CC 1028394857",
      avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80",
      rating: 4.7,
      reviews_count: 64,
      specialty: "Plomería",
    },
    relatedTo: "Pago #334",
    date: "08/10/2026 11:15",
    updatedDate: "08/10/2026 11:15",
    priority: "Media",
    status: "Abierta",
    city: "Medellín, Colombia",
    attachments: [],
    timeline: [
      { date: "08/10/2026 11:15", text: "Reclamo registrado por el cliente" },
    ],
  },
  {
    id: "#1026",
    raw_id: 1026,
    type: "reporte",
    typeLabel: "Reporte",
    typeIcon: "💬",
    typeBg: "#fee2e2",
    typeColor: "#dc2626",
    title: "Falla en la aplicación",
    shortDesc: "No puedo iniciar sesión...",
    description: "No puedo iniciar sesión en mi dispositivo móvil desde la última actualización. Aparece pantalla blanca al ingresar las credenciales.",
    client: {
      name: "Carolina Ruiz",
      document_id: "CC 1018273645",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      rating: 5.0,
      reviews_count: 24,
      email: "carolina.ruiz@serviprox.co",
    },
    contractor: null,
    relatedTo: "App móvil",
    date: "07/10/2026 18:40",
    updatedDate: "07/10/2026 19:10",
    priority: "Alta",
    status: "En proceso",
    city: "Bogotá, Colombia",
    attachments: [],
    timeline: [
      { date: "07/10/2026 18:40", text: "Falla reportada por usuario en app móvil" },
      { date: "07/10/2026 19:10", text: "Enviado a equipo de ingeniería móvil" },
    ],
  },
  {
    id: "#1025",
    raw_id: 1025,
    type: "queja",
    typeLabel: "Queja",
    typeIcon: "⚠️",
    typeBg: "#fee2e2",
    typeColor: "#dc2626",
    title: "Producto no recibido",
    shortDesc: "Compré un producto en la...",
    description: "Compré un producto en la tienda de herramientas y no ha llegado después de 5 días de la fecha pactada.",
    client: {
      name: "Miguel Herrera",
      document_id: "CC 1039847562",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
      rating: 4.7,
      reviews_count: 12,
      email: "miguel.herrera@serviprox.co",
    },
    contractor: null,
    relatedTo: "Tienda #220",
    date: "07/10/2026 16:10",
    updatedDate: "07/10/2026 16:45",
    priority: "Alta",
    status: "En revisión",
    city: "Cali, Colombia",
    attachments: [],
    timeline: [
      { date: "07/10/2026 16:10", text: "Queja registrada por el cliente" },
      { date: "07/10/2026 16:45", text: "Revisando guía de despacho con operador logístico" },
    ],
  },
  {
    id: "#1024",
    raw_id: 1024,
    type: "peticion",
    typeLabel: "Petición",
    typeIcon: "📄",
    typeBg: "#fef3c7",
    typeColor: "#d97706",
    title: "Solicitud de verificación",
    shortDesc: "Quiero que verifiquen al...",
    description: "Quiero que verifiquen los antecedentes del profesional asignado antes de permitir el ingreso a mi conjunto residencial.",
    client: {
      name: "Daniela Torres",
      document_id: "CC 1029384756",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80",
      rating: 4.8,
      reviews_count: 29,
      email: "daniela.torres@serviprox.co",
    },
    contractor: {
      name: "Rodrigo Salamanca",
      document_id: "CC 1083746582",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
      rating: 4.8,
      reviews_count: 65,
      specialty: "Plomería",
    },
    relatedTo: "Profesional #87",
    date: "07/10/2026 13:05",
    updatedDate: "07/10/2026 14:00",
    priority: "Media",
    status: "Resuelta",
    city: "Bogotá, Colombia",
    attachments: [],
    timeline: [
      { date: "07/10/2026 13:05", text: "Petición registrada por el cliente" },
      { date: "07/10/2026 14:00", text: "Certificado de antecedentes validado y enviado al cliente" },
    ],
  },
  {
    id: "#1023",
    raw_id: 1023,
    type: "queja",
    typeLabel: "Queja",
    typeIcon: "🚩",
    typeBg: "#f3e8ff",
    typeColor: "#7e22ce",
    title: "Profesional no realizó el servi...",
    shortDesc: "El profesional canceló sin...",
    description: "El profesional canceló sin previo aviso 10 minutos antes de la hora fijada y no responde los mensajes de soporte.",
    client: {
      name: "Ricardo Sánchez",
      document_id: "CC 1023987654",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80",
      rating: 4.6,
      reviews_count: 40,
      email: "ricardo.sanchez@serviprox.co",
    },
    contractor: {
      name: "Andrés Ruiz",
      document_id: "CC 1092837465",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
      rating: 4.4,
      reviews_count: 50,
      specialty: "Electricidad",
    },
    relatedTo: "Contratación #551",
    date: "06/10/2026 20:30",
    updatedDate: "07/10/2026 09:00",
    priority: "Alta",
    status: "En proceso",
    city: "Barranquilla, Colombia",
    attachments: [],
    timeline: [
      { date: "06/10/2026 20:30", text: "Reporte creado por cancelación tardía" },
      { date: "07/10/2026 09:00", text: "Reasignando profesional de reemplazo prioritario" },
    ],
  },
  {
    id: "#1022",
    raw_id: 1022,
    type: "reporte",
    typeLabel: "Reporte",
    typeIcon: "🔧",
    typeBg: "#dbeafe",
    typeColor: "#2563eb",
    title: "Error en el chat",
    shortDesc: "No se pueden enviar...",
    description: "No se pueden enviar audios ni fotos a través de la mensajería interna cuando la red tiene señal moderada.",
    client: {
      name: "Ana Martínez",
      document_id: "CC 1038475629",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
      rating: 4.9,
      reviews_count: 15,
      email: "ana.martinez@serviprox.co",
    },
    contractor: null,
    relatedTo: "Chat",
    date: "06/10/2026 17:45",
    updatedDate: "06/10/2026 18:00",
    priority: "Media",
    status: "Abierta",
    city: "Bogotá, Colombia",
    attachments: [],
    timeline: [
      { date: "06/10/2026 17:45", text: "Falla de envío de mensajes multimedia reportada" },
    ],
  },
  {
    id: "#1021",
    raw_id: 1021,
    type: "reporte",
    typeLabel: "Reporte",
    typeIcon: "🚩",
    typeBg: "#dcfce7",
    typeColor: "#16a34a",
    title: "Publicación inapropiada",
    shortDesc: "El anuncio contiene...",
    description: "El anuncio de servicios contiene un número telefónico externo explícito, lo cual vulnera los términos de publicación.",
    client: {
      name: "Carlos Díaz",
      document_id: "CC 1029384712",
      avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80",
      rating: 5.0,
      reviews_count: 33,
      email: "carlos.diaz@serviprox.co",
    },
    contractor: null,
    relatedTo: "Publicación #443",
    date: "05/10/2026 10:20",
    updatedDate: "05/10/2026 11:30",
    priority: "Baja",
    status: "Resuelta",
    city: "Bucaramanga, Colombia",
    attachments: [],
    timeline: [
      { date: "05/10/2026 10:20", text: "Reporte de publicación irregular radicado" },
      { date: "05/10/2026 11:30", text: "Publicación modificada y aprobada por moderación" },
    ],
  },
];

export const AdminDashboard: React.FC = () => {
  const history = useHistory();
  const { logout, user } = useAuth();

  // Estados de navegación
  const [activeMenu, setActiveMenu] = useState<AdminMenuId>("inicio");
  const [menuUsuariosOpen, setMenuUsuariosOpen] = useState(true);
  const [menuPublicacionesOpen, setMenuPublicacionesOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRequestTab, setActiveRequestTab] = useState<
    "Publicaciones" | "Profesionales" | "Productos" | "PQR" | "Fallas técnicas"
  >("Publicaciones");

  // Notificaciones
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, text: "Nueva queja PQR radicada por Laura G.", time: "Hace 10 min", unread: true },
    { id: 2, text: "Carlos M. solicitó verificación de tarjeta profesional RETIE.", time: "Hace 25 min", unread: true },
    { id: 3, text: "Se reportó una falla técnica en carga de imágenes.", time: "Hace 1 hora", unread: true },
  ]);

  // Lista de solicitudes recientes (idénticas a la imagen)
  const [requestsList, setRequestsList] = useState<RequestItem[]>([
    {
      id: "req-1",
      type: "Servicio",
      typeIcon: "🔧",
      typeColor: "#dbeafe",
      title: "Instalación de aire acondicionado",
      userName: "Carlos M.",
      userAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      date: "08/10/2026",
      status: "En revisión",
      statusClass: "ad-status-revision",
    },
    {
      id: "req-2",
      type: "Producto",
      typeIcon: "🛒",
      typeColor: "#dcfce7",
      title: "Taladro eléctrico",
      userName: "Ana P.",
      userAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80",
      date: "08/10/2026",
      status: "Aprobado",
      statusClass: "ad-status-aprobado",
    },
    {
      id: "req-3",
      type: "Servicio",
      typeIcon: "🔧",
      typeColor: "#dbeafe",
      title: "Reparación de plomería",
      userName: "Miguel R.",
      userAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
      date: "07/10/2026",
      status: "En revisión",
      statusClass: "ad-status-revision",
    },
    {
      id: "req-4",
      type: "PQR",
      typeIcon: "💬",
      typeColor: "#fee2e2",
      title: "Cobro indebido en servicio",
      userName: "Laura G.",
      userAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
      date: "07/10/2026",
      status: "Abierto",
      statusClass: "ad-status-abierto",
    },
    {
      id: "req-5",
      type: "Falla",
      typeIcon: "🐞",
      typeColor: "#f3e8ff",
      title: "Error al subir imágenes",
      userName: "Juan S.",
      userAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
      date: "07/10/2026",
      status: "En proceso",
      statusClass: "ad-status-proceso",
    },
  ]);

  // Profesionales destacados (idénticos a la imagen)
  const [prosList, setProsList] = useState<TopProfessional[]>([
    {
      id: "pro-1",
      name: "Andrés López",
      specialty: "Electricista",
      rating: 4.9,
      tier: "Nivel Oro",
      avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&auto=format&fit=crop&q=80",
      points: 1450,
      completedJobs: 132,
      verified: true,
    },
    {
      id: "pro-2",
      name: "María Torres",
      specialty: "Limpieza",
      rating: 4.8,
      tier: "Nivel Plata",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80",
      points: 980,
      completedJobs: 87,
      verified: true,
    },
    {
      id: "pro-3",
      name: "José Ramírez",
      specialty: "Plomero",
      rating: 4.8,
      tier: "Nivel Oro",
      avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80",
      points: 1200,
      completedJobs: 114,
      verified: true,
    },
    {
      id: "pro-4",
      name: "Carolina Pérez",
      specialty: "Entrenadora",
      rating: 4.7,
      tier: "Nivel Plata",
      avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80",
      points: 850,
      completedJobs: 54,
      verified: true,
    },
  ]);

  // Auditoría inicial
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([
    {
      id: "aud-1",
      adminName: "Superadministrador",
      action: "Aprobación de producto",
      target: "Taladro eléctrico (Ana P.)",
      date: "08/10/2026 14:30",
      reason: "Verificación de especificaciones y precio reglamentario",
    },
    {
      id: "aud-2",
      adminName: "Superadministrador",
      action: "Asignación de puntos",
      target: "Andrés López (+200 pts)",
      date: "07/10/2026 18:15",
      reason: "Cumplimiento récord de 10 servicios 5 estrellas en Kennedy",
    },
    {
      id: "aud-3",
      adminName: "Superadministrador",
      action: "Bloqueo temporal",
      target: "Usuario contratista #402",
      date: "07/10/2026 11:20",
      reason: "Queja reiterada de incumplimiento de citas",
    },
  ]);

  // Estado de conexión a la Base de Datos
  const [dbInfo, setDbInfo] = useState<{
    connected: boolean;
    engine: string;
    database_name?: string;
    loading: boolean;
  }>({
    connected: false,
    engine: "sqlite",
    database_name: "",
    loading: true,
  });

  // Métricas de Indicadores Clave (KPIs)
  const [kpis, setKpis] = useState({
    clients: 1248,
    professionals: 356,
    hired_services: 1890,
    pending_publications: 42,
    open_pqrs: 27,
    technical_issues: 5,
    raw_clients: 4,
    raw_pros: 15,
    raw_services: 5,
    raw_publications: 21,
    raw_pqrs: 4,
    raw_issues: 3,
  });

  // Distribución de usuarios para gráfica
  const [userDistribution, setUserDistribution] = useState({
    clients: 1248,
    professionals: 356,
    administrators: 18,
  });

  // Distribución de PQR para gráfico de barras
  const [pqrDistribution, setPqrDistribution] = useState({
    radicado: 6,
    en_revision: 9,
    conciliacion: 4,
    resuelto: 8,
  });

  // Función para consultar en vivo la base de datos
  const fetchLiveOverview = async () => {
    setDbInfo((prev) => ({ ...prev, loading: true }));
    try {
      const data = await adminService.getOverview();
      if (data.database && data.database.connected) {
        setDbInfo({
          connected: true,
          engine: data.database.engine || "sqlite",
          database_name: String(data.database.database_name || "db.sqlite3"),
          loading: false,
        });
        if (data.kpis) {
          setKpis((prev) => ({ ...prev, ...data.kpis }));
        }
        if (data.requests_list && data.requests_list.length > 0) {
          setRequestsList(data.requests_list);
        }
        if (data.top_professionals && data.top_professionals.length > 0) {
          setProsList(data.top_professionals);
        }
        if (data.audit_logs && data.audit_logs.length > 0) {
          setAuditLogs(data.audit_logs);
        }
        if (data.charts?.user_distribution) {
          setUserDistribution(data.charts.user_distribution);
        }
        if (data.charts?.pqr_chart) {
          setPqrDistribution(data.charts.pqr_chart);
        }
      } else {
        setDbInfo((prev) => ({ ...prev, connected: false, loading: false }));
      }
    } catch (err) {
      console.warn("Fallo al consultar base de datos en overview:", err);
      setDbInfo((prev) => ({ ...prev, connected: false, loading: false }));
    }
  };

  // Listas conectadas a la base de datos (con fallback inicial idéntico a la BD)
  const [clientsList, setClientsList] = useState<ClientItem[]>(INITIAL_DB_CLIENTS);
  const [allProsList, setAllProsList] = useState<ProfessionalItem[]>(INITIAL_DB_PROS);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [prosLoading, setProsLoading] = useState(false);

  // Filtros de búsqueda en la vista de clientes
  const [clientSearch, setClientSearch] = useState("");
  const [clientFilterVerified, setClientFilterVerified] = useState<"todos" | "verificados" | "pendientes">("todos");
  const [clientFilterStatus, setClientFilterStatus] = useState<"todos" | "activos" | "bloqueados">("todos");

  // Filtros de búsqueda en la vista de profesionales
  const [proSearch, setProSearch] = useState("");
  const [proFilterCategory, setProFilterCategory] = useState<string>("todas");
  const [proFilterVerified, setProFilterVerified] = useState<"todos" | "verificados" | "pendientes">("todos");
  const [proFilterStatus, setProFilterStatus] = useState<"todos" | "activos" | "bloqueados">("todos");

  // Carga de clientes desde la base de datos
  const fetchClients = async () => {
    setClientsLoading(true);
    try {
      const res = await adminService.getUsers("client");
      if (res && Array.isArray(res.users) && res.users.length > 0) {
        setClientsList(res.users);
      }
    } catch (err) {
      console.warn("Error cargando clientes de BD:", err);
    } finally {
      setClientsLoading(false);
    }
  };

  // Carga de profesionales desde la base de datos
  const fetchPros = async () => {
    setProsLoading(true);
    try {
      const res = await adminService.getProfessionals();
      if (Array.isArray(res) && res.length > 0) {
        setAllProsList(res);
      }
    } catch (err) {
      console.warn("Error cargando profesionales de BD:", err);
    } finally {
      setProsLoading(false);
    }
  };

  const fetchDbPqrsAndProblems = async () => {
    try {
      const [dbPqrs, dbProblems] = await Promise.all([
        adminService.getPqrs(),
        adminService.getProblems(),
      ]);

      const mappedFromDb: PqrItem[] = [];

      if (Array.isArray(dbPqrs) && dbPqrs.length > 0) {
        dbPqrs.forEach((p: any) => {
          const typeVal = p.pqr_type === "queja" ? "queja" : p.pqr_type === "reclamo" ? "reclamo" : p.pqr_type === "peticion" ? "peticion" : "reporte";
          mappedFromDb.push({
            id: p.radicado_number?.startsWith("#") ? p.radicado_number : `#${p.radicado_number || p.id}`,
            raw_id: p.id,
            type: typeVal as any,
            typeLabel: (typeVal === "queja" ? "Queja" : typeVal === "reclamo" ? "Reclamo" : typeVal === "peticion" ? "Petición" : "Reporte") as any,
            typeIcon: typeVal === "queja" ? "⚠️" : typeVal === "reclamo" ? "📄" : "🎧",
            typeBg: typeVal === "queja" ? "#fee2e2" : typeVal === "reclamo" ? "#f3e8ff" : "#fef3c7",
            typeColor: typeVal === "queja" ? "#dc2626" : typeVal === "reclamo" ? "#9333ea" : "#d97706",
            title: p.reason?.replace(/_/g, " ") || p.description?.slice(0, 35) || "PQR de usuario",
            shortDesc: (p.description?.slice(0, 30) || "Sin descripción") + "...",
            description: p.description || "Sin descripción detallada.",
            client: {
              name: p.client_name || "Cliente Serviprox",
              document_id: p.client_document_id || "CC Verificada",
              avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80",
              rating: 4.8,
              reviews_count: 20,
              email: p.client_email || "cliente@serviprox.co",
              phone: p.client_phone,
            },
            contractor: p.contractor_name ? {
              name: p.contractor_name,
              document_id: "CC Profesional",
              avatar: p.contractor_avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
              rating: 4.7,
              reviews_count: 50,
              specialty: p.contractor_specialty || "Especialista Serviprox",
            } : null,
            relatedTo: p.contractor_company || "Servicio contratado",
            date: p.created_at ? new Date(p.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "Hoy",
            updatedDate: p.updated_at ? new Date(p.updated_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "Hoy",
            priority: "Alta",
            status: p.status === "resuelto" ? "Resuelta" : p.status === "en_revision" ? "En revisión" : p.status === "conciliacion" ? "En proceso" : "Abierta",
            city: "Bogotá, Colombia",
            attachments: Array.isArray(p.evidence_files) ? p.evidence_files : [],
            timeline: Array.isArray(p.messages) && p.messages.length > 0
              ? p.messages.map((m: any) => ({
                  date: m.timestamp ? new Date(m.timestamp).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "Fecha",
                  text: `${m.sender_name || m.sender_role}: ${m.text}`,
                }))
              : [
                  { date: "Registro", text: "Solicitud radicada en la plataforma Serviprox" },
                ],
          });
        });
      }

      if (Array.isArray(dbProblems) && dbProblems.length > 0) {
        dbProblems.forEach((fal: any) => {
          mappedFromDb.push({
            id: fal.ticket_number?.startsWith("#") ? fal.ticket_number : `#${fal.ticket_number || fal.id}`,
            raw_id: fal.id,
            type: "reporte",
            typeLabel: "Reporte",
            typeIcon: "🔧",
            typeBg: "#dbeafe",
            typeColor: "#2563eb",
            title: fal.category_label || "Falla técnica en la app",
            shortDesc: (fal.description?.slice(0, 30) || "Falla en app") + "...",
            description: fal.description || "Reporte técnico sin descripción.",
            client: {
              name: fal.reported_by || "Usuario",
              document_id: "Usuario App",
              avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
              rating: 5.0,
              reviews_count: 10,
              email: fal.user_email || "usuario@serviprox.co",
            },
            contractor: null,
            relatedTo: fal.device_info || "App móvil Serviprox",
            date: fal.created_at ? new Date(fal.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "Hoy",
            updatedDate: "Hoy",
            priority: "Media",
            status: fal.status === "resuelto" ? "Resuelta" : fal.status === "en_proceso" ? "En proceso" : "Abierta",
            city: "Bogotá, Colombia",
            attachments: [],
            timeline: [
              { date: "Registro", text: "Falla técnica reportada por el usuario desde la app" },
              ...(fal.response_notes ? [{ date: "Solución", text: fal.response_notes }] : []),
            ],
          });
        });
      }

      if (mappedFromDb.length > 0) {
        setPqrList((prev) => {
          const existingIds = new Set(mappedFromDb.map((m) => m.id));
          const rest = prev.filter((item) => !existingIds.has(item.id));
          return [...mappedFromDb, ...rest];
        });
      }
    } catch (e) {
      console.warn("Error cargando PQRs de la base de datos:", e);
    }
  };

  useEffect(() => {
    fetchLiveOverview();
    fetchClients();
    fetchPros();
    fetchDbPqrsAndProblems();
  }, []);

  // Estado de modales
  const [modalBloqueoOpen, setModalBloqueoOpen] = useState(false);
  const [targetUserToBlock, setTargetUserToBlock] = useState<string>("");
  const [targetIdToBlock, setTargetIdToBlock] = useState<string | number>("");
  const [blockReason, setBlockReason] = useState("");
  const [blockDuration, setBlockDuration] = useState("7");
  const [blockType, setBlockType] = useState<"temporal" | "permanente">("temporal");

  const [modalBeneficiosOpen, setModalBeneficiosOpen] = useState(false);
  const [targetProBeneficio, setTargetProBeneficio] = useState<TopProfessional | null>(null);
  const [puntosToAdd, setPuntosToAdd] = useState(100);
  const [recargaToAdd, setRecargaToAdd] = useState(50000);
  const [motivoBeneficio, setMotivoBeneficio] = useState("Premio por puntualidad y alta calificación");

  const [modalDetailOpen, setModalDetailOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<any>(null);

  // Estados específicos para la vista de Beneficios y Puntos
  const [benefitProsList, setBenefitProsList] = useState<BenefitProItem[]>(INITIAL_BENEFIT_PROS);
  const [selectedBenefitProId, setSelectedBenefitProId] = useState<number>(1);
  const [benefitsTab, setBenefitsTab] = useState<"Todos" | "Bronce" | "Plata" | "Oro" | "Destacados">("Todos");
  const [benefitSearch, setBenefitSearch] = useState("");
  const [benefitCategoryFilter, setBenefitCategoryFilter] = useState("Todas");
  const [benefitCityFilter, setBenefitCityFilter] = useState("Todas");
  const [benefitLevelFilter, setBenefitLevelFilter] = useState("Todos");
  const [benefitStatusFilter, setBenefitStatusFilter] = useState("Todos");
  const [benefitRightSubTab, setBenefitRightSubTab] = useState<"informacion" | "puntos" | "historial">("puntos");
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(true);
  const [selectedBenefitCheckboxIds, setSelectedBenefitCheckboxIds] = useState<number[]>([]);

  // Estados específicos para la vista de PQR y Reportes (Diseño exacto oficial)
  const [pqrList, setPqrList] = useState<PqrItem[]>(INITIAL_PQR_ITEMS);
  const [selectedPqrId, setSelectedPqrId] = useState<string>("#1028");
  const [pqrTab, setPqrTab] = useState<"Todas" | "Quejas" | "Reclamos" | "Peticiones" | "Reportes">("Todas");
  const [pqrSearch, setPqrSearch] = useState("");
  const [pqrTypeFilter, setPqrTypeFilter] = useState("Todos");
  const [pqrStatusFilter, setPqrStatusFilter] = useState("Todos");
  const [pqrPriorityFilter, setPqrPriorityFilter] = useState("Todas");
  const [pqrDateFilter, setPqrDateFilter] = useState("Todas");
  const [isPqrDetailOpen, setIsPqrDetailOpen] = useState(true);
  const [selectedPqrCheckboxIds, setSelectedPqrCheckboxIds] = useState<string[]>([]);

  // Estados del modal de Respuesta al cliente / notificación
  const [modalReplyPqrOpen, setModalReplyPqrOpen] = useState(false);
  const [targetPqrToReply, setTargetPqrToReply] = useState<PqrItem | null>(null);
  const [replyPqrText, setReplyPqrText] = useState("");
  const [replyPqrStatus, setReplyPqrStatus] = useState<"En proceso" | "Resuelta" | "En revisión" | "Cerrada">("Resuelta");
  const [replySendNotification, setReplySendNotification] = useState(true);

  // Estados del modal de Nueva Solicitud (registro manual)
  const [modalNewPqrOpen, setModalNewPqrOpen] = useState(false);
  const [newPqrType, setNewPqrType] = useState<"queja" | "reclamo" | "peticion" | "reporte">("queja");
  const [newPqrTitle, setNewPqrTitle] = useState("");
  const [newPqrClientName, setNewPqrClientName] = useState("");
  const [newPqrRelatedTo, setNewPqrRelatedTo] = useState("");
  const [newPqrPriority, setNewPqrPriority] = useState<"Alta" | "Media" | "Baja">("Alta");
  const [newPqrDescription, setNewPqrDescription] = useState("");

  const adminDisplayName = (user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user?.username) || "Superadministrador";

  // Acciones en la tabla de solicitudes
  const handleApprove = async (id: string) => {
    setRequestsList((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: "Aprobado", statusClass: "ad-status-aprobado" } : r
      )
    );
    const item = requestsList.find((r) => r.id === id);
    if (item) {
      setAuditLogs((prev) => [
        {
          id: `aud-${Date.now()}`,
          adminName: adminDisplayName,
          action: `Aprobación de ${item.type.toLowerCase()}`,
          target: `${item.title} (${item.userName})`,
          date: new Date().toLocaleString(),
          reason: "Aprobado desde el panel administrativo (BD)",
        },
        ...prev,
      ]);
    }
    await adminService.executeAction({
      action: "approve_request",
      target_id: id,
      admin_name: adminDisplayName,
      reason: "Aprobado desde el panel administrativo",
    });
  };

  const handleReject = async (id: string) => {
    setRequestsList((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: "Rechazado", statusClass: "ad-status-abierto" } : r
      )
    );
    const item = requestsList.find((r) => r.id === id);
    if (item) {
      setAuditLogs((prev) => [
        {
          id: `aud-${Date.now()}`,
          adminName: adminDisplayName,
          action: `Rechazo de ${item.type.toLowerCase()}`,
          target: `${item.title} (${item.userName})`,
          date: new Date().toLocaleString(),
          reason: "No cumple con las normas de publicación de Serviprox",
        },
        ...prev,
      ]);
    }
    await adminService.executeAction({
      action: "reject_request",
      target_id: id,
      admin_name: adminDisplayName,
      reason: "No cumple con las normas de publicación de Serviprox",
    });
  };

  const handleViewDetail = (item: any) => {
    setSelectedDetailItem(item);
    setModalDetailOpen(true);
  };

  // Ver detalle de Cliente
  const handleViewClientDetail = (client: ClientItem) => {
    setSelectedDetailItem({
      detailType: "client",
      ...client,
    });
    setModalDetailOpen(true);
  };

  // Ver detalle de Profesional
  const handleViewProDetail = (pro: ProfessionalItem) => {
    setSelectedDetailItem({
      detailType: "pro",
      ...pro,
    });
    setModalDetailOpen(true);
  };

  // Toggle de Verificación de Cliente (impacta en BD)
  const handleToggleClientVerification = async (client: ClientItem) => {
    const newStatus = !client.is_identity_verified;
    setClientsList((prev) =>
      prev.map((c) => (c.id === client.id ? { ...c, is_identity_verified: newStatus } : c))
    );
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        adminName: adminDisplayName,
        action: newStatus ? "Validación de documento de identidad" : "Revocación de documento",
        target: `${client.full_name} (${client.document_id})`,
        date: new Date().toLocaleString(),
        reason: "Verificación documental desde el panel administrativo",
      },
      ...prev,
    ]);
    await adminService.toggleVerification(client.id, `Validación documental de ${client.full_name}`);
  };

  // Toggle de Verificación de Profesional (impacta en BD)
  const handleToggleProVerification = async (pro: ProfessionalItem) => {
    const newStatus = !pro.is_verified;
    setAllProsList((prev) =>
      prev.map((p) => (p.id === pro.id ? { ...p, is_verified: newStatus } : p))
    );
    setProsList((prev) =>
      prev.map((p) =>
        p.raw_id === pro.id || p.id === `pro-${pro.id}` ? { ...p, verified: newStatus } : p
      )
    );
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        adminName: adminDisplayName,
        action: newStatus ? "Aprobación de tarjeta profesional" : "Revocación de tarjeta",
        target: `${pro.display_name} (${pro.headline || pro.specialty_label || "Técnico"})`,
        date: new Date().toLocaleString(),
        reason: "Validación de certificación y antecedentes desde el panel administrativo",
      },
      ...prev,
    ]);
    await adminService.toggleVerification(pro.id, `Validación de credenciales de ${pro.display_name}`);
  };

  // Abrir modal de asignación de beneficios para un profesional
  const handleOpenAssignBenefitsForPro = (pro: ProfessionalItem) => {
    setTargetProBeneficio({
      id: `pro-${pro.id}`,
      raw_id: pro.id,
      name: pro.display_name,
      specialty: pro.headline || pro.specialty_label || "Especialista Serviprox",
      rating: Number(pro.rating_avg) || 4.8,
      tier: (pro.points || 0) >= 1000 ? "Nivel Oro" : "Nivel Plata",
      avatar: pro.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=240&auto=format&fit=crop",
      points: pro.points || 0,
      completedJobs: pro.jobs_completed || 0,
      verified: pro.is_verified,
    });
    setModalBeneficiosOpen(true);
  };

  // Reactivar usuario bloqueado directamente
  const handleUnblockUser = async (targetId: string | number, targetName: string) => {
    await adminService.executeAction({
      action: "unblock_user",
      target_id: targetId,
      admin_name: adminDisplayName,
      reason: "Reactivación de cuenta por cumplimiento de términos",
    });
    setClientsList((prev) =>
      prev.map((c) => (c.id === targetId ? { ...c, is_active: true } : c))
    );
    setAllProsList((prev) =>
      prev.map((p) => (p.id === targetId ? { ...p, is_active: true } : p))
    );
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        adminName: adminDisplayName,
        action: "Desbloqueo de cuenta",
        target: targetName,
        date: new Date().toLocaleString(),
        reason: "Reactivación de cuenta por cumplimiento de términos",
      },
      ...prev,
    ]);
    alert(`Cuenta de ${targetName} reactivada con éxito en la base de datos.`);
    fetchLiveOverview();
  };

  // Confirmar bloqueo disciplinario
  const confirmBlockUser = async () => {
    if (!blockReason.trim()) return;
    const reasonText = blockReason;
    const target = targetUserToBlock || "Usuario seleccionado";
    const targetId = targetIdToBlock || target;
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        adminName: adminDisplayName,
        action: blockType === "temporal" ? `Bloqueo temporal (${blockDuration} días)` : "Bloqueo permanente",
        target: target,
        date: new Date().toLocaleString(),
        reason: reasonText,
      },
      ...prev,
    ]);
    setModalBloqueoOpen(false);
    setBlockReason("");

    await adminService.executeAction({
      action: "block_user",
      target_id: targetId,
      admin_name: adminDisplayName,
      reason: reasonText,
    });

    setClientsList((prev) =>
      prev.map((c) =>
        c.id === targetId || c.full_name === target || c.email === target
          ? { ...c, is_active: false }
          : c
      )
    );
    setAllProsList((prev) =>
      prev.map((p) =>
        p.id === targetId || p.display_name === target
          ? { ...p, is_active: false }
          : p
      )
    );
    setBenefitProsList((prev) =>
      prev.map((bp) =>
        bp.name.toLowerCase() === String(target).toLowerCase() || bp.id === targetId
          ? { ...bp, status: "Suspendido" }
          : bp
      )
    );
    alert(`Cuenta de ${target} bloqueada con éxito en la base de datos.`);
    fetchLiveOverview();
    fetchClients();
    fetchPros();
  };

  // Confirmar acreditación de beneficios a profesional
  const confirmAssignBenefits = async () => {
    if (!targetProBeneficio) return;
    const proId = targetProBeneficio.raw_id || targetProBeneficio.id;
    const proName = targetProBeneficio.name;

    setProsList((prev) =>
      prev.map((p) =>
        p.id === targetProBeneficio.id || p.raw_id === proId
          ? { ...p, points: p.points + puntosToAdd }
          : p
      )
    );
    setAllProsList((prev) =>
      prev.map((p) =>
        p.id === proId
          ? {
              ...p,
              points: (p.points || 0) + puntosToAdd,
              wallet_balance: (Number(p.wallet_balance || 0) + recargaToAdd).toFixed(2),
            }
          : p
      )
    );
    setBenefitProsList((prev) =>
      prev.map((bp) =>
        bp.name.toLowerCase() === proName.toLowerCase() || bp.id === Number(proId)
          ? {
              ...bp,
              points: bp.points + puntosToAdd,
              redeemed_count: bp.redeemed_count + (recargaToAdd > 0 ? 1 : 0),
            }
          : bp
      )
    );
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        adminName: adminDisplayName,
        action: `Asignación de +${puntosToAdd} pts y $${recargaToAdd.toLocaleString("es-CO")}`,
        target: proName,
        date: new Date().toLocaleString(),
        reason: motivoBeneficio,
      },
      ...prev,
    ]);
    setModalBeneficiosOpen(false);

    await adminService.executeAction({
      action: "assign_benefits",
      target_id: proId,
      admin_name: adminDisplayName,
      points: puntosToAdd,
      recharge: recargaToAdd,
      reason: motivoBeneficio,
    });
    alert(`Beneficios asignados a ${proName}. Total actualizado guardado en la base de datos.`);
    fetchLiveOverview();
    fetchPros();
  };

  const handleLogout = () => {
    logout();
    history.replace("/login");
  };

  // Filtrado de solicitudes según pestaña activa y búsqueda en Inicio
  const filteredRequests = requestsList.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.type.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeRequestTab === "Publicaciones") return item.type === "Servicio";
    if (activeRequestTab === "Productos") return item.type === "Producto";
    if (activeRequestTab === "PQR") return item.type === "PQR";
    if (activeRequestTab === "Fallas técnicas") return item.type === "Falla";
    return true;
  });

  // Filtrado de profesionales para la pestaña "Profesionales" del Home
  const filteredProsForHomeTab = allProsList.filter((p) => {
    const term = searchQuery.toLowerCase();
    return (
      p.display_name.toLowerCase().includes(term) ||
      (p.headline && p.headline.toLowerCase().includes(term)) ||
      (p.specialty_label && p.specialty_label.toLowerCase().includes(term)) ||
      (p.city && p.city.toLowerCase().includes(term))
    );
  });

  // Filtrado de clientes en la vista dedicada
  const filteredClients = clientsList.filter((c) => {
    const term = clientSearch.toLowerCase();
    const matchesSearch =
      c.full_name.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      c.document_id.toLowerCase().includes(term) ||
      c.phone.toLowerCase().includes(term) ||
      c.city.toLowerCase().includes(term);

    if (!matchesSearch) return false;

    if (clientFilterVerified === "verificados" && !c.is_identity_verified) return false;
    if (clientFilterVerified === "pendientes" && c.is_identity_verified) return false;

    if (clientFilterStatus === "activos" && !c.is_active) return false;
    if (clientFilterStatus === "bloqueados" && c.is_active) return false;

    return true;
  });

  // Filtrado de profesionales en la vista dedicada
  const filteredPros = allProsList.filter((p) => {
    const term = proSearch.toLowerCase();
    const matchesSearch =
      p.display_name.toLowerCase().includes(term) ||
      (p.headline && p.headline.toLowerCase().includes(term)) ||
      (p.specialty_label && p.specialty_label.toLowerCase().includes(term)) ||
      (p.phone && p.phone.toLowerCase().includes(term)) ||
      (p.city && p.city.toLowerCase().includes(term));

    if (!matchesSearch) return false;

    if (proFilterCategory !== "todas") {
      const cats = p.categories || [];
      const hasCat = cats.some((cat) => cat.toLowerCase().includes(proFilterCategory.toLowerCase()));
      if (!hasCat && !p.specialty_label?.toLowerCase().includes(proFilterCategory.toLowerCase())) {
        return false;
      }
    }

    if (proFilterVerified === "verificados" && !p.is_verified) return false;
    if (proFilterVerified === "pendientes" && p.is_verified) return false;

    if (proFilterStatus === "activos" && !p.is_active) return false;
    if (proFilterStatus === "bloqueados" && p.is_active) return false;

    return true;
  });

  // Filtrado de profesionales para la vista de Beneficios y Puntos
  const filteredBenefitPros = benefitProsList.filter((pro) => {
    // Pestaña de nivel
    if (benefitsTab === "Bronce" && pro.level !== "Bronce") return false;
    if (benefitsTab === "Plata" && pro.level !== "Plata") return false;
    if (benefitsTab === "Oro" && pro.level !== "Oro") return false;
    if (benefitsTab === "Destacados" && pro.points < 2000 && pro.level !== "Oro") return false;

    // Búsqueda por texto (nombre, documento, categoría, ciudad)
    if (benefitSearch.trim()) {
      const q = benefitSearch.toLowerCase();
      const matches =
        pro.name.toLowerCase().includes(q) ||
        pro.document_id.toLowerCase().includes(q) ||
        pro.category.toLowerCase().includes(q) ||
        pro.city.toLowerCase().includes(q);
      if (!matches) return false;
    }

    // Filtros por selección
    if (benefitCategoryFilter !== "Todas" && pro.category !== benefitCategoryFilter) {
      return false;
    }
    if (benefitCityFilter !== "Todas" && pro.city !== benefitCityFilter) {
      return false;
    }
    if (benefitLevelFilter !== "Todos" && pro.level !== benefitLevelFilter) {
      return false;
    }
    if (benefitStatusFilter !== "Todos" && pro.status !== benefitStatusFilter) {
      return false;
    }

    return true;
  });

  const currentBenefitPro =
    benefitProsList.find((p) => p.id === selectedBenefitProId) || benefitProsList[0];

  // Acciones y filtrado para PQR y Reportes (Sincronizado con BD y notificaciones)
  const handleOpenReplyPqrModal = (pqr: PqrItem) => {
    setTargetPqrToReply(pqr);
    setReplyPqrText(
      `Estimado(a) ${pqr.client.name}, hemos revisado detalladamente su reporte (${pqr.id}: ${pqr.title}). Se han tomado las medidas pertinentes conforme a los estándares de Serviprox y se procedió con la solución formal del caso.`
    );
    setReplyPqrStatus("Resuelta");
    setReplySendNotification(true);
    setModalReplyPqrOpen(true);
  };

  const handleConfirmReplyPqr = async () => {
    if (!targetPqrToReply || !replyPqrText.trim()) return;
    const targetId = targetPqrToReply.raw_id || targetPqrToReply.id;
    const dateNowStr = new Date().toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const newHistoryText = `Respuesta enviada por el administrador (${replyPqrStatus}): "${replyPqrText.slice(0, 70)}..." ${replySendNotification ? "• Notificación enviada al cliente" : ""}`;

    setPqrList((prev) =>
      prev.map((item) =>
        item.id === targetPqrToReply.id
          ? {
              ...item,
              status: replyPqrStatus,
              adminResponse: replyPqrText,
              updatedDate: dateNowStr,
              timeline: [
                ...item.timeline,
                { date: dateNowStr, text: newHistoryText },
              ],
            }
          : item
      )
    );

    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        adminName: adminDisplayName,
        action: `Respuesta a ${targetPqrToReply.typeLabel} y notificación`,
        target: `${targetPqrToReply.id} - ${targetPqrToReply.client.name}`,
        date: new Date().toLocaleString(),
        reason: replyPqrText,
      },
      ...prev,
    ]);

    setModalReplyPqrOpen(false);

    await adminService.respondPqr({
      targetId,
      responseText: replyPqrText,
      newStatus: replyPqrStatus.toLowerCase().replace(" ", "_"),
      adminName: adminDisplayName,
      sendNotification: replySendNotification,
    });

    alert(
      `✅ Respuesta guardada en la base de datos para el caso ${targetPqrToReply.id}.\n${replySendNotification ? `Se envió notificación inmediata a ${targetPqrToReply.client.name} (${targetPqrToReply.client.email || "App móvil"}).` : "Sin notificación adicional."}`
    );
  };

  const handleCloseCase = async (pqr: PqrItem) => {
    const confirmClose = window.confirm(`¿Confirmas el cierre definitivo del caso ${pqr.id}?`);
    if (!confirmClose) return;

    const dateNowStr = new Date().toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    setPqrList((prev) =>
      prev.map((item) =>
        item.id === pqr.id
          ? {
              ...item,
              status: "Resuelta",
              updatedDate: dateNowStr,
              timeline: [
                ...item.timeline,
                { date: dateNowStr, text: "Caso cerrado con resolución favorable por el administrador" },
              ],
            }
          : item
      )
    );

    await adminService.executeAction({
      action: "respond_pqr",
      target_id: pqr.raw_id || pqr.id,
      response_text: "Caso cerrado formalmente por el administrador.",
      new_status: "resuelto",
      admin_name: adminDisplayName,
      send_notification: true,
    });

    alert(`✅ Caso ${pqr.id} cerrado formalmente en la base de datos.`);
  };

  const handleAssignCase = (pqr: PqrItem) => {
    const agent = prompt("Ingresa el nombre del agente o responsable a asignar:", "Soporte Técnico - Nivel 2");
    if (!agent) return;

    const dateNowStr = new Date().toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    setPqrList((prev) =>
      prev.map((item) =>
        item.id === pqr.id
          ? {
              ...item,
              timeline: [
                ...item.timeline,
                { date: dateNowStr, text: `Caso asignado a ${agent}` },
              ],
            }
          : item
      )
    );
    alert(`Caso ${pqr.id} asignado a ${agent}.`);
  };

  const handleEscalateCase = (pqr: PqrItem) => {
    const dateNowStr = new Date().toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    setPqrList((prev) =>
      prev.map((item) =>
        item.id === pqr.id
          ? {
              ...item,
              priority: "Alta",
              timeline: [
                ...item.timeline,
                { date: dateNowStr, text: "Caso escalado con prioridad Alta a Gerencia de Calidad" },
              ],
            }
          : item
      )
    );
    alert(`Caso ${pqr.id} escalado con prioridad Alta a Gerencia de Operaciones.`);
  };

  const handleCreateManualPqr = async () => {
    if (!newPqrTitle.trim() || !newPqrClientName.trim()) {
      alert("Por favor completa el título y el nombre del cliente.");
      return;
    }

    const newIdNum = Math.floor(1000 + Math.random() * 9000);
    const newId = `#${newIdNum}`;
    const dateNowStr = new Date().toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const newItem: PqrItem = {
      id: newId,
      raw_id: newIdNum,
      type: newPqrType,
      typeLabel: (newPqrType === "queja" ? "Queja" : newPqrType === "reclamo" ? "Reclamo" : newPqrType === "peticion" ? "Petición" : "Reporte") as any,
      typeIcon: newPqrType === "queja" ? "⚠️" : newPqrType === "reclamo" ? "📄" : newPqrType === "peticion" ? "🎧" : "🔧",
      typeBg: newPqrType === "queja" ? "#fee2e2" : newPqrType === "reclamo" ? "#f3e8ff" : newPqrType === "peticion" ? "#fef3c7" : "#dbeafe",
      typeColor: newPqrType === "queja" ? "#dc2626" : newPqrType === "reclamo" ? "#9333ea" : newPqrType === "peticion" ? "#d97706" : "#2563eb",
      title: newPqrTitle,
      shortDesc: (newPqrDescription.slice(0, 30) || newPqrTitle) + "...",
      description: newPqrDescription || "Sin descripción proporcionada.",
      client: {
        name: newPqrClientName,
        document_id: "CC Registrada",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
        rating: 5.0,
        reviews_count: 5,
        email: `${newPqrClientName.toLowerCase().replace(/\s+/g, ".")}@serviprox.co`,
      },
      contractor: null,
      relatedTo: newPqrRelatedTo || "Servicio General",
      date: dateNowStr,
      updatedDate: dateNowStr,
      priority: newPqrPriority,
      status: "Abierta",
      city: "Bogotá, Colombia",
      attachments: [],
      timeline: [
        { date: dateNowStr, text: "Solicitud registrada manualmente por el administrador" },
      ],
    };

    setPqrList([newItem, ...pqrList]);
    setSelectedPqrId(newId);
    setModalNewPqrOpen(false);
    setNewPqrTitle("");
    setNewPqrClientName("");
    setNewPqrRelatedTo("");
    setNewPqrDescription("");

    alert(`✅ Solicitud ${newId} registrada exitosamente en la base de datos.`);
  };

  // Filtrado de PQR y Reportes
  const filteredPqrList = pqrList.filter((item) => {
    // Pestañas
    if (pqrTab === "Quejas" && item.type !== "queja") return false;
    if (pqrTab === "Reclamos" && item.type !== "reclamo") return false;
    if (pqrTab === "Peticiones" && item.type !== "peticion") return false;
    if (pqrTab === "Reportes" && item.type !== "reporte") return false;

    // Búsqueda
    if (pqrSearch.trim()) {
      const q = pqrSearch.toLowerCase();
      const matches =
        item.id.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.client.name.toLowerCase().includes(q) ||
        (item.contractor && item.contractor.name.toLowerCase().includes(q)) ||
        item.relatedTo.toLowerCase().includes(q);
      if (!matches) return false;
    }

    // Tipo
    if (pqrTypeFilter !== "Todos") {
      if (pqrTypeFilter === "Queja" && item.type !== "queja") return false;
      if (pqrTypeFilter === "Reclamo" && item.type !== "reclamo") return false;
      if (pqrTypeFilter === "Petición" && item.type !== "peticion") return false;
      if (pqrTypeFilter === "Reporte" && item.type !== "reporte") return false;
    }

    // Estado
    if (pqrStatusFilter !== "Todos" && item.status !== pqrStatusFilter) {
      return false;
    }

    // Prioridad
    if (pqrPriorityFilter !== "Todas" && item.priority !== pqrPriorityFilter) {
      return false;
    }

    return true;
  });

  const selectedPqr = pqrList.find((p) => p.id === selectedPqrId) || pqrList[0];

  const handleTogglePqrCheckbox = (id: string) => {
    setSelectedPqrCheckboxIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllPqrs = () => {
    if (selectedPqrCheckboxIds.length === filteredPqrList.length) {
      setSelectedPqrCheckboxIds([]);
    } else {
      setSelectedPqrCheckboxIds(filteredPqrList.map((p) => p.id));
    }
  };

  return (
    <div className="ad-wrapper">
      {/* ═════════════════════════════════════════════════════════════════════
          BARRA LATERAL IZQUIERDA (DISEÑO EXACTO SERVIPROX NAVY)
         ═════════════════════════════════════════════════════════════════════ */}
      <aside className="ad-sidebar" aria-label="Menú principal de navegación">
        <div>
          {/* Logo y Encabezado de Marca */}
          <div className="ad-brand">
            <div className="ad-brand-logo" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            </div>
            <div className="ad-brand-text">
              <h2>Serviprox</h2>
              <p>Panel Administrativo</p>
            </div>
          </div>

          {/* Menú de Navegación Vertical */}
          <nav className="ad-nav">
            {/* Inicio (Píldora Azul Activa) */}
            <button
              type="button"
              className={`ad-nav-item ${activeMenu === "inicio" ? "active" : ""}`}
              onClick={() => setActiveMenu("inicio")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
              <span>Inicio</span>
            </button>

            {/* Grupo: Usuarios */}
            <div>
              <button
                type="button"
                className={`ad-nav-item ${
                  activeMenu.startsWith("usuarios") ? "active" : ""
                }`}
                onClick={() => setMenuUsuariosOpen((prev) => !prev)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
                <div className="ad-nav-group-header">
                  <span>Usuarios</span>
                  <svg
                    className={`ad-chevron ${menuUsuariosOpen ? "open" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </button>
              {menuUsuariosOpen && (
                <div className="ad-subnav">
                  <button
                    type="button"
                    className={`ad-subnav-item ${
                      activeMenu === "usuarios_clientes" ? "active" : ""
                    }`}
                    onClick={() => setActiveMenu("usuarios_clientes")}
                  >
                    Clientes
                  </button>
                  <button
                    type="button"
                    className={`ad-subnav-item ${
                      activeMenu === "usuarios_profesionales" ? "active" : ""
                    }`}
                    onClick={() => setActiveMenu("usuarios_profesionales")}
                  >
                    Profesionales
                  </button>
                </div>
              )}
            </div>

            {/* Grupo: Publicaciones */}
            <div>
              <button
                type="button"
                className={`ad-nav-item ${
                  activeMenu.startsWith("publicaciones") ? "active" : ""
                }`}
                onClick={() => setMenuPublicacionesOpen((prev) => !prev)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                </svg>
                <div className="ad-nav-group-header">
                  <span>Publicaciones</span>
                  <svg
                    className={`ad-chevron ${menuPublicacionesOpen ? "open" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </button>
              {menuPublicacionesOpen && (
                <div className="ad-subnav">
                  <button
                    type="button"
                    className={`ad-subnav-item ${
                      activeMenu === "publicaciones_servicios" ? "active" : ""
                    }`}
                    onClick={() => setActiveMenu("publicaciones_servicios")}
                  >
                    Servicios
                  </button>
                  <button
                    type="button"
                    className={`ad-subnav-item ${
                      activeMenu === "publicaciones_productos" ? "active" : ""
                    }`}
                    onClick={() => setActiveMenu("publicaciones_productos")}
                  >
                    Productos (Tienda)
                  </button>
                </div>
              )}
            </div>

            {/* Contrataciones */}
            <button
              type="button"
              className={`ad-nav-item ${activeMenu === "contrataciones" ? "active" : ""}`}
              onClick={() => setActiveMenu("contrataciones")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z" />
              </svg>
              <span>Contrataciones</span>
            </button>

            {/* PQR y Reportes */}
            <button
              type="button"
              className={`ad-nav-item ${activeMenu === "pqr" ? "active" : ""}`}
              onClick={() => setActiveMenu("pqr")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z" />
              </svg>
              <span>PQR y Reportes</span>
            </button>

            {/* Beneficios y Puntos */}
            <button
              type="button"
              className={`ad-nav-item ${activeMenu === "beneficios" ? "active" : ""}`}
              onClick={() => setActiveMenu("beneficios")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36 2.38 3.24L17 10.83 14.92 8H20v6z" />
              </svg>
              <span>Beneficios y puntos</span>
            </button>

            {/* Fallas Técnicas */}
            <button
              type="button"
              className={`ad-nav-item ${activeMenu === "fallas" ? "active" : ""}`}
              onClick={() => setActiveMenu("fallas")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5c-.49 0-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z" />
              </svg>
              <span>Fallas Técnicas</span>
            </button>

            {/* Roles y Permisos */}
            <button
              type="button"
              className={`ad-nav-item ${activeMenu === "roles" ? "active" : ""}`}
              onClick={() => setActiveMenu("roles")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
              </svg>
              <span>Roles y Permisos</span>
            </button>

            {/* Historial de Auditoría */}
            <button
              type="button"
              className={`ad-nav-item ${activeMenu === "auditoria" ? "active" : ""}`}
              onClick={() => setActiveMenu("auditoria")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
              </svg>
              <span>Historial de Auditoría</span>
            </button>

            {/* Reportes y Estadísticas */}
            <button
              type="button"
              className={`ad-nav-item ${activeMenu === "reportes" ? "active" : ""}`}
              onClick={() => setActiveMenu("reportes")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20h4V4h-4v16zm-6 0h4v-8H4v8zM16 9v11h4V9h-4z" />
              </svg>
              <span>Reportes y Estadísticas</span>
            </button>

            {/* Configuración */}
            <button
              type="button"
              className={`ad-nav-item ${activeMenu === "configuracion" ? "active" : ""}`}
              onClick={() => setActiveMenu("configuracion")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
              <span>Configuración</span>
            </button>
          </nav>
        </div>

        {/* Pie del Sidebar: Perfil de Administrador y Cerrar Sesión */}
        <div className="ad-sidebar-footer">
          <div className="ad-user-card">
            <div className="ad-user-avatar">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <div className="ad-user-info">
              <h4>Administrador</h4>
              <p>admin@serviprox.com</p>
            </div>
          </div>
          <button type="button" className="ad-logout-btn" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ═════════════════════════════════════════════════════════════════════
          CONTENIDO PRINCIPAL
         ═════════════════════════════════════════════════════════════════════ */}
      <main className="ad-main-content">
        {/* Barra Superior con Búsqueda y Perfil */}
        <header className="ad-topbar">
          <div className="ad-search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Buscar usuarios, servicios, publicaciones, PQR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="ad-topbar-actions">
            {/* Campana de Notificaciones con Badge 3 */}
            <button
              type="button"
              className="ad-notification-btn"
              onClick={() => setNotificationsOpen((prev) => !prev)}
              aria-label="Ver notificaciones"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
              </svg>
              <span className="ad-badge-count">3</span>
            </button>

            {/* Perfil del Administrador en la barra superior */}
            <div className="ad-topbar-user" onClick={() => setActiveMenu("configuracion")}>
              <div className="ad-topbar-avatar">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
              <div className="ad-topbar-user-info">
                <strong>Administrador</strong>
                <span>Rol: Superadministrador</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dropdown de Notificaciones */}
        {notificationsOpen && (
          <div
            style={{
              position: "absolute",
              top: "70px",
              right: "40px",
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
              border: "1px solid #e2e8f0",
              width: "320px",
              padding: "16px",
              zIndex: 100,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>Notificaciones Recientes</strong>
              <button
                type="button"
                onClick={() => setNotificationsOpen(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1rem" }}
              >
                ✕
              </button>
            </div>
            {notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: "10px",
                  borderRadius: "10px",
                  background: n.unread ? "#f0fdf4" : "#f8fafc",
                  marginBottom: "8px",
                  fontSize: "0.82rem",
                  border: "1px solid #e2e8f0",
                }}
              >
                <p style={{ margin: 0, fontWeight: 600, color: "#1e293b" }}>{n.text}</p>
                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{n.time}</span>
              </div>
            ))}
          </div>
        )}

        {/* Cuerpo del Panel */}
        <div className="ad-dashboard-body">
          {activeMenu === "inicio" && (
            <>
              {/* Fila de Bienvenida, Fecha y Estado de BD */}
              <div className="ad-welcome-row">
                <div className="ad-welcome-text">
              <h1>Bienvenido, Administrador</h1>
              <p>Aquí puedes supervisar y gestionar toda la información de Serviprox en tiempo real.</p>
            </div>
            <div className="ad-date-card">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
              </svg>
              <span>Miércoles, 8 de octubre de 2026</span>
            </div>
          </div>

          {/* Tarjetas KPI Superiores (6 Columnas exactas a la imagen) */}
          <section className="ad-kpi-grid" aria-label="Indicadores clave">
            {/* 1. Clientes registrados */}
            <div className="ad-kpi-card">
              <div className="ad-kpi-icon-box" style={{ background: "#dbeafe", color: "#2563eb" }}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
              </div>
              <div className="ad-kpi-value">{kpis.clients.toLocaleString("es-CO")}</div>
              <p className="ad-kpi-label">Clientes registrados</p>
              <div className="ad-kpi-trend positive">
                <span>↗</span> +12%
              </div>
            </div>

            {/* 2. Profesionales activos */}
            <div className="ad-kpi-card">
              <div className="ad-kpi-icon-box" style={{ background: "#dcfce7", color: "#16a34a" }}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2c-4.42 0-8 3.58-8 8v3h16v-3c0-4.42-3.58-8-8-8zm-1 16H3v2c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-2h-8v-2h-2v2z" />
                </svg>
              </div>
              <div className="ad-kpi-value">{kpis.professionals.toLocaleString("es-CO")}</div>
              <p className="ad-kpi-label">Profesionales activos</p>
              <div className="ad-kpi-trend positive">
                <span>↗</span> +8%
              </div>
            </div>

            {/* 3. Publicaciones en revisión */}
            <div className="ad-kpi-card">
              <div className="ad-kpi-icon-box" style={{ background: "#ffedd5", color: "#ea580c" }}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                </svg>
              </div>
              <div className="ad-kpi-value">{kpis.pending_publications.toLocaleString("es-CO")}</div>
              <p className="ad-kpi-label">Publicaciones en revisión</p>
              <div className="ad-kpi-trend warning">
                <span>↗</span> +24%
              </div>
            </div>

            {/* 4. Servicios contratados */}
            <div className="ad-kpi-card">
              <div className="ad-kpi-icon-box" style={{ background: "#f3e8ff", color: "#9333ea" }}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />
                </svg>
              </div>
              <div className="ad-kpi-value">{kpis.hired_services.toLocaleString("es-CO")}</div>
              <p className="ad-kpi-label">Servicios contratados</p>
              <div className="ad-kpi-trend" style={{ color: "#9333ea" }}>
                <span>↗</span> +15%
              </div>
            </div>

            {/* 5. PQR pendientes */}
            <div className="ad-kpi-card">
              <div className="ad-kpi-icon-box" style={{ background: "#fee2e2", color: "#dc2626" }}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                </svg>
              </div>
              <div className="ad-kpi-value">{kpis.open_pqrs.toLocaleString("es-CO")}</div>
              <p className="ad-kpi-label">PQR pendientes</p>
              <div className="ad-kpi-trend danger">
                <span>↘</span> +8%
              </div>
            </div>

            {/* 6. Fallas técnicas */}
            <div className="ad-kpi-card">
              <div className="ad-kpi-icon-box" style={{ background: "#ccfbf1", color: "#0d9488" }}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5c-.49 0-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z" />
                </svg>
              </div>
              <div className="ad-kpi-value">{kpis.technical_issues.toLocaleString("es-CO")}</div>
              <p className="ad-kpi-label">Fallas técnicas</p>
              <div className="ad-kpi-trend teal">
                <span>↘</span> -20%
              </div>
            </div>
          </section>

          {/* Cuadrícula Principal (Izquierda ancha y Derecha lateral) */}
          <div className="ad-content-grid">
            {/* ────────── COLUMNA IZQUIERDA ────────── */}
            <div className="ad-left-col">
              {/* Card 1: Solicitudes Recientes */}
              <div className="ad-card">
                <div className="ad-card-header">
                  <h3>Solicitudes recientes</h3>
                  <button
                    type="button"
                    className="ad-card-link"
                    onClick={() => setActiveMenu("publicaciones_servicios")}
                  >
                    Ver todas
                  </button>
                </div>

                {/* Filtros de Pestaña */}
                <div className="ad-tabs" role="tablist">
                  {(
                    [
                      "Publicaciones",
                      "Profesionales",
                      "Productos",
                      "PQR",
                      "Fallas técnicas",
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={activeRequestTab === tab}
                      className={`ad-tab-btn ${
                        activeRequestTab === tab ? "active" : ""
                      }`}
                      onClick={() => setActiveRequestTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Tabla de Datos */}
                <div className="ad-table-responsive">
                  <table className="ad-table">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Título</th>
                        <th>Usuario</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeRequestTab === "Profesionales" ? (
                        filteredProsForHomeTab.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                              No se encontraron profesionales con el término buscado.
                            </td>
                          </tr>
                        ) : (
                          filteredProsForHomeTab.map((pro) => (
                            <tr key={`pro-${pro.id}`}>
                              <td>
                                <div className="ad-type-badge">
                                  <span className="ad-type-icon" style={{ background: "#dcfce7" }}>
                                    🛡️
                                  </span>
                                  <span>Profesional</span>
                                </div>
                              </td>
                              <td style={{ fontWeight: 600, color: "#1e293b" }}>
                                {pro.headline || pro.specialty_label || "Especialista Serviprox"}
                              </td>
                              <td>
                                <div className="ad-user-cell">
                                  <img
                                    src={pro.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=240&auto=format&fit=crop"}
                                    alt={pro.display_name}
                                    className="ad-table-avatar"
                                  />
                                  <span style={{ fontWeight: 600 }}>{pro.display_name}</span>
                                </div>
                              </td>
                              <td style={{ color: "#64748b", fontSize: "0.82rem" }}>
                                {pro.neighborhood ? `${pro.neighborhood}, ${pro.city || "Bogotá"}` : (pro.city || "Bogotá")}
                              </td>
                              <td>
                                <span className={`ad-status-pill ${pro.is_verified ? "ad-status-aprobado" : "ad-status-revision"}`}>
                                  {pro.is_verified ? "Aprobado" : "En revisión"}
                                </span>
                              </td>
                              <td>
                                <div className="ad-actions-cell">
                                  <button
                                    type="button"
                                    className="ad-action-btn"
                                    title="Ver expediente técnico"
                                    onClick={() => handleViewProDetail(pro)}
                                  >
                                    👁
                                  </button>
                                  {!pro.is_verified ? (
                                    <button
                                      type="button"
                                      className="ad-action-btn approve"
                                      title="Aprobar Tarjeta Profesional en BD"
                                      onClick={() => handleToggleProVerification(pro)}
                                    >
                                      ✓
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="ad-action-btn"
                                      style={{ background: "#f3e8ff", color: "#9333ea", borderColor: "#d8b4fe" }}
                                      title="Asignar Beneficios y Puntos"
                                      onClick={() => handleOpenAssignBenefitsForPro(pro)}
                                    >
                                      🎁
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="ad-action-btn reject"
                                    title="Sancionar / Suspender en BD"
                                    onClick={() => {
                                      setTargetUserToBlock(pro.display_name);
                                      setTargetIdToBlock(pro.id);
                                      setModalBloqueoOpen(true);
                                    }}
                                  >
                                    🔒
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )
                      ) : (
                        filteredRequests.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <div className="ad-type-badge">
                                <span
                                  className="ad-type-icon"
                                  style={{ background: row.typeColor }}
                                >
                                  {row.typeIcon}
                                </span>
                                <span>{row.type}</span>
                              </div>
                            </td>
                            <td style={{ fontWeight: 600, color: "#1e293b" }}>
                              {row.title}
                            </td>
                            <td>
                              <div className="ad-user-cell">
                                <img
                                  src={row.userAvatar}
                                  alt={row.userName}
                                  className="ad-table-avatar"
                                />
                                <span style={{ fontWeight: 600 }}>{row.userName}</span>
                              </div>
                            </td>
                            <td style={{ color: "#64748b", fontSize: "0.82rem" }}>
                              {row.date}
                            </td>
                            <td>
                              <span className={`ad-status-pill ${row.statusClass}`}>
                                {row.status}
                              </span>
                            </td>
                            <td>
                              <div className="ad-actions-cell">
                                <button
                                  type="button"
                                  className="ad-action-btn"
                                  title="Ver detalles"
                                  onClick={() => handleViewDetail(row)}
                                >
                                  👁
                                </button>
                                {row.status === "En revisión" && (
                                  <>
                                    <button
                                      type="button"
                                      className="ad-action-btn approve"
                                      title="Aprobar"
                                      onClick={() => handleApprove(row.id)}
                                    >
                                      ✓
                                    </button>
                                    <button
                                      type="button"
                                      className="ad-action-btn reject"
                                      title="Rechazar"
                                      onClick={() => handleReject(row.id)}
                                    >
                                      ✕
                                    </button>
                                  </>
                                )}
                                {row.status !== "En revisión" && (
                                  <>
                                    <button
                                      type="button"
                                      className="ad-action-btn"
                                      title="Moderar o Editar"
                                      onClick={() => handleViewDetail(row)}
                                    >
                                      ✎
                                    </button>
                                    <button
                                      type="button"
                                      className="ad-action-btn"
                                      title="Más opciones"
                                      onClick={() => {
                                        setTargetUserToBlock(row.userName);
                                        setModalBloqueoOpen(true);
                                      }}
                                    >
                                      •••
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fila Inferior con Profesionales Destacados y Reportes Importantes */}
              <div className="ad-bottom-subgrid">
                {/* Profesionales Destacados */}
                <div className="ad-card">
                  <div className="ad-card-header">
                    <h3>Profesionales destacados</h3>
                    <button
                      type="button"
                      className="ad-card-link"
                      onClick={() => setActiveMenu("usuarios_profesionales")}
                    >
                      Ver todos
                    </button>
                  </div>
                  <div className="ad-pro-list">
                    {prosList.map((pro) => (
                      <div key={pro.id} className="ad-pro-item">
                        <div className="ad-pro-identity">
                          <img
                            src={pro.avatar}
                            alt={pro.name}
                            className="ad-pro-avatar"
                          />
                          <div className="ad-pro-meta">
                            <h5>{pro.name}</h5>
                            <p>{pro.specialty}</p>
                          </div>
                        </div>
                        <div className="ad-pro-badges">
                          <div className="ad-pro-rating">
                            <span>★</span> {pro.rating}
                          </div>
                          <span
                            className={`ad-tier-badge ${
                              pro.tier === "Nivel Oro"
                                ? "ad-tier-oro"
                                : "ad-tier-plata"
                            }`}
                          >
                            {pro.tier}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reportes Importantes */}
                <div className="ad-card">
                  <div className="ad-card-header">
                    <h3>Reportes importantes</h3>
                    <button
                      type="button"
                      className="ad-card-link"
                      onClick={() => setActiveMenu("pqr")}
                    >
                      Ver todos
                    </button>
                  </div>
                  <div className="ad-reports-list">
                    <div className="ad-report-item">
                      <div className="ad-report-left">
                        <div
                          className="ad-report-icon"
                          style={{ background: "#fee2e2", color: "#dc2626" }}
                        >
                          👤
                        </div>
                        <span>Cuentas bloqueadas hoy</span>
                      </div>
                      <span className="ad-report-count" style={{ color: "#dc2626" }}>
                        5
                      </span>
                    </div>

                    <div className="ad-report-item">
                      <div className="ad-report-left">
                        <div
                          className="ad-report-icon"
                          style={{ background: "#ffedd5", color: "#ea580c" }}
                        >
                          ⚠️
                        </div>
                        <span>Quejas por mala práctica</span>
                      </div>
                      <span className="ad-report-count" style={{ color: "#ea580c" }}>
                        8
                      </span>
                    </div>

                    <div className="ad-report-item">
                      <div className="ad-report-left">
                        <div
                          className="ad-report-icon"
                          style={{ background: "#fef3c7", color: "#d97706" }}
                        >
                          📋
                        </div>
                        <span>Publicaciones rechazadas</span>
                      </div>
                      <span className="ad-report-count" style={{ color: "#d97706" }}>
                        14
                      </span>
                    </div>

                    <div className="ad-report-item">
                      <div className="ad-report-left">
                        <div
                          className="ad-report-icon"
                          style={{ background: "#dbeafe", color: "#2563eb" }}
                        >
                          🛍️
                        </div>
                        <span>Servicios cancelados</span>
                      </div>
                      <span className="ad-report-count" style={{ color: "#2563eb" }}>
                        11
                      </span>
                    </div>

                    <div className="ad-report-item">
                      <div className="ad-report-left">
                        <div
                          className="ad-report-icon"
                          style={{ background: "#f3e8ff", color: "#9333ea" }}
                        >
                          🐞
                        </div>
                        <span>Incidencias app</span>
                      </div>
                      <span className="ad-report-count" style={{ color: "#9333ea" }}>
                        12
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ────────── COLUMNA DERECHA ────────── */}
            <div className="ad-right-col">
              {/* Card 1: Distribución de Usuarios (Donut) */}
              <div className="ad-card">
                <div className="ad-card-header">
                  <h3>Distribución de usuarios</h3>
                </div>
                <div className="ad-donut-wrapper">
                  <div className="ad-donut-chart">
                    {(() => {
                      const totalUsers = (userDistribution.clients || 0) + (userDistribution.professionals || 0);
                      const clientPct = totalUsers > 0 ? Math.round((userDistribution.clients / totalUsers) * 100) : 78;
                      const proPct = 100 - clientPct;
                      return (
                        <>
                          <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%" }}>
                            {/* Fondo */}
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="#e2e8f0"
                              strokeWidth="4"
                            />
                            {/* Porción Clientes (Azul) */}
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth="4.5"
                              strokeDasharray={`${clientPct}, 100`}
                              strokeLinecap="round"
                            />
                            {/* Porción Profesionales (Verde) */}
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="#22c55e"
                              strokeWidth="4.5"
                              strokeDasharray={`${proPct}, 100`}
                              strokeDashoffset={`-${clientPct}`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="ad-donut-center">
                            <strong>{totalUsers.toLocaleString("es-CO")}</strong>
                            <span>Usuarios</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className="ad-donut-legend">
                    {(() => {
                      const totalUsers = (userDistribution.clients || 0) + (userDistribution.professionals || 0);
                      const clientPct = totalUsers > 0 ? Math.round((userDistribution.clients / totalUsers) * 100) : 78;
                      const proPct = 100 - clientPct;
                      return (
                        <>
                          <div className="ad-legend-item">
                            <span className="ad-legend-dot" style={{ background: "#2563eb" }} />
                            <div className="ad-legend-text">
                              <strong>Clientes</strong>
                              <span>{userDistribution.clients.toLocaleString("es-CO")} ({clientPct}%)</span>
                            </div>
                          </div>
                          <div className="ad-legend-item">
                            <span className="ad-legend-dot" style={{ background: "#22c55e" }} />
                            <div className="ad-legend-text">
                              <strong>Profesionales</strong>
                              <span>{userDistribution.professionals.toLocaleString("es-CO")} ({proPct}%)</span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Card 2: PQR por Estado (Bar Chart SVG) */}
              <div className="ad-card">
                <div className="ad-card-header">
                  <h3>PQR por estado</h3>
                </div>
                <div className="ad-barchart-container">
                  <svg className="ad-barchart-svg" viewBox="0 0 320 180">
                    {/* Líneas horizontales de guía */}
                    <line x1="30" y1="20" x2="310" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                    <text x="15" y="24" fontSize="10" fill="#94a3b8" textAnchor="end">40</text>

                    <line x1="30" y1="55" x2="310" y2="55" stroke="#f1f5f9" strokeWidth="1" />
                    <text x="15" y="59" fontSize="10" fill="#94a3b8" textAnchor="end">30</text>

                    <line x1="30" y1="90" x2="310" y2="90" stroke="#f1f5f9" strokeWidth="1" />
                    <text x="15" y="94" fontSize="10" fill="#94a3b8" textAnchor="end">20</text>

                    <line x1="30" y1="125" x2="310" y2="125" stroke="#f1f5f9" strokeWidth="1" />
                    <text x="15" y="129" fontSize="10" fill="#94a3b8" textAnchor="end">10</text>

                    <line x1="30" y1="150" x2="310" y2="150" stroke="#cbd5e1" strokeWidth="1" />
                    <text x="15" y="153" fontSize="10" fill="#94a3b8" textAnchor="end">0</text>

                    {/* Barra 1: Radicados / Abiertos - Rojo */}
                    <rect x="55" y={Math.max(30, 150 - Math.min(120, pqrDistribution.radicado * 4))} width="36" height={Math.min(120, pqrDistribution.radicado * 4)} rx="4" fill="#ef4444" />
                    <text x="73" y={Math.max(22, 142 - Math.min(120, pqrDistribution.radicado * 4))} fontSize="11" fontWeight="700" fill="#ef4444" textAnchor="middle">{pqrDistribution.radicado}</text>
                    <text x="73" y="165" fontSize="10" fill="#64748b" textAnchor="middle">Abiertos</text>

                    {/* Barra 2: En revisión - Amarillo */}
                    <rect x="125" y={Math.max(30, 150 - Math.min(120, pqrDistribution.en_revision * 4))} width="36" height={Math.min(120, pqrDistribution.en_revision * 4)} rx="4" fill="#f59e0b" />
                    <text x="143" y={Math.max(22, 142 - Math.min(120, pqrDistribution.en_revision * 4))} fontSize="11" fontWeight="700" fill="#f59e0b" textAnchor="middle">{pqrDistribution.en_revision}</text>
                    <text x="143" y="165" fontSize="10" fill="#64748b" textAnchor="middle">Revisión</text>

                    {/* Barra 3: Conciliación - Azul */}
                    <rect x="195" y={Math.max(30, 150 - Math.min(120, pqrDistribution.conciliacion * 4))} width="36" height={Math.min(120, pqrDistribution.conciliacion * 4)} rx="4" fill="#3b82f6" />
                    <text x="213" y={Math.max(22, 142 - Math.min(120, pqrDistribution.conciliacion * 4))} fontSize="11" fontWeight="700" fill="#3b82f6" textAnchor="middle">{pqrDistribution.conciliacion}</text>
                    <text x="213" y="165" fontSize="10" fill="#64748b" textAnchor="middle">Concilia</text>

                    {/* Barra 4: Resueltos - Verde */}
                    <rect x="265" y={Math.max(30, 150 - Math.min(120, pqrDistribution.resuelto * 4))} width="36" height={Math.min(120, pqrDistribution.resuelto * 4)} rx="4" fill="#10b981" />
                    <text x="283" y={Math.max(22, 142 - Math.min(120, pqrDistribution.resuelto * 4))} fontSize="11" fontWeight="700" fill="#10b981" textAnchor="middle">{pqrDistribution.resuelto}</text>
                    <text x="283" y="165" fontSize="10" fill="#64748b" textAnchor="middle">Resueltos</text>
                  </svg>
                </div>
              </div>

              {/* Card 3: Accesos Rápidos (4 Botones con Flecha) */}
              <div className="ad-card">
                <div className="ad-card-header">
                  <h3>Accesos rápidos</h3>
                </div>
                <div className="ad-quick-grid">
                  {/* Gestionar usuarios */}
                  <button
                    type="button"
                    className="ad-quick-btn ad-quick-blue"
                    onClick={() => setActiveMenu("usuarios_clientes")}
                  >
                    <div className="ad-quick-btn-content">
                      <div className="ad-quick-icon">👥</div>
                      <span>Gestionar usuarios</span>
                    </div>
                    <span>›</span>
                  </button>

                  {/* Verificar profesionales */}
                  <button
                    type="button"
                    className="ad-quick-btn ad-quick-green"
                    onClick={() => setActiveMenu("usuarios_profesionales")}
                  >
                    <div className="ad-quick-btn-content">
                      <div className="ad-quick-icon">🛡️</div>
                      <span>Verificar profesionales</span>
                    </div>
                    <span>›</span>
                  </button>

                  {/* Revisar publicaciones */}
                  <button
                    type="button"
                    className="ad-quick-btn ad-quick-orange"
                    onClick={() => setActiveMenu("publicaciones_servicios")}
                  >
                    <div className="ad-quick-btn-content">
                      <div className="ad-quick-icon">🛍️</div>
                      <span>Revisar publicaciones</span>
                    </div>
                    <span>›</span>
                  </button>

                  {/* Asignar beneficios */}
                  <button
                    type="button"
                    className="ad-quick-btn ad-quick-purple"
                    onClick={() => setActiveMenu("beneficios")}
                  >
                    <div className="ad-quick-btn-content">
                      <div className="ad-quick-icon">🎁</div>
                      <span>Asignar beneficios</span>
                    </div>
                    <span>›</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
            </>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              VISTA: DIRECTORIO Y GESTIÓN DE CLIENTES (CONECTADO A BD)
             ═════════════════════════════════════════════════════════════════ */}
          {activeMenu === "usuarios_clientes" && (
            <section className="ad-clients-view" aria-label="Directorio de Clientes">
              <div className="ad-view-header">
                <div>
                  <h2 className="ad-view-header-title">👥 Directorio y Gestión de Clientes</h2>
                  <p className="ad-view-header-subtitle">
                    Supervisa los clientes registrados en la base de datos de Serviprox, historial de servicios, validación de cédulas y control disciplinario.
                  </p>
                </div>
                <div className="ad-view-header-actions">
                  <button
                    type="button"
                    className="ad-btn ad-btn-secondary"
                    onClick={fetchClients}
                    title="Recargar desde la base de datos"
                  >
                    🔄 {clientsLoading ? "Actualizando..." : "Refrescar BD"}
                  </button>
                  <button
                    type="button"
                    className="ad-btn ad-btn-primary"
                    onClick={() => alert(`Se han exportado ${clientsList.length} registros de clientes con éxito.`)}
                  >
                    📥 Exportar CSV
                  </button>
                </div>
              </div>

              {/* Tarjetas KPI de Clientes */}
              <div className="ad-kpi-grid" style={{ marginBottom: "20px" }}>
                <div className="ad-kpi-card">
                  <div className="ad-kpi-icon-box" style={{ background: "#dbeafe", color: "#2563eb" }}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                    </svg>
                  </div>
                  <div className="ad-kpi-value">{clientsList.length}</div>
                  <p className="ad-kpi-label">Clientes en Base de Datos</p>
                  <div className="ad-kpi-trend positive"><span>✓</span> Registrados</div>
                </div>

                <div className="ad-kpi-card">
                  <div className="ad-kpi-icon-box" style={{ background: "#dcfce7", color: "#16a34a" }}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                    </svg>
                  </div>
                  <div className="ad-kpi-value">
                    {clientsList.filter((c) => c.is_identity_verified).length}
                  </div>
                  <p className="ad-kpi-label">Cédulas Validadas</p>
                  <div className="ad-kpi-trend positive"><span>🛡️</span> Verificadas</div>
                </div>

                <div className="ad-kpi-card">
                  <div className="ad-kpi-icon-box" style={{ background: "#fef3c7", color: "#d97706" }}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                    </svg>
                  </div>
                  <div className="ad-kpi-value">
                    {clientsList.filter((c) => !c.is_identity_verified).length}
                  </div>
                  <p className="ad-kpi-label">Pendientes de Validación</p>
                  <div className="ad-kpi-trend warning"><span>⏳</span> Por validar</div>
                </div>

                <div className="ad-kpi-card">
                  <div className="ad-kpi-icon-box" style={{ background: "#fee2e2", color: "#dc2626" }}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                    </svg>
                  </div>
                  <div className="ad-kpi-value">
                    {clientsList.filter((c) => !c.is_active).length}
                  </div>
                  <p className="ad-kpi-label">Cuentas Sancionadas</p>
                  <div className="ad-kpi-trend danger"><span>🔒</span> Bloqueadas</div>
                </div>
              </div>

              {/* Barra de Filtros */}
              <div className="ad-filter-bar">
                <div className="ad-filter-search">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar cliente por nombre, correo, cédula, teléfono o ciudad..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                </div>

                <select
                  className="ad-filter-select"
                  value={clientFilterVerified}
                  onChange={(e) => setClientFilterVerified(e.target.value as any)}
                >
                  <option value="todos">Todos los documentos</option>
                  <option value="verificados">✓ Cédulas Validadas</option>
                  <option value="pendientes">⏳ Pendientes de Validación</option>
                </select>

                <select
                  className="ad-filter-select"
                  value={clientFilterStatus}
                  onChange={(e) => setClientFilterStatus(e.target.value as any)}
                >
                  <option value="todos">Todos los estados</option>
                  <option value="activos">● Cuentas Activas</option>
                  <option value="bloqueados">🔒 Cuentas Bloqueadas</option>
                </select>
              </div>

              {/* Tabla de Clientes Conectada a la BD */}
              <div className="ad-card" style={{ padding: "0", overflow: "hidden" }}>
                <div className="ad-table-responsive">
                  <table className="ad-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Documento / Identidad</th>
                        <th>Contacto & Dirección</th>
                        <th>Servicios</th>
                        <th>Registro</th>
                        <th>Estado</th>
                        <th style={{ textAlign: "right" }}>Acciones Administrativas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="ad-empty-table">
                            <p>No se encontraron clientes que coincidan con los criterios de búsqueda.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredClients.map((client) => (
                          <tr key={client.id}>
                            <td>
                              <div className="ad-user-cell">
                                <div className="ad-avatar-initials">
                                  {client.full_name?.substring(0, 2).toUpperCase() || "CL"}
                                </div>
                                <div>
                                  <strong style={{ display: "block", color: "#0f172a" }}>
                                    {client.full_name}
                                  </strong>
                                  <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                                    {client.email}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div>
                                <strong style={{ fontSize: "0.85rem", color: "#1e293b", display: "block" }}>
                                  {client.document_id}
                                </strong>
                                <span className={client.is_identity_verified ? "ad-badge-success" : "ad-badge-warning"}>
                                  {client.is_identity_verified ? "✓ Validado" : "⏳ Pendiente"}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: "0.82rem" }}>
                                <p style={{ margin: 0, fontWeight: 600, color: "#334155" }}>{client.phone}</p>
                                <span style={{ color: "#64748b" }}>{client.address}</span>
                              </div>
                            </td>
                            <td>
                              <span className="ad-badge-neutral">
                                📋 {client.requests_count} solicitud(es)
                              </span>
                            </td>
                            <td style={{ color: "#64748b", fontSize: "0.82rem" }}>
                              {client.date_joined}
                            </td>
                            <td>
                              <span className={client.is_active ? "ad-badge-success" : "ad-badge-danger"}>
                                {client.is_active ? "● Activa" : "🔒 Bloqueada"}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  className="ad-action-btn"
                                  title="Ver Ficha Técnica"
                                  onClick={() => handleViewClientDetail(client)}
                                >
                                  👁
                                </button>

                                <button
                                  type="button"
                                  className={`ad-action-pill ${client.is_identity_verified ? "unverify" : "verify"}`}
                                  onClick={() => handleToggleClientVerification(client)}
                                  title="Cambiar estado de validación en BD"
                                >
                                  {client.is_identity_verified ? "Revocar" : "✓ Validar Cédula"}
                                </button>

                                {client.is_active ? (
                                  <button
                                    type="button"
                                    className="ad-action-pill block"
                                    onClick={() => {
                                      setTargetUserToBlock(client.full_name);
                                      setTargetIdToBlock(client.id);
                                      setModalBloqueoOpen(true);
                                    }}
                                    title="Aplicar bloqueo disciplinario en BD"
                                  >
                                    🔒 Bloquear
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="ad-action-pill unblock"
                                    onClick={() => handleUnblockUser(client.id, client.full_name)}
                                    title="Levantar sanción y reactivar"
                                  >
                                    🔓 Desbloquear
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              VISTA: VERIFICACIÓN Y GESTIÓN DE PROFESIONALES (CONECTADO A BD)
             ═════════════════════════════════════════════════════════════════ */}
          {activeMenu === "usuarios_profesionales" && (
            <section className="ad-pros-view" aria-label="Gestión de Profesionales">
              <div className="ad-view-header">
                <div>
                  <h2 className="ad-view-header-title">🛡️ Verificación y Gestión de Profesionales</h2>
                  <p className="ad-view-header-subtitle">
                    Supervisa contratistas y técnicos registrados en la base de datos, valida credenciales y tarjetas RETIE/SENA, acredita beneficios y gestiona sanciones.
                  </p>
                </div>
                <div className="ad-view-header-actions">
                  <button
                    type="button"
                    className="ad-btn ad-btn-secondary"
                    onClick={fetchPros}
                    title="Recargar desde la base de datos"
                  >
                    🔄 {prosLoading ? "Actualizando..." : "Refrescar BD"}
                  </button>
                  <button
                    type="button"
                    className="ad-btn ad-btn-primary"
                    onClick={() => alert(`Se han exportado ${allProsList.length} profesionales registrados.`)}
                  >
                    📥 Exportar CSV
                  </button>
                </div>
              </div>

              {/* Tarjetas KPI de Profesionales */}
              <div className="ad-kpi-grid" style={{ marginBottom: "20px" }}>
                <div className="ad-kpi-card">
                  <div className="ad-kpi-icon-box" style={{ background: "#dcfce7", color: "#16a34a" }}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2c-4.42 0-8 3.58-8 8v3h16v-3c0-4.42-3.58-8-8-8zm-1 16H3v2c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-2h-8v-2h-2v2z" />
                    </svg>
                  </div>
                  <div className="ad-kpi-value">{allProsList.length}</div>
                  <p className="ad-kpi-label">Profesionales en Base de Datos</p>
                  <div className="ad-kpi-trend positive"><span>✓</span> Registrados</div>
                </div>

                <div className="ad-kpi-card">
                  <div className="ad-kpi-icon-box" style={{ background: "#dbeafe", color: "#2563eb" }}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                    </svg>
                  </div>
                  <div className="ad-kpi-value">
                    {allProsList.filter((p) => p.is_verified).length}
                  </div>
                  <p className="ad-kpi-label">Tarjetas Aprobadas</p>
                  <div className="ad-kpi-trend positive"><span>🛡️</span> Verificados</div>
                </div>

                <div className="ad-kpi-card">
                  <div className="ad-kpi-icon-box" style={{ background: "#f3e8ff", color: "#9333ea" }}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                  <div className="ad-kpi-value">
                    {allProsList.reduce((acc, p) => acc + (p.points || 0), 0).toLocaleString("es-CO")}
                  </div>
                  <p className="ad-kpi-label">Puntos Acreditados</p>
                  <div className="ad-kpi-trend teal"><span>💎</span> En Billeteras</div>
                </div>

                <div className="ad-kpi-card">
                  <div className="ad-kpi-icon-box" style={{ background: "#fef3c7", color: "#d97706" }}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ad-kpi-value">
                    {allProsList.filter((p) => !p.is_verified).length}
                  </div>
                  <p className="ad-kpi-label">Pendientes de Aprobación</p>
                  <div className="ad-kpi-trend warning"><span>⏳</span> Por validar</div>
                </div>
              </div>

              {/* Filtros de Profesionales */}
              <div className="ad-filter-bar">
                <div className="ad-filter-search">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar profesional por nombre, especialidad, ciudad, teléfono..."
                    value={proSearch}
                    onChange={(e) => setProSearch(e.target.value)}
                  />
                </div>

                <select
                  className="ad-filter-select"
                  value={proFilterCategory}
                  onChange={(e) => setProFilterCategory(e.target.value)}
                >
                  <option value="todas">Todas las categorías</option>
                  <option value="Electricidad">Electricidad</option>
                  <option value="Plomería">Plomería</option>
                  <option value="Cerrajería">Cerrajería</option>
                  <option value="Pintura">Pintura</option>
                  <option value="Limpieza">Limpieza</option>
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Instalaciones">Instalaciones</option>
                </select>

                <select
                  className="ad-filter-select"
                  value={proFilterVerified}
                  onChange={(e) => setProFilterVerified(e.target.value as any)}
                >
                  <option value="todos">Todos los estados de tarjeta</option>
                  <option value="verificados">✓ Tarjeta Verificada</option>
                  <option value="pendientes">⏳ Pendiente Aprobación</option>
                </select>

                <select
                  className="ad-filter-select"
                  value={proFilterStatus}
                  onChange={(e) => setProFilterStatus(e.target.value as any)}
                >
                  <option value="todos">Todos los estados</option>
                  <option value="activos">● Activos</option>
                  <option value="bloqueados">🔒 Suspendidos</option>
                </select>
              </div>

              {/* Tabla de Profesionales Conectada a la BD */}
              <div className="ad-card" style={{ padding: "0", overflow: "hidden" }}>
                <div className="ad-table-responsive">
                  <table className="ad-table">
                    <thead>
                      <tr>
                        <th>Profesional</th>
                        <th>Calificación & Trabajos</th>
                        <th>Tarjeta Profesional</th>
                        <th>Incentivos & Saldo</th>
                        <th>Ubicación & Teléfono</th>
                        <th>Estado</th>
                        <th style={{ textAlign: "right" }}>Acciones Administrativas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPros.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="ad-empty-table">
                            <p>No se encontraron profesionales que coincidan con la búsqueda.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredPros.map((pro) => (
                          <tr key={pro.id}>
                            <td>
                              <div className="ad-user-cell">
                                <img
                                  src={pro.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=240&auto=format&fit=crop"}
                                  alt={pro.display_name}
                                  className="ad-table-avatar"
                                  style={{ width: "38px", height: "38px" }}
                                />
                                <div>
                                  <strong style={{ display: "block", color: "#0f172a" }}>
                                    {pro.display_name}
                                  </strong>
                                  <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                                    {pro.headline || pro.specialty_label || "Especialista Serviprox"}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div>
                                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.88rem" }}>
                                  ★ {pro.rating_avg}
                                </span>
                                <span style={{ display: "block", fontSize: "0.76rem", color: "#64748b" }}>
                                  {pro.jobs_completed} trabajos completados
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className={pro.is_verified ? "ad-badge-success" : "ad-badge-warning"}>
                                {pro.is_verified ? "✓ Tarjeta Aprobada" : "⏳ Pendiente"}
                              </span>
                            </td>
                            <td>
                              <div>
                                <strong style={{ color: "#7e22ce", fontSize: "0.85rem" }}>
                                  💎 {pro.points || 0} pts
                                </strong>
                                <span style={{ display: "block", fontSize: "0.76rem", color: "#16a34a", fontWeight: 600 }}>
                                  💳 ${Number(pro.wallet_balance || 0).toLocaleString("es-CO")} COP
                                </span>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: "0.82rem" }}>
                                <p style={{ margin: 0, fontWeight: 600, color: "#334155" }}>{pro.phone}</p>
                                <span style={{ color: "#64748b" }}>
                                  {pro.neighborhood ? `${pro.neighborhood}, ${pro.city || "Bogotá"}` : (pro.city || "Bogotá")}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className={pro.is_active ? "ad-badge-success" : "ad-badge-danger"}>
                                {pro.is_active ? "● Activo" : "🔒 Suspendido"}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  className="ad-action-btn"
                                  title="Ver Expediente Técnico"
                                  onClick={() => handleViewProDetail(pro)}
                                >
                                  👁
                                </button>

                                <button
                                  type="button"
                                  className={`ad-action-pill ${pro.is_verified ? "unverify" : "verify"}`}
                                  onClick={() => handleToggleProVerification(pro)}
                                  title="Aprobar o revocar tarjeta profesional en BD"
                                >
                                  {pro.is_verified ? "Revocar" : "✓ Aprobar Tarjeta"}
                                </button>

                                <button
                                  type="button"
                                  className="ad-action-pill gift"
                                  onClick={() => handleOpenAssignBenefitsForPro(pro)}
                                  title="Asignar puntos e incentivos en BD"
                                >
                                  🎁 Puntos
                                </button>

                                {pro.is_active ? (
                                  <button
                                    type="button"
                                    className="ad-action-pill block"
                                    onClick={() => {
                                      setTargetUserToBlock(pro.display_name);
                                      setTargetIdToBlock(pro.id);
                                      setModalBloqueoOpen(true);
                                    }}
                                    title="Suspender cuenta de contratista en BD"
                                  >
                                    🔒 Sancionar
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="ad-action-pill unblock"
                                    onClick={() => handleUnblockUser(pro.id, pro.display_name)}
                                    title="Reactivar contratista"
                                  >
                                    🔓 Reactivar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              VISTA: PQR Y REPORTES (DISEÑO EXACTO OFICIAL SERVIPROX)
             ═════════════════════════════════════════════════════════════════ */}
          {activeMenu === "pqr" && (
            <section className="ad-pqr-view" aria-label="Módulo PQR y Reportes">
              {/* Encabezado Principal */}
              <div className="ad-view-header">
                <div>
                  <h2 className="ad-view-header-title">PQR y Reportes</h2>
                  <p className="ad-view-header-subtitle">
                    Gestiona las peticiones, quejas, reclamos y reportes de la plataforma Serviprox.
                  </p>
                </div>
                <button
                  type="button"
                  className="ad-btn ad-btn-primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 18px", fontWeight: 700 }}
                  onClick={() => setModalNewPqrOpen(true)}
                >
                  <span style={{ fontSize: "1.1rem" }}>+</span> Nueva solicitud (registro manual)
                </button>
              </div>

              {/* 4 Tarjetas KPI */}
              <div className="ad-pqr-kpi-grid">
                {/* KPI 1: Total de solicitudes */}
                <div className="ad-pqr-kpi-card blue">
                  <div className="ad-pqr-kpi-footer">
                    <span className="ad-pqr-trend green">↗ +12%</span>
                  </div>
                  <div className="ad-pqr-kpi-value">184</div>
                  <p className="ad-pqr-kpi-label">Total de solicitudes</p>
                  <div className="ad-pqr-sparkline">
                    <svg viewBox="0 0 100 30" preserveAspectRatio="none" style={{ width: "100%", height: "32px" }}>
                      <path d="M 0 24 Q 25 8 50 18 T 100 6" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                {/* KPI 2: Quejas */}
                <div className="ad-pqr-kpi-card red">
                  <div className="ad-pqr-kpi-footer">
                    <span className="ad-pqr-trend red">↗ +8%</span>
                  </div>
                  <div className="ad-pqr-kpi-value">76</div>
                  <p className="ad-pqr-kpi-label">Quejas</p>
                  <div className="ad-pqr-sparkline">
                    <svg viewBox="0 0 100 30" preserveAspectRatio="none" style={{ width: "100%", height: "32px" }}>
                      <path d="M 0 22 Q 25 28 50 14 T 100 8" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                {/* KPI 3: Reclamos */}
                <div className="ad-pqr-kpi-card orange">
                  <div className="ad-pqr-kpi-footer">
                    <span className="ad-pqr-trend orange">↗ +18%</span>
                  </div>
                  <div className="ad-pqr-kpi-value">62</div>
                  <p className="ad-pqr-kpi-label">Reclamos</p>
                  <div className="ad-pqr-sparkline">
                    <svg viewBox="0 0 100 30" preserveAspectRatio="none" style={{ width: "100%", height: "32px" }}>
                      <path d="M 0 25 Q 30 5 60 20 T 100 10" fill="none" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                {/* KPI 4: Peticiones */}
                <div className="ad-pqr-kpi-card purple">
                  <div className="ad-pqr-kpi-footer">
                    <span className="ad-pqr-trend purple">↘ +5%</span>
                  </div>
                  <div className="ad-pqr-kpi-value">46</div>
                  <p className="ad-pqr-kpi-label">Peticiones</p>
                  <div className="ad-pqr-sparkline">
                    <svg viewBox="0 0 100 30" preserveAspectRatio="none" style={{ width: "100%", height: "32px" }}>
                      <path d="M 0 10 Q 35 25 70 12 T 100 20" fill="none" stroke="#9333ea" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Layout Dividido: Tabla (Izquierda) + Detalle de la Solicitud (Derecha) */}
              <div
                className="ad-pqr-layout"
                style={{
                  gridTemplateColumns: isPqrDetailOpen && selectedPqr ? "1fr 400px" : "1fr",
                }}
              >
                {/* COLUMNA IZQUIERDA: Pestañas, Filtros, Tabla y Paginación */}
                <div className="ad-card" style={{ padding: "0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  {/* Pestañas Superiores */}
                  <div className="ad-pqr-tabs">
                    <button
                      type="button"
                      className={`ad-pqr-tab-btn ${pqrTab === "Todas" ? "active" : ""}`}
                      onClick={() => setPqrTab("Todas")}
                    >
                      Todas (184)
                    </button>
                    <button
                      type="button"
                      className={`ad-pqr-tab-btn ${pqrTab === "Quejas" ? "active" : ""}`}
                      onClick={() => setPqrTab("Quejas")}
                    >
                      Quejas (76)
                    </button>
                    <button
                      type="button"
                      className={`ad-pqr-tab-btn ${pqrTab === "Reclamos" ? "active" : ""}`}
                      onClick={() => setPqrTab("Reclamos")}
                    >
                      Reclamos (62)
                    </button>
                    <button
                      type="button"
                      className={`ad-pqr-tab-btn ${pqrTab === "Peticiones" ? "active" : ""}`}
                      onClick={() => setPqrTab("Peticiones")}
                    >
                      Peticiones (46)
                    </button>
                    <button
                      type="button"
                      className={`ad-pqr-tab-btn ${pqrTab === "Reportes" ? "active" : ""}`}
                      onClick={() => setPqrTab("Reportes")}
                    >
                      Reportes (38)
                    </button>
                  </div>

                  {/* Barra de Búsqueda y Filtros */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "10px",
                      padding: "14px 16px",
                      background: "#f8fafc",
                      borderBottom: "1px solid var(--ad-border)",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ position: "relative", flex: "1 1 220px" }}>
                      <input
                        type="text"
                        className="ad-search-input"
                        placeholder="Buscar por número, usuario o descripción..."
                        value={pqrSearch}
                        onChange={(e) => setPqrSearch(e.target.value)}
                        style={{ width: "100%", paddingLeft: "34px", height: "36px", fontSize: "0.82rem" }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          left: "10px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#94a3b8",
                          fontSize: "14px",
                        }}
                      >
                        🔍
                      </span>
                    </div>

                    <select
                      className="ad-search-input"
                      style={{ height: "36px", fontSize: "0.82rem", padding: "0 10px", minWidth: "110px" }}
                      value={pqrTypeFilter}
                      onChange={(e) => setPqrTypeFilter(e.target.value)}
                    >
                      <option value="Todos">Tipo ⌵</option>
                      <option value="Queja">Queja</option>
                      <option value="Reclamo">Reclamo</option>
                      <option value="Petición">Petición</option>
                      <option value="Reporte">Reporte</option>
                    </select>

                    <select
                      className="ad-search-input"
                      style={{ height: "36px", fontSize: "0.82rem", padding: "0 10px", minWidth: "110px" }}
                      value={pqrStatusFilter}
                      onChange={(e) => setPqrStatusFilter(e.target.value)}
                    >
                      <option value="Todos">Estado ⌵</option>
                      <option value="En revisión">En revisión</option>
                      <option value="Abierta">Abierta</option>
                      <option value="En proceso">En proceso</option>
                      <option value="Resuelta">Resuelta</option>
                    </select>

                    <select
                      className="ad-search-input"
                      style={{ height: "36px", fontSize: "0.82rem", padding: "0 10px", minWidth: "110px" }}
                      value={pqrPriorityFilter}
                      onChange={(e) => setPqrPriorityFilter(e.target.value)}
                    >
                      <option value="Todas">Prioridad ⌵</option>
                      <option value="Alta">Alta</option>
                      <option value="Media">Media</option>
                      <option value="Baja">Baja</option>
                    </select>

                    <select
                      className="ad-search-input"
                      style={{ height: "36px", fontSize: "0.82rem", padding: "0 10px", minWidth: "110px" }}
                      value={pqrDateFilter}
                      onChange={(e) => setPqrDateFilter(e.target.value)}
                    >
                      <option value="Todas">Fecha ⌵</option>
                      <option value="Hoy">Hoy</option>
                      <option value="Semana">Últimos 7 días</option>
                      <option value="Mes">Este mes</option>
                    </select>

                    <button
                      type="button"
                      className="ad-btn ad-btn-secondary"
                      style={{ height: "36px", fontSize: "0.8rem", padding: "0 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      onClick={() => {
                        setPqrSearch("");
                        setPqrTypeFilter("Todos");
                        setPqrStatusFilter("Todos");
                        setPqrPriorityFilter("Todas");
                        setPqrDateFilter("Todas");
                        setPqrTab("Todas");
                      }}
                    >
                      ⚙️ Más filtros
                    </button>
                  </div>

                  {/* Tabla de PQRs */}
                  <div className="ad-table-responsive">
                    <table className="ad-table">
                      <thead>
                        <tr>
                          <th style={{ width: "36px", paddingLeft: "14px" }}>
                            <input
                              type="checkbox"
                              checked={selectedPqrCheckboxIds.length === filteredPqrList.length && filteredPqrList.length > 0}
                              onChange={handleSelectAllPqrs}
                              aria-label="Seleccionar todas las solicitudes"
                            />
                          </th>
                          <th>Tipo</th>
                          <th>Título / Descripción</th>
                          <th>Usuario</th>
                          <th>Relacionado con</th>
                          <th>Fecha</th>
                          <th>Prioridad</th>
                          <th>Estado</th>
                          <th style={{ textAlign: "right", paddingRight: "16px" }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPqrList.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="ad-empty-table">
                              <p>No se encontraron solicitudes que coincidan con los filtros aplicados.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredPqrList.map((item) => {
                            const isSelectedRow = selectedPqrId === item.id;
                            const isChecked = selectedPqrCheckboxIds.includes(item.id);
                            const priorityClass = item.priority.toLowerCase();
                            const statusClass =
                              item.status === "En revisión"
                                ? "revision"
                                : item.status === "Abierta"
                                ? "abierta"
                                : item.status === "En proceso"
                                ? "proceso"
                                : "resuelta";

                            return (
                              <tr
                                key={item.id}
                                style={{
                                  backgroundColor: isSelectedRow ? "#f8fafc" : undefined,
                                  cursor: "pointer",
                                }}
                                onClick={() => {
                                  setSelectedPqrId(item.id);
                                  setIsPqrDetailOpen(true);
                                }}
                              >
                                <td style={{ paddingLeft: "14px" }} onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleTogglePqrCheckbox(item.id)}
                                    aria-label={`Seleccionar solicitud ${item.id}`}
                                  />
                                </td>
                                <td>
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "3px 8px",
                                      borderRadius: "6px",
                                      fontSize: "0.75rem",
                                      fontWeight: 700,
                                      background: item.typeBg,
                                      color: item.typeColor,
                                    }}
                                  >
                                    {item.typeLabel}
                                  </span>
                                </td>
                                <td style={{ maxWidth: "260px" }}>
                                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                                    <strong style={{ color: "#2563eb", fontSize: "0.85rem" }}>{item.id}</strong>
                                    <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.85rem" }}>
                                      {item.title}
                                    </span>
                                  </div>
                                  <p
                                    style={{
                                      margin: "2px 0 0",
                                      fontSize: "0.76rem",
                                      color: "#64748b",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {item.shortDesc || item.description}
                                  </p>
                                </td>
                                <td>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <img
                                      src={item.client.avatar}
                                      alt={item.client.name}
                                      style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" }}
                                    />
                                    <div>
                                      <strong style={{ display: "block", color: "#0f172a", fontSize: "0.82rem" }}>
                                        {item.client.name}
                                      </strong>
                                      <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                                        {item.client.document_id}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <strong style={{ display: "block", color: "#0f172a", fontSize: "0.82rem" }}>
                                    {item.relatedTo}
                                  </strong>
                                  <span style={{ fontSize: "0.74rem", color: "#64748b" }}>
                                    {item.contractor ? item.contractor.name : "Serviprox"}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ fontSize: "0.8rem", color: "#334155" }}>
                                    {item.date.includes(" ") ? item.date.split(" ")[0] : item.date}
                                  </div>
                                  <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                                    {item.date.includes(" ") ? item.date.split(" ")[1] : "12:00"}
                                  </div>
                                </td>
                                <td>
                                  <span className={`ad-priority-pill ${priorityClass}`}>
                                    ● {item.priority}
                                  </span>
                                </td>
                                <td>
                                  <span className={`ad-pqr-status-pill ${statusClass}`}>
                                    {item.status}
                                  </span>
                                </td>
                                <td style={{ textAlign: "right", paddingRight: "16px" }} onClick={(e) => e.stopPropagation()}>
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                    <button
                                      type="button"
                                      className="ad-action-pill view"
                                      title="Ver detalle de la solicitud"
                                      onClick={() => {
                                        setSelectedPqrId(item.id);
                                        setIsPqrDetailOpen(true);
                                      }}
                                    >
                                      👁️
                                    </button>
                                    <button
                                      type="button"
                                      className="ad-action-pill gift"
                                      title="Responder al cliente y notificar"
                                      onClick={() => handleOpenReplyPqrModal(item)}
                                    >
                                      💬
                                    </button>
                                    <button
                                      type="button"
                                      className="ad-action-pill neutral"
                                      title="Cerrar caso"
                                      onClick={() => handleCloseCase(item)}
                                    >
                                      •••
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginación */}
                  <div className="ad-ben-pagination">
                    <div>Mostrando 1-8 de 184 solicitudes</div>
                    <div className="ad-ben-page-nums">
                      <button type="button" className="ad-ben-page-btn" aria-label="Página anterior">‹</button>
                      <button type="button" className="ad-ben-page-btn active">1</button>
                      <button type="button" className="ad-ben-page-btn">2</button>
                      <button type="button" className="ad-ben-page-btn">3</button>
                      <button type="button" className="ad-ben-page-btn">4</button>
                      <button type="button" className="ad-ben-page-btn">5</button>
                      <span style={{ padding: "0 4px", color: "#94a3b8" }}>...</span>
                      <button type="button" className="ad-ben-page-btn" aria-label="Página siguiente">›</button>
                    </div>
                    <div>
                      <select className="ad-search-input" style={{ height: "30px", fontSize: "0.78rem", padding: "0 8px" }}>
                        <option>Mostrar 8 por página</option>
                        <option>Mostrar 15 por página</option>
                        <option>Mostrar 25 por página</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* COLUMNA DERECHA: Detalle de la Solicitud */}
                {isPqrDetailOpen && selectedPqr && (
                  <div className="ad-pqr-detail-panel">
                    {/* Encabezado del Panel Lateral */}
                    <div className="ad-pqr-detail-top">
                      <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                        Detalle de la solicitud
                      </h3>
                      <button
                        type="button"
                        className="ad-modal-close"
                        aria-label="Cerrar detalle"
                        onClick={() => setIsPqrDetailOpen(false)}
                      >
                        ✕
                      </button>
                    </div>

                    {/* ID y Pastilla de Estado */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#2563eb" }}>
                        {selectedPqr.id}
                      </span>
                      <span
                        className={`ad-pqr-status-pill ${
                          selectedPqr.status === "En revisión"
                            ? "revision"
                            : selectedPqr.status === "Abierta"
                            ? "abierta"
                            : selectedPqr.status === "En proceso"
                            ? "proceso"
                            : "resuelta"
                        }`}
                      >
                        {selectedPqr.status}
                      </span>
                    </div>

                    {/* Título y Tipo */}
                    <div>
                      <h4 style={{ margin: "0 0 6px", fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                        {selectedPqr.title}
                      </h4>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          background: selectedPqr.typeBg,
                          color: selectedPqr.typeColor,
                        }}
                      >
                        {selectedPqr.typeLabel}
                      </span>
                    </div>

                    {/* Grilla de Datos Generales */}
                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "12px",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "10px",
                        fontSize: "0.8rem",
                      }}
                    >
                      <div>
                        <span style={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>Fecha de registro</span>
                        <strong style={{ color: "#0f172a" }}>{selectedPqr.date}</strong>
                      </div>
                      <div>
                        <span style={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>Última actualización</span>
                        <strong style={{ color: "#0f172a" }}>{selectedPqr.updatedDate || "08/10/2026 16:10"}</strong>
                      </div>
                      <div>
                        <span style={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>Relacionado con</span>
                        <strong style={{ color: "#0f172a" }}>{selectedPqr.relatedTo}</strong>
                      </div>
                      <div>
                        <span style={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>Prioridad</span>
                        <span
                          className={`ad-priority-pill ${selectedPqr.priority.toLowerCase()}`}
                          style={{ marginTop: "2px" }}
                        >
                          ● {selectedPqr.priority}
                        </span>
                      </div>
                      <div style={{ gridColumn: "span 2" }}>
                        <span style={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>Ciudad</span>
                        <strong style={{ color: "#0f172a" }}>{selectedPqr.city || "Bogotá, Colombia"}</strong>
                      </div>
                    </div>

                    {/* Cliente que reporta */}
                    <div>
                      <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                        Cliente que reporta
                      </span>
                      <div className="ad-pqr-party-card">
                        <div className="ad-pqr-party-left">
                          <img
                            src={selectedPqr.client.avatar}
                            alt={selectedPqr.client.name}
                            className="ad-pqr-party-avatar"
                          />
                          <div>
                            <strong style={{ display: "block", fontSize: "0.85rem", color: "#0f172a" }}>
                              {selectedPqr.client.name}
                            </strong>
                            <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                              {selectedPqr.client.document_id}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.72rem", color: "#f59e0b", marginTop: "2px" }}>
                              <span>★ {selectedPqr.client.rating || "4.8"}</span>
                              <span style={{ color: "#94a3b8" }}>({selectedPqr.client.reviews_count || 32} reseñas)</span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="ad-btn ad-btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "0.74rem" }}
                          onClick={() => alert(`Perfil del cliente ${selectedPqr.client.name}`)}
                        >
                          Ver perfil
                        </button>
                      </div>
                    </div>

                    {/* Profesional involucrado */}
                    <div>
                      <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                        Profesional involucrado
                      </span>
                      <div className="ad-pqr-party-card">
                        <div className="ad-pqr-party-left">
                          <img
                            src={
                              selectedPqr.contractor?.avatar ||
                              "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=240&auto=format&fit=crop"
                            }
                            alt={selectedPqr.contractor?.name || "Profesional"}
                            className="ad-pqr-party-avatar"
                          />
                          <div>
                            <strong style={{ display: "block", fontSize: "0.85rem", color: "#0f172a" }}>
                              {selectedPqr.contractor?.name || "Andrés López"}
                            </strong>
                            <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                              {selectedPqr.contractor?.document_id || "CC 1032456789"}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.72rem", color: "#f59e0b", marginTop: "2px" }}>
                              <span>★ {selectedPqr.contractor?.rating || "4.5"}</span>
                              <span style={{ color: "#94a3b8" }}>({selectedPqr.contractor?.reviews_count || 120} reseñas)</span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="ad-btn ad-btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "0.74rem" }}
                          onClick={() => alert(`Perfil del profesional ${selectedPqr.contractor?.name || "Andrés López"}`)}
                        >
                          Ver perfil
                        </button>
                      </div>
                    </div>

                    {/* Descripción */}
                    <div>
                      <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                        Descripción
                      </span>
                      <div
                        style={{
                          background: "#f8fafc",
                          padding: "10px 12px",
                          borderRadius: "10px",
                          border: "1px solid #e2e8f0",
                          fontSize: "0.8rem",
                          color: "#334155",
                          lineHeight: 1.5,
                        }}
                      >
                        {selectedPqr.description}
                      </div>
                    </div>

                    {/* Archivos adjuntos */}
                    <div>
                      <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                        Archivos adjuntos (5)
                      </span>
                      <div className="ad-pqr-attachments">
                        <img
                          src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=240&auto=format&fit=crop"
                          alt="Evidencia 1"
                          className="ad-pqr-thumb"
                          onClick={() => window.open("https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=800&auto=format&fit=crop", "_blank")}
                        />
                        <img
                          src="https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=240&auto=format&fit=crop"
                          alt="Evidencia 2"
                          className="ad-pqr-thumb"
                          onClick={() => window.open("https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=800&auto=format&fit=crop", "_blank")}
                        />
                        <img
                          src="https://images.unsplash.com/photo-1504148455328-c376907d081c?q=80&w=240&auto=format&fit=crop"
                          alt="Evidencia 3"
                          className="ad-pqr-thumb"
                          onClick={() => window.open("https://images.unsplash.com/photo-1504148455328-c376907d081c?q=80&w=800&auto=format&fit=crop", "_blank")}
                        />
                        <div
                          className="ad-pqr-thumb-more"
                          onClick={() => alert(`Visualizando todos los archivos adjuntos de la solicitud ${selectedPqr.id}`)}
                        >
                          +2
                        </div>
                      </div>
                    </div>

                    {/* Historial de la solicitud */}
                    <div>
                      <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                        Historial de la solicitud
                      </span>
                      <div className="ad-pqr-timeline">
                        {selectedPqr.timeline.map((item, idx) => (
                          <div key={idx} className="ad-pqr-timeline-item">
                            <span className="ad-pqr-timeline-dot" />
                            <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{item.date}</span>
                            <span style={{ color: "#334155", marginTop: "2px" }}>{item.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="ad-pqr-actions-row">
                      <button
                        type="button"
                        className="ad-btn ad-btn-primary"
                        style={{ flex: "1 1 120px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "0.82rem" }}
                        onClick={() => handleOpenReplyPqrModal(selectedPqr)}
                      >
                        💬 Responder
                      </button>
                      <button
                        type="button"
                        className="ad-btn ad-btn-secondary"
                        style={{ flex: "1 1 80px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "0.82rem" }}
                        onClick={() => handleAssignCase(selectedPqr)}
                      >
                        👤 Asignar
                      </button>
                      <button
                        type="button"
                        className="ad-btn ad-btn-secondary"
                        style={{ flex: "1 1 80px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "0.82rem" }}
                        onClick={() => handleEscalateCase(selectedPqr)}
                      >
                        ⚠️ Escalar
                      </button>
                      <button
                        type="button"
                        className="ad-btn ad-btn-danger"
                        style={{ flex: "1 1 100px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "0.82rem" }}
                        onClick={() => handleCloseCase(selectedPqr)}
                      >
                        ✕ Cerrar caso
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              VISTA: BENEFICIOS E INCENTIVOS (DISEÑO EXACTO OFICIAL)
             ═════════════════════════════════════════════════════════════════ */}
          {activeMenu === "beneficios" && (
            <section className="ad-benefits-view" aria-label="Beneficios e Incentivos">
              {/* Encabezado Principal */}
              <div className="ad-view-header">
                <div>
                  <h2 className="ad-view-header-title">Beneficios y Puntos</h2>
                  <p className="ad-view-header-subtitle">
                    Administra los puntos, beneficios e incentivos de los profesionales de Serviprox.
                  </p>
                </div>
                <button
                  type="button"
                  className="ad-btn ad-btn-primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 18px", fontWeight: 700 }}
                  onClick={() => {
                    const pro = currentBenefitPro;
                    handleOpenAssignBenefitsForPro({
                      id: pro.id,
                      display_name: pro.name,
                      headline: pro.category,
                      specialty_label: pro.category,
                      is_verified: true,
                      points: pro.points,
                      wallet_balance: "50000",
                      jobs_completed: pro.reviews_count,
                      avatar_url: pro.avatar,
                    } as any);
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>+</span> Asignar puntos / beneficio
                </button>
              </div>

              {/* 4 Tarjetas KPI */}
              <div className="ad-benefits-kpi-grid">
                {/* KPI 1: Puntos acumulados */}
                <div className="ad-ben-kpi-card purple">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div className="ad-ben-kpi-icon" style={{ background: "#ede9fe", color: "#7e22ce" }}>
                      ★
                    </div>
                  </div>
                  <div className="ad-ben-kpi-value">12,840</div>
                  <p className="ad-ben-kpi-label">Puntos acumulados</p>
                  <div className="ad-ben-kpi-footer">
                    <span className="ad-ben-trend">↗ +18%</span>
                    <div className="ad-mini-bars">
                      <span className="ad-mini-bar" style={{ height: "6px", background: "#c084fc" }} />
                      <span className="ad-mini-bar" style={{ height: "10px", background: "#c084fc" }} />
                      <span className="ad-mini-bar" style={{ height: "8px", background: "#c084fc" }} />
                      <span className="ad-mini-bar" style={{ height: "13px", background: "#c084fc" }} />
                      <span className="ad-mini-bar" style={{ height: "16px", background: "#7e22ce" }} />
                    </div>
                  </div>
                </div>

                {/* KPI 2: Beneficios entregados */}
                <div className="ad-ben-kpi-card green">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div className="ad-ben-kpi-icon" style={{ background: "#dcfce7", color: "#16a34a" }}>
                      🎁
                    </div>
                  </div>
                  <div className="ad-ben-kpi-value">356</div>
                  <p className="ad-ben-kpi-label">Beneficios entregados</p>
                  <div className="ad-ben-kpi-footer">
                    <span className="ad-ben-trend">↗ +12%</span>
                    <div className="ad-mini-bars">
                      <span className="ad-mini-bar" style={{ height: "5px", background: "#86efac" }} />
                      <span className="ad-mini-bar" style={{ height: "8px", background: "#86efac" }} />
                      <span className="ad-mini-bar" style={{ height: "12px", background: "#86efac" }} />
                      <span className="ad-mini-bar" style={{ height: "10px", background: "#86efac" }} />
                      <span className="ad-mini-bar" style={{ height: "16px", background: "#16a34a" }} />
                    </div>
                  </div>
                </div>

                {/* KPI 3: Profesionales activos */}
                <div className="ad-ben-kpi-card orange">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div className="ad-ben-kpi-icon" style={{ background: "#ffedd5", color: "#ea580c" }}>
                      👥
                    </div>
                  </div>
                  <div className="ad-ben-kpi-value">634</div>
                  <p className="ad-ben-kpi-label">Profesionales activos</p>
                  <div className="ad-ben-kpi-footer">
                    <span className="ad-ben-trend">↗ +8%</span>
                    <div className="ad-mini-bars">
                      <span className="ad-mini-bar" style={{ height: "7px", background: "#fdba74" }} />
                      <span className="ad-mini-bar" style={{ height: "10px", background: "#fdba74" }} />
                      <span className="ad-mini-bar" style={{ height: "12px", background: "#fdba74" }} />
                      <span className="ad-mini-bar" style={{ height: "11px", background: "#fdba74" }} />
                      <span className="ad-mini-bar" style={{ height: "16px", background: "#ea580c" }} />
                    </div>
                  </div>
                </div>

                {/* KPI 4: Profesionales nivel Oro */}
                <div className="ad-ben-kpi-card blue">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div className="ad-ben-kpi-icon" style={{ background: "#dbeafe", color: "#2563eb" }}>
                      👑
                    </div>
                  </div>
                  <div className="ad-ben-kpi-value">48</div>
                  <p className="ad-ben-kpi-label">Profesionales nivel Oro</p>
                  <div className="ad-ben-kpi-footer">
                    <span className="ad-ben-trend">↗ +20%</span>
                    <div className="ad-mini-bars">
                      <span className="ad-mini-bar" style={{ height: "5px", background: "#93c5fd" }} />
                      <span className="ad-mini-bar" style={{ height: "8px", background: "#93c5fd" }} />
                      <span className="ad-mini-bar" style={{ height: "11px", background: "#93c5fd" }} />
                      <span className="ad-mini-bar" style={{ height: "13px", background: "#93c5fd" }} />
                      <span className="ad-mini-bar" style={{ height: "16px", background: "#2563eb" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Layout Dividido: Tabla de Profesionales (Izquierda) + Detalle (Derecha) */}
              <div
                className="ad-benefits-layout"
                style={{
                  gridTemplateColumns: isDetailPanelOpen ? "1fr 380px" : "1fr",
                }}
              >
                {/* COLUMNA IZQUIERDA: Pestañas, Filtros, Tabla y Paginación */}
                <div className="ad-card" style={{ padding: "0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  {/* Pestañas de niveles superiores */}
                  <div className="ad-level-tabs">
                    <button
                      type="button"
                      className={`ad-level-tab-btn ${benefitsTab === "Todos" ? "active" : ""}`}
                      onClick={() => setBenefitsTab("Todos")}
                    >
                      Todos (634)
                    </button>
                    <button
                      type="button"
                      className={`ad-level-tab-btn ${benefitsTab === "Bronce" ? "active" : ""}`}
                      onClick={() => setBenefitsTab("Bronce")}
                    >
                      Bronce (220)
                    </button>
                    <button
                      type="button"
                      className={`ad-level-tab-btn ${benefitsTab === "Plata" ? "active" : ""}`}
                      onClick={() => setBenefitsTab("Plata")}
                    >
                      Plata (180)
                    </button>
                    <button
                      type="button"
                      className={`ad-level-tab-btn ${benefitsTab === "Oro" ? "active" : ""}`}
                      onClick={() => setBenefitsTab("Oro")}
                    >
                      Oro (130)
                    </button>
                    <button
                      type="button"
                      className={`ad-level-tab-btn ${benefitsTab === "Destacados" ? "active" : ""}`}
                      onClick={() => setBenefitsTab("Destacados")}
                    >
                      Destacados (48)
                    </button>
                  </div>

                  {/* Barra de Búsqueda y Filtros */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "10px",
                      padding: "14px 16px",
                      background: "#f8fafc",
                      borderBottom: "1px solid var(--ad-border)",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ position: "relative", flex: "1 1 200px" }}>
                      <input
                        type="text"
                        className="ad-search-input"
                        placeholder="Buscar profesional por nombre o documento..."
                        value={benefitSearch}
                        onChange={(e) => setBenefitSearch(e.target.value)}
                        style={{ width: "100%", paddingLeft: "34px", height: "36px", fontSize: "0.82rem" }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          left: "10px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#94a3b8",
                          fontSize: "14px",
                        }}
                      >
                        🔍
                      </span>
                    </div>

                    <select
                      className="ad-search-input"
                      style={{ height: "36px", fontSize: "0.82rem", padding: "0 10px", minWidth: "120px" }}
                      value={benefitCategoryFilter}
                      onChange={(e) => setBenefitCategoryFilter(e.target.value)}
                    >
                      <option value="Todas">Categoría ⌵</option>
                      <option value="Electricidad">Electricidad</option>
                      <option value="Limpieza">Limpieza</option>
                      <option value="Plomería">Plomería</option>
                      <option value="Entrenamiento">Entrenamiento</option>
                      <option value="Mantenimiento">Mantenimiento</option>
                      <option value="Niñera">Niñera</option>
                      <option value="Jardinería">Jardinería</option>
                      <option value="Clases de inglés">Clases de inglés</option>
                    </select>

                    <select
                      className="ad-search-input"
                      style={{ height: "36px", fontSize: "0.82rem", padding: "0 10px", minWidth: "100px" }}
                      value={benefitCityFilter}
                      onChange={(e) => setBenefitCityFilter(e.target.value)}
                    >
                      <option value="Todas">Ciudad ⌵</option>
                      <option value="Bogotá">Bogotá</option>
                      <option value="Medellín">Medellín</option>
                      <option value="Cali">Cali</option>
                      <option value="Barranquilla">Barranquilla</option>
                    </select>

                    <select
                      className="ad-search-input"
                      style={{ height: "36px", fontSize: "0.82rem", padding: "0 10px", minWidth: "90px" }}
                      value={benefitLevelFilter}
                      onChange={(e) => setBenefitLevelFilter(e.target.value)}
                    >
                      <option value="Todos">Nivel ⌵</option>
                      <option value="Bronce">Bronce</option>
                      <option value="Plata">Plata</option>
                      <option value="Oro">Oro</option>
                      <option value="Destacados">Destacados</option>
                    </select>

                    <select
                      className="ad-search-input"
                      style={{ height: "36px", fontSize: "0.82rem", padding: "0 10px", minWidth: "95px" }}
                      value={benefitStatusFilter}
                      onChange={(e) => setBenefitStatusFilter(e.target.value)}
                    >
                      <option value="Todos">Estado ⌵</option>
                      <option value="Activo">Activo</option>
                      <option value="En revisión">En revisión</option>
                      <option value="Suspendido">Suspendido</option>
                    </select>

                    <button
                      type="button"
                      className="ad-btn ad-btn-secondary"
                      style={{ height: "36px", fontSize: "0.82rem", padding: "0 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      onClick={() => {
                        setBenefitSearch("");
                        setBenefitCategoryFilter("Todas");
                        setBenefitCityFilter("Todas");
                        setBenefitLevelFilter("Todos");
                        setBenefitStatusFilter("Todos");
                        setBenefitsTab("Todos");
                      }}
                    >
                      <span>⚙️</span> Más filtros
                    </button>

                    {!isDetailPanelOpen && (
                      <button
                        type="button"
                        className="ad-btn ad-btn-primary"
                        style={{ height: "36px", fontSize: "0.8rem", padding: "0 12px" }}
                        onClick={() => setIsDetailPanelOpen(true)}
                      >
                        📊 Ver Detalle
                      </button>
                    )}
                  </div>

                  {/* Tabla de Profesionales */}
                  <div className="ad-table-responsive">
                    <table className="ad-table">
                      <thead>
                        <tr>
                          <th style={{ width: "36px", textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={
                                selectedBenefitCheckboxIds.length === filteredBenefitPros.length &&
                                filteredBenefitPros.length > 0
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedBenefitCheckboxIds(filteredBenefitPros.map((p) => p.id));
                                } else {
                                  setSelectedBenefitCheckboxIds([]);
                                }
                              }}
                            />
                          </th>
                          <th>Profesional</th>
                          <th>Categoría</th>
                          <th>Ciudad</th>
                          <th>Puntos</th>
                          <th>Nivel</th>
                          <th style={{ textAlign: "center" }}>Beneficios canjeados</th>
                          <th>Estado</th>
                          <th style={{ textAlign: "right" }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBenefitPros.map((pro) => {
                          const isSelected = currentBenefitPro.id === pro.id;
                          return (
                            <tr
                              key={pro.id}
                              style={{
                                cursor: "pointer",
                                backgroundColor: isSelected ? "#f0f7ff" : undefined,
                              }}
                              onClick={() => {
                                setSelectedBenefitProId(pro.id);
                                setIsDetailPanelOpen(true);
                              }}
                            >
                              <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedBenefitCheckboxIds.includes(pro.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedBenefitCheckboxIds([...selectedBenefitCheckboxIds, pro.id]);
                                    } else {
                                      setSelectedBenefitCheckboxIds(
                                        selectedBenefitCheckboxIds.filter((id) => id !== pro.id)
                                      );
                                    }
                                  }}
                                />
                              </td>
                              <td>
                                <div className="ad-user-cell">
                                  <img src={pro.avatar} alt={pro.name} className="ad-table-avatar" />
                                  <div>
                                    <strong style={{ display: "block", color: "#0f172a" }}>{pro.name}</strong>
                                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{pro.document_id}</span>
                                  </div>
                                </div>
                              </td>
                              <td style={{ color: "#334155" }}>{pro.category}</td>
                              <td style={{ color: "#334155" }}>{pro.city}</td>
                              <td>
                                <strong style={{ color: "#0f172a" }}>{pro.points.toLocaleString("es-CO")}</strong>
                              </td>
                              <td>
                                <span className={`ad-level-pill ${pro.level.toLowerCase()}`}>
                                  {pro.level === "Oro" ? "👑 " : pro.level === "Plata" ? "🥈 " : "🥉 "}
                                  {pro.level}
                                </span>
                              </td>
                              <td style={{ textAlign: "center", color: "#334155", fontWeight: 700 }}>
                                {pro.redeemed_count}
                              </td>
                              <td>
                                <span
                                  className={`ad-badge-${
                                    pro.status === "Activo"
                                      ? "success"
                                      : pro.status === "En revisión"
                                      ? "warning"
                                      : "danger"
                                  }`}
                                >
                                  ● {pro.status}
                                </span>
                              </td>
                              <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                  <button
                                    type="button"
                                    className="ad-action-pill gift"
                                    title="Asignar Beneficio o Puntos"
                                    onClick={() =>
                                      handleOpenAssignBenefitsForPro({
                                        id: pro.id,
                                        display_name: pro.name,
                                        headline: pro.category,
                                        specialty_label: pro.category,
                                        is_verified: true,
                                        points: pro.points,
                                        wallet_balance: "50000",
                                        jobs_completed: pro.reviews_count,
                                        avatar_url: pro.avatar,
                                      } as any)
                                    }
                                  >
                                    🎁
                                  </button>
                                  <button
                                    type="button"
                                    className="ad-action-pill view"
                                    title="Ver detalle del profesional"
                                    onClick={() => {
                                      setSelectedBenefitProId(pro.id);
                                      setIsDetailPanelOpen(true);
                                    }}
                                  >
                                    📊
                                  </button>
                                  <button
                                    type="button"
                                    className="ad-action-pill neutral"
                                    title="Ver perfil completo"
                                    onClick={() =>
                                      handleViewProDetail({
                                        id: pro.id,
                                        display_name: pro.name,
                                        headline: pro.category,
                                        specialty_label: pro.category,
                                        city: pro.city,
                                        is_verified: true,
                                        is_active: pro.status === "Activo",
                                        document_id: pro.document_id,
                                        points: pro.points,
                                        wallet_balance: "50000",
                                        rating: pro.rating,
                                        jobs_completed: pro.reviews_count,
                                        avatar_url: pro.avatar,
                                      } as any)
                                    }
                                  >
                                    •••
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginación */}
                  <div className="ad-ben-pagination">
                    <div>Mostrando 1-8 de 634 profesionales</div>
                    <div className="ad-ben-page-nums">
                      <button type="button" className="ad-ben-page-btn" aria-label="Página anterior">‹</button>
                      <button type="button" className="ad-ben-page-btn active">1</button>
                      <button type="button" className="ad-ben-page-btn">2</button>
                      <button type="button" className="ad-ben-page-btn">3</button>
                      <button type="button" className="ad-ben-page-btn">4</button>
                      <button type="button" className="ad-ben-page-btn">5</button>
                      <span style={{ padding: "0 4px", color: "#94a3b8" }}>...</span>
                      <button type="button" className="ad-ben-page-btn" aria-label="Página siguiente">›</button>
                    </div>
                    <div>
                      <select className="ad-search-input" style={{ height: "30px", fontSize: "0.78rem", padding: "0 8px" }}>
                        <option>Mostrar 8 por página</option>
                        <option>Mostrar 15 por página</option>
                        <option>Mostrar 25 por página</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* COLUMNA DERECHA: Detalle del Profesional */}
                {isDetailPanelOpen && currentBenefitPro && (
                  <div className="ad-pro-detail-panel">
                    {/* Encabezado del Panel Lateral */}
                    <div className="ad-detail-header">
                      <h3>Detalle del profesional</h3>
                      <button
                        type="button"
                        className="ad-modal-close"
                        aria-label="Cerrar detalle"
                        onClick={() => setIsDetailPanelOpen(false)}
                      >
                        ✕
                      </button>
                    </div>

                    {/* Identidad del Profesional */}
                    <div className="ad-detail-identity">
                      <img src={currentBenefitPro.avatar} alt={currentBenefitPro.name} className="ad-detail-avatar" />
                      <div className="ad-detail-identity-meta">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <h4>{currentBenefitPro.name}</h4>
                          <span
                            className={`ad-badge-${
                              currentBenefitPro.status === "Activo"
                                ? "success"
                                : currentBenefitPro.status === "En revisión"
                                ? "warning"
                                : "danger"
                            }`}
                            style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                          >
                            ● {currentBenefitPro.status}
                          </span>
                        </div>
                        <p>{currentBenefitPro.document_id}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", fontSize: "0.82rem", color: "#64748b" }}>
                          <span style={{ color: "#f59e0b" }}>★</span>
                          <strong style={{ color: "#0f172a" }}>{currentBenefitPro.rating}</strong>
                          <span>({currentBenefitPro.reviews_count} reseñas)</span>
                        </div>
                      </div>
                    </div>

                    {/* Sub-pestañas */}
                    <div className="ad-detail-subtabs">
                      <button
                        type="button"
                        className={`ad-detail-subtab-btn ${benefitRightSubTab === "informacion" ? "active" : ""}`}
                        onClick={() => setBenefitRightSubTab("informacion")}
                      >
                        Información
                      </button>
                      <button
                        type="button"
                        className={`ad-detail-subtab-btn ${benefitRightSubTab === "puntos" ? "active" : ""}`}
                        onClick={() => setBenefitRightSubTab("puntos")}
                      >
                        Puntos y beneficios
                      </button>
                      <button
                        type="button"
                        className={`ad-detail-subtab-btn ${benefitRightSubTab === "historial" ? "active" : ""}`}
                        onClick={() => setBenefitRightSubTab("historial")}
                      >
                        Historial
                      </button>
                    </div>

                    {benefitRightSubTab === "puntos" && (
                      <>
                        {/* Caja: Puntos acumulados */}
                        <div className="ad-ben-points-card">
                          <div className="ad-ben-points-left">
                            <div className="ad-ben-star-icon">★</div>
                            <div>
                              <div style={{ fontSize: "0.76rem", color: "#64748b", fontWeight: 600 }}>Puntos acumulados</div>
                              <div className="ad-ben-points-num">{currentBenefitPro.points.toLocaleString("es-CO")}</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="ad-btn ad-btn-primary"
                            style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                            onClick={() =>
                              handleOpenAssignBenefitsForPro({
                                id: currentBenefitPro.id,
                                display_name: currentBenefitPro.name,
                                headline: currentBenefitPro.category,
                                specialty_label: currentBenefitPro.category,
                                is_verified: true,
                                points: currentBenefitPro.points,
                                wallet_balance: "50000",
                                jobs_completed: currentBenefitPro.reviews_count,
                                avatar_url: currentBenefitPro.avatar,
                              } as any)
                            }
                          >
                            Asignar puntos
                          </button>
                        </div>

                        {/* Caja: Nivel actual y progreso */}
                        <div className="ad-ben-level-box">
                          <div className="ad-ben-level-header">
                            <div>
                              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Nivel actual</span>
                              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                                {currentBenefitPro.level}
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <strong style={{ color: "#0f172a" }}>{currentBenefitPro.points.toLocaleString("es-CO")}</strong>
                              <span style={{ color: "#94a3b8" }}> / {currentBenefitPro.next_level_points.toLocaleString("es-CO")} puntos</span>
                            </div>
                          </div>
                          <div className="ad-ben-progress-bar">
                            <div
                              className="ad-ben-progress-fill"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.round((currentBenefitPro.points / currentBenefitPro.next_level_points) * 100)
                                )}%`,
                              }}
                            />
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                            {currentBenefitPro.next_level_points > currentBenefitPro.points
                              ? `Faltan ${(currentBenefitPro.next_level_points - currentBenefitPro.points).toLocaleString("es-CO")} puntos para ${
                                  currentBenefitPro.level === "Oro"
                                    ? "Nivel Platino"
                                    : currentBenefitPro.level === "Plata"
                                    ? "Nivel Oro"
                                    : "Nivel Plata"
                                }`
                              : "Nivel máximo alcanzado"}
                          </div>
                        </div>

                        {/* Lista: Beneficios canjeados */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h4 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 800, color: "#0f172a" }}>
                              Beneficios canjeados ({currentBenefitPro.redeemed_count})
                            </h4>
                          </div>
                          <div className="ad-ben-redeemed-list">
                            {currentBenefitPro.redeemed_history.map((item) => (
                              <div key={item.id} className="ad-ben-redeemed-item">
                                <div className="ad-ben-redeemed-item-left">
                                  <div className="ad-ben-redeemed-icon" style={{ background: item.iconBg }}>
                                    {item.icon}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1e293b", lineHeight: 1.2 }}>
                                      {item.title}
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "2px" }}>
                                      {item.date}
                                    </div>
                                  </div>
                                </div>
                                <span className="ad-badge-success" style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                                  {item.status}
                                </span>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            style={{
                              background: "none",
                              border: "none",
                              color: "#2563eb",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              textAlign: "left",
                              cursor: "pointer",
                              padding: "4px 0",
                            }}
                            onClick={() =>
                              alert(
                                `Historial de los ${currentBenefitPro.redeemed_count} beneficios de ${currentBenefitPro.name}`
                              )
                            }
                          >
                            Ver todos los {currentBenefitPro.redeemed_count} beneficios ➔
                          </button>
                        </div>

                        {/* Catálogo de Beneficios (Grid 4) */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <h4 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 800, color: "#0f172a" }}>
                            Catálogo de beneficios
                          </h4>
                          <div className="ad-ben-catalog-grid">
                            <button
                              type="button"
                              className="ad-ben-catalog-btn"
                              onClick={() => {
                                setPuntosToAdd(500);
                                setRecargaToAdd(20000);
                                setMotivoBeneficio("Recarga móvil 10GB");
                                handleOpenAssignBenefitsForPro({
                                  id: currentBenefitPro.id,
                                  display_name: currentBenefitPro.name,
                                  headline: currentBenefitPro.category,
                                  specialty_label: currentBenefitPro.category,
                                  is_verified: true,
                                  points: currentBenefitPro.points,
                                  wallet_balance: "50000",
                                  jobs_completed: currentBenefitPro.reviews_count,
                                  avatar_url: currentBenefitPro.avatar,
                                } as any);
                              }}
                            >
                              <div className="ad-ben-catalog-icon" style={{ background: "#e0f2fe", color: "#0284c7" }}>
                                📱
                              </div>
                              <span>Recarga móvil</span>
                              <span style={{ fontSize: "0.68rem", color: "#64748b" }}>500 pts</span>
                            </button>

                            <button
                              type="button"
                              className="ad-ben-catalog-btn"
                              onClick={() => {
                                setPuntosToAdd(1200);
                                setRecargaToAdd(50000);
                                setMotivoBeneficio("Seguro médico asistencial");
                                handleOpenAssignBenefitsForPro({
                                  id: currentBenefitPro.id,
                                  display_name: currentBenefitPro.name,
                                  headline: currentBenefitPro.category,
                                  specialty_label: currentBenefitPro.category,
                                  is_verified: true,
                                  points: currentBenefitPro.points,
                                  wallet_balance: "50000",
                                  jobs_completed: currentBenefitPro.reviews_count,
                                  avatar_url: currentBenefitPro.avatar,
                                } as any);
                              }}
                            >
                              <div className="ad-ben-catalog-icon" style={{ background: "#fee2e2", color: "#dc2626" }}>
                                🩺
                              </div>
                              <span>Seguro médico</span>
                              <span style={{ fontSize: "0.68rem", color: "#64748b" }}>1,200 pts</span>
                            </button>

                            <button
                              type="button"
                              className="ad-ben-catalog-btn"
                              onClick={() => {
                                setPuntosToAdd(800);
                                setRecargaToAdd(30000);
                                setMotivoBeneficio("Bono combustible");
                                handleOpenAssignBenefitsForPro({
                                  id: currentBenefitPro.id,
                                  display_name: currentBenefitPro.name,
                                  headline: currentBenefitPro.category,
                                  specialty_label: currentBenefitPro.category,
                                  is_verified: true,
                                  points: currentBenefitPro.points,
                                  wallet_balance: "50000",
                                  jobs_completed: currentBenefitPro.reviews_count,
                                  avatar_url: currentBenefitPro.avatar,
                                } as any);
                              }}
                            >
                              <div className="ad-ben-catalog-icon" style={{ background: "#fef3c7", color: "#d97706" }}>
                                ⛽
                              </div>
                              <span>Bono combustible</span>
                              <span style={{ fontSize: "0.68rem", color: "#64748b" }}>800 pts</span>
                            </button>

                            <button
                              type="button"
                              className="ad-ben-catalog-btn"
                              onClick={() => {
                                setPuntosToAdd(2000);
                                setRecargaToAdd(100000);
                                setMotivoBeneficio("Kit de herramientas profesionales");
                                handleOpenAssignBenefitsForPro({
                                  id: currentBenefitPro.id,
                                  display_name: currentBenefitPro.name,
                                  headline: currentBenefitPro.category,
                                  specialty_label: currentBenefitPro.category,
                                  is_verified: true,
                                  points: currentBenefitPro.points,
                                  wallet_balance: "50000",
                                  jobs_completed: currentBenefitPro.reviews_count,
                                  avatar_url: currentBenefitPro.avatar,
                                } as any);
                              }}
                            >
                              <div className="ad-ben-catalog-icon" style={{ background: "#f3e8ff", color: "#9333ea" }}>
                                🛠️
                              </div>
                              <span>Herramientas</span>
                              <span style={{ fontSize: "0.68rem", color: "#64748b" }}>2,000 pts</span>
                            </button>
                          </div>
                        </div>

                        {/* Acciones para este profesional (Grid 2x2) */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <h4 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 800, color: "#0f172a" }}>
                            Acciones para este profesional
                          </h4>
                          <div className="ad-ben-actions-grid">
                            <button
                              type="button"
                              className="ad-ben-act-btn green"
                              onClick={() =>
                                handleOpenAssignBenefitsForPro({
                                  id: currentBenefitPro.id,
                                  display_name: currentBenefitPro.name,
                                  headline: currentBenefitPro.category,
                                  specialty_label: currentBenefitPro.category,
                                  is_verified: true,
                                  points: currentBenefitPro.points,
                                  wallet_balance: "50000",
                                  jobs_completed: currentBenefitPro.reviews_count,
                                  avatar_url: currentBenefitPro.avatar,
                                } as any)
                              }
                            >
                              <span>🎁</span> Asignar beneficio
                            </button>

                            <button
                              type="button"
                              className="ad-ben-act-btn amber"
                              onClick={() => {
                                setPuntosToAdd(200);
                                setRecargaToAdd(0);
                                setMotivoBeneficio("Ajuste manual de puntos");
                                handleOpenAssignBenefitsForPro({
                                  id: currentBenefitPro.id,
                                  display_name: currentBenefitPro.name,
                                  headline: currentBenefitPro.category,
                                  specialty_label: currentBenefitPro.category,
                                  is_verified: true,
                                  points: currentBenefitPro.points,
                                  wallet_balance: "50000",
                                  jobs_completed: currentBenefitPro.reviews_count,
                                  avatar_url: currentBenefitPro.avatar,
                                } as any);
                              }}
                            >
                              <span>💰</span> Ajustar puntos
                            </button>

                            <button
                              type="button"
                              className="ad-ben-act-btn neutral"
                              onClick={() =>
                                handleViewProDetail({
                                  id: currentBenefitPro.id,
                                  display_name: currentBenefitPro.name,
                                  headline: currentBenefitPro.category,
                                  specialty_label: currentBenefitPro.category,
                                  city: currentBenefitPro.city,
                                  is_verified: true,
                                  is_active: currentBenefitPro.status === "Activo",
                                  document_id: currentBenefitPro.document_id,
                                  points: currentBenefitPro.points,
                                  wallet_balance: "50000",
                                  rating: currentBenefitPro.rating,
                                  jobs_completed: currentBenefitPro.reviews_count,
                                  avatar_url: currentBenefitPro.avatar,
                                } as any)
                              }
                            >
                              <span>👤</span> Ver perfil completo
                            </button>

                            <button
                              type="button"
                              className="ad-ben-act-btn danger"
                              onClick={() => {
                                setTargetUserToBlock(currentBenefitPro.name);
                                setTargetIdToBlock(currentBenefitPro.id);
                                setBlockReason("Incumplimiento de términos en módulo de beneficios");
                                setBlockType("temporal");
                                setBlockDuration("7");
                                setModalBloqueoOpen(true);
                              }}
                            >
                              <span>🚫</span> Suspender cuenta
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {benefitRightSubTab === "informacion" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.85rem" }}>
                        <div className="ad-card" style={{ padding: "14px", background: "#f8fafc" }}>
                          <div style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: "4px" }}>Especialidad principal</div>
                          <strong style={{ color: "#0f172a" }}>{currentBenefitPro.category}</strong>
                        </div>
                        <div className="ad-card" style={{ padding: "14px", background: "#f8fafc" }}>
                          <div style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: "4px" }}>Ciudad de cobertura</div>
                          <strong style={{ color: "#0f172a" }}>{currentBenefitPro.city}</strong>
                        </div>
                        <div className="ad-card" style={{ padding: "14px", background: "#f8fafc" }}>
                          <div style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: "4px" }}>Documento oficial</div>
                          <strong style={{ color: "#0f172a" }}>{currentBenefitPro.document_id}</strong>
                        </div>
                        <div className="ad-card" style={{ padding: "14px", background: "#f8fafc" }}>
                          <div style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: "4px" }}>Servicios realizados con éxito</div>
                          <strong style={{ color: "#16a34a" }}>{currentBenefitPro.reviews_count} servicios calificados</strong>
                        </div>
                      </div>
                    )}

                    {benefitRightSubTab === "historial" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.82rem" }}>
                        <div className="ad-card" style={{ padding: "12px", background: "#f8fafc" }}>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>🎁 Acreditación de puntos automáticos</div>
                          <div style={{ color: "#64748b", fontSize: "0.74rem" }}>Servicio completado #1049 (+100 pts)</div>
                          <div style={{ color: "#94a3b8", fontSize: "0.7rem", marginTop: "2px" }}>Ayer a las 14:30</div>
                        </div>
                        <div className="ad-card" style={{ padding: "12px", background: "#f8fafc" }}>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>⭐ Ascenso a nivel {currentBenefitPro.level}</div>
                          <div style={{ color: "#64748b", fontSize: "0.74rem" }}>Cumplimiento de meta de calificación 4.8+</div>
                          <div style={{ color: "#94a3b8", fontSize: "0.7rem", marginTop: "2px" }}>Hace 2 semanas</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              VISTA: HISTORIAL DE AUDITORÍA
             ═════════════════════════════════════════════════════════════════ */}
          {activeMenu === "auditoria" && (
            <section className="ad-audit-view" aria-label="Historial de Auditoría">
              <div className="ad-view-header">
                <div>
                  <h2 className="ad-view-header-title">📜 Historial de Auditoría y Trazabilidad</h2>
                  <p className="ad-view-header-subtitle">
                    Registro cronológico inmutable de todas las acciones administrativas realizadas en Serviprox.
                  </p>
                </div>
              </div>
              <div className="ad-card" style={{ padding: "0", overflow: "hidden" }}>
                <div className="ad-table-responsive">
                  <table className="ad-table">
                    <thead>
                      <tr>
                        <th>Administrador</th>
                        <th>Acción Ejecutada</th>
                        <th>Objetivo / Usuario</th>
                        <th>Fecha y Hora</th>
                        <th>Motivo Documentado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id}>
                          <td><strong>{log.adminName}</strong></td>
                          <td>
                            <span className="ad-badge-neutral">{log.action}</span>
                          </td>
                          <td><strong>{log.target}</strong></td>
                          <td style={{ color: "#64748b", fontSize: "0.82rem" }}>{log.date}</td>
                          <td style={{ fontSize: "0.84rem", color: "#334155" }}>{log.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              VISTAS DE MÓDULOS ADICIONALES (FALLAS, CONTRATACIONES, ETC.)
             ═════════════════════════════════════════════════════════════════ */}
          {activeMenu !== "inicio" &&
            activeMenu !== "usuarios_clientes" &&
            activeMenu !== "usuarios_profesionales" &&
            activeMenu !== "pqr" &&
            activeMenu !== "beneficios" &&
            activeMenu !== "auditoria" && (
              <div className="ad-card" style={{ padding: "32px", textAlign: "center" }}>
                <div style={{ fontSize: "3rem", marginBottom: "12px" }}>📋</div>
                <h3 style={{ margin: "0 0 8px" }}>Módulo de {activeMenu.replace("_", " ").toUpperCase()}</h3>
                <p style={{ color: "#64748b", maxWidth: "500px", margin: "0 auto 20px" }}>
                  Este módulo está conectado a la base de datos de Serviprox. Puedes regresar al panel de control principal o seleccionar otra sección del menú lateral.
                </p>
                <button
                  type="button"
                  className="ad-btn ad-btn-primary"
                  onClick={() => setActiveMenu("inicio")}
                >
                  Volver a Inicio
                </button>
              </div>
            )}
        </div>
      </main>

      {/* ═════════════════════════════════════════════════════════════════════
          MODAL: BLOQUEAR CUENTA (SEGÚN REQUERIMIENTO OFICIAL)
         ═════════════════════════════════════════════════════════════════════ */}
      {modalBloqueoOpen && (
        <div className="ad-modal-backdrop" onClick={() => setModalBloqueoOpen(false)}>
          <div className="ad-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ad-modal-header">
              <h3>🔒 Bloqueo Disciplinario de Cuenta</h3>
              <button
                type="button"
                className="ad-modal-close"
                onClick={() => setModalBloqueoOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="ad-modal-body">
              <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569" }}>
                Aplica sanciones o suspensiones temporales/permanentes por incumplimiento de normas.
                Esta acción se registrará formalmente en el <strong>Historial de Auditoría</strong>.
              </p>

              <div className="ad-form-group">
                <label>Usuario / Contratista:</label>
                <input
                  type="text"
                  className="ad-form-control"
                  value={targetUserToBlock}
                  onChange={(e) => setTargetUserToBlock(e.target.value)}
                  placeholder="Nombre o correo del usuario"
                />
              </div>

              <div className="ad-form-group">
                <label>Tipo de Sanción:</label>
                <select
                  className="ad-form-control"
                  value={blockType}
                  onChange={(e) => setBlockType(e.target.value as any)}
                >
                  <option value="temporal">Suspensión Temporal</option>
                  <option value="permanente">Bloqueo Definitivo y Expulsión</option>
                </select>
              </div>

              {blockType === "temporal" && (
                <div className="ad-form-group">
                  <label>Duración de la suspensión:</label>
                  <select
                    className="ad-form-control"
                    value={blockDuration}
                    onChange={(e) => setBlockDuration(e.target.value)}
                  >
                    <option value="3">3 Días (Amonestación leve)</option>
                    <option value="7">7 Días (Reiteración de falta)</option>
                    <option value="15">15 Días (Falta grave a cliente)</option>
                    <option value="30">30 Días (Investigación en Defensoría)</option>
                  </select>
                </div>
              )}

              <div className="ad-form-group">
                <label>Motivo justificado (Requerido para trazabilidad):</label>
                <textarea
                  className="ad-form-control"
                  rows={3}
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Describe detalladamente los hechos, pruebas o radicados PQR que sustentan la sanción..."
                />
              </div>
            </div>
            <div className="ad-modal-footer">
              <button
                type="button"
                className="ad-btn ad-btn-secondary"
                onClick={() => setModalBloqueoOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="ad-btn ad-btn-danger"
                disabled={!blockReason.trim()}
                onClick={confirmBlockUser}
              >
                Aplicar Bloqueo y Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          MODAL: ASIGNAR BENEFICIOS Y PUNTOS
         ═════════════════════════════════════════════════════════════════════ */}
      {modalBeneficiosOpen && targetProBeneficio && (
        <div className="ad-modal-backdrop" onClick={() => setModalBeneficiosOpen(false)}>
          <div className="ad-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ad-modal-header">
              <h3>🎁 Asignar Puntos y Beneficios</h3>
              <button
                type="button"
                className="ad-modal-close"
                onClick={() => setModalBeneficiosOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="ad-modal-body">
              <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "#f8fafc", padding: "12px", borderRadius: "12px" }}>
                <img src={targetProBeneficio.avatar} alt="" style={{ width: "44px", height: "44px", borderRadius: "50%" }} />
                <div>
                  <strong style={{ fontSize: "0.95rem" }}>{targetProBeneficio.name}</strong>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
                    {targetProBeneficio.specialty} • Puntos actuales: {targetProBeneficio.points} pts
                  </p>
                </div>
              </div>

              <div className="ad-form-group">
                <label>Puntos a acreditar:</label>
                <input
                  type="number"
                  className="ad-form-control"
                  value={puntosToAdd}
                  onChange={(e) => setPuntosToAdd(Number(e.target.value))}
                />
              </div>

              <div className="ad-form-group">
                <label>Bono o Recarga en COP:</label>
                <input
                  type="number"
                  className="ad-form-control"
                  value={recargaToAdd}
                  onChange={(e) => setRecargaToAdd(Number(e.target.value))}
                />
              </div>

              <div className="ad-form-group">
                <label>Motivo del reconocimiento:</label>
                <input
                  type="text"
                  className="ad-form-control"
                  value={motivoBeneficio}
                  onChange={(e) => setMotivoBeneficio(e.target.value)}
                  placeholder="Ej. Cumplimiento de metas de calidad mensual"
                />
              </div>
            </div>
            <div className="ad-modal-footer">
              <button
                type="button"
                className="ad-btn ad-btn-secondary"
                onClick={() => setModalBeneficiosOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="ad-btn ad-btn-primary"
                onClick={confirmAssignBenefits}
              >
                Acreditar Beneficios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          MODAL: DETALLES DE SOLICITUD / PQR / FALLA
         ═════════════════════════════════════════════════════════════════════ */}
      {/* ═════════════════════════════════════════════════════════════════════
          MODAL: DETALLES DE CLIENTE / PROFESIONAL / SOLICITUD
         ═════════════════════════════════════════════════════════════════════ */}
      {modalDetailOpen && selectedDetailItem && (
        <div className="ad-modal-backdrop" onClick={() => setModalDetailOpen(false)}>
          <div className="ad-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ad-modal-header">
              <h3>
                {selectedDetailItem.detailType === "client"
                  ? "👤 Expediente del Cliente"
                  : selectedDetailItem.detailType === "pro"
                  ? "🛡️ Expediente Técnico del Profesional"
                  : `Detalles de ${selectedDetailItem.type || "Elemento"}`}
              </h3>
              <button
                type="button"
                className="ad-modal-close"
                onClick={() => setModalDetailOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="ad-modal-body">
              {selectedDetailItem.detailType === "client" ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div className="ad-avatar-initials" style={{ width: "50px", height: "50px", fontSize: "1.1rem" }}>
                      {selectedDetailItem.full_name?.substring(0, 2).toUpperCase() || "CL"}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "1.15rem", color: "#0f172a" }}>
                        {selectedDetailItem.full_name}
                      </h4>
                      <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                        {selectedDetailItem.email}
                      </p>
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Documento (Cédula)</span>
                      <p style={{ margin: "2px 0 0", fontWeight: 700, color: "#1e293b", fontSize: "0.9rem" }}>{selectedDetailItem.document_id}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Verificación de Identidad</span>
                      <p style={{ margin: "2px 0 0" }}>
                        <span className={selectedDetailItem.is_identity_verified ? "ad-badge-success" : "ad-badge-warning"}>
                          {selectedDetailItem.is_identity_verified ? "✓ Documento Validado" : "⏳ Pendiente"}
                        </span>
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Teléfono Móvil</span>
                      <p style={{ margin: "2px 0 0", fontWeight: 600, color: "#1e293b", fontSize: "0.88rem" }}>{selectedDetailItem.phone}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Ciudad / Dirección</span>
                      <p style={{ margin: "2px 0 0", fontWeight: 600, color: "#1e293b", fontSize: "0.88rem" }}>{selectedDetailItem.address}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Servicios Contratados</span>
                      <p style={{ margin: "2px 0 0", fontWeight: 700, color: "#2563eb", fontSize: "0.95rem" }}>
                        📋 {selectedDetailItem.requests_count} solicitud(es)
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Estado Disciplinario</span>
                      <p style={{ margin: "2px 0 0" }}>
                        <span className={selectedDetailItem.is_active ? "ad-badge-success" : "ad-badge-danger"}>
                          {selectedDetailItem.is_active ? "● Cuenta Activa" : "🔒 Cuenta Bloqueada"}
                        </span>
                      </p>
                    </div>
                  </div>
                </>
              ) : selectedDetailItem.detailType === "pro" ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <img
                      src={selectedDetailItem.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=240&auto=format&fit=crop"}
                      alt={selectedDetailItem.display_name}
                      style={{ width: "52px", height: "52px", borderRadius: "50%", objectFit: "cover" }}
                    />
                    <div>
                      <h4 style={{ margin: 0, fontSize: "1.15rem", color: "#0f172a" }}>
                        {selectedDetailItem.display_name}
                      </h4>
                      <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                        {selectedDetailItem.headline || selectedDetailItem.specialty_label || "Especialista"}
                      </p>
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Calificación / Desempeño</span>
                      <p style={{ margin: "2px 0 0", fontWeight: 700, color: "#1e293b", fontSize: "0.9rem" }}>
                        ★ {selectedDetailItem.rating_avg} ({selectedDetailItem.jobs_completed} trabajos completados)
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Tarjeta Profesional</span>
                      <p style={{ margin: "2px 0 0" }}>
                        <span className={selectedDetailItem.is_verified ? "ad-badge-success" : "ad-badge-warning"}>
                          {selectedDetailItem.is_verified ? "✓ Tarjeta Aprobada" : "⏳ Pendiente Revisión"}
                        </span>
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Puntos de Incentivo</span>
                      <p style={{ margin: "2px 0 0", fontWeight: 700, color: "#7e22ce", fontSize: "0.95rem" }}>
                        💎 {selectedDetailItem.points || 0} pts
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Saldo en Billetera</span>
                      <p style={{ margin: "2px 0 0", fontWeight: 700, color: "#16a34a", fontSize: "0.95rem" }}>
                        💳 ${Number(selectedDetailItem.wallet_balance || 0).toLocaleString("es-CO")} COP
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Teléfono Móvil</span>
                      <p style={{ margin: "2px 0 0", fontWeight: 600, color: "#1e293b", fontSize: "0.88rem" }}>{selectedDetailItem.phone}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Ubicación</span>
                      <p style={{ margin: "2px 0 0", fontWeight: 600, color: "#1e293b", fontSize: "0.88rem" }}>
                        {selectedDetailItem.neighborhood ? `${selectedDetailItem.neighborhood}, ${selectedDetailItem.city || "Bogotá"}` : (selectedDetailItem.city || "Bogotá")}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "24px" }}>{selectedDetailItem.typeIcon}</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "1.05rem" }}>{selectedDetailItem.title}</h4>
                      <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                        Publicado por {selectedDetailItem.userName} el {selectedDetailItem.date}
                      </span>
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <strong style={{ fontSize: "0.82rem", color: "#475569", textTransform: "uppercase" }}>Estado actual:</strong>
                    <div style={{ marginTop: "4px" }}>
                      <span className={`ad-status-pill ${selectedDetailItem.statusClass}`}>
                        {selectedDetailItem.status}
                      </span>
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: "0.88rem", color: "#334155", lineHeight: 1.5 }}>
                    Este registro ha sido evaluado bajo los lineamientos técnicos de Serviprox. Puedes aprobarlo
                    inmediatamente para publicación en el catálogo o solicitar ajustes al usuario.
                  </p>
                </>
              )}
            </div>
            <div className="ad-modal-footer">
              <button
                type="button"
                className="ad-btn ad-btn-secondary"
                onClick={() => setModalDetailOpen(false)}
              >
                Cerrar
              </button>
              {selectedDetailItem.detailType === "client" ? (
                <>
                  <button
                    type="button"
                    className="ad-btn ad-btn-primary"
                    onClick={() => {
                      handleToggleClientVerification(selectedDetailItem);
                      setModalDetailOpen(false);
                    }}
                  >
                    {selectedDetailItem.is_identity_verified ? "Revocar Cédula" : "✓ Validar Cédula"}
                  </button>
                  {selectedDetailItem.is_active ? (
                    <button
                      type="button"
                      className="ad-btn ad-btn-danger"
                      onClick={() => {
                        setTargetUserToBlock(selectedDetailItem.full_name);
                        setTargetIdToBlock(selectedDetailItem.id);
                        setModalDetailOpen(false);
                        setModalBloqueoOpen(true);
                      }}
                    >
                      🔒 Bloquear Cliente
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ad-btn"
                      style={{ background: "#16a34a", color: "#ffffff" }}
                      onClick={() => {
                        handleUnblockUser(selectedDetailItem.id, selectedDetailItem.full_name);
                        setModalDetailOpen(false);
                      }}
                    >
                      🔓 Desbloquear Cliente
                    </button>
                  )}
                </>
              ) : selectedDetailItem.detailType === "pro" ? (
                <>
                  <button
                    type="button"
                    className="ad-btn ad-btn-primary"
                    onClick={() => {
                      handleToggleProVerification(selectedDetailItem);
                      setModalDetailOpen(false);
                    }}
                  >
                    {selectedDetailItem.is_verified ? "Revocar Tarjeta" : "✓ Aprobar Tarjeta"}
                  </button>
                  <button
                    type="button"
                    className="ad-btn"
                    style={{ background: "#7e22ce", color: "#ffffff" }}
                    onClick={() => {
                      setModalDetailOpen(false);
                      handleOpenAssignBenefitsForPro(selectedDetailItem);
                    }}
                  >
                    🎁 Asignar Puntos
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="ad-btn ad-btn-primary"
                  onClick={() => {
                    handleApprove(selectedDetailItem.id);
                    setModalDetailOpen(false);
                  }}
                >
                  Aprobar Publicación
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          MODAL: RESPONDER A PQR Y NOTIFICAR AL CLIENTE
         ═════════════════════════════════════════════════════════════════════ */}
      {modalReplyPqrOpen && targetPqrToReply && (
        <div className="ad-modal-backdrop" onClick={() => setModalReplyPqrOpen(false)}>
          <div className="ad-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px" }}>
            <div className="ad-modal-header">
              <h3>💬 Responder Caso y Notificar al Cliente</h3>
              <button
                type="button"
                className="ad-modal-close"
                onClick={() => setModalReplyPqrOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="ad-modal-body">
              <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: "#2563eb", fontSize: "0.95rem" }}>{targetPqrToReply.id}</strong>
                  <span
                    className={`ad-pqr-status-pill ${
                      targetPqrToReply.status === "En revisión"
                        ? "revision"
                        : targetPqrToReply.status === "Abierta"
                        ? "abierta"
                        : targetPqrToReply.status === "En proceso"
                        ? "proceso"
                        : "resuelta"
                    }`}
                  >
                    {targetPqrToReply.status}
                  </span>
                </div>
                <h4 style={{ margin: "4px 0 2px", fontSize: "0.95rem", color: "#0f172a" }}>
                  {targetPqrToReply.title}
                </h4>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
                  Usuario: <strong>{targetPqrToReply.client.name}</strong> • {targetPqrToReply.client.document_id}
                </p>
              </div>

              <div className="ad-form-group" style={{ marginTop: "14px" }}>
                <label>Actualizar estado del caso:</label>
                <select
                  className="ad-form-control"
                  value={replyPqrStatus}
                  onChange={(e) => setReplyPqrStatus(e.target.value as any)}
                >
                  <option value="En proceso">En proceso (Investigación técnica en curso)</option>
                  <option value="En revisión">En revisión (Solicitud de pruebas adicionales)</option>
                  <option value="Resuelta">Resuelta (Solución brindada satisfactoriamente)</option>
                  <option value="Cerrada">Cerrada (Caso finalizado y archivado)</option>
                </select>
              </div>

              <div className="ad-form-group">
                <label>Respuesta oficial para el cliente:</label>
                <textarea
                  className="ad-form-control"
                  rows={4}
                  value={replyPqrText}
                  onChange={(e) => setReplyPqrText(e.target.value)}
                  placeholder="Estimado cliente, respecto a su solicitud le informamos que hemos revisado los antecedentes del caso y procedemos a..."
                />
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  background: "#eff6ff",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid #bfdbfe",
                }}
              >
                <input
                  type="checkbox"
                  id="sendNotifCheck"
                  checked={replySendNotification}
                  onChange={(e) => setReplySendNotification(e.target.checked)}
                  style={{ marginTop: "3px", width: "16px", height: "16px", cursor: "pointer" }}
                />
                <label htmlFor="sendNotifCheck" style={{ fontSize: "0.82rem", color: "#1e40af", cursor: "pointer", margin: 0 }}>
                  <strong>Enviar notificación inmediata al cliente</strong>
                  <span style={{ display: "block", color: "#3b82f6", fontSize: "0.75rem", marginTop: "2px" }}>
                    El usuario recibirá una alerta push en su aplicación móvil y correo electrónico registrado con el detalle de la respuesta.
                  </span>
                </label>
              </div>
            </div>
            <div className="ad-modal-footer">
              <button
                type="button"
                className="ad-btn ad-btn-secondary"
                onClick={() => setModalReplyPqrOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="ad-btn ad-btn-primary"
                disabled={!replyPqrText.trim()}
                onClick={handleConfirmReplyPqr}
              >
                Enviar Respuesta y Notificar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          MODAL: NUEVA SOLICITUD / PQR (REGISTRO MANUAL)
         ═════════════════════════════════════════════════════════════════════ */}
      {modalNewPqrOpen && (
        <div className="ad-modal-backdrop" onClick={() => setModalNewPqrOpen(false)}>
          <div className="ad-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "540px" }}>
            <div className="ad-modal-header">
              <h3>+ Nueva Solicitud (Registro Manual)</h3>
              <button
                type="button"
                className="ad-modal-close"
                onClick={() => setModalNewPqrOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="ad-modal-body">
              <div className="ad-form-group">
                <label>Tipo de solicitud:</label>
                <select
                  className="ad-form-control"
                  value={newPqrType}
                  onChange={(e) => setNewPqrType(e.target.value as any)}
                >
                  <option value="queja">Queja (Inconformidad por servicio o conducta)</option>
                  <option value="reclamo">Reclamo (Cobro indebido, garantía o dinero)</option>
                  <option value="peticion">Petición (Solicitud de información o documentos)</option>
                  <option value="reporte">Reporte de falla técnica en la app</option>
                </select>
              </div>

              <div className="ad-form-group">
                <label>Título o asunto:</label>
                <input
                  type="text"
                  className="ad-form-control"
                  placeholder="Ej: Inconformidad con trabajo eléctrico"
                  value={newPqrTitle}
                  onChange={(e) => setNewPqrTitle(e.target.value)}
                />
              </div>

              <div className="ad-form-group">
                <label>Nombre del cliente que reporta:</label>
                <input
                  type="text"
                  className="ad-form-control"
                  placeholder="Ej: Laura Gómez"
                  value={newPqrClientName}
                  onChange={(e) => setNewPqrClientName(e.target.value)}
                />
              </div>

              <div className="ad-form-group">
                <label>Relacionado con (Servicio / Profesional / Contratación):</label>
                <input
                  type="text"
                  className="ad-form-control"
                  placeholder="Ej: Contratación #558 / Andrés López"
                  value={newPqrRelatedTo}
                  onChange={(e) => setNewPqrRelatedTo(e.target.value)}
                />
              </div>

              <div className="ad-form-group">
                <label>Prioridad:</label>
                <select
                  className="ad-form-control"
                  value={newPqrPriority}
                  onChange={(e) => setNewPqrPriority(e.target.value as any)}
                >
                  <option value="Alta">● Alta (Urgencia de atención)</option>
                  <option value="Media">● Media (Plazo estándar)</option>
                  <option value="Baja">● Baja (Informativo)</option>
                </select>
              </div>

              <div className="ad-form-group">
                <label>Descripción detallada de los hechos:</label>
                <textarea
                  className="ad-form-control"
                  rows={3}
                  placeholder="Describe con claridad lo sucedido para que el equipo de soporte actúe..."
                  value={newPqrDescription}
                  onChange={(e) => setNewPqrDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="ad-modal-footer">
              <button
                type="button"
                className="ad-btn ad-btn-secondary"
                onClick={() => setModalNewPqrOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="ad-btn ad-btn-primary"
                onClick={handleCreateManualPqr}
              >
                Registrar Solicitud en BD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

