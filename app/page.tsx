"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { FormEvent, Fragment, KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import { coffeeAndDrinks, comfortFood, snacks, type Dish } from "@/lib/menu";
import { SITE } from "@/lib/site";
import { lenisRef } from "@/lib/lenis";
import { useScrollLock } from "@/lib/useScrollLock";
import SequenceScroll from "@/components/SequenceScroll";
import Wordmark from "@/components/Wordmark";

const menuItems = [
  { title: "Awal cerita", href: "#cerita", number: "01", note: "KENALI CERITA KAMI" },
  { title: "Menu kami", href: "#menu", number: "02", note: "PILIH YANG KAMU SUKA" },
  { title: "Reservation", href: "#reservation", number: "03", note: "SIAPKAN JEDA TERBAIKMU" },
  { title: "Lokasi & jam buka", href: "#lokasi-loca", number: "04", note: "TEMUKAN COFFEE LOCA" },
];

type CategoryId = "comfort" | "snack" | "drinks";
type Category = { id: CategoryId; number: string; title: string; subtitle: string; dishes: Dish[] };

const categories: Category[] = [
  { id: "comfort", number: "01", title: "Comfort Food", subtitle: "YANG SELALU BIKIN NYAMAN", dishes: comfortFood },
  { id: "snack", number: "02", title: "Snack", subtitle: "TEMAN NGOBROL & JEDA", dishes: snacks },
  { id: "drinks", number: "03", title: "Coffee & Drinks", subtitle: "KOPI, JUICE & SIGNATURE LOCA", dishes: coffeeAndDrinks },
];

const pad = (value: number) => String(value).padStart(2, "0");

function groupDishes(dishes: Dish[]) {
  if (!dishes.some((dish) => dish.category)) return [{ label: undefined, items: dishes }];
  const labels = Array.from(new Set(dishes.map((dish) => dish.category)));
  return labels.map((label) => ({ label, items: dishes.filter((dish) => dish.category === label) }));
}

function MenuIcon({ open }: { open: boolean }) {
  return <span className={`menu-icon${open ? " menu-icon-open" : ""}`} aria-hidden="true"><i /><i /></span>;
}

