export const ALL_COLOMBIA_OPTION = "Toda Colombia";

export const TOP_COLOMBIA_CITIES = [
  "Toda Colombia",
  "Bogotá",
  "Medellín",
  "Cali",
  "Barranquilla",
  "Cartagena",
  "Bucaramanga",
  "Pereira",
  "Manizales",
  "Santa Marta",
  "Cúcuta",
  "Ibagué",
  "Villavicencio",
  "Pasto",
  "Montería",
  "Valledupar",
  "Neiva",
  "Armenia",
  "Popayán",
  "Sincelejo",
  "Tunja",
  "Riohacha",
];

export const COLOMBIA_DEPARTMENTS: Record<string, string[]> = {
  "Bogotá D.C.": ["Bogotá"],
  "Antioquia": [
    "Medellín", "Bello", "Itagüí", "Envigado", "Rionegro", "Apartadó", "Turbo", "Caucasia",
    "Sabaneta", "Caldas", "Copacabana", "La Ceja", "Marinilla", "Guarne", "Girardota", "Santa Rosa de Osos"
  ],
  "Valle del Cauca": [
    "Cali", "Buenaventura", "Palmira", "Tuluá", "Yumbo", "Cartago", "Buga", "Jamundí",
    "Candelaria", "Florida", "Pradera", "Sevilla", "Zarzal"
  ],
  "Atlántico": [
    "Barranquilla", "Soledad", "Malambo", "Sabanalarga", "Puerto Colombia", "Baranoa", "Galapa", "Palmar de Varela"
  ],
  "Santander": [
    "Bucaramanga", "Floridablanca", "Girón", "Piedecuesta", "Barrancabermeja", "San Gil",
    "Socorro", "Lebrija", "Barbosa", "Cimitarra"
  ],
  "Bolívar": [
    "Cartagena", "Magangué", "El Carmen de Bolívar", "Turbaco", "Arjona", "Santa Rosa del Sur", "San Juan Nepomuceno"
  ],
  "Cundinamarca": [
    "Soacha", "Chía", "Zipaquirá", "Facatativá", "Fusagasugá", "Mosquera", "Madrid", "Funza",
    "Cajicá", "Girardot", "Sopó", "Cota", "Tocancipá", "La Calera", "Tabio", "Tenjo", "Villeta", "Ubaté"
  ],
  "Risaralda": [
    "Pereira", "Dosquebradas", "Santa Rosa de Cabal", "La Virginia", "Belén de Umbría", "Santuario"
  ],
  "Caldas": [
    "Manizales", "La Dorada", "Chinchiná", "Villamaría", "Anserma", "Riosucio", "Salamina"
  ],
  "Quindío": [
    "Armenia", "Calarcá", "Montenegro", "Quimbaya", "La Tebaida", "Circasia", "Salento"
  ],
  "Tolima": [
    "Ibagué", "Espinal", "Melgar", "Mariquita", "Chaparral", "Honda", "Líbano", "Flandes", "Guamo"
  ],
  "Huila": [
    "Neiva", "Pitalito", "Garzón", "La Plata", "Campoalegre", "San Agustín"
  ],
  "Norte de Santander": [
    "Cúcuta", "Ocaña", "Pamplona", "Villa del Rosario", "Los Patios", "Tibú", "Chinácota"
  ],
  "Boyacá": [
    "Tunja", "Duitama", "Sogamoso", "Chiquinquirá", "Puerto Boyacá", "Paipa", "Villa de Leyva", "Moniquirá", "Garagoa"
  ],
  "Meta": [
    "Villavicencio", "Acacías", "Granada", "Puerto López", "San Martín", "Cumaral"
  ],
  "Nariño": [
    "Pasto", "Tumaco", "Ipiales", "Túquerres", "Samaniego", "La Unión", "Sandoná"
  ],
  "Magdalena": [
    "Santa Marta", "Ciénaga", "Fundación", "El Banco", "Plato", "Aracataca", "Pivijay"
  ],
  "Cesar": [
    "Valledupar", "Aguachica", "Agustín Codazzi", "Bosconia", "Curumaní", "La Jagua de Ibirico"
  ],
  "Córdoba": [
    "Montería", "Lorica", "Cereté", "Sahagún", "Montelíbano", "Planeta Rica", "Tierralta"
  ],
  "Sucre": [
    "Sincelejo", "Corozal", "San Marcos", "San Onofre", "Tolú", "Sampués", "Coveñas"
  ],
  "Cauca": [
    "Popayán", "Santander de Quilichao", "Puerto Tejada", "Patía", "Piendamó", "El Tambo"
  ],
  "La Guajira": [
    "Riohacha", "Maicao", "Uribia", "Fonseca", "San Juan del Cesar", "Barrancas"
  ],
  "Casanare": [
    "Yopal", "Aguazul", "Villanueva", "Tauramena", "Paz de Ariporo", "Monterrey"
  ],
  "Caquetá": [
    "Florencia", "San Vicente del Caguán", "Cartagena del Chairá", "Puerto Rico"
  ],
  "Chocó": [
    "Quibdó", "Istmina", "Condoto", "Tadó", "Bahía Solano", "Acandí"
  ],
  "Arauca": [
    "Arauca", "Tame", "Saravena", "Fortul", "Arauquita"
  ],
  "Putumayo": [
    "Mocoa", "Puerto Asís", "Orito", "Valle del Guamuez", "Sibundoy"
  ],
  "San Andrés y Providencia": [
    "San Andrés", "Providencia"
  ],
  "Amazonas": [
    "Leticia", "Puerto Nariño"
  ],
  "Guaviare": [
    "San José del Guaviare", "El Retorno", "Calamar"
  ],
  "Guainía": [
    "Inírida", "Barranco Minas"
  ],
  "Vaupés": [
    "Mitú", "Carurú", "Taraira"
  ],
  "Vichada": [
    "Puerto Carreño", "Santa Rosalía", "Cumaribo", "La Primavera"
  ],
};

export interface ColombiaCityItem {
  city: string;
  department: string;
}

export const ALL_COLOMBIA_CITIES_FLAT: ColombiaCityItem[] = Object.entries(COLOMBIA_DEPARTMENTS).flatMap(
  ([department, cities]) => cities.map((city) => ({ city, department }))
);

const normalizeStr = (str: string) =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export const isLocationMatch = (productCity: string, filterCity: string): boolean => {
  if (!filterCity || filterCity === ALL_COLOMBIA_OPTION || filterCity === "Todas") {
    return true;
  }
  const normProduct = normalizeStr(productCity || "");
  const normFilter = normalizeStr(filterCity);

  if (normProduct.includes("toda colombia") || normProduct.includes("todo colombia") || normProduct.includes("nacional")) {
    return true;
  }

  return normProduct.includes(normFilter) || normFilter.includes(normProduct);
};
