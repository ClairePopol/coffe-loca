"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { QRCodeSVG } from "qrcode.react";
import { getSupabaseClient } from "@/lib/supabase";
import { PageFooter, PageHeader } from "@/components/PageShell";

type Profile = { stamps: number; role: string };
const STAMP_GOAL = 10;

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile>({ stamps: 0, role: "member" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const qrTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        const supabase = getSupabaseClient();
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) { window.location.href = "/login"; return; }
        if (!active) return;
        setUser(authData.user);
        const { data } = await supabase.from("profiles").select("stamps, role").eq("id", authData.user.id).maybeSingle();
        if (active && data) setProfile({ stamps: data.stamps ?? 0, role: data.role ?? "member" });
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "Profile gagal dimuat.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadProfile();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!qrOpen) return;
    closeRef.current?.focus();
    const trigger = qrTriggerRef.current;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setQrOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [qrOpen]);

  const displayName: string = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Loca member";
  const email = user?.email ?? "";
  const initials = useMemo(() => displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "L", [displayName]);
  const memberCode = user?.id ?? "";
  const stamps = Math.min(profile.stamps, STAMP_GOAL);
  const remaining = STAMP_GOAL - stamps;
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : "";

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const card = cardRef.current;
    if (!card || event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = card.getBoundingClientRect();
    setTilt({ x: ((event.clientY - bounds.top) / bounds.height - .5) * -4, y: ((event.clientX - bounds.left) / bounds.width - .5) * 4 });
  }
  async function signOut() {
    if (!window.confirm("Keluar dari profile Coffe Loca?")) return;
    await getSupabaseClient().auth.signOut();
    window.location.href = "/";
  }

  return (
    <main className="page-shell profile-page">
      <div className="profile-bean profile-bean-one" aria-hidden="true"><img src="/white-coffee-bean.png" alt="" /></div>
      <div className="profile-bean profile-bean-two" aria-hidden="true"><img src="/white-coffee-bean.png" alt="" /></div>
      <PageHeader />
      <section className="profile-layout" aria-labelledby="profile-title">
        <div className="profile-heading page-heading">
          <span className="eyebrow"><i /> MEMBER CARD / MEDAN</span>
          <h1 id="profile-title">A little space<br /><em>for your moments.</em></h1>
          <p>Semua momen Loca-mu, tersimpan dalam satu kartu. Tunjukkan QR ke kasir setiap kali beli kopi.</p>
          <ol className="profile-howto">
            <li><b>01</b>Pesan kopi favoritmu</li>
            <li><b>02</b>Tunjukkan QR member ke kasir</li>
            <li><b>03</b>Stamp ke-{STAMP_GOAL}: kopi gratis</li>
          </ol>
        </div>

        <article ref={cardRef} className={`profile-card card${loading ? " is-loading" : ""}`} style={{ transform: `perspective(1100px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }} onPointerMove={handlePointerMove} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
          <div className="profile-card-shimmer" aria-hidden="true" />
          <div className="card-topline"><span>YOUR LOCA PROFILE</span><span>{memberSince ? `SEJAK ${memberSince.toUpperCase()}` : "MEDAN / 2026"}</span></div>
          {loading ? (
            <div className="profile-skeleton" aria-label="Memuat profile"><i /><i /><i /><i /></div>
          ) : !user ? (
            <div className="profile-empty">
              <h2>Profile belum bisa dibuka.</h2>
              <p>{loadError || "Kamu perlu login dulu untuk melihat kartu member."}</p>
              <a className="btn-primary" href="/login"><span>LOGIN / REGISTER</span><span className="arrow-icon" aria-hidden="true" /></a>
            </div>
          ) : (
            <div className="profile-card-content">
              <div className="profile-identity profile-stagger">
                <div className="profile-avatar">{user.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="" /> : initials}</div>
                <div><span className="profile-kicker">{["admin", "owner"].includes(profile.role) ? `${profile.role.toUpperCase()} COFFE LOCA` : "MEMBER COFFE LOCA"}</span><h2>{displayName}</h2>{email && <p>{email}</p>}</div>
              </div>

              <div className="profile-stamps profile-stagger">
                <div className="profile-section-label"><span>COFFEE STAMP CARD</span><strong>{stamps} / {STAMP_GOAL}</strong></div>
                <div className="profile-progress" role="progressbar" aria-label="Progress stamp" aria-valuemin={0} aria-valuemax={STAMP_GOAL} aria-valuenow={stamps}><i style={{ width: `${(stamps / STAMP_GOAL) * 100}%` }} /></div>
                <div className="stamp-row">
                  {Array.from({ length: STAMP_GOAL }, (_, index) => {
                    const filled = index < stamps;
                    const free = index === STAMP_GOAL - 1;
                    return (
                      <span className={`${filled ? "is-filled" : ""}${free ? " is-free-coffee" : ""}`} key={index} style={{ animationDelay: `${0.5 + index * 0.05}s` }}>
                        <img src="/white-coffee-bean.png" alt="" />
                        {free && <b>FREE</b>}
                      </span>
                    );
                  })}
                </div>
                <small>{remaining === 0 ? "Selamat! Tukarkan kartu ini untuk 1 kopi gratis." : `${remaining} stamp lagi untuk gratis 1 kopi.`}</small>
              </div>

              <div className="profile-member-code profile-stagger">
                <div><span>MEMBER CODE</span><strong>Scan untuk stamp</strong><small>Tunjukkan ke kasir Coffe Loca. Ketuk QR untuk memperbesar.</small></div>
                {memberCode && <button ref={qrTriggerRef} className="profile-qr" type="button" onClick={() => setQrOpen(true)} aria-label="Perbesar QR member"><QRCodeSVG value={memberCode} size={96} bgColor="#f8f4eb" fgColor="#354537" level="M" /><i className="profile-scan-line" /></button>}
              </div>

              <div className="profile-actions profile-stagger">
                <a className="btn-primary" href="/#reservation"><span>BUAT RESERVASI</span><span className="arrow-icon" aria-hidden="true" /></a>
                <div className="profile-actions-row">
                  {["admin", "owner"].includes(profile.role) && <a className="btn-ghost" href="/admin">ADMIN PANEL <span className="arrow-icon" aria-hidden="true" /></a>}
                  <button className="btn-ghost profile-logout" type="button" onClick={signOut}>LOGOUT <span className="arrow-icon arrow-up" aria-hidden="true" /></button>
                </div>
              </div>
            </div>
          )}
        </article>
      </section>
      <PageFooter items={["COFFE LOCA · MEDAN", "TAKE IT EASY", "© 2026"]} />

      {qrOpen && memberCode && (
        <div className="profile-qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title" onClick={() => setQrOpen(false)}>
          <div className="profile-qr-modal-card" onClick={(event) => event.stopPropagation()}>
            <button ref={closeRef} className="profile-modal-close" type="button" onClick={() => setQrOpen(false)} aria-label="Tutup">×</button>
            <span id="qr-title">MEMBER CODE / STAMP</span>
            <div className="profile-qr-large"><QRCodeSVG value={memberCode} size={240} bgColor="#f8f4eb" fgColor="#354537" level="M" /></div>
            <strong>{displayName}</strong>
            <small>Tunjukkan kode ini ke kasir Coffe Loca untuk mendapatkan stamp.</small>
          </div>
        </div>
      )}
    </main>
  );
}
