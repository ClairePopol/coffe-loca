"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useConfirm } from "@/components/ConfirmDialog";
import PhotoCropper from "@/components/PhotoCropper";
import AdminEvents from "@/components/AdminEvents";
import {
  DEFAULT_CATEGORIES, LOW_STOCK, ORDER_COLUMNS, ORDER_STATUS, PRODUCT_COLUMNS, type Category, type Order, type OrderStatus, type Product, type StoreCategory,
  buyerWhatsappUrl, categoryLabel, categorySlug, fetchCategories, formatIDR, statusLabel, storeError, uploadStoreBlob,
} from "@/lib/store";

type Status = { tone: "ok" | "error"; text: string } | null;
type Wish = { id: number; note: string; created_at: string; product_id: number | null; product_name: string | null; buyer_name: string | null; buyer_phone: string | null };
type Tab = "orders" | "products" | "categories" | "events" | "wishlist";
type Crop = { source: Blob; title: string };
type Draft = { id: number | null; name: string; category: StoreCategory; card_info: string; price: string; stock: string; description: string; is_active: boolean; image_url: string | null };
const EMPTY: Draft = { id: null, name: "", category: "boardgame", card_info: "", price: "", stock: "1", description: "", is_active: true, image_url: null };
const when = (iso: string) => new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Store control: orders inbox, product CRUD (with photo cropper), and the "titip cari" list. Only Admin Store / Admin Umum / Owner reach this (RLS enforces it too). */
export default function AdminStore({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>("orders");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [catsMissing, setCatsMissing] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [editingCat, setEditingCat] = useState<{ id: string; label: string } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [eventCount, setEventCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [orderFilter, setOrderFilter] = useState<OrderStatus | "open" | "all">("open");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    const [p, o, w, c] = await Promise.all([
      supabase.from("store_products").select(PRODUCT_COLUMNS).order("created_at", { ascending: false }),
      supabase.from("store_orders").select(ORDER_COLUMNS).order("created_at", { ascending: false }).limit(200),
      supabase.rpc("list_store_wishlist"),
      fetchCategories(supabase),
    ]);
    setCategories(c.list);
    setCatsMissing(c.missing);
    const err = p.error ?? o.error ?? w.error;
    if (err) setStatus({ tone: "error", text: storeError(err, "Data toko gagal dimuat.") });
    setProducts((p.data ?? []) as Product[]);
    setOrders((o.data ?? []) as unknown as Order[]);
    setWishes((w.data ?? []) as Wish[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  const stats = useMemo(() => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const done = orders.filter((o) => o.status === "completed" && new Date(o.created_at) >= monthStart);
    return {
      open: orders.filter((o) => o.status === "new" || o.status === "confirmed" || o.status === "ready").length,
      fresh: orders.filter((o) => o.status === "new").length,
      low: products.filter((p) => p.is_active && p.stock <= LOW_STOCK).length,
      revenue: done.reduce((n, o) => n + o.total, 0),
    };
  }, [orders, products]);

  const shownOrders = orders.filter((o) => orderFilter === "all" ? true : orderFilter === "open" ? ["new", "confirmed", "ready"].includes(o.status) : o.status === orderFilter);
  const shownProducts = useMemo(() => { const q = query.trim().toLowerCase(); return products.filter((p) => !q || `${p.name} ${p.card_info ?? ""}`.toLowerCase().includes(q)); }, [products, query]);

  async function run(action: () => PromiseLike<{ error: unknown }>, ok: string, fail: string) {
    setBusy(true); setStatus(null);
    const { error } = await action();
    setBusy(false);
    if (error) { setStatus({ tone: "error", text: storeError(error, fail) }); return false; }
    if (ok) setStatus({ tone: "ok", text: ok });
    await load();
    return true;
  }

  async function changeStatus(order: Order, next: OrderStatus) {
    if (next === "cancelled") {
      const yes = await confirm({ title: `Batalkan pesanan #${order.id}?`, message: "Kalau stok sudah dipotong, stok dikembalikan otomatis.", confirmLabel: "YA, BATALKAN", tone: "danger" });
      if (!yes) return;
    }
    await run(() => getSupabaseClient().rpc("set_order_status", { order_id: order.id, new_status: next }), `Pesanan #${order.id}: ${statusLabel(next)}.`, "Status gagal diubah.");
  }

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setStatus({ tone: "error", text: "File harus berupa gambar (JPG, PNG, WebP)." }); return; }
    setStatus(null);
    setCrop({ source: file, title: "Atur foto produk" });
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const price = Math.floor(Number(draft.price));
    const stock = Math.floor(Number(draft.stock));
    if (!draft.name.trim() || !Number.isFinite(price) || price < 0 || !Number.isFinite(stock) || stock < 0) { setStatus({ tone: "error", text: "Isi nama, harga (≥ 0), dan stok (≥ 0)." }); return; }
    setBusy(true); setStatus(null);
    try {
      const supabase = getSupabaseClient();
      const image_url = photo ? await uploadStoreBlob(supabase, photo.blob) : draft.image_url;
      const row = { name: draft.name.trim(), category: draft.category, card_info: draft.card_info.trim() || null, price, stock, description: draft.description.trim() || null, is_active: draft.is_active, image_url };
      const { error } = draft.id ? await supabase.from("store_products").update(row).eq("id", draft.id) : await supabase.from("store_products").insert({ ...row, created_by: userId });
      if (error) throw error;
      setStatus({ tone: "ok", text: draft.id ? "Produk diperbarui." : "Produk ditambahkan." });
      setDraft(null); setPhoto(null);
      await load();
    } catch (error) {
      setStatus({ tone: "error", text: storeError(error, "Produk gagal disimpan.") });
    }
    setBusy(false);
  }

  const startEdit = (p: Product | null) => { setPhoto(null); setStatus(null); setDraft(p ? { id: p.id, name: p.name, category: p.category, card_info: p.card_info ?? "", price: String(p.price), stock: String(p.stock), description: p.description ?? "", is_active: p.is_active, image_url: p.image_url } : { ...EMPTY, category: categories.find((c) => c.is_active)?.id ?? EMPTY.category }); };
  const adjustStock = (p: Product, delta: number) => run(() => getSupabaseClient().from("store_products").update({ stock: Math.max(0, p.stock + delta) }).eq("id", p.id), "", "Stok gagal diubah.");
  const toggleActive = (p: Product) => run(() => getSupabaseClient().from("store_products").update({ is_active: !p.is_active }).eq("id", p.id), "", "Status gagal diubah.");
  async function removeProduct(p: Product) {
    const yes = await confirm({ title: `Hapus "${p.name}"?`, message: "Produk hilang dari katalog. Riwayat pesanan lama tetap menyimpan namanya. Untuk menyembunyikan sementara, pakai Nonaktifkan.", confirmLabel: "YA, HAPUS", tone: "danger" });
    if (yes) await run(() => getSupabaseClient().from("store_products").delete().eq("id", p.id), "Produk dihapus.", "Produk gagal dihapus.");
  }
  const removeWish = (w: Wish) => run(() => getSupabaseClient().from("store_wishlist").delete().eq("id", w.id), "", "Titipan gagal dihapus.");

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = newCat.trim();
    if (!label) return;
    const id = categorySlug(label, categories.map((c) => c.id));
    const sort_order = categories.reduce((max, c) => Math.max(max, c.sort_order), 0) + 1;
    const ok = await run(() => getSupabaseClient().from("store_categories").insert({ id, label, sort_order }), `Jenis "${label}" ditambahkan.`, "Jenis produk gagal ditambahkan.");
    if (ok) setNewCat("");
  }
  async function saveCategoryLabel() {
    if (!editingCat) return;
    const label = editingCat.label.trim();
    if (!label) return;
    const ok = await run(() => getSupabaseClient().from("store_categories").update({ label }).eq("id", editingCat.id), "Nama jenis produk diperbarui.", "Nama gagal diubah.");
    if (ok) setEditingCat(null);
  }
  const toggleCategory = (c: Category) =>
    run(() => getSupabaseClient().from("store_categories").update({ is_active: !c.is_active }).eq("id", c.id), c.is_active ? `"${c.label}" disembunyikan dari katalog (produknya ikut tersembunyi).` : `"${c.label}" tampil lagi di katalog.`, "Gagal mengubah jenis produk.");
  async function moveCategory(c: Category, dir: -1 | 1) {
    const i = categories.findIndex((x) => x.id === c.id);
    const other = categories[i + dir];
    if (!other) return;
    const supabase = getSupabaseClient();
    // Re-number the whole list so equal sort_order values can't block the swap.
    const order = categories.map((x) => x.id);
    [order[i], order[i + dir]] = [order[i + dir], order[i]];
    await run(async () => {
      for (const [n, id] of order.entries()) {
        const { error } = await supabase.from("store_categories").update({ sort_order: n + 1 }).eq("id", id);
        if (error) return { error };
      }
      return { error: null };
    }, "", "Urutan gagal diubah.");
  }
  async function removeCategory(c: Category) {
    const used = products.filter((p) => p.category === c.id).length;
    if (used > 0) { setStatus({ tone: "error", text: `"${c.label}" masih dipakai ${used} produk. Pindahkan produknya ke jenis lain dulu, atau pakai Sembunyikan.` }); return; }
    const yes = await confirm({ title: `Hapus jenis "${c.label}"?`, message: "Jenis ini belum dipakai produk apa pun.", confirmLabel: "YA, HAPUS", tone: "danger" });
    if (yes) await run(() => getSupabaseClient().from("store_categories").delete().eq("id", c.id), "Jenis produk dihapus.", "Jenis produk gagal dihapus.");
  }

  return (
    <div className="admin-panel card admin-storepanel">
      <div className="card-topline"><span>LOCA STORE</span><span>PESANAN · PRODUK · ACARA · TITIPAN</span></div>
      <dl className="admin-store-stats">
        <div><dt>Pesanan baru</dt><dd>{stats.fresh}</dd></div>
        <div><dt>Belum selesai</dt><dd>{stats.open}</dd></div>
        <div><dt>Stok menipis</dt><dd>{stats.low}</dd></div>
        <div><dt>Omzet bulan ini</dt><dd>{formatIDR(stats.revenue)}</dd></div>
      </dl>
      <div className="admin-store-tabs" role="tablist">
        {([["orders", `Pesanan (${stats.open})`], ["products", `Produk (${products.length})`], ["categories", `Jenis produk (${categories.length})`], ["events", eventCount === null ? "Acara" : `Acara (${eventCount})`], ["wishlist", `Titipan (${wishes.length})`]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "is-active" : ""} onClick={() => { setTab(id); setStatus(null); }}>{label}</button>
        ))}
      </div>
      {status && <p className={`notice${status.tone === "error" ? " notice-error" : ""}`} role={status.tone === "error" ? "alert" : "status"}>{status.text}</p>}
      {loading && <p className="admin-empty">Memuat data toko…</p>}

      {!loading && tab === "orders" && (<>
        <div className="admin-store-filter">
          {([["open", "Aktif"], ["all", "Semua"], ...ORDER_STATUS.map((s) => [s.id, s.label])] as [string, string][]).map(([id, label]) => (
            <button key={id} type="button" className={orderFilter === id ? "is-active" : ""} onClick={() => setOrderFilter(id as OrderStatus | "open" | "all")}>{label}</button>
          ))}
        </div>
        {shownOrders.length === 0 ? <p className="admin-empty">Tidak ada pesanan di filter ini.</p> : (
          <ul className="admin-order-list">
            {shownOrders.map((o) => {
              const reply = buyerWhatsappUrl(o.buyer_phone, `Halo ${o.buyer_name ?? ""}, soal pesanan Loca Store #${o.id} (${formatIDR(o.total)}): `);
              return (
                <li key={o.id} className={`is-${o.status}`}>
                  <div className="admin-order-head"><b>#{o.id}</b><span>{when(o.created_at)}</span><em className={`order-pill is-${o.status}`}>{statusLabel(o.status)}</em></div>
                  <strong>{o.buyer_name || "Member"}{o.buyer_phone ? ` · ${o.buyer_phone}` : ""}</strong>
                  <ul className="admin-order-items">{o.store_order_items.map((i) => <li key={i.id}><span>{i.name} ×{i.qty}</span><span>{formatIDR(i.price * i.qty)}</span></li>)}</ul>
                  {o.note && <small className="admin-order-note">Catatan: {o.note}</small>}
                  <div className="admin-order-foot">
                    <b>{formatIDR(o.total)}</b>
                    <span className="admin-order-actions">
                      {reply && <a href={reply} target="_blank" rel="noopener noreferrer">WhatsApp pembeli</a>}
                      {o.status === "new" && <button type="button" disabled={busy} onClick={() => changeStatus(o, "confirmed")}>Konfirmasi</button>}
                      {o.status === "confirmed" && <button type="button" disabled={busy} onClick={() => changeStatus(o, "ready")}>Siap diambil</button>}
                      {(o.status === "confirmed" || o.status === "ready") && <button type="button" disabled={busy} onClick={() => changeStatus(o, "completed")}>Selesai</button>}
                      {o.status !== "cancelled" && o.status !== "completed" && <button type="button" className="is-danger" disabled={busy} onClick={() => changeStatus(o, "cancelled")}>Batalkan</button>}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </>)}

      {!loading && tab === "products" && (<>
        {!draft && (
          <div className="admin-store-bar">
            <label className="field"><span>CARI PRODUK</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nama atau nomor kartu" /></label>
            <button type="button" className="btn-primary" onClick={() => startEdit(null)}><span>TAMBAH PRODUK</span><i className="arrow-icon" aria-hidden="true" /></button>
          </div>
        )}
        {draft && (
          <form className="admin-product-form" onSubmit={saveProduct}>
            <h3>{draft.id ? "Edit produk" : "Produk baru"}</h3>
            <label className="field"><span>NAMA</span><input value={draft.name} maxLength={120} required onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="mis. Catan, atau Pikachu ex SV8" /></label>
            <label className="field"><span>KATEGORI</span><select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as StoreCategory })}>{categories.filter((c) => c.is_active || c.id === draft.category).map((c) => <option key={c.id} value={c.id}>{c.label}{c.is_active ? "" : " (disembunyikan)"}</option>)}</select></label>
            <label className="field"><span>SET / NOMOR KARTU (OPSIONAL)</span><input value={draft.card_info} maxLength={80} onChange={(e) => setDraft({ ...draft, card_info: e.target.value })} placeholder="mis. SV8 · 057/106" /></label>
            <label className="field"><span>HARGA (RP)</span><input type="number" min={0} step={1} inputMode="numeric" required value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></label>
            <label className="field"><span>STOK</span><input type="number" min={0} step={1} inputMode="numeric" required value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} /></label>
            <label className="field admin-product-wide"><span>DESKRIPSI (OPSIONAL)</span><textarea rows={3} maxLength={500} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
            <div className="field admin-product-wide">
              <span>FOTO (OPSIONAL)</span>
              {(photo?.url || draft.image_url) && <img className="admin-product-photo" src={photo?.url ?? draft.image_url ?? ""} alt="Pratinjau foto produk" />}
              <input type="file" accept="image/*" onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
              <small className="field-hint">Geser, zoom, dan putar sebelum disimpan. Dipotong 4:3, maks. 800px.</small>
            </div>
            <label className="admin-product-check"><input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} /> Tampil di katalog</label>
            <div className="admin-product-actions">
              <button className="btn-primary" type="submit" disabled={busy}><span>{draft.id ? "SIMPAN" : "TAMBAH"}</span><i className="arrow-icon" aria-hidden="true" /></button>
              <button type="button" className="btn-outline" disabled={busy} onClick={() => { setDraft(null); setPhoto(null); }}>BATAL</button>
            </div>
          </form>
        )}
        {!draft && (shownProducts.length === 0 ? <p className="admin-empty">{products.length === 0 ? "Belum ada produk. Tambahkan yang pertama." : "Tidak ada yang cocok."}</p> : (
          <ul className="admin-product-list">
            {shownProducts.map((p) => (
              <li key={p.id} className={p.is_active ? "" : "is-off"}>
                {p.image_url ? <img src={p.image_url} alt="" loading="lazy" /> : <span className="admin-product-noimg" aria-hidden="true" />}
                <span className="admin-product-info"><strong>{p.name}{!p.is_active && <em>NONAKTIF</em>}</strong><small>{categoryLabel(p.category, categories)}{p.card_info ? ` · ${p.card_info}` : ""} · {formatIDR(p.price)}</small></span>
                <span className={`admin-stock${p.stock <= LOW_STOCK ? " is-low" : ""}`}>
                  <button type="button" disabled={busy || p.stock === 0} onClick={() => adjustStock(p, -1)} aria-label={`Kurangi stok ${p.name}`}>−</button>
                  <b>{p.stock}</b>
                  <button type="button" disabled={busy} onClick={() => adjustStock(p, 1)} aria-label={`Tambah stok ${p.name}`}>+</button>
                </span>
                <span className="admin-order-actions">
                  <button type="button" disabled={busy} onClick={() => startEdit(p)}>Edit</button>
                  <button type="button" disabled={busy} onClick={() => toggleActive(p)}>{p.is_active ? "Nonaktifkan" : "Aktifkan"}</button>
                  <button type="button" className="is-danger" disabled={busy} onClick={() => removeProduct(p)}>Hapus</button>
                </span>
              </li>
            ))}
          </ul>
        ))}
      </>)}

      {!loading && tab === "categories" && (catsMissing ? (
        <p className="notice notice-error" role="alert">Jenis produk belum bisa diatur. Jalankan <code>supabase/store-categories.sql</code> di Supabase SQL Editor, lalu refresh.</p>
      ) : (
        <div className="admin-categories">
          <form className="admin-categories-add" onSubmit={addCategory}>
            <label className="field"><span className="sr-only">Nama jenis produk</span><input value={newCat} onChange={(e) => setNewCat(e.target.value)} required maxLength={40} placeholder="Tambah jenis, mis. One Piece Singles" /></label>
            <button className="btn-primary" type="submit" disabled={busy}><span>TAMBAH</span><i className="arrow-icon" aria-hidden="true" /></button>
          </form>
          {categories.length === 0 ? <p className="admin-empty">Belum ada jenis produk. Tambahkan yang pertama.</p> : (
            <ul className="admin-content-list">
              {categories.map((c, i) => (
                <li key={c.id} className={c.is_active ? "" : "is-off"}>
                  <div className="admin-content-row">
                    <div className="admin-content-info">
                      {editingCat?.id === c.id
                        ? <input className="admin-category-edit" value={editingCat.label} maxLength={40} autoFocus onChange={(e) => setEditingCat({ id: c.id, label: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveCategoryLabel(); } if (e.key === "Escape") setEditingCat(null); }} aria-label="Nama jenis produk" />
                        : <strong>{c.label}{!c.is_active && <em>DISEMBUNYIKAN</em>}</strong>}
                      <span>{products.filter((p) => p.category === c.id).length} produk</span>
                    </div>
                    <div className="admin-content-actions">
                      {editingCat?.id === c.id ? (<>
                        <button type="button" className="admin-use-id" disabled={busy} onClick={saveCategoryLabel}>SIMPAN</button>
                        <button type="button" className="admin-use-id" disabled={busy} onClick={() => setEditingCat(null)}>BATAL</button>
                      </>) : (<>
                        <button type="button" className="admin-use-id" disabled={busy || i === 0} onClick={() => moveCategory(c, -1)} aria-label={`Naikkan ${c.label}`}>↑</button>
                        <button type="button" className="admin-use-id" disabled={busy || i === categories.length - 1} onClick={() => moveCategory(c, 1)} aria-label={`Turunkan ${c.label}`}>↓</button>
                        <button type="button" className="admin-use-id" disabled={busy} onClick={() => setEditingCat({ id: c.id, label: c.label })}>UBAH NAMA</button>
                        <button type="button" className="admin-use-id" disabled={busy} onClick={() => toggleCategory(c)}>{c.is_active ? "SEMBUNYIKAN" : "TAMPILKAN"}</button>
                        <button type="button" className="admin-use-id admin-use-danger" disabled={busy} onClick={() => removeCategory(c)}>HAPUS</button>
                      </>)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {tab === "events" && <AdminEvents userId={userId} onCount={setEventCount} />}

      {!loading && tab === "wishlist" && (wishes.length === 0 ? <p className="admin-empty">Belum ada titipan dari member.</p> : (
        <ul className="admin-order-list">
          {wishes.map((w) => {
            const reply = buyerWhatsappUrl(w.buyer_phone, `Halo ${w.buyer_name ?? ""}, kabar baik soal titipanmu di Loca Store: "${w.note}". `);
            return (
              <li key={w.id}>
                <div className="admin-order-head"><b>{w.buyer_name || "Member"}</b><span>{when(w.created_at)}</span></div>
                <strong>{w.note}</strong>
                {w.product_name && <small className="admin-order-note">Produk: {w.product_name}</small>}
                <span className="admin-order-actions">
                  {reply && <a href={reply} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                  <button type="button" className="is-danger" disabled={busy} onClick={() => removeWish(w)}>Hapus</button>
                </span>
              </li>
            );
          })}
        </ul>
      ))}

      {crop && <PhotoCropper file={crop.source} title={crop.title} onCancel={() => setCrop(null)} onDone={(blob) => { setCrop(null); setPhoto((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { blob, url: URL.createObjectURL(blob) }; }); }} />}
      {confirmDialog}
    </div>
  );
}
