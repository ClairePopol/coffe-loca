/**
 * Konten panel di samping kartu member (halaman /profile).
 *
 * ⚠️ PLACEHOLDER — isi di bawah ini contoh saja. Ganti dengan promo / event / voucher asli dari client
 * sebelum dipublikasikan. Cukup edit array di file ini, tampilan akan mengikuti.
 * Kalau array kosong, panel menampilkan keterangan "belum ada".
 */

export type Voucher = { code: string; title: string; detail: string; expires: string };
export type Promo = { title: string; detail: string; badge?: string; validUntil: string };
export type CafeEvent = { day: string; month: string; title: string; detail: string; time: string };

/** Voucher aktif milik member. Kosongkan jika belum ada sistem voucher. */
export const vouchers: Voucher[] = [];

export const monthlyPromos: Promo[] = [
  { title: "Promo contoh 1", detail: "Ganti dengan deskripsi promo dari client.", badge: "PROMO", validUntil: "Berlaku sampai akhir bulan" },
  { title: "Promo contoh 2", detail: "Ganti dengan deskripsi promo dari client.", validUntil: "Berlaku sampai akhir bulan" },
];

export const monthlyEvents: CafeEvent[] = [
  { day: "15", month: "NOV", title: "Event contoh 1", detail: "Ganti dengan deskripsi event dari client.", time: "19.00 WIB" },
  { day: "29", month: "NOV", title: "Event contoh 2", detail: "Ganti dengan deskripsi event dari client.", time: "16.00 WIB" },
];
