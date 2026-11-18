"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { todayWib } from "@/lib/content";
import { CATEGORY_COLUMNS, EVENT_COLUMNS, dateParts, eventsError, feeLabel, safeHttpUrl, type EventCategory, type EventItem } from "@/lib/events";

/** Public events page: anyone can read active events (RLS), grouped by the categories the admin manages. */
export default function EventsApp() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [category, setCategory] = useState<number | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const [e, c] = await Promise.all([
          supabase.from("events").select(EVENT_COLUMNS).eq("is_active", true).order("event_date", { ascending: true }).order("id", { ascending: true }),
          supabase.from("event_categories").select(CATEGORY_COLUMNS).eq("is_active", true).order("sort_order", { ascending: true }).order("name", { ascending: true }),
        ]);
        const failed = e.error ?? c.error;
        if (failed) throw failed;
        if (!active) return;
        setEvents((e.data ?? []) as EventItem[]);
        setCategories((c.data ?? []) as EventCategory[]);
      } catch (err) {
        if (active) setError(eventsError(err, "Jadwal acara gagal dimuat."));
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const today = todayWib();
  const nameOf = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const matches = (event: EventItem) => category === "all" || event.category_id === category;
  const upcoming = events.filter((e) => e.event_date >= today && matches(e));
  const past = events.filter((e) => e.event_date < today && matches(e)).reverse().slice(0, 12);
  const countFor = (id: number) => events.filter((e) => e.event_date >= today && e.category_id === id).length;
  const totalUpcoming = events.filter((e) => e.event_date >= today).length;

  const card = (event: EventItem, isPast: boolean) => {
    const parts = dateParts(event.event_date);
    const fee = feeLabel(event.fee);
    const url = safeHttpUrl(event.registration_url);
    const label = event.category_id !== null ? nameOf.get(event.category_id) : null;
    return (
      <li key={event.id} className={`event-card${isPast ? " is-past" : ""}`}>
        <div className="event-date" aria-label={`${parts.weekday}, ${event.event_date}`}><b>{parts.day}</b><span>{parts.month}</span></div>
        <div className="event-body">
          <span className="event-meta">
            {label && <em className="event-tag">{label}</em>}
            {!isPast && event.event_date === today && <em className="event-tag is-today">HARI INI</em>}
            <small>{parts.weekday}{event.time_text ? ` · ${event.time_text}` : ""}</small>
          </span>
          <strong>{event.title}</strong>
          {event.detail && <p>{event.detail}</p>}
          <span className="event-foot">
            {fee && <b className="event-fee">{fee}</b>}
            {!isPast && url && <a className="btn-red event-register" href={url} target="_blank" rel="noopener noreferrer">DAFTAR</a>}
          </span>
        </div>
      </li>
    );
  };

  return (
    <section className="store-content events-content" aria-labelledby="events-title">
      <div className="page-heading">
        <span className="eyebrow"><i /> LOCA EVENT / TURNAMEN &amp; KEGIATAN</span>
        <h1 id="events-title">Ada apa<br /><em>di Loca.</em></h1>
        <p>Turnamen kartu, malam boardgame, dan kegiatan komunitas. Pilih game favoritmu, lalu daftar langsung dari sini.</p>
      </div>

      {categories.length > 0 && (
        <div className="store-cats" role="tablist" aria-label="Kategori acara">
          <button type="button" role="tab" aria-selected={category === "all"} className={category === "all" ? "is-active" : ""} onClick={() => setCategory("all")}>Semua <small>{totalUpcoming}</small></button>
          {categories.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={category === c.id} className={category === c.id ? "is-active" : ""} onClick={() => setCategory(c.id)}>{c.name} <small>{countFor(c.id)}</small></button>
          ))}
        </div>
      )}

      {loading ? <p className="store-empty">Memuat jadwal…</p>
        : error ? <p className="notice notice-error" role="alert">{error}</p>
        : (
          <>
            <h2 className="events-heading">Akan datang</h2>
            {upcoming.length === 0
              ? <p className="store-empty">{category === "all" ? "Belum ada acara terjadwal. Pantau terus ya." : "Belum ada acara untuk kategori ini."}</p>
              : <ul className="event-list">{upcoming.map((e) => card(e, false))}</ul>}
            {past.length > 0 && (
              <details className="events-past">
                <summary>Sudah lewat ({past.length})</summary>
                <ul className="event-list">{past.map((e) => card(e, true))}</ul>
              </details>
            )}
          </>
        )}
    </section>
  );
}