function Navigation() {
  const [open, setOpen] = useState(false);
  const [lightSurface, setLightSurface] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const close = () => setOpen(false);
  useScrollLock(open);

  function goTo(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
    event.preventDefault();
    setOpen(false);
    // Wait until the menu has released the scroll lock (Lenis running again), then glide to the section.
    const startedAt = performance.now();
    const tryScroll = () => {
      const lenis = lenisRef.current;
      const unlocked = !lenis || !lenis.isStopped;
      if (!unlocked && performance.now() - startedAt < 1500) {
        requestAnimationFrame(tryScroll);
        return;
      }
      const target = document.querySelector<HTMLElement>(href);
      if (!target) return;
      window.history.replaceState(null, "", href);
      if (lenis) lenis.scrollTo(target);
      else target.scrollIntoView({ behavior: "smooth" });
    };
    requestAnimationFrame(tryScroll);
  }

  useEffect(() => {
    let active = true;
    try {
      const supabase = getSupabaseClient();
      supabase.auth.getUser().then(({ data }) => {
        if (active) setUser(data.user);
      });
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) setUser(session?.user ?? null);
      });
      return () => {
        active = false;
        listener.subscription.unsubscribe();
      };
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
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  useEffect(() => {
    const updateSurface = () => {
      const probeY = 100;
      const lightSections = document.querySelectorAll<HTMLElement>('[data-nav-theme="light"]');
      const overLightSection = Array.from(lightSections).some((section) => {
        const bounds = section.getBoundingClientRect();
        return bounds.top <= probeY && bounds.bottom > probeY;
      });
      setLightSurface(overLightSection);
    };
    updateSurface();
    window.addEventListener("scroll", updateSurface, { passive: true });
    window.addEventListener("resize", updateSurface);
    return () => {
      window.removeEventListener("scroll", updateSurface);
      window.removeEventListener("resize", updateSurface);
    };
  }, []);

  const accountName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Loca member";
  const accountInitials = accountName.split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase() || "L";

  return (
    <>
      <header className={`site-header${lightSurface || open ? " header-on-light" : ""}`}>
        <Wordmark href="#beranda" inverse />
        <div className="header-actions">
          {user ? <a className="header-profile-link" href="/profile" aria-label={`Buka profil ${accountName}`} title={accountName}>{user.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="" /> : <span>{accountInitials}</span>}</a> : <a className="header-account-link" href="/login">LOGIN <span className="arrow-icon" aria-hidden="true" /></a>}
          <button className={`menu-toggle${open ? " is-open" : ""}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="site-menu" aria-label={open ? "Tutup navigasi" : "Buka navigasi"}>
            <MenuIcon open={open} />
          </button>
        </div>
      </header>
      <AnimatePresence>
        {open && (
          <motion.div id="site-menu" data-lenis-prevent data-scroll-lock-allow className="menu-overlay" initial={{ clipPath: "inset(0 0 100% 0)" }} animate={{ clipPath: "inset(0 0 0% 0)" }} exit={{ clipPath: "inset(0 0 100% 0)" }} transition={{ duration: 0.72, ease: [0.76, 0, 0.24, 1] }}>
            <div className="menu-inner">
              <div className="menu-top"><span><i /> NAVIGASI / COFFE LOCA</span><span>{pad(menuItems.length)} HALAMAN</span></div>
              <nav className="menu-links" aria-label="Navigasi utama">
                {menuItems.map((item, index) => (
                  <motion.a key={item.number} href={item.href} onClick={(event) => goTo(event, item.href)} initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 + index * 0.1, duration: 0.62, ease: [0.22, 1, 0.36, 1] }}>
                    <span className="menu-number">{item.number}</span><span className="menu-title-wrap"><span className="menu-title">{item.title}</span><small>{item.note}</small></span><span className="menu-arrow"><i className="arrow-icon" aria-hidden="true" /></span>
                  </motion.a>
                ))}
              </nav>
              <motion.div className="menu-bottom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.5 }}>
                <div><span className="menu-bottom-label">AREA MEMBER</span><a href={user ? "/profile" : "/login"} onClick={close}>{user ? "Lihat profile" : "Login / Register"} <i className="arrow-icon" aria-hidden="true" /></a></div>
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

function EntryChoice() {
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useScrollLock(visible);

  useEffect(() => {
    setVisible(true);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("entry-is-open", visible);
    if (visible) dialogRef.current?.focus({ preventScroll: true });
    return () => document.body.classList.remove("entry-is-open");
  }, [visible]);

  function choose(path: "coffee" | "store") {
    if (path === "coffee") setVisible(false);
    else window.location.href = "/store";
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div ref={dialogRef} tabIndex={-1} data-lenis-prevent data-scroll-lock-allow className="entry-choice" role="dialog" aria-modal="true" aria-labelledby="entry-title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
          <div className="entry-choice-orbit" aria-hidden="true" />
          <div className="entry-choice-top"><span>LOCA / EST. WITH CARE</span><span>MEDAN · 2026</span></div>
          <div className="entry-choice-content">
            <div className="entry-choice-mark"><img src="/white-coffee-bean.png" alt="" /><span>COFFE <b>LOCA</b></span></div>
            <span className="eyebrow"><i /> WHERE DO YOU WANT TO GO?</span>
            <h1 id="entry-title">Pilih ruang<br /><em>untuk jedamu.</em></h1>
            <p>Satu rumah, dua cara menikmati Loca.</p>
            <div className="entry-choice-actions">
              <button type="button" onClick={() => choose("coffee")}><span><small>01 / COFFEE HOUSE</small><strong>Loca Coffee</strong><em>Good coffee, good company.</em></span><i className="arrow-icon" aria-hidden="true" /></button>
              <button type="button" onClick={() => choose("store")}><span><small>02 / ONLINE STORE</small><strong>Loca Store</strong><em>Coming soon — take Loca home.</em></span><i className="arrow-icon" aria-hidden="true" /></button>
            </div>
          </div>
          <div className="entry-choice-bottom"><span>TAKE YOUR TIME</span><span>COFFEE · STORE · COMMUNITY</span></div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.88, anchors: true });
    lenisRef.current = lenis;
    gsap.registerPlugin(ScrollTrigger);
    const updateScrollTrigger = () => ScrollTrigger.update();
    const raf = (time: number) => lenis.raf(time * 1000);
    lenis.on("scroll", updateScrollTrigger);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    // Freeze page scroll while the entry choice or fullscreen menu is open.
    const syncLock = () => {
      const locked = document.body.classList.contains("entry-is-open") || document.body.classList.contains("menu-is-open");
      if (locked) lenis.stop();
      else lenis.start();
    };
    syncLock();
    const observer = new MutationObserver(syncLock);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => {
      observer.disconnect();
      lenisRef.current = null;
      lenis.off("scroll", updateScrollTrigger);
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);
  return null;
}

/**
 * Slowly plays the hero scroll animation on its own once the intro screens are gone,
 * ending with the "Kopi enak. Hari yang baik." section fully in view.
 * Any user input (swipe/touch, wheel, click, key) stops it immediately and hands
 * control back. Only drives the page scroll — the hero itself is untouched.
 */
const AUTO_SCROLL_SECONDS = 11;
const AUTO_SCROLL_START_DELAY = 1200;

function HeroAutoScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    let running = false;
    let startTimer = 0;
    let pollTimer = 0;

    const stop = () => {
      if (cancelled) return;
      cancelled = true;
      window.clearTimeout(startTimer);
      window.clearInterval(pollTimer);
      removeListeners();
      const lenis = lenisRef.current;
      // stop() + start() cancels Lenis' running scrollTo and keeps the current position.
      if (running && lenis && !lenis.isStopped) { lenis.stop(); lenis.start(); }
      running = false;
    };
    const onKey = (event: KeyboardEvent) => { if (!event.metaKey && !event.ctrlKey && !event.altKey) stop(); };
    const events: [string, EventListener][] = [["wheel", stop], ["touchstart", stop], ["pointerdown", stop], ["keydown", onKey as EventListener]];
    const addListeners = () => events.forEach(([type, fn]) => window.addEventListener(type, fn, { passive: true, capture: true }));
    const removeListeners = () => events.forEach(([type, fn]) => window.removeEventListener(type, fn, { capture: true }));

    const begin = () => {
      const lenis = lenisRef.current;
      const story = document.getElementById("cerita"); // "Kopi enak. Hari yang baik."
      if (cancelled || !lenis || !story || lenis.isStopped) return;
      if (window.scrollY > 40) { stop(); return; } // visitor already scrolled — don't take over
      // End with the Cerita section filling the screen (its top at the top of the viewport).
      const end = Math.round(story.getBoundingClientRect().top + window.scrollY);
      if (end <= window.scrollY) { stop(); return; }
      running = true;
      lenis.scrollTo(end, {
        duration: AUTO_SCROLL_SECONDS,
        easing: (t) => -(Math.cos(Math.PI * t) - 1) / 2, // gentle ease-in-out
        onComplete: () => { running = false; stop(); },
      });
    };

    // Wait until the entry choice is closed and the preloader is gone, then start after a short pause.
    const ready = () => !document.body.classList.contains("entry-is-open") && !document.querySelector(".preloader") && lenisRef.current;
    // Listen for user input only from here on, so the tap that closes the entry choice doesn't count.
    pollTimer = window.setInterval(() => {
      if (cancelled || !ready()) return;
      window.clearInterval(pollTimer);
      addListeners();
      startTimer = window.setTimeout(begin, AUTO_SCROLL_START_DELAY);
    }, 200);

    return stop;
  }, []);
  return null;
}

function TextReveal({ children }: { children: string }) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: textRef, offset: ["start 0.88", "end 0.52"] });
  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const chars = textRef.current?.querySelectorAll<HTMLElement>("[data-char]");
    if (!chars) return;
    chars.forEach((char, index) => {
      const reveal = Math.max(0, Math.min(1, progress * (chars.length + 12) - index + 12));
      char.style.color = `color-mix(in srgb, var(--reveal-color) ${Math.round(reveal * 100)}%, var(--quiet-color))`;
      char.style.transform = `translateY(${(1 - reveal) * 8}px)`;
    });
  });
  const words = children.split(" ");
  let charIndex = 0;
  return (
    <p className="text-reveal" ref={textRef}>
      {words.map((word, wordIndex) => (
        <Fragment key={wordIndex}>
          <span className="text-reveal-word">{Array.from(word).map((char) => <span data-char key={charIndex++}>{char}</span>)}</span>
          {wordIndex < words.length - 1 && " "}
        </Fragment>
      ))}
    </p>
  );
}

function MenuPanel({ category }: { category: Category }) {
  const groups = groupDishes(category.dishes);
  let counter = 0;

  return (
    <div className="menu-list-panel" data-nav-theme="light">
      <header className="menu-list-heading">
        <span className="menu-category-number">{category.number}</span>
        <div><span className="menu-list-subtitle">{category.subtitle}</span><h3>{category.title}</h3></div>
        <span className="menu-list-count">{pad(category.dishes.length)} ITEMS</span>
      </header>
      {groups.map((group) => (
        <section className="menu-group" key={group.label ?? "all"} aria-label={group.label ?? category.title}>
          {group.label && <h4 className="menu-group-label"><span>{group.label}</span><small>{pad(group.items.length)}</small></h4>}
          <ol className="menu-list">
            {group.items.map((dish) => {
              counter += 1;
              return (
                <li className="menu-item-row" key={`${group.label ?? category.id}-${dish.name}`}>
                  <span className="menu-item-index">{pad(counter)}</span>
                  <span className="menu-item-copy">
                    <span className="menu-item-line"><strong>{dish.name}</strong><i className="menu-item-leader" aria-hidden="true" /><span className="menu-item-price">{dish.price === "SEASONAL" ? "Seasonal" : <><small>Rp</small>{dish.price}</>}</span></span>
                    {dish.detail && <small>{dish.detail}</small>}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

function MenuSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeId, setActiveId] = useState<CategoryId>("comfort");
  const active = categories.find((category) => category.id === activeId) ?? categories[0];

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const section = sectionRef.current;
    if (!section || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      const intro = gsap.timeline({
        scrollTrigger: { trigger: section, start: "top 76%", once: true },
      });
      intro
        .from(".menu-kicker", { autoAlpha: 0, y: 14, duration: 0.45, ease: "power2.out" })
        .from(".menu-heading", { autoAlpha: 0, y: 22, duration: 0.58, ease: "power3.out" }, "-=0.2")
        .from(".menu-category-tabs", { autoAlpha: 0, y: 16, duration: 0.5, ease: "power3.out" }, "-=0.2")
        .from(".menu-list-panel", { autoAlpha: 0, y: 24, duration: 0.62, ease: "power3.out" }, "-=0.16");
    }, section);
    return () => context.revert();
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const section = sectionRef.current;
    if (!section || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      gsap.set(".menu-item-row", { autoAlpha: 0, y: 12 });
      ScrollTrigger.batch(".menu-item-row", {
        start: "top 92%",
        once: true,
        batchMax: 6,
        onEnter: (rows) => gsap.to(rows, { autoAlpha: 1, y: 0, duration: 0.38, stagger: 0.05, ease: "power3.out", overwrite: "auto" }),
      });
      ScrollTrigger.refresh();
    }, section);
    return () => context.revert();
  }, [activeId]);

  function select(id: CategoryId) {
    if (id === activeId) return;
    setActiveId(id);
    const panel = panelRef.current;
    if (!panel) return;
    const offset = window.matchMedia("(max-width: 760px)").matches ? 150 : 110;
    const top = panel.getBoundingClientRect().top;
    if (top < offset) window.scrollTo({ top: top + window.scrollY - offset, behavior: "smooth" });
  }

  function onTabKey(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next = index;
    if (event.key in keys) next = (index + keys[event.key] + categories.length) % categories.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = categories.length - 1;
    else return;
    event.preventDefault();
    select(categories[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <section ref={sectionRef} className="menu-section section-pad" id="menu" aria-labelledby="menu-title">
      <div className="section-kicker section-kicker-dark menu-kicker"><span>02 / MENU COFFE LOCA</span><span>MAKAN ENAK, JEDA LEBIH LAMA</span></div>
      <div className="menu-heading">
        <div><span className="eyebrow"><i /> DARI YANG HANGAT SAMPAI YANG RENYAH</span><h2 id="menu-title">Ada yang<br /><em>kamu suka.</em></h2></div>
        <p>Comfort food, camilan, dan racikan kopi favorit untuk menemani waktu di Loca. Semua harga dalam Rupiah.</p>
      </div>
      <div className="menu-category-tabs" role="tablist" aria-label="Kategori menu">
        {categories.map((category, index) => {
          const selected = category.id === activeId;
          return (
            <button
              key={category.id}
              ref={(node) => { tabRefs.current[index] = node; }}
              className={selected ? "is-active" : ""}
              id={`menu-tab-${category.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls="menu-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => select(category.id)}
              onKeyDown={(event) => onTabKey(event, index)}
            >
              <span className="menu-tab-number">{category.number}</span>
              <span className="menu-tab-copy"><strong>{category.title}</strong><small>{category.subtitle}</small></span>
              <span className="menu-tab-count">{pad(category.dishes.length)}</span>
            </button>
          );
        })}
      </div>
      <div ref={panelRef} className="menu-list-grid" id="menu-panel" role="tabpanel" aria-labelledby={`menu-tab-${active.id}`} tabIndex={0}>
        <MenuPanel key={active.id} category={active} />
      </div>
      <div className="menu-footnote"><span>{pad(active.dishes.length)} PILIHAN UNTUK DINIKMATI</span><span>HARGA DAPAT BERUBAH SEWAKTU-WAKTU</span></div>
    </section>
  );
}

