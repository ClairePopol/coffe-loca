/** Types + helpers for the profile content that staff manage in the admin panel (supabase/content.sql). */

export type Promo = { id: number; title: string; detail: string | null; badge: string | null; valid_until: string | null; claim_uses: number; is_active: boolean; created_at: string };
export type CafeEvent = { id: number; title: string; detail: string | null; event_date: string; time_text: string | null; is_active: boolean; created_at: string };
export type Voucher = { id: number; title: string; detail: string | null; expires_at: string | null; promo_id: number | null; is_active: boolean; created_at: string };
export type VoucherGrant = { id: number; voucher_id: number; member_id: string; granted_by: string | null; status: "active" | "used"; uses_total: number; uses_left: number; expires_at: string | null; granted_at: string; used_at: string | null };

export type Reward = { id: number; title: string; detail: string | null; stamps_cost: number; is_active: boolean; created_at: string; image_url: string | null };

/** What the member's voucher QR encodes ("LOCA-VOUCHER:<member_voucher id>"); the cashier scans it in the admin panel. */
export const VOUCHER_QR_PREFIX = "LOCA-VOUCHER:";

/** Today as YYYY-MM-DD in Medan time (WIB), so "this month" / "expired" don't depend on the visitor's timezone. */
export const todayWib = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

/** First and last day (YYYY-MM-DD) of the month that contains `day`. */
export function monthBounds(day: string) {
  const [year, month] = day.split("-").map(Number);
  const last = new Date(year, month, 0).getDate();
  const pad = (value: number) => String(value).padStart(2, "0");
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(last)}` };
}

/** "2026-11-30" → "30 Nov 2026" */
export const formatDateId = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export const errorMessage = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "";
  if (/promos|events|vouchers|member_vouchers|grant_voucher|use_member_voucher|claim_promo|claim_uses|uses_left|rewards|redeem_reward|scan_member|scan_voucher|reward_title/.test(message) && /does not exist|not find|schema cache/i.test(message)) {
    return "Fitur ini butuh update database. Jalankan supabase/content.sql, promo-claim.sql, lalu rewards.sql di Supabase SQL Editor, lalu refresh.";
  }
  return message || fallback;
};

/** Shrinks a photo to max 800px WebP in the browser, uploads it to the public "reward-images" bucket and returns its URL. */
export async function uploadRewardImage(supabase: import("@supabase/supabase-js").SupabaseClient, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("File harus berupa gambar.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("Gambar gagal diproses.");
  const path = `${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from("reward-images").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
  if (error) throw error;
  return supabase.storage.from("reward-images").getPublicUrl(path).data.publicUrl;
}
