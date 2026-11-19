"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import { useConfirm } from "@/components/ConfirmDialog";
import { formatPhone, isPhoneAuthEmail, userPhone } from "@/lib/phone";
import { roleLabel } from "@/lib/roles";
import StoreHero from "@/components/store/StoreHero";
import { ORDER_COLUMNS, formatIDR, statusLabel, storeError, type Order } from "@/lib/store";

type Wish = { id: number; note: string; created_at: string };
type Account = { role: string; approved: boolean };
const when = (iso: string) => new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Loca Store account page: who you are, your store orders and "titip cari" requests. Coffee stamps / vouchers stay on /profile. */
export default function StoreProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account>({ role: "member", approved: true });
  const [orders, setOrders] = useState<Order[]>([]);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const load = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      if (!data.user) return;
      const [p, o, w] = await Promise.all([
        supabase.from("profiles").select("role, approved").eq("id", data.user.id).maybeSingle(),
        supabase.from("store_orders").select(ORDER_COLUMNS).eq("user_id", data.user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("store_wishlist").select("id, note, created_at").eq("user_id", data.user.id).order("created_at", { ascending: false }).limit(50),
      ]);
      if (p.data) setAccount({ role: p.data.role ?? "member", approved: p.data.approved !== false });
      const failed = o.error ?? w.error;
      if (failed) setError(storeError(failed, "Data toko gagal dimuat."));
      setOrders((o.data ?? []) as unknown as Order[]);
      setWishes((w.data ?? []) as Wish[]);
    } catch (e) {
      setError(storeError(e, "Profil gagal dimuat."));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const phone = userPhone(user);
  const name: string = user?.user_metadata?.full_name || (phone ? formatPhone(phone) : user?.email?.split("@")[0]) || "Loca member";
  const contact = phone ? formatPhone(phone) : isPhoneAuthEmail(user?.email) ? "" : user?.email ?? "";
  const initials = useMemo(() => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "L", [name]);
  const pending = account.role === "member" && !account.approved;
  const openOrders = orders.filter((o) => o.status === "new" || o.status === "confirmed" || o.status === "ready").length;

  async function removeWish(wish: Wish) {
    const { error: err } = await getSupabaseClient().from("store_wishlist").delete().eq("id", wish.id);
    if (err) setError(storeError(err, "Titipan gagal dihapus."));
    else setWishes((current) => current.filter((w) => w.id !== wish.id));
  }

  async function signOut() {
    const ok = await confirm({ title: "Keluar dari akunmu?", message: "Pesanan dan titipanmu tetap tersimpan. Login lagi kapan saja untuk melihatnya.", confirmLabel: "YA, LOGOUT", tone: "danger" });
    if (!ok) return;
    setSigningOut(true);
    try { await getSupabaseClient().auth.signOut(); } finally { window.location.href = "/store/profile"; }
  }

  if (loading) return <section className="store-content store-shop"><p className="store-empty">Memuat profil…</p></section>;

  if (!user) {
    return (
      <>
        <StoreHero id="sp-title" kicker="LOCA STORE" side="AKUN" title={<>Masuk untuk<br /><em>lihat pesananmu.</em></>}>
          <p>Pesanan dan titipan Loca Store tersimpan di akun member kamu.</p>
        </StoreHero>
        <section className="store-content store-shop"><div className="store-actions" style={{ marginTop: 0 }}><a className="btn-red sprofile-btn" href="/login?next=/store/profile">LOGIN / REGISTER</a></div></section>
      </>
    );
  }

  return (
    <>
    <StoreHero id="sp-title" kicker="LOCA STORE" side="AKUN" title={<>Halo,<br /><em>{name.split(" ")[0]}.</em></>} />
    <section className="store-content store-shop sprofile" aria-label="Akun">
      <div className="sprofile-card">
        <span className="sprofile-avatar" aria-hidden="true">{initials}</span>
        <div>
          <strong>{name}</strong>
          <small>{[contact, roleLabel(account.role)].filter(Boolean).join(" · ")}</small>
        </div>
        <button type="button" className="btn-outline sprofile-logout" onClick={signOut} disabled={signingOut}>{signingOut ? "KELUAR…" : "LOGOUT"}</button>
      </div>

      {pending && <p className="notice notice-error" role="status">Akunmu belum diverifikasi owner, jadi belum bisa memesan. Katalog tetap bisa kamu lihat.</p>}
      {error && <p className="notice notice-error" role="alert">{error}</p>}

      <div className="sprofile-head"><h2>Pesanan saya</h2><span>{orders.length === 0 ? "BELUM ADA" : `${openOrders} AKTIF · ${orders.length} TOTAL`}</span></div>
      {orders.length === 0 ? <p className="store-empty">Belum ada pesanan. <a href="/store">Lihat katalog →</a></p> : (
        <ul className="sprofile-orders">
          {orders.map((order) => (
            <li key={order.id} className={`is-${order.status}`}>
              <div className="sprofile-order-top"><b>#{order.id}</b><span>{when(order.created_at)}</span><em className={`order-pill is-${order.status}`}>{statusLabel(order.status)}</em></div>
              <ul className="sprofile-items">{order.store_order_items.map((item) => <li key={item.id}><span>{item.name} ×{item.qty}</span><span>{formatIDR(item.price * item.qty)}</span></li>)}</ul>
              {order.note && <small>Catatan: {order.note}</small>}
              <div className="sprofile-total"><span>Total</span><b>{formatIDR(order.total)}</b></div>
            </li>
          ))}
        </ul>
      )}

      <div className="sprofile-head"><h2>Titipan saya</h2><span>{wishes.length === 0 ? "BELUM ADA" : `${wishes.length} TITIPAN`}</span></div>
      {wishes.length === 0 ? <p className="store-empty">Barang habis? Tekan “Titip cari” di katalog, kami kabari kalau sudah ada.</p> : (
        <ul className="sprofile-wishes">
          {wishes.map((wish) => (
            <li key={wish.id}><span><strong>{wish.note}</strong><small>{when(wish.created_at)}</small></span><button type="button" className="sprofile-remove" onClick={() => removeWish(wish)}>Hapus</button></li>
          ))}
        </ul>
      )}

      <div className="store-actions">
        <a className="btn-red sprofile-btn" href="/store">BELANJA LAGI</a>
        <a className="btn-outline sprofile-btn" href="/events">LIHAT EVENT</a>
        <a className="btn-outline sprofile-btn" href="/profile">KARTU MEMBER COFFEE</a>
      </div>
      {confirmDialog}
    </section>
    </>
  );
}