function ReservationSection() {
  const [submitted, setSubmitted] = useState<null | { name: string; date: string; time: string; guests: string }>(null);
  const [minDate, setMinDate] = useState<string>();

  useEffect(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setMinDate(now.toISOString().slice(0, 10));
  }, []);

  function handleReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitted({
      name: String(data.get("name") ?? "").trim(),
      date: String(data.get("date") ?? ""),
      time: String(data.get("time") ?? ""),
      guests: String(data.get("guests") ?? ""),
    });
  }

  const formattedDate = submitted?.date
    ? new Date(`${submitted.date}T00:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <section className="reservation-section section-pad" id="reservation" data-nav-theme="light" aria-labelledby="reservation-title">
      <div className="section-kicker reservation-kicker"><span>03 / RESERVATION</span><span>SIAPKAN JEDA TERBAIKMU</span></div>
      <div className="reservation-layout">
        <div className="reservation-copy">
          <span className="eyebrow"><i /> MEJA UNTUK CERITA YANG BAIK</span>
          <h2 id="reservation-title">Simpan tempat<br /><em>untuk nanti.</em></h2>
          <p>Datang dengan tenang. Pilih waktu yang kamu suka, biar kami siapkan ruang untuk kopi dan cerita yang ingin kamu bagi.</p>
          <div className="reservation-mark" aria-hidden="true"><span className="reservation-mark-ring"><img src="/white-coffee-bean.png" alt="" /></span></div>
        </div>
        <div className="reservation-card">
          <div className="reservation-card-top"><span>TABLE REQUEST</span><span>COFFE LOCA / MEDAN</span></div>
          {submitted ? (
            <div className="reservation-success" role="status">
              <span className="reservation-success-icon" aria-hidden="true"><img src="/white-coffee-bean.png" alt="" /></span>
              <span className="reservation-card-label">PERMINTAAN DITERIMA</span>
              <h3>Terima kasih, {submitted.name.split(" ")[0] || "kamu"}.</h3>
              <p>Kami akan menghubungimu untuk konfirmasi meja.</p>
              <dl>
                <div><dt>TANGGAL</dt><dd>{formattedDate}</dd></div>
                <div><dt>JAM</dt><dd>{submitted.time}</dd></div>
                <div><dt>TAMU</dt><dd>{submitted.guests} orang</dd></div>
              </dl>
              <button className="reservation-reset" type="button" onClick={() => setSubmitted(null)}>BUAT PERMINTAAN LAIN <i className="arrow-icon" aria-hidden="true" /></button>
            </div>
          ) : (
            <>
              <div className="reservation-card-heading"><span className="reservation-card-label">PILIH WAKTUMU</span><h3>See you at Loca.</h3></div>
              <form className="reservation-form" onSubmit={handleReservation}>
                <div className="reservation-field-grid">
                  <label><span>TANGGAL</span><input type="date" name="date" min={minDate} required /></label>
                  <label><span>JAM</span><select name="time" defaultValue="" required><option value="" disabled>Pilih jam</option><option>10:00</option><option>12:00</option><option>14:00</option><option>16:00</option><option>18:00</option><option>20:00</option></select></label>
                </div>
                <div className="reservation-field-grid">
                  <label><span>NAMA</span><input type="text" name="name" placeholder="Nama kamu" autoComplete="name" required /></label>
                  <label><span>JUMLAH ORANG</span><select name="guests" defaultValue="2" required><option value="1">1 orang</option><option value="2">2 orang</option><option value="3">3 orang</option><option value="4">4 orang</option><option value="5">5 orang</option><option value="6+">6+ orang</option></select></label>
                </div>
                <label><span>NO. WHATSAPP</span><input type="tel" name="phone" placeholder="08xx xxxx xxxx" autoComplete="tel" inputMode="tel" pattern="[0-9+ \-]{8,}" required /></label>
                <label><span>CATATAN KECIL <em>OPSIONAL</em></span><textarea name="note" rows={2} placeholder="Ada yang perlu kami siapkan?"></textarea></label>
                <button className="reservation-submit" type="submit"><span>KIRIM PERMINTAAN</span><i className="arrow-icon" aria-hidden="true" /></button>
              </form>
              <p className="reservation-note">Reservasi akan dikonfirmasi oleh tim Loca melalui kontak yang kamu berikan.</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function LocationSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const section = sectionRef.current;
    if (!section || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      const intro = gsap.timeline({
        scrollTrigger: { trigger: section, start: "top 72%", once: true },
      });
      intro
        .from(".location-kicker > span", { autoAlpha: 0, y: 12, duration: 0.42, stagger: 0.08, ease: "power2.out" })
        .from(".location-copy > .eyebrow, .location-copy > h2, .location-copy > p, .location-rating", { autoAlpha: 0, y: 20, duration: 0.58, stagger: 0.1, ease: "power3.out" }, "-=0.16")
        .from(".location-map", { autoAlpha: 0, scale: 0.96, y: 22, duration: 0.75, ease: "power3.out" }, "-=0.42")
        .from(".location-detail", { autoAlpha: 0, y: 18, duration: 0.45, stagger: 0.13, ease: "power2.out" }, "-=0.38")
        .from(".location-map-top, .location-map-bottom", { autoAlpha: 0, y: 10, duration: 0.4, stagger: 0.1, ease: "power2.out" }, "-=0.3");
    }, section);
    return () => context.revert();
  }, []);

  return (
    <section ref={sectionRef} className="location-section section-pad" id="lokasi-loca" data-nav-theme="light" aria-labelledby="location-title">
      <div className="section-kicker location-kicker"><span>04 / LOKASI &amp; JAM BUKA</span><span>SEMPATKAN JEDA DI LOCA</span></div>
      <div className="location-layout">
        <div className="location-copy">
          <span className="eyebrow"><i /> KAMI SIAP MENYAMBUTMU</span>
          <h2 id="location-title">Mampir ke<br /><em>Loca.</em></h2>
          <p>Temukan kami di Medan, pilih waktu yang pas, lalu nikmati kopi dan jeda kecilmu di sini.</p>
          <a className="location-rating" href={SITE.mapsUrl} target="_blank" rel="noreferrer" aria-label={`Rating ${SITE.rating} dari 5, ${SITE.reviews} ulasan di Google`}>
            <b>{SITE.rating}</b><span><i aria-hidden="true">★★★★★</i><small>{SITE.reviews} ulasan di Google</small></span>
          </a>
          <div className="location-details">
            <article className="location-detail">
              <span className="location-detail-label"><i>01</i> ALAMAT KAMI</span>
              <p><strong>{SITE.placeName}</strong><br />{SITE.addressLine}, {SITE.addressCity}</p>
              <a href={SITE.mapsUrl} target="_blank" rel="noreferrer">LIHAT RUTE <span className="arrow-icon" aria-hidden="true" /></a>
            </article>
            <article className="location-detail">
              <span className="location-detail-label"><i>02</i> JAM OPERASIONAL</span>
              <p>Cek jam buka terbaru langsung di Google Maps sebelum berangkat.</p>
              <a href={SITE.mapsUrl} target="_blank" rel="noreferrer">CEK JAM BUKA <span className="arrow-icon" aria-hidden="true" /></a>
            </article>
          </div>
          <a className="location-cta" href={SITE.mapsUrl} target="_blank" rel="noreferrer"><span>PETUNJUK ARAH</span><i className="arrow-icon" aria-hidden="true" /></a>
        </div>
        <figure className="location-map">
          <div className="location-map-top"><span>COFFEE LOCA / MEDAN</span><a href={SITE.mapsUrl} target="_blank" rel="noreferrer">BUKA DI GOOGLE MAPS <i className="arrow-icon" aria-hidden="true" /></a></div>
          <div className="location-map-body">
            <iframe
              className="location-map-frame"
              src={SITE.mapsEmbedUrl}
              title={`Peta Google Maps ${SITE.placeName}, Medan`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
            <div className="location-map-orbit" aria-hidden="true"><span /><span /><span /></div>
          </div>
          <figcaption className="location-map-bottom"><span>BUKA PETA DAN MULAI JALAN</span><span>GOOD COFFEE, GOOD COMPANY</span></figcaption>
        </figure>
      </div>
      <div className="location-bottomline"><span>DATANG UNTUK KOPI.</span><em>Pulang membawa cerita.</em></div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Wordmark href="#beranda" />
          <p>Kopi yang baik, teman yang baik, dan jeda kecil untuk dinikmati pelan-pelan.</p>
        </div>
        <nav className="footer-col" aria-label="Navigasi footer">
          <span className="footer-label">JELAJAHI</span>
          {menuItems.map((item) => <a key={item.href} href={item.href}>{item.title}</a>)}
        </nav>
        <div className="footer-col">
          <span className="footer-label">KUNJUNGI</span>
          <address>{SITE.addressLine}<br />{SITE.addressCity}</address>
          <a href={SITE.mapsUrl} target="_blank" rel="noreferrer">Google Maps <i className="arrow-icon" aria-hidden="true" /></a>
        </div>
        <div className="footer-col">
          <span className="footer-label">SAPA KAMI</span>
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
          <a href={SITE.instagram} target="_blank" rel="noreferrer">Instagram <i className="arrow-icon" aria-hidden="true" /></a>
          <a href={SITE.tiktok} target="_blank" rel="noreferrer">TikTok <i className="arrow-icon" aria-hidden="true" /></a>
          <a href="/store">Loca Store <i className="arrow-icon" aria-hidden="true" /></a>
        </div>
      </div>
      <div className="footer-word" aria-hidden="true">Take it easy.</div>
      <div className="footer-bottom"><span>© COFFE LOCA 2026 — GOOD COFFEE, GOOD COMPANY.</span><span>MADE WITH CARE <i>✳</i> MEDAN</span><a href="#beranda" className="back-top">BACK TO TOP <i className="arrow-icon arrow-up" aria-hidden="true" /></a></div>
    </footer>
  );
}

export default function Home() {
  const aboutRef = useRef<HTMLElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const section = aboutRef.current;
    if (!section || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      const intro = gsap.timeline({
        scrollTrigger: { trigger: section, start: "top 72%", once: true },
      });
      intro
        .from(".about-section > .section-kicker span", { autoAlpha: 0, y: 12, duration: 0.45, stagger: 0.1, ease: "power2.out" })
        .from(".about-heading > *", { autoAlpha: 0, y: 24, duration: 0.65, stagger: 0.12, ease: "power3.out" }, "-=0.12")
        .from(".about-text > .underlined-link", { autoAlpha: 0, y: 12, duration: 0.45, ease: "power2.out" }, "-=0.28");
      gsap.from(".about-rituals > li", {
        autoAlpha: 0,
        y: 16,
        duration: 0.5,
        stagger: 0.12,
        ease: "power2.out",
        scrollTrigger: { trigger: ".about-rituals", start: "top 88%", once: true },
      });
      gsap.to(".about-scribble", {
        y: -18,
        rotate: 4,
        ease: "none",
        scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: 1.4 },
      });
    }, section);
    return () => context.revert();
  }, []);

  return (
    <>
      <SmoothScroll />
      <HeroAutoScroll />
      <EntryChoice />
      <Navigation />
      <main>
        <SequenceScroll />
        <div className="story-world relative z-10 -mt-[100vh]">
          <section ref={aboutRef} className="about-section section-pad" id="cerita" data-nav-theme="light" aria-labelledby="about-title">
            <div className="section-kicker"><span>01 / AWAL CERITA</span><span>DIBUAT UNTUK DINIKMATI PELAN-PELAN</span></div>
            <div className="about-layout">
              <div className="about-heading"><span className="eyebrow"><i /> HALO, KAMU.</span><h2 id="about-title">Kopi enak.<br /><em>Hari yang baik.</em></h2><div className="about-scribble-wrap"><div className="about-scribble" aria-hidden="true"><svg viewBox="0 0 180 90"><path d="M4 71C42 7 112 3 176 38M35 86C74 41 124 34 170 52" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="m149 27 28 11-23 17" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg><span>take it easy</span></div></div></div>
              <div className="about-text">
                <TextReveal>Kami percaya hal sederhana bisa membuat hari terasa lebih baik. Secangkir kopi yang diracik dengan teliti. Sudut nyaman untuk menarik napas. Dan waktu yang tidak perlu diburu-buru.</TextReveal>
                <a className="underlined-link" href="#menu">LIHAT YANG KAMI SAJIKAN <span className="arrow-icon" aria-hidden="true" /></a>
              </div>
            </div>
            <ol className="about-rituals" aria-label="Hal sederhana di Coffe Loca">
              <li><span>01</span><strong>Kopi yang diracik dengan teliti</strong><small>Biji pilihan, takaran yang pas, disajikan hangat.</small><i className="ritual-dot" /></li>
              <li><span>02</span><strong>Waktu untuk menarik napas</strong><small>Sudut tenang untuk kerja, baca, atau sekadar diam.</small><i className="ritual-dot" /></li>
              <li><span>03</span><strong>Ruang untuk berbagi cerita</strong><small>Boardgame, obrolan panjang, dan teman yang baik.</small><i className="ritual-dot" /></li>
            </ol>
          </section>

          <MenuSection />

          <ReservationSection />

          <LocationSection />

          <SiteFooter />
        </div>
      </main>
    </>
  );
}
