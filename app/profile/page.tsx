"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { QRCodeSVG } from "qrcode.react";
import { getSupabaseClient } from "@/lib/supabase";

type Profile = { stamps: number; role: string };
const fallbackName = "Bryan Chandra";
const fallbackEmail = "darkphrince@gmail.com";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile>({ stamps: 0, role: "member" });
  const [loading, setLoading] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        const supabase = getSupabaseClient();
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) { window.location.href = "/login"; return; }
        if (!active) return;
        setUser(authData.user);
        const { data } = await supabase.from("profiles").select("points, role").eq("id", authData.user.id).maybeSingle();
        if (active && data) setProfile({ stamps: data.points ?? 0, role: data.role ?? "member" });
      } finally { if (active) setLoading(false); }
    }
    loadProfile();
    return () => { active = false; };
  }, []);

  const displayName = user?.user_metadata?.full_name || fallbackName;
  const email = user?.email || fallbackEmail;
  const initials = useMemo(() => displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase() || "BC", [displayName]);
  const memberCode = user?.id || "coffe-loca-bryan-chandra";

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const card = cardRef.current;
    if (!card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = card.getBoundingClientRect();
    setTilt({ x: ((event.clientY - bounds.top) / bounds.height - .5) * -5, y: ((event.clientX - bounds.left) / bounds.width - .5) * 5 });
  }
  function ripple(event: React.MouseEvent<HTMLButtonElement>) {
    const button = event.currentTarget;
    const circle = document.createElement("span");
    circle.className = "profile-ripple";
    const bounds = button.getBoundingClientRect();
    circle.style.left = `${event.clientX - bounds.left}px`;
    circle.style.top = `${event.clientY - bounds.top}px`;
    button.appendChild(circle);
    window.setTimeout(() => circle.remove(), 650);
    navigator.vibrate?.(8);
  }
  async function signOut() {
    if (!window.confirm("Keluar dari profile Coffe Loca?")) return;
    await getSupabaseClient().auth.signOut();
    window.location.href = "/";
  }

  return (
    <main className="profile-page profile-redesign">
      <div className="profile-bean profile-bean-one" aria-hidden="true"><img src="/white-coffee-bean.png" alt="" /></div><div className="profile-bean profile-bean-two" aria-hidden="true"><img src="/white-coffee-bean.png" alt="" /></div><div className="profile-steam profile-steam-one" aria-hidden="true"><i /><i /><i /></div>
      <header className="profile-header"><a className="wordmark profile-wordmark" href="/" aria-label="Kembali ke Coffe Loca"><img className="wordmark-logo" src="/white-coffee-bean.png" alt="" /><span className="wordmark-type"><span>COFFE <b>LOCA</b></span><small>GOOD COFFEE, GOOD COMPANY</small></span></a><a className="profile-back" href="/">KEMBALI KE BERANDA <span className="arrow-icon" aria-hidden="true" /></a></header>
      <section className="profile-layout profile-redesign-layout" aria-labelledby="profile-title">
        <div className="profile-page-heading"><span className="eyebrow"><i /> MEMBER CARD / MEDAN</span><h1 id="profile-title">A little space<br /><em>for your moments.</em></h1><p>Semua momen Loca-mu, tersimpan dalam satu kartu.</p></div>
        <article ref={cardRef} className={`profile-card profile-loyalty-card${loading ? " is-loading" : ""}`} style={{ transform: `perspective(1100px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }} onPointerMove={handlePointerMove} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
          <div className="profile-card-shimmer" aria-hidden="true" /><div className="profile-card-top"><span>YOUR LOCA PROFILE</span><span>MEDAN / 2026</span></div>
          {loading ? <div className="profile-skeleton"><i /><i /><i /><i /></div> : <div className="profile-card-content">
            <div className="profile-identity profile-stagger"><div className="profile-avatar profile-avatar-ring">{user?.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="" /> : initials}</div><div><span className="profile-kicker">MEMBER COFFE LOCA</span><h2>{displayName}</h2><p>{email}</p></div></div>
            <div className="profile-member-code profile-stagger"><div><span>MEMBER CODE</span><strong>SCAN UNTUK STAMP</strong><small>TUNJUKKAN KE CASHIER COFFE LOCA</small></div><button className="profile-qr profile-qr-button" type="button" onClick={() => setQrOpen(true)} aria-label="Perbesar QR member"><QRCodeSVG value={memberCode} size={94} bgColor="#f8f4eb" fgColor="#354537" level="M" /><i className="profile-scan-line" /></button></div>
            <div className="profile-stamps profile-stagger"><div className="profile-section-label"><span>COFFEE STAMP CARD</span><span>{Math.min(profile.stamps, 8)} / 8</span></div><div className="stamp-row">{Array.from({ length: 8 }, (_, index) => <span className={index < Math.min(profile.stamps, 8) ? "is-filled" : ""} key={index}><img src="/white-coffee-bean.png" alt="" /></span>)}</div><small>{8 - Math.min(profile.stamps, 8)} stamp lagi untuk gratis 1 kopi</small></div>
            <div className="profile-actions profile-stagger"><a className="profile-reserve-button" href="/#reservation">BUAT RESERVASI <span className="arrow-icon" aria-hidden="true" /></a>{["admin", "owner"].includes(profile.role) && <a href="/admin">ADMIN PANEL <span className="arrow-icon" aria-hidden="true" /></a>}<button className="profile-logout" type="button" onClick={signOut}>LOGOUT <span className="arrow-icon arrow-up" aria-hidden="true" /></button></div>
          </div>}
        </article>
      </section>
      <footer className="profile-footer"><span>COFFE LOCA · MEDAN</span><span>TAKE IT EASY</span><span>© 2026</span></footer>
      {qrOpen && <div className="profile-qr-modal" role="dialog" aria-modal="true" aria-label="QR member" onClick={() => setQrOpen(false)}><div className="profile-qr-modal-card" onClick={(event) => event.stopPropagation()}><button className="profile-modal-close" type="button" onClick={() => setQrOpen(false)} aria-label="Tutup">×</button><span>MEMBER CODE / STAMP</span><QRCodeSVG value={memberCode} size={230} bgColor="#f8f4eb" fgColor="#354537" level="M" /><strong>{displayName}</strong><small>Tunjukkan kode ini ke cashier Coffe Loca untuk stamp</small><button className="profile-wallet-button" type="button">ADD TO APPLE WALLET</button></div></div>}
    </main>
  );
}
