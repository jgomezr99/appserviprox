import { DEFAULT_MOCK_PRODUCTS } from "./mockStoreProducts";

export interface MekoCartItem {
  id: string | number;
  productId: string | number;
  title: string;
  price: number;
  image: string;
  city: string;
  category: string;
  quantity: number;
  sellerName: string;
  phone: string;
}

export interface MekoOrder {
  id: string;
  reference: string;
  date: string;
  items: MekoCartItem[];
  total: number;
  status: "Pagado con Wompi" | "En preparación" | "En camino" | "Entregado";
  shippingAddress: {
    fullName: string;
    phone: string;
    city: string;
    address: string;
    notes?: string;
  };
  paymentMethod: string;
  wompiTransactionId: string;
}

export interface MekoPaymentRecord {
  id: string;
  orderId: string;
  reference: string;
  date: string;
  amount: number;
  status: "Aprobado" | "Pendiente" | "Rechazado";
  gateway: "Wompi (Bancolombia)";
  method: "Nequi" | "Bancolombia" | "Tarjeta de Crédito / Débito" | "PSE" | "Daviplata";
  productNames: string;
  customerName: string;
  customerPhone: string;
  city: string;
}

const STORAGE_KEYS = {
  CUSTOM_PRODUCTS: "sp_store_custom_products_v2",
  CART: "sp_store_cart_v2",
  ORDERS: "sp_store_orders_v2",
  PAYMENTS: "sp_store_payments_v2",
};

// ======================== PRODUCTOS LOCALES GUARDADOS ========================
export const getCustomStoredProducts = (): any[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_PRODUCTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveCustomStoredProduct = (product: any): void => {
  try {
    const existing = getCustomStoredProducts();
    const updated = [product, ...existing.filter((p) => p.id !== product.id)];
    localStorage.setItem(STORAGE_KEYS.CUSTOM_PRODUCTS, JSON.stringify(updated));
  } catch (err) {
    console.error("Error guardando producto localmente:", err);
  }
};

export const removeCustomStoredProduct = (productId: string | number): void => {
  try {
    const existing = getCustomStoredProducts();
    const updated = existing.filter((p) => p.id !== productId);
    localStorage.setItem(STORAGE_KEYS.CUSTOM_PRODUCTS, JSON.stringify(updated));
  } catch (err) {
    console.error("Error eliminando producto:", err);
  }
};

// ======================== CARRITO DE COMPRAS ========================
export const getMekoCart = (): MekoCartItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CART);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveMekoCart = (items: MekoCartItem[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(items));
  } catch (err) {
    console.error("Error guardando carrito:", err);
  }
};

// ======================== HISTORIAL DE PEDIDOS ========================
const DEFAULT_DEMO_ORDERS: MekoOrder[] = [
  {
    id: "ORD-2026-0891",
    reference: "WOMPI-MEKO-89102",
    date: "05/11/2026, 14:20",
    total: 320000,
    status: "En camino",
    paymentMethod: "Wompi (Nequi)",
    wompiTransactionId: "TX-WOMPI-9941203",
    shippingAddress: {
      fullName: "Carlos Gómez",
      phone: "+57 314 220 8910",
      city: "Bogotá",
      address: "Calle 127 # 15-40, Apto 502",
      notes: "Dejar en portería torre 2",
    },
    items: [
      {
        id: "item-1",
        productId: 5,
        title: "Control PS5 DualSense",
        price: 320000,
        image: "/assets/prod-ps5.jpg",
        city: "Bogotá",
        category: "Multimedia",
        quantity: 1,
        sellerName: "Sebastián Arias",
        phone: "+57 311 345 6789",
      },
    ],
  },
];

export const getMekoOrders = (): MekoOrder[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(DEFAULT_DEMO_ORDERS));
      return DEFAULT_DEMO_ORDERS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_DEMO_ORDERS;
  }
};

export const saveMekoOrder = (order: MekoOrder): void => {
  try {
    const existing = getMekoOrders();
    const updated = [order, ...existing];
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updated));
  } catch (err) {
    console.error("Error guardando orden:", err);
  }
};

// ======================== HISTORIAL DE PAGO PRODUCTOS ========================
const DEFAULT_DEMO_PAYMENTS: MekoPaymentRecord[] = [
  {
    id: "PAY-2026-902",
    orderId: "ORD-2026-0891",
    reference: "WOMPI-MEKO-89102",
    date: "05/11/2026, 14:21",
    amount: 320000,
    status: "Aprobado",
    gateway: "Wompi (Bancolombia)",
    method: "Nequi",
    productNames: "Control PS5 DualSense (1 unidad)",
    customerName: "Carlos Gómez",
    customerPhone: "+57 314 220 8910",
    city: "Bogotá",
  },
];

export const getMekoPayments = (): MekoPaymentRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(DEFAULT_DEMO_PAYMENTS));
      return DEFAULT_DEMO_PAYMENTS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_DEMO_PAYMENTS;
  }
};

export const saveMekoPayment = (payment: MekoPaymentRecord): void => {
  try {
    const existing = getMekoPayments();
    const updated = [payment, ...existing];
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(updated));
  } catch (err) {
    console.error("Error guardando pago:", err);
  }
};
