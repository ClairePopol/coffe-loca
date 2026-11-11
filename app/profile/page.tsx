"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { QRCodeSVG } from "qrcode.react";
import { getSupabaseClient } from "@/lib/supabase";
import { PageFooter, PageHeader } from "@/components/PageShell";
import { useConfirm } from "@/components/ConfirmDialog";
import { isStaff as isStaffRole, roleLabel } from "@/lib/roles";
import { formatPhone, isPhoneAuthEmail, userPhone } from "@/lib/phone";
import { formatDateId, monthBounds, todayWib, type CafeEvent, type Promo, type Voucher } from "@/lib/content";

type Profile = { stamps: number; role: string };
const STAMP_GOAL = 10;

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile>({ stamps: 0, role: "member" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // Managed by staff in the admin panel (supabase/content.sql). Empty until loaded / when nothing is published.
  const [promos, setPromos] = useState<Pick<Promo, "id" | "title" | "detail" | "badge" | "valid_until">[]>([]);
  const [events, setEvents] = useState<Pick<CafeEvent, "id" | "title" | "detail" | "event_date" | "time_text">[]>([]);
  const [vouchers, setVouchers] = useState<{ id: number; voucher: Pick<Voucher, "id" | "title" | "detail" | "expires_at"> }[]>([]);
  const [qrOpen, setQrOpen] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [side, setSide] = useState<"front" | "back">("front");
  const [phase, setPhase] = useState<"idle" | "out" | "in">("idle");
  const flipped = side === "back";
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [confirm, confirmDialog] = useConfirm();
  const [signingOut, setSigningOut] = useState(false);
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

        // Side panels: a failure here must never break the member card, so errors are ignored (panels stay empty).
        const today = todayWib();
        const [promoRes, eventRes, voucherRes] = await Promise.all([
          supabase.from("promos").select("id, title, detail, badge, valid_until").eq("is_active", true).or(`valid_until.is.null,valid_until.gte.${today}`).order("created_at", { ascending: false }),
          supabase.from("events").select("id, title, detail, event_date, time_text").eq("is_active", true).gte("event_date", today).lte("event_date", monthBounds(today).end).order("event_date", { ascending: true }),
          supabase.from("member_vouchers").select("id, vouchers(id, title, detail, expires_at, is_active)").eq("member_id", authData.user.id).eq("status", "active").order("granted_at", { ascending: false }),
        ]);
        if (!active) return;
        if (!promoRes.error) setPromos(promoRes.data ?? []);
        if (!eventRes.error) setEvents(eventRes.data ?? []);
        if (!voucherRes.error) {
          const rows = (voucherRes.data ?? []) as unknown as { id: number; vouchers: (Voucher & { is_active: boolean }) | null }[];
          setVouchers(rows.flatMap((row) => (row.vouchers && row.vouchers.is_active && (!row.vouchers.expires_at || row.vouchers.expires_at >= today) ? [{ id: row.id, voucher: row.vouchers }] : [])));
        }
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

  const phone = userPhone(user);
  const displayName: string = user?.user_metadata?.full_name || (phone ? formatPhone(phone) : user?.email?.split("@")[0]) || "Loca member";
  // Show the phone number for phone accounts; old accounts still show their email.
  const contact = phone ? formatPhone(phone) : isPhoneAuthEmail(user?.email) ? "" : user?.email ?? "";
  const initials = useMemo(() => displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "L", [displayName]);
  const memberCode = user?.id ?? "";
  const stamps = Math.min(profile.stamps, STAMP_GOAL);
  const remaining = STAMP_GOAL - stamps;
  const isStaff = isStaffRole(profile.role);
  const memberNumber = memberCode ? `LOCA · ${memberCode.replace(/-/g, "").slice(0, 8).toUpperCase().replace(/(.{4})/, "$1 ")}` : "";
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : "";
  const monthLabel = new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" }).toUpperCase();
  const showAside = !loading && Boolean(user);

  // Single-sided flip: turn the card edge-on, swap the face, turn it back.
  // (Two-sided backface-visibility flips are unreliable in mobile Safari.)
  function flip() {
    if (phase !== "idle") return;
    navigator.vibrate?.(10);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSide((current) => (current === "front" ? "back" : "front"));
      return;
    }
    setPhase("out");
  }

  function onFlipAnimationEnd(event: React.AnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (phase === "out") {
      setSide((current) => (current === "front" ? "back" : "front"));
      setPhase("in");
    } else if (phase === "in") {
      setPhase("idle");
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const card = cardRef.current;
    if (!card || event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = card.getBoundingClientRect();
    setTilt({ x: ((event.clientY - bounds.top) / bounds.height - .5) * -6, y: ((event.clientX - bounds.left) / bounds.width - .5) * 6 });
  }
  async function signOut() {
    const ok = await confirm({
      title: "Keluar dari akunmu?",
      message: "Stamp kamu tetap tersimpan. Login lagi kapan saja untuk melihat kartu member.",
      confirmLabel: "YA, LOGOUT",
      tone: "danger",
      icon: <svg viewBox="0 0 24 24"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10" /></svg>,
    });
    if (!ok) return;
    setSigningOut(true);
    try {
      await getSupabaseClient().auth.signOut();
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <main className="page-shell profile-page">
      <div className="profile-bean profile-bean-one" aria-hidden="true"><img src="/white-coffee-bean.png" alt="" /></div>
      <div className="profile-bean profile-bean-two" aria-hidden="true"><img src="/white-coffee-bean.png" alt="" /></div>
      <PageHeader />
      <section className={`profile-layout${showAside ? " has-aside" : ""}`} aria-label="Profil member">
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
            <div className="card profile-wallet-panel">
              <div className="profile-identity">
                <div className="profile-avatar">{user.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="" /> : initials}</div>
                <div><span className="profile-kicker">{`${roleLabel(profile.role).toUpperCase()} COFFE LOCA`}</span><h2>{displayName}</h2>{contact && <p>{contact}</p>}</div>
              </div>

              <div ref={cardRef} className="member-card-scene" style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }} onPointerMove={handlePointerMove} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
                <div className={`member-card side-${side}${phase !== "idle" ? ` is-${phase}` : ""}`} onClick={flip} onAnimationEnd={onFlipAnimationEnd} aria-live="polite">
                  {side === "front" ? (
                    <section className="member-card-face member-card-front" aria-label="Kartu member Coffe Loca">
                      <span className="mc-shine" aria-hidden="true" />
                      <span className="mc-bean" aria-hidden="true"><img src="/white-coffee-bean.png" alt="" /></span>
                      <header className="mc-top">
                        <span className="mc-brand"><img src="/white-coffee-bean.png" alt="" /><span>COFFE <b>LOCA</b></span></span>
                        <span className="mc-tier">{roleLabel(profile.role).toUpperCase()}</span>
                      </header>
                      <div className="mc-body">
                        <div className="mc-identity">
                          <small>NAMA MEMBER</small>
                          <strong>{displayName}</strong>
                          <span className="mc-number">{memberNumber}</span>
                        </div>
                        <button ref={qrTriggerRef} className="mc-qr" type="button" onClick={(event) => { event.stopPropagation(); setQrOpen(true); }} aria-label="Perbesar QR member">
                          <QRCodeSVG value={memberCode} size={112} bgColor="#f8f4eb" fgColor="#26372d" level="M" />
                          <i className="profile-scan-line" />
                        </button>
                      </div>
                      <footer className="mc-bottom"><span>{memberSince ? `SEJAK ${memberSince.toUpperCase()}` : "MEDAN"}</span><span>SCAN DI KASIR</span></footer>
                    </section>
                  ) : (
                    <section className="member-card-face member-card-back" aria-label={`Kartu stamp: ${stamps} dari ${STAMP_GOAL}`}>
                      <header className="mc-back-top">
                        <span className="mc-back-brand"><img src="/white-coffee-bean.png" alt="" /><span><small>COFFE <b>LOCA</b></small>Stamp card</span></span>
                        <span className="mc-count"><b>{stamps}</b>/ {STAMP_GOAL}</span>
                      </header>
                      <div className="mc-stamps">
                        {Array.from({ length: STAMP_GOAL }, (_, index) => {
                          const filled = index < stamps;
                          const free = index === STAMP_GOAL - 1;
                          return (
                            <span key={index} className={`mc-stamp${filled ? " is-filled" : ""}${free ? " is-free" : ""}`} style={{ ["--i" as string]: index, ["--tilt" as string]: `${((index * 37) % 21) - 10}deg` }}>
                              {free ? (
                                <><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c0 1 1 1.5 1 2.5M11.5 3.5c0 1 1 1.5 1 2.5" /></svg><b>FREE</b></>
                              ) : filled ? (
                                <img src="/white-coffee-bean.png" alt="" />
                              ) : (
                                <em>{index + 1}</em>
                              )}
                            </span>
                          );
                        })}
                      </div>
                      <footer className="mc-back-bottom">
                        <span className="mc-meter" aria-hidden="true"><i style={{ width: `${(stamps / STAMP_GOAL) * 100}%` }} /></span>
                        <span>{remaining === 0 ? "Penuh! Tunjukkan QR ke kasir untuk kopi gratis" : `${remaining} stamp lagi untuk kopi gratis`}</span>
                      </footer>
                    </section>
                  )}
                </div>
              </div>

              <div className="member-card-controls">
                <button className="btn-ghost mc-flip" type="button" onClick={flip} aria-pressed={flipped}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5" /></svg>
                  <span>{flipped ? "LIHAT KARTU" : "LIHAT STAMP"}</span>
                </button>
              </div>

              <div className="profile-actions">
                <a className="btn-primary" href="/#reservation"><span>BUAT RESERVASI</span><span className="arrow-icon" aria-hidden="true" /></a>
                <div className="profile-actions-row">
                  {isStaff && <a className="btn-ghost" href="/admin">ADMIN PANEL <span className="arrow-icon" aria-hidden="true" /></a>}
                  <button className="btn-ghost profile-logout" type="button" onClick={signOut} disabled={signingOut}>{signingOut ? "KELUAR..." : "LOGOUT"} <span className="arrow-icon arrow-up" aria-hidden="true" /></button>
                </div>
              </div>
            </div>
          )}
        </div>

        {showAside && (
          <aside className="profile-aside" aria-label="Rewards, promo, dan acara bulan ini">
            <section className="card aside-card" aria-labelledby="aside-rewards">
              <header className="aside-head"><h2 id="aside-rewards">Rewards &amp; Voucher</h2><span>{stamps} / {STAMP_GOAL} STAMP</span></header>
              <div className="aside-reward">
                <span className="mc-meter" aria-hidden="true"><i style={{ width: `${(stamps / STAMP_GOAL) * 100}%` }} /></span>
                <p>{remaining === 0 ? "Stamp penuh! Tunjukkan QR ke kasir untuk kopi gratis." : `${remaining} stamp lagi untuk kopi gratis.`}</p>
              </div>
              {vouchers.length === 0 ? (
                <p className="aside-empty">Belum ada voucher aktif. Voucher barumu akan muncul di sini.</p>
              ) : (
                <ul className="aside-list">
                  {vouchers.map(({ id, voucher }) => (
                    <li key={id} className="aside-voucher">
                      <div><strong>{voucher.title}</strong>{voucher.detail && <small>{voucher.detail}</small>}</div>
                      <span>{voucher.expires_at ? `s/d ${formatDateId(voucher.expires_at)}` : "Tanpa batas"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card aside-card" aria-labelledby="aside-promo">
              <header className="aside-head"><h2 id="aside-promo">This Month&rsquo;s Promo</h2><span>{monthLabel}</span></header>
              {promos.length === 0 ? (
                <p className="aside-empty">Promo bulan ini segera hadir.</p>
              ) : (
                <ul className="aside-list">
                  {promos.map((promo) => (
                    <li key={promo.id} className="aside-promo">
                      <div><strong>{promo.title}</strong>{promo.badge && <b className="aside-badge">{promo.badge}</b>}{promo.detail && <small>{promo.detail}</small>}</div>
                      {promo.valid_until && <em>s/d {formatDateId(promo.valid_until)}</em>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card aside-card" aria-labelledby="aside-events">
              <header className="aside-head"><h2 id="aside-events">What&rsquo;s Happening This Month</h2><span>{monthLabel}</span></header>
              {events.length === 0 ? (
                <p className="aside-empty">Belum ada acara bulan ini.</p>
              ) : (
                <ul className="aside-list">
                  {events.map((event) => {
                    const date = new Date(`${event.event_date}T00:00:00`);
                    return (
                      <li key={event.id} className="aside-event">
                        <time className="aside-date" dateTime={event.event_date}><b>{date.getDate()}</b>{date.toLocaleDateString("id-ID", { month: "short" }).toUpperCase()}</time>
                        <div><strong>{event.title}</strong>{event.detail && <small>{event.detail}</small>}{event.time_text && <em>{event.time_text}</em>}</div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </aside>
        )}
      </section>
      <PageFooter items={["COFFE LOCA · MEDAN", "TAKE IT EASY", "© 2026"]} />
      {confirmDialog}

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
