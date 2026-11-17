import type { SupabaseClient } from "@supabase/supabase-js";
import { OWNER_WHATSAPP_URL } from "@/lib/owner";

export type StoreCategory = "boardgame" | "pokemon_single" | "pokemon_sealed" | "accessories";
export const CATEGORIES: { id: StoreCategory; label: string; note: string }[] = [
  { id: "boardgame", label: "Boardgame", note: "Untuk meja bareng teman" },
  { id: "pokemon_single", label: "Pokémon Singles", note: "Kartu satuan" },
  { id: "pokemon_sealed", label: "Pokémon Sealed", note: "Booster, box & deck" },
  { id: "accessories", label: "Accessories", note: "Sleeves, deck box, playmat" },
];
export const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

export type Product = {
  id: number;
  name: string;
  description: string | null;
  category: StoreCategory;
  card_info: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
};
export const PRODUCT_COLUMNS = "id, name, description, category, card_info, price, stock, image_url, is_active, created_at";
export const LOW_STOCK = 3;

export type OrderStatus = "new" | "confirmed" | "ready" | "completed" | "cancelled";
export const ORDER_STATUS: { id: OrderStatus; label: string }[] = [
  { id: "new", label: "Baru" },
  { id: "confirmed", label: "Dikonfirmasi" },
  { id: "ready", label: "Siap diambil" },
  { id: "completed", label: "Selesai" },
  { id: "cancelled", label: "Dibatalkan" },
];
export const statusLabel = (id: string) => ORDER_STATUS.find((s) => s.id === id)?.label ?? id;

export type OrderItem = { id: number; product_id: number | null; name: string; price: number; qty: number };
export type Order = {
  id: number;
  user_id: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  status: OrderStatus;
  total: number;
  note: string | null;
  created_at: string;
  store_order_items: OrderItem[];
};
export const ORDER_COLUMNS = "id, user_id, buyer_name, buyer_phone, status, total, note, created_at, store_order_items(id, product_id, name, price, qty)";

export const formatIDR = (value: number) => `Rp ${Math.round(value).toLocaleString("id-ID")}`;

export function stockState(stock: number): { tone: "ok" | "low" | "out"; label: string } {
  if (stock <= 0) return { tone: "out", label: "Habis" };
  if (stock <= LOW_STOCK) return { tone: "low", label: `Sisa ${stock}` };
  return { tone: "ok", label: "Tersedia" };
}

/** Uploads a processed WebP blob (from PhotoCropper) to the public "store-images" bucket. */
export async function uploadStoreBlob(supabase: SupabaseClient, blob: Blob): Promise<string> {
  const path = `${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from("store-images").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
  if (error) throw error;
  return supabase.storage.from("store-images").getPublicUrl(path).data.publicUrl;
}

/** Friendlier message when store.sql has not been run yet. */
export const storeError = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "";
  if (/store_products|store_orders|store_order_items|store_wishlist|place_order|set_order_status|store-images/.test(message) && /does not exist|not find|schema cache/i.test(message)) {
    return "Fitur toko butuh update database. Jalankan supabase/store.sql di Supabase SQL Editor, lalu refresh.";
  }
  return message || fallback;
};

// --- cart (browser only, kept in localStorage; prices are always re-checked by place_order) ---
export type CartLine = { id: number; qty: number };
const CART_KEY = "loca-store-cart-v1";

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(CART_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((l) => Number.isInteger(l?.id) && Number.isInteger(l?.qty) && l.qty > 0 && l.qty < 100) : [];
  } catch { return []; }
}
export function writeCart(lines: CartLine[]) {
  try { window.localStorage.setItem(CART_KEY, JSON.stringify(lines)); } catch { /* private mode: cart just won't persist */ }
}

// --- WhatsApp ---
/** Digits only, international format without "+", e.g. 6281234567890. Falls back to the owner's wa.link. */
const STORE_WA_NUMBER = (process.env.NEXT_PUBLIC_STORE_WHATSAPP ?? "").replace(/\D/g, "");

export function orderMessage(order: { id: number; buyer_name?: string | null; total: number; note?: string | null; items: { name: string; price: number; qty: number }[] }) {
  const lines = order.items.map((i) => `• ${i.name} ×${i.qty} = ${formatIDR(i.price * i.qty)}`);
  return [
    `Halo Loca Store, saya mau konfirmasi pesanan #${order.id}${order.buyer_name ? ` atas nama ${order.buyer_name}` : ""}:`,
    ...lines,
    `Total: ${formatIDR(order.total)}`,
    ...(order.note ? [`Catatan: ${order.note}`] : []),
    "Mohon dicek ketersediaannya ya. Terima kasih!",
  ].join("\n");
}

/** wa.me link with the message pre-filled, or the owner's wa.link when no store number is configured. */
export function whatsappUrl(message: string) {
  return STORE_WA_NUMBER ? `https://wa.me/${STORE_WA_NUMBER}?text=${encodeURIComponent(message)}` : OWNER_WHATSAPP_URL;
}
export const hasStoreWhatsapp = STORE_WA_NUMBER !== "";

/** Admin → buyer reply link. Phone is stored as typed (08…); convert to 62… */
export function buyerWhatsappUrl(phone: string | null, message: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const intl = digits.startsWith("0") ? `62${digits.slice(1)}` : digits.startsWith("62") ? digits : `62${digits}`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}
