"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import { SITE } from "@/lib/site";
import Wordmark from "@/components/Wordmark";

// Same pattern as the Coffee header in app/page.tsx (profile link + hamburger + fullscreen red menu),
// but always on the light surface because /store has a white background.
const menuItems = [
  { title: "Katalog", href: "/store", number: "01", note: "BOARDGAME & POKÉMON" },
  { title: "Event", href: "/events", number: "02", note: "TURNAMEN & KEGIATAN LOCA" },
];

export type Brand = { second: string; tagline: string; href: string; label: string; menuTop: string; next: string };
const STORE_BRAND: Brand = { second: "STORE", tagline: "BOARDGAME · POKÉMON", href: "/store", label: "Loca Store, ke katalog", menuTop: "NAVIGASI / LOCA STORE", next: "/store" };
/** `brand` picks the wordmark / login-return page, so /store and /events share one header. */
export default function StoreHeader({ brand = STORE_BRAND }: { brand?: Brand }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;
    try {
      const supabase = getSupabaseClient();
      supabase.auth.getUser().then(({ data }) => { if (active) setUser(data.user); });
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (active) setUser(session?.user ?? null); });
      return () => { active = false; listener.subscription.unsubscribe(); };
    } catch {
      return () => { active = false; };
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle("menu-is-open", open);
    return () => document.body.classList.remove("menu-is-open");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);
  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Loca member";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase() || "L";

  return (
    <>
      <header className="site-header header-on-light">
        <Wordmark first="LOCA" second={brand.second} tagline={brand.tagline} label={brand.label} href={brand.href} />
        <div className="header-actions">
          {user
            ? <a className="header-profile-link" href="/store/profile" aria-label={`Buka profil ${name}`} title={name}>{user.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="" /> : <span>{initials}</span>}</a>
            : <a className="header-account-link" href={`/login?next=${brand.next}`}>LOGIN <span className="arrow-icon" aria-hidden="true" /></a>}
          <button type="button" className={`menu-toggle${open ? " is-open" : ""}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="store-menu" aria-label={open ? "Tutup navigasi" : "Buka navigasi"}>
            <span className={`menu-icon${open ? " menu-icon-open" : ""}`} aria-hidden="true"><i /><i /></span>
          </button>
        </div>
      </header>
      <AnimatePresence>
        {open && (
          <motion.div id="store-menu" data-lenis-prevent data-scroll-lock-allow className="menu-overlay" initial={{ clipPath: "inset(0 0 100% 0)" }} animate={{ clipPath: "inset(0 0 0% 0)" }} exit={{ clipPath: "inset(0 0 100% 0)" }} transition={{ duration: 0.72, ease: [0.76, 0, 0.24, 1] }}>
            <div className="menu-inner">
              <div className="menu-top"><span><i /> {brand.menuTop}</span><span>{String(menuItems.length).padStart(2, "0")} HALAMAN</span></div>
              <nav className="menu-links" aria-label="Navigasi utama">
                {menuItems.map((item, index) => (
                  <motion.a key={item.number} href={item.href} onClick={close} initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 + index * 0.1, duration: 0.62, ease: [0.22, 1, 0.36, 1] }}>
                    <span className="menu-number">{item.number}</span>
                    <span className="menu-title-wrap"><span className="menu-title">{item.title}</span><small>{item.note}</small></span>
                    <span className="menu-arrow"><i className="arrow-icon" aria-hidden="true" /></span>
                  </motion.a>
                ))}
              </nav>
              <motion.div className="menu-bottom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.5 }}>
                <div><span className="menu-bottom-label">AREA MEMBER</span><a href={user ? "/store/profile" : `/login?next=${brand.next}`} onClick={close}>{user ? "Lihat profile" : "Login / Register"} <i className="arrow-icon" aria-hidden="true" /></a><a href="/">Kembali ke Coffee Loca <i className="arrow-icon" aria-hidden="true" /></a></div>
                <div><span className="menu-bottom-label">KUNJUNGI KAMI</span><a href={SITE.mapsUrl} target="_blank" rel="noreferrer">{SITE.addressLine} <i className="arrow-icon" aria-hidden="true" /></a></div>
                <div><span className="menu-bottom-label">SAPA KAMI</span><a href={`mailto:${SITE.email}`}>{SITE.email} <i className="arrow-icon" aria-hidden="true" /></a></div>
                <div><span className="menu-bottom-label">IKUTI CERITA</span><div className="social-links"><a href={SITE.instagram} target="_blank" rel="noreferrer">Instagram</a><a href={SITE.tiktok} target="_blank" rel="noreferrer">TikTok</a></div></div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
