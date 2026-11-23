"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useConfirm } from "@/components/ConfirmDialog";
import { errorMessage, formatDateId, type CafeEvent } from "@/lib/content";
import { CATEGORY_COLUMNS, feeLabel, safeHttpUrl, type EventCategory } from "@/lib/events";

type Status = { tone: "ok" | "error"; text: string } | null;

/**
 * Admin Store → "Acara": events shown on /events (and this month's on member profiles), plus their categories.
 * Admin Store / Admin Umum / Owner can manage these (RLS: can_manage_store()).
 */
export default function AdminEvents({ userId, onCount }: { userId: string; onCount?: (n: number) => void }) {
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<CafeEvent[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [catsMissing, setCatsMissing] = useState(false);
  const [editingCat, setEditingCat] = useState<{ id: number; name: string } | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  const load = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const e = await supabase.from("events").select("*").order("event_date", { ascending: true });
      if (e.error) throw e.error;
      // Categories come from events-page.sql; if it has not been run yet, events must still work.
      const c = await supabase.from("event_categories").select(CATEGORY_COLUMNS).order("sort_order", { ascending: true }).order("name", { ascending: true });
      setCatsMissing(Boolean(c.error));
      setCategories(c.error ? [] : ((c.data ?? []) as EventCategory[]));
      setEvents((e.data ?? []) as CafeEvent[]);
    } catch (error) {
      setStatus({ tone: "error", text: errorMessage(error, "Acara gagal dimuat.") });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { onCount?.(events.length); }, [events.length, onCount]);

  async function run(action: () => PromiseLike<{ error: unknown }>, okText: string, fallback: string) {
    setBusy(true);
    setStatus(null);
    try {
      const { error } = await action();
      if (error) throw error;
      setStatus({ tone: "ok", text: okText });
      await load();
      return true;
    } catch (error) {
      setStatus({ tone: "error", text: errorMessage(error, fallback) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
  const optional = (value: string) => value || null;

  async function addEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const url = text(data, "url");
    if (url && !safeHttpUrl(url)) { setStatus({ tone: "error", text: "Link pendaftaran harus diawali http:// atau https://." }); return; }
    const feeText = text(data, "fee");
    const fee = feeText === "" ? null : Math.floor(Number(feeText));
    if (fee !== null && (!Number.isFinite(fee) || fee < 0)) { setStatus({ tone: "error", text: "Biaya harus berupa angka 0 atau lebih (kosongkan kalau tidak ada)." }); return; }
    const categoryId = text(data, "category");
    const extra = catsMissing ? {} : { category_id: categoryId ? Number(categoryId) : null, fee, registration_url: optional(url) };
    const ok = await run(
      () => getSupabaseClient().from("events").insert({ title: text(data, "title"), detail: optional(text(data, "detail")), event_date: text(data, "date"), time_text: optional(text(data, "time")), created_by: userId, ...extra }),
      "Acara ditambahkan. Tampil di halaman /events dan profil member.",
      "Acara gagal ditambahkan.",
    );
    if (ok) form.reset();
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = text(new FormData(form), "name");
    if (!name) return;
    const next = categories.reduce((max, c) => Math.max(max, c.sort_order), 0) + 1;
    const ok = await run(() => getSupabaseClient().from("event_categories").insert({ name, sort_order: next }), `Kategori "${name}" ditambahkan.`, "Kategori gagal ditambahkan (nama mungkin sudah ada).");
    if (ok) form.reset();
  }

  async function saveCategoryName() {
    if (!editingCat) return;
    const name = editingCat.name.trim();
    if (!name) return;
    const ok = await run(() => getSupabaseClient().from("event_categories").update({ name }).eq("id", editingCat.id), "Nama kategori diperbarui.", "Nama kategori gagal diubah (nama mungkin sudah ada).");
    if (ok) setEditingCat(null);
  }

  const toggleCategory = (c: EventCategory) =>
    run(() => getSupabaseClient().from("event_categories").update({ is_active: !c.is_active }).eq("id", c.id), c.is_active ? "Kategori disembunyikan dari halaman acara." : "Kategori ditampilkan.", "Gagal mengubah kategori.");

  async function removeCategory(c: EventCategory) {
    const used = events.filter((e) => e.category_id === c.id).length;
    const ok = await confirm({
      title: `Hapus kategori “${c.name}”?`,
      message: used > 0 ? `${used} acara di kategori ini tidak ikut terhapus, tapi jadi tanpa kategori. Untuk menyembunyikan saja, pakai Nonaktifkan.` : "Kategori ini belum dipakai acara apa pun.",
      confirmLabel: "YA, HAPUS",
      tone: "danger",
    });
    if (ok) await run(() => getSupabaseClient().from("event_categories").delete().eq("id", c.id), "Kategori dihapus.", "Kategori gagal dihapus.");
  }

  const toggleEvent = (item: CafeEvent) =>
    run(() => getSupabaseClient().from("events").update({ is_active: !item.is_active }).eq("id", item.id), item.is_active ? "Acara dinonaktifkan — tidak tampil lagi." : "Acara diaktifkan.", "Gagal mengubah status.");

  async function removeEvent(item: CafeEvent) {
    const ok = await confirm({ title: `Hapus “${item.title}”?`, message: "Acara ini tidak akan tampil lagi di halaman /events dan profil member.", confirmLabel: "YA, HAPUS", tone: "danger" });
    if (ok) await run(() => getSupabaseClient().from("events").delete().eq("id", item.id), "Acara dihapus.", "Gagal menghapus.");
  }

  return (
    <>
      {status && <p className={`notice admin-list-status${status.tone === "error" ? " notice-error" : ""}`} role={status.tone === "error" ? "alert" : "status"}>{status.text}</p>}
        {confirmDialog}
      <div className="admin-tabpanel admin-events-panel">
          <p className="admin-content-hint"><b>Halaman /events</b> — tampil untuk semua pengunjung (tanpa login), dikelompokkan per kategori. Acara bulan berjalan yang belum lewat juga tampil di <b>What&rsquo;s Happening This Month</b> pada profil member.</p>
          {catsMissing && <p className="notice notice-error" role="alert">Kategori & biaya acara butuh update database. Jalankan supabase/events-page.sql di Supabase SQL Editor, lalu refresh. Sampai itu, acara tetap bisa dibuat tanpa kategori.</p>}
          <form className="admin-content-form" onSubmit={addEvent}>
            <label className="field"><span>NAMA ACARA</span><input name="title" required maxLength={80} placeholder="Contoh: Pokémon TCG Night" /></label>
            <label className="field"><span>KETERANGAN</span><textarea name="detail" maxLength={300} rows={2} placeholder="Detail acara" /></label>
            <div className="admin-content-two">
              <label className="field"><span>TANGGAL</span><input name="date" type="date" required /></label>
              <label className="field"><span>JAM (OPSIONAL)</span><input name="time" maxLength={30} placeholder="19.00 WIB" /></label>
            </div>
            {!catsMissing && (
              <>
                <div className="admin-content-two">
                  <label className="field"><span>KATEGORI</span>
                    <select name="category" defaultValue=""><option value="">Tanpa kategori</option>{categories.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  </label>
                  <label className="field"><span>BIAYA (RP, OPSIONAL)</span><input name="fee" type="number" min={0} step={1} inputMode="numeric" placeholder="0 = gratis, kosong = tidak ditampilkan" /></label>
                </div>
                <label className="field"><span>LINK PENDAFTARAN (OPSIONAL)</span><input name="url" type="url" maxLength={300} placeholder="https://…" /></label>
              </>
            )}
            <button className="btn-primary" type="submit" disabled={busy}><span>{busy ? "MENYIMPAN..." : "TAMBAH ACARA"}</span><i className="arrow-icon" aria-hidden="true" /></button>
          </form>
          {loading ? <p className="admin-empty">Memuat…</p> : events.length === 0 ? <p className="admin-empty">Belum ada acara.</p> : (
            <ul className="admin-content-list">
              {events.map((item) => (
                <li key={item.id} className={item.is_active ? "" : "is-off"}>
                  <div className="admin-content-row">
                    <div className="admin-content-info">
                      <strong>{item.title}{!item.is_active && <em>NONAKTIF</em>}</strong>
                      {item.detail && <small>{item.detail}</small>}
                      <span>{formatDateId(item.event_date)}{item.time_text ? ` · ${item.time_text}` : ""}</span>
                      {(item.category_id || item.fee !== null && item.fee !== undefined || item.registration_url) && (
                        <span>{[categories.find((c) => c.id === item.category_id)?.name, feeLabel(item.fee ?? null), item.registration_url ? "ada link daftar" : null].filter(Boolean).join(" · ")}</span>
                      )}
                    </div>
                    <div className="admin-content-actions">
                      <button type="button" className="admin-use-id" disabled={busy} onClick={() => toggleEvent(item)}>{item.is_active ? "NONAKTIFKAN" : "AKTIFKAN"}</button>
                      <button type="button" className="admin-use-id admin-use-danger" disabled={busy} onClick={() => removeEvent(item)}>HAPUS</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!catsMissing && (
            <div className="admin-categories">
              <h3>Kategori acara</h3>
              <form className="admin-categories-add" onSubmit={addCategory}>
                <label className="field"><span className="sr-only">Nama kategori</span><input name="name" required maxLength={40} placeholder="Tambah kategori, mis. Yu-Gi-Oh!" /></label>
                <button className="btn-primary" type="submit" disabled={busy}><span>TAMBAH</span><i className="arrow-icon" aria-hidden="true" /></button>
              </form>
              <ul className="admin-content-list">
                {categories.map((c) => (
                  <li key={c.id} className={c.is_active ? "" : "is-off"}>
                    <div className="admin-content-row">
                      <div className="admin-content-info">
                        {editingCat?.id === c.id
                          ? <input className="admin-category-edit" value={editingCat.name} maxLength={40} autoFocus onChange={(e) => setEditingCat({ id: c.id, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") saveCategoryName(); if (e.key === "Escape") setEditingCat(null); }} aria-label="Nama kategori" />
                          : <strong>{c.name}{!c.is_active && <em>DISEMBUNYIKAN</em>}</strong>}
                        <span>{events.filter((e) => e.category_id === c.id).length} acara</span>
                      </div>
                      <div className="admin-content-actions">
                        {editingCat?.id === c.id ? (
                          <>
                            <button type="button" className="admin-use-id" disabled={busy} onClick={saveCategoryName}>SIMPAN</button>
                            <button type="button" className="admin-use-id" disabled={busy} onClick={() => setEditingCat(null)}>BATAL</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="admin-use-id" disabled={busy} onClick={() => setEditingCat({ id: c.id, name: c.name })}>UBAH NAMA</button>
                            <button type="button" className="admin-use-id" disabled={busy} onClick={() => toggleCategory(c)}>{c.is_active ? "SEMBUNYIKAN" : "TAMPILKAN"}</button>
                            <button type="button" className="admin-use-id admin-use-danger" disabled={busy} onClick={() => removeCategory(c)}>HAPUS</button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
    </>
  );
}
