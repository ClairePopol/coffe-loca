import { todayWib } from "@/lib/content";

export type EventCategory = { id: number; name: string; sort_order: number; is_active: boolean };
export type EventItem = {
  id: number;
  title: string;
  detail: string | null;
  event_date: string;
  time_text: string | null;
  category_id: number | null;
  fee: number | null;
  registration_url: string | null;
};
/** Display columns only (the anonymous role cannot read the rest). */
export const EVENT_COLUMNS = "id, title, detail, event_date, time_text, category_id, fee, registration_url";
export const CATEGORY_COLUMNS = "id, name, sort_order, is_active";

/** Registration links are rendered as <a href>, so only http(s) ever gets through (the DB enforces it too). */
export const safeHttpUrl = (value: string | null | undefined) => (value && /^https?:\/\//i.test(value) ? value : null);

export const isUpcoming = (event: Pick<EventItem, "event_date">) => event.event_date >= todayWib();

export function dateParts(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  return {
    day: date.toLocaleDateString("id-ID", { day: "numeric" }),
    month: date.toLocaleDateString("id-ID", { month: "short" }).toUpperCase(),
    weekday: date.toLocaleDateString("id-ID", { weekday: "long" }),
  };
}

export const feeLabel = (fee: number | null) => (fee === null ? null : fee === 0 ? "Gratis" : `Rp ${fee.toLocaleString("id-ID")}`);

export const eventsError = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "";
  if (/event_categories|category_id|registration_url|\bfee\b/.test(message)) return "Halaman acara butuh update database. Jalankan supabase/events-page.sql di Supabase SQL Editor, lalu refresh.";
  return message || fallback;
};
