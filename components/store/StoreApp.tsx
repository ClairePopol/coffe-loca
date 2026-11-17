"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import {
  CATEGORIES, PRODUCT_COLUMNS, type CartLine, type Product, type StoreCategory,
  categoryLabel, formatIDR, hasStoreWhatsapp, orderMessage, readCart, stockState, storeError, whatsappUrl, writeCart,
} from "@/lib/store";

type Sort = "new" | "price-asc" | "price-desc" | "name";
type Placed = { id: number; message: string; url: string };
type Notice = { tone: "ok" | "error"; text: string } | null;
type Buyer = { id: string; name: string; approved: boolean; staff: boolean } | null;

/** Public catalogue (anyone can browse) + cart. Ordering needs a signed-in, approved member; place_order() re-checks price and stock on the server. */
export default function StoreApp() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [category, setCategory] = useState<StoreCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("new");
  const [detail, setDetail] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [buyer, setBuyer] = useState<Buyer>(null);
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [wish, setWish] = useState("");

  useEffect(() => { setCart(readCart()); setCartReady(true); }, []);
  useEffect(() => { if (cartReady) writeCart(cart); }, [cart, cartReady]);

  const load = useCallback(async () => {
    try {
      const { data, error } = await getSupabaseClient().from("store_products").select(PRODUCT_COLUMNS).eq("is_active", true).order("created_at", { ascending: false });
      if (error) throw error;
      setProducts((data ?? []) as Product[]);
      setLoadError("");
    } catch (error) {
      setLoadError(storeError(error, "Katalog gagal dimuat."));
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getUser();
        if (!active || !data.user) return;
        const { data: row } = await supabase.from("profiles").select("full_name, role, approved").eq("id", data.user.id).maybeSingle();
        if (!active) return;
        setBuyer({
          id: data.user.id,
          name: row?.full_name || data.user.user_metadata?.full_name || "Member",
          approved: row ? row.approved !== false : true,
          staff: !!row && row.role !== "member",
        });
      } catch { /* browsing stays possible without a session */ }
    })();
    return () => { active = false; };
  }, []);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  // drop cart lines whose product vanished / sold out, and cap quantities at current stock
  const lines = useMemo(() => cart.flatMap((l) => {
    const p = byId.get(l.id);
    return p && p.stock > 0 ? [{ product: p, qty: Math.min(l.qty, p.stock) }] : [];
  }), [cart, byId]);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const total = lines.reduce((n, l) => n + l.qty * l.product.price, 0);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products.filter((p) => (category === "all" || p.category === category) && (!q || `${p.name} ${p.card_info ?? ""}`.toLowerCase().includes(q)));
    const sorted = [...list];
    if (sort === "price-asc") sorted.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") sorted.sort((a, b) => b.price - a.price);
    else if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [products, category, query, sort]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return m;
  }, [products]);

  function setQty(id: number, qty: number) {
    setCart((current) => {
      const p = byId.get(id);
      const next = Math.max(0, Math.min(qty, p?.stock ?? 99, 99));
      const rest = current.filter((l) => l.id !== id);
      return next > 0 ? [...rest, { id, qty: next }] : rest;
    });
  }
  const qtyOf = (id: number) => cart.find((l) => l.id === id)?.qty ?? 0;
  function add(p: Product) {
    if (p.stock <= 0) return;
    setQty(p.id, qtyOf(p.id) + 1);
    setNotice({ tone: "ok", text: `${p.name} masuk keranjang.` });
  }

  async function checkout() {
    setNotice(null);
    if (!buyer) { window.location.href = "/login?next=/store"; return; }
    if (!buyer.approved && !buyer.staff) { setNotice({ tone: "error", text: "Akunmu belum diverifikasi owner, jadi belum bisa memesan." }); return; }
    if (lines.length === 0) return;
    setPlacing(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc("place_order", { items: lines.map((l) => ({ product_id: l.product.id, qty: l.qty })), order_note: note.trim() || null });
      if (error) throw error;
      const id = Number(data);
      // Show what the server saved, not what the browser believed.
      const { data: saved } = await supabase.from("store_orders").select("id, buyer_name, total, note, store_order_items(name, price, qty)").eq("id", id).maybeSingle();
      const items = (saved?.store_order_items ?? lines.map((l) => ({ name: l.product.name, price: l.product.price, qty: l.qty }))) as { name: string; price: number; qty: number }[];
      const message = orderMessage({ id, buyer_name: saved?.buyer_name ?? buyer.name, total: saved?.total ?? total, note: saved?.note ?? note, items });
      setPlaced({ id, message, url: whatsappUrl(message) });
      setCart([]);
      setNote("");
      load();
    } catch (error) {
      setNotice({ tone: "error", text: storeError(error, "Pesanan gagal dibuat.") });
      load(); // stock may have changed
    }
    setPlacing(false);
  }

  async function sendWish() {
    const text = wish.trim();
    if (!text) return;
    if (!buyer) { window.location.href = "/login?next=/store"; return; }
    const { error } = await getSupabaseClient().from("store_wishlist").insert({ note: text, product_id: detail?.id ?? null });
    if (error) setNotice({ tone: "error", text: storeError(error, "Titipan gagal dikirim.") });
    else { setNotice({ tone: "ok", text: "Titipan terkirim. Kami kabari lewat WhatsApp kalau barangnya ada." }); setWish(""); }
  }

  async function copyMessage() {
    if (!placed) return;
    try { await navigator.clipboard.writeText(placed.message); setNotice({ tone: "ok", text: "Pesan disalin." }); }
    catch { setNotice({ tone: "error", text: "Tidak bisa menyalin otomatis. Tekan lama pada teks pesan untuk menyalin." }); }
  }

  const noticeEl = notice && <p className={`notice store-notice${notice.tone === "error" ? " notice-error" : ""}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>;

  return (
    <section className="store-content" aria-labelledby="store-title">
      <div className="page-heading">
        <span className="eyebrow"><i /> LOCA STORE / BOARDGAME &amp; POKÉMON</span>
        <h1 id="store-title">Bawa pulang<br /><em>serunya Loca.</em></h1>
        <p>Boardgame, kartu Pokémon, dan aksesori. Pilih barangnya, kirim pesanan lewat WhatsApp, lalu ambil di kedai atau kami atur pengirimannya.</p>
      </div>

      <div className="store-cats" role="tablist" aria-label="Kategori">
        <button type="button" role="tab" aria-selected={category === "all"} className={category === "all" ? "is-active" : ""} onClick={() => setCategory("all")}>Semua <small>{products.length}</small></button>
        {CATEGORIES.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={category === c.id} className={category === c.id ? "is-active" : ""} onClick={() => setCategory(c.id)}>{c.label} <small>{counts.get(c.id) ?? 0}</small></button>
        ))}
      </div>

      <div className="store-toolbar">
        <label className="field store-search"><span>CARI</span><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nama barang atau nomor kartu" /></label>
        <label className="field store-sort"><span>URUTKAN</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="new">Terbaru</option><option value="price-asc">Harga terendah</option><option value="price-desc">Harga tertinggi</option><option value="name">Nama A–Z</option>
          </select>
        </label>
      </div>

      {!detail && !cartOpen && !placed && noticeEl}

      {loading ? <p className="store-empty">Memuat katalog…</p>
        : loadError ? <p className="notice notice-error" role="alert">{loadError}</p>
        : visible.length === 0 ? <p className="store-empty">{products.length === 0 ? "Katalog belum diisi. Segera hadir." : "Tidak ada barang yang cocok."}</p>
        : (
          <ul className="store-products">
            {visible.map((p) => {
              const s = stockState(p.stock);
              return (
                <li key={p.id} className={`store-card${s.tone === "out" ? " is-out" : ""}`}>
                  <button type="button" className="store-card-art" onClick={() => setDetail(p)} aria-label={`Lihat ${p.name}`}>
                    {p.image_url ? <img src={p.image_url} alt="" loading="lazy" /> : <img className="store-card-placeholder" src="/white-coffee-bean.png" alt="" />}
                    <span className={`store-badge is-${s.tone}`}>{s.label}</span>
                  </button>
                  <small className="store-card-cat">{categoryLabel(p.category)}{p.card_info ? ` · ${p.card_info}` : ""}</small>
                  <strong>{p.name}</strong>
                  <span className="store-price">{formatIDR(p.price)}</span>
                  <button type="button" className="btn-red store-add" disabled={s.tone === "out"} onClick={() => add(p)}>{s.tone === "out" ? "HABIS" : qtyOf(p.id) > 0 ? `DI KERANJANG (${qtyOf(p.id)})` : "TAMBAH"}</button>
                </li>
              );
            })}
          </ul>
        )}

      {count > 0 && !cartOpen && (
        <button type="button" className="store-cartbar" onClick={() => setCartOpen(true)}>
          <span>Keranjang · {count} barang</span><b>{formatIDR(total)}</b>
        </button>
      )}

      {detail && (
        <div className="store-overlay" role="dialog" aria-modal="true" aria-label={detail.name} onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div className="store-sheet">
            <button type="button" className="store-close" onClick={() => setDetail(null)} aria-label="Tutup">×</button>
            <div className="store-sheet-art">{detail.image_url ? <img src={detail.image_url} alt={detail.name} /> : <img className="store-card-placeholder" src="/white-coffee-bean.png" alt="" />}</div>
            <small className="store-card-cat">{categoryLabel(detail.category)}{detail.card_info ? ` · ${detail.card_info}` : ""}</small>
            {noticeEl}
            <h2>{detail.name}</h2>
            <p className="store-price">{formatIDR(detail.price)} <span className={`store-badge is-${stockState(detail.stock).tone}`}>{stockState(detail.stock).label}</span></p>
            {detail.description && <p className="store-desc">{detail.description}</p>}
            {detail.stock > 0 ? (
              <button type="button" className="btn-red" onClick={() => { add(detail); setDetail(null); setCartOpen(true); }}>TAMBAH KE KERANJANG</button>
            ) : (
              <div className="store-wish">
                <p>Barang ini sedang habis. Titip cari, kami kabari kalau sudah ada.</p>
                <input value={wish} onChange={(e) => setWish(e.target.value)} maxLength={200} placeholder={`mis. ${detail.name}, 2 pcs`} />
                <button type="button" className="btn-outline" onClick={sendWish}>TITIP CARI</button>
              </div>
            )}
          </div>
        </div>
      )}

      {(cartOpen || placed) && (
        <div className="store-overlay" role="dialog" aria-modal="true" aria-label="Keranjang" onClick={(e) => { if (e.target === e.currentTarget && !placing) { setCartOpen(false); } }}>
          <div className="store-sheet store-cart">
            <button type="button" className="store-close" onClick={() => { setCartOpen(false); setPlaced(null); }} aria-label="Tutup">×</button>
            {placed ? (
              <>
                <span className="eyebrow"><i /> PESANAN #{placed.id} TERCATAT</span>
                <h2>Tinggal konfirmasi.</h2>
                {noticeEl}
                <p className="store-desc">Pesananmu sudah masuk ke admin. Kirim pesan ini lewat WhatsApp supaya cepat diproses. Stok dicek dulu, dan belum dikunci sebelum dikonfirmasi.</p>
                <pre className="store-message">{placed.message}</pre>
                <a className="btn-red" href={placed.url} target="_blank" rel="noopener noreferrer">KIRIM VIA WHATSAPP</a>
                {!hasStoreWhatsapp && <p className="field-hint">Chat ke owner akan terbuka. Tempel pesan di atas (tombol salin) karena nomor toko belum diatur.</p>}
                <button type="button" className="btn-outline" onClick={copyMessage}>SALIN PESAN</button>
              </>
            ) : (
              <>
                <span className="eyebrow"><i /> KERANJANG</span>
                <h2>{lines.length === 0 ? "Keranjang kosong." : "Periksa pesananmu."}</h2>
                {notice?.tone === "error" && noticeEl}
                {lines.length > 0 && (
                  <ul className="store-lines">
                    {lines.map(({ product: p, qty }) => (
                      <li key={p.id}>
                        <span><strong>{p.name}</strong><small>{formatIDR(p.price)}{qty >= p.stock ? " · stok maksimal" : ""}</small></span>
                        <span className="store-qty">
                          <button type="button" onClick={() => setQty(p.id, qty - 1)} aria-label={`Kurangi ${p.name}`}>−</button>
                          <b>{qty}</b>
                          <button type="button" onClick={() => setQty(p.id, qty + 1)} disabled={qty >= p.stock} aria-label={`Tambah ${p.name}`}>+</button>
                        </span>
                        <b className="store-line-total">{formatIDR(p.price * qty)}</b>
                      </li>
                    ))}
                  </ul>
                )}
                {lines.length > 0 && (
                  <>
                    <label className="field"><span>CATATAN (OPSIONAL)</span><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="mis. ambil di kedai hari Sabtu" /></label>
                    <p className="store-total"><span>Total</span><b>{formatIDR(total)}</b></p>
                    {!buyer && <p className="field-hint">Kamu perlu masuk sebagai member untuk memesan. Keranjang tetap tersimpan.</p>}
                    <button type="button" className="btn-red" disabled={placing} onClick={checkout}>{placing ? "MEMPROSES…" : buyer ? "PESAN VIA WHATSAPP" : "MASUK UNTUK MEMESAN"}</button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
