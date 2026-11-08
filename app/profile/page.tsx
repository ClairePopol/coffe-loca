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
  const [flipped, setFlipped] = useState(false);
  const [hasFlipped, setHasFlipped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
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
  const isStaff = ["admin", "owner"].includes(profile.role);
  const memberNumber = memberCode ? `LOCA · ${memberCode.replace(/-/g, "").slice(0, 8).toUpperCase().replace(/(.{4})/, "$1 ")}` : "";
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : "";

  function flip() {
    setHasFlipped(true);
    setFlipped((value) => !value);
    navigator.vibrate?.(10);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const card = cardRef.current;
    if (!card || event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = card.getBoundingClientRect();
    setTilt({ x: ((event.clientY - bounds.top) / bounds.height - .5) * -6, y: ((event.clientX - bounds.left) / bounds.width - .5) * 6 });
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
            <li><b>03</b>Tekan &ldquo;Lihat stamp&rdquo; — stamp ke-{STAMP_GOAL} kopi gratis</li>
          </ol>
        </div>

        <div className="profile-wallet">
          {loading ? (
            <div className="card profile-state"><div className="profile-skeleton" aria-label="Memuat profile"><i /><i /><i /><i /></div></div>
          ) : !user ? (
            <div className="card profile-state profile-empty">
              <h2>Profile belum bisa dibuka.</h2>
              <p>{loadError || "Kamu perlu login dulu untuk melihat kartu member."}</p>
              <a className="btn-primary" href="/login"><span>LOGIN / REGISTER</span><span className="arrow-icon" aria-hidden="true" /></a>
            </div>
          ) : (
            <>
              <div ref={cardRef} className="member-card-scene" style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }} onPointerMove={handlePointerMove} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
                <div className={`member-card${flipped ? " is-flipped" : ""}${hasFlipped ? " has-flipped" : ""}`} onClick={() => flip()}>
                  <section className="member-card-face member-card-front" aria-hidden={flipped} aria-label="Kartu member Coffe Loca">
                    <span className="mc-shine" aria-hidden="true" />
                    <span className="mc-bean" aria-hidden="true"><img src="/white-coffee-bean.png" alt="" /></span>
                    <header className="mc-top">
                      <span className="mc-brand"><img src="/white-coffee-bean.png" alt="" /><span>COFFE <b>LOCA</b></span></span>
                      <span className="mc-tier">{isStaff ? profile.role.toUpperCase() : "MEMBER"}</span>
                    </header>
                    <div className="mc-body">
                      <div className="mc-identity">
                        <small>NAMA MEMBER</small>
                        <strong>{displayName}</strong>
                        <span className="mc-number">{memberNumber}</span>
                      </div>
                      <button ref={qrTriggerRef} className="mc-qr" type="button" tabIndex={flipped ? -1 : 0} onClick={(event) => { event.stopPropagation(); setQrOpen(true); }} aria-label="Perbesar QR member">
                        <QRCodeSVG value={memberCode} size={112} bgColor="#f8f4eb" fgColor="#26372d" level="M" />
                        <i className="profile-scan-line" />
                      </button>
                    </div>
                    <footer className="mc-bottom"><span>{memberSince ? `SEJAK ${memberSince.toUpperCase()}` : "MEDAN"}</span><span>SCAN DI KASIR</span></footer>
                  </section>

                  <section className="member-card-face member-card-back" aria-hidden={!flipped} aria-label={`Kartu stamp: ${stamps} dari ${STAMP_GOAL}`}>
                    <header className="mc-top">
                      <span className="mc-back-title"><small>COFFE LOCA</small>Coffee stamp card</span>
                      <span className="mc-count"><b>{stamps}</b>/{STAMP_GOAL}</span>
                    </header>
                    <div className="mc-stamps" key={flipped ? "shown" : "hidden"}>
                      {Array.from({ length: STAMP_GOAL }, (_, index) => {
                        const filled = index < stamps;
                        const free = index === STAMP_GOAL - 1;
                        return (
                          <span key={index} className={`mc-stamp${filled ? " is-filled" : ""}${free ? " is-free" : ""}`} style={{ animationDelay: `${0.55 + index * 0.07}s`, ["--tilt" as string]: `${((index * 37) % 21) - 10}deg` }}>
                            {free ? <b>FREE<br />COFFEE</b> : <img src="/white-coffee-bean.png" alt="" />}
                          </span>
                        );
                      })}
                    </div>
                    <footer className="mc-bottom"><span>{remaining === 0 ? "KARTU PENUH — TUKAR KOPI GRATIS!" : `${remaining} STAMP LAGI UNTUK KOPI GRATIS`}</span><span>1 KOPI = 1 STAMP</span></footer>
                  </section>
                </div>
              </div>

              <div className="member-card-controls">
                <button className="btn-primary mc-flip" type="button" onClick={() => flip()} aria-pressed={flipped}>
                  <span>{flipped ? "LIHAT KARTU" : "LIHAT STAMP"}</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5" /></svg>
                </button>
                <p>{flipped ? "Ketuk kartu untuk kembali ke QR member." : `${stamps}/${STAMP_GOAL} stamp terkumpul. Ketuk kartu untuk membalik.`}</p>
              </div>

              <div className="card profile-account">
                <div className="profile-identity">
                  <div className="profile-avatar">{user.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="" /> : initials}</div>
                  <div><span className="profile-kicker">{isStaff ? `${profile.role.toUpperCase()} COFFE LOCA` : "MEMBER COFFE LOCA"}</span><h2>{displayName}</h2>{email && <p>{email}</p>}</div>
                </div>
                <div className="profile-actions">
                  <a className="btn-primary" href="/#reservation"><span>BUAT RESERVASI</span><span className="arrow-icon" aria-hidden="true" /></a>
                  <div className="profile-actions-row">
                    {isStaff && <a className="btn-ghost" href="/admin">ADMIN PANEL <span className="arrow-icon" aria-hidden="true" /></a>}
                    <button className="btn-ghost profile-logout" type="button" onClick={signOut}>LOGOUT <span className="arrow-icon arrow-up" aria-hidden="true" /></button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
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
