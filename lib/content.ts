/** Types + helpers for the profile content that staff manage in the admin panel (supabase/content.sql). */

export type Promo = { id: number; title: string; detail: string | null; badge: string | null; valid_until: string | null; claim_uses: number; is_active: boolean; created_at: string };
export type CafeEvent = { id: number; title: string; detail: string | null; event_date: string; time_text: string | null; is_active: boolean; created_at: string };
export type Voucher = { id: number; title: string; detail: string | null; expires_at: string | null; promo_id: number | null; is_active: boolean; created_at: string };
export type VoucherGrant = { id: number; voucher_id: number; member_id: string; status: "active" | "used"; uses_total: number; uses_left: number; expires_at: string | null; granted_at: string; used_at: string | null };

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
  if (/promos|events|vouchers|member_vouchers|grant_voucher|use_member_voucher|claim_promo|claim_uses|uses_left/.test(message) && /does not exist|not find|schema cache/i.test(message)) {
    return "Fitur ini butuh update database. Jalankan supabase/content.sql lalu supabase/promo-claim.sql di Supabase SQL Editor, lalu refresh.";
  }
  return message || fallback;
};
