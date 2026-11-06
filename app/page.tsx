"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { FormEvent, Fragment, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import SequenceScroll from "@/components/SequenceScroll";

const menuItems = [
  { title: "Awal cerita", href: "#cerita", number: "01", note: "KENALI CERITA KAMI" },
  { title: "Menu kami", href: "#menu", number: "02", note: "PILIH YANG KAMU SUKA" },
  { title: "Reservation", href: "#reservation", number: "03", note: "SIAPKAN JEDA TERBAIKMU" },
  { title: "Lokasi & jam buka", href: "#lokasi-loca", number: "04", note: "TEMUKAN COFFEE LOCA" },
];

type Dish = { name: string; detail?: string; price: string; category?: string };

const comfortFood: Dish[] = [
  { name: "Nasi Goreng Pete Teri Udang", price: "35.000" },
  { name: "Nasi Goreng Kampung Ayam Goreng", price: "35.000" },
  { name: "Nasi Goreng Putih Seafood", price: "42.000" },
  { name: "Nasi Goreng Gila", detail: "Sosis, bakso, ayam", price: "35.000" },
  { name: "Nasi Ayam Ricarica / Cabe Hijau / Kecap", price: "35.000" },
  { name: "Nasi Geprek Komplit", detail: "Crispy chicken, sambel, tahu, tempe, bakso, sayur crispy", price: "30.000" },
  { name: "Salted Egg", detail: "Chicken, buttered rice, onsen egg", price: "42.000" },
  { name: "Tongseng Ayam / Sapi", price: "35.000 / 55.000" },
  { name: "Soto Susu Non-Santan Ayam", price: "35.000" },
  { name: "Sup Sapi", price: "65.000" },
  { name: "Mie Rebus", price: "28.000" },
  { name: "Mie Sop Kampung", detail: "Bakso & ayam", price: "35.000" },
  { name: "Mie Pecel / Pecel Sayur", detail: "Bumbu kacang & gorengan", price: "28.000" },
  { name: "Mie Goreng Indonesia", price: "38.000" },
  { name: "Kwetiau / Bihun Telur", price: "25.000" },
  { name: "Kwetiau / Bihun Seafood / Ayam", price: "38.000" },
  { name: "Indomie Bangladesh", price: "22.000" },
  { name: "Indomie Bangladesh dengan Onsen Egg", price: "28.000" },
  { name: "Loca Cheese Pasta", detail: "Triple cheese & katsu", price: "65.000" },
  { name: "Aglio Olio Seafood", price: "55.000" },
  { name: "Fish & Chips", price: "55.000" },
  { name: "Chicken Steak Grilled / Deep Fried", detail: "With fries and sauce", price: "50.000" },
  { name: "Cordon Bleu", detail: "Ayam isi keju, breaded, dengan fries & sauce", price: "65.000" },
];

const snacks: Dish[] = [
  { name: "Aneka Gorengan", detail: "Bakwan, tahu isi, tempe, bakso, pisang, risol · 15 pcs", price: "42.000" },
  { name: "Dimsum Ayam 4 pcs / Udang 3 pcs / Kepiting 3 pcs / Rumput Laut 3 pcs", price: "25.000" },
  { name: "Dimsum Platter", detail: "8 pcs", price: "58.000" },
  { name: "Bubur Sumsum", price: "25.000" },
  { name: "Telur Ayam Kampung", detail: "2 butir", price: "18.000" },
  { name: "Taichans", detail: "10 tusuk", price: "45.000" },
  { name: "Chicken Popcorn", price: "30.000" },
  { name: "Crispy Chicken Skin", price: "30.000" },
  { name: "Chicken Tortilla", price: "35.000" },
  { name: "Seasoned French Fries", price: "30.000" },
  { name: "Bakwan Saus Kacang", price: "30.000" },
  { name: "Lobak Goreng", price: "30.000" },
  { name: "Pisang Goreng", price: "30.000" },
  { name: "Ubi Kayu / Manis", price: "25.000" },
  { name: "Tahu Balik", price: "30.000" },
  { name: "Tahu Isi Udang", price: "30.000" },
  { name: "Rujak Buah", price: "35.000" },
  { name: "Lupis", detail: "Per pc", price: "10.000" },
  { name: "Roti Bakar", price: "25.000" },
  { name: "Sosis Gulung Mie", price: "30.000" },
  { name: "Tahu Pop Cabe Garam", price: "27.000" },
  { name: "Enoki Crispy", price: "27.000" },
];

const coffeeAndDrinks: Dish[] = [
  { category: "COFFEE LOCA", name: "Sabrina", detail: "Frozen blended mango, straw, pineapple", price: "35.000" },
  { category: "COFFEE LOCA", name: "Mario", detail: "Frozen blended mango, avocado, banana", price: "35.000" },
  { category: "COFFEE LOCA", name: "Esmeralda", detail: "Frozen blended dragon fruit, soursop", price: "35.000" },
  { category: "COFFEE LOCA", name: "Maskel Builder", detail: "Blended banana, avocado, almond, whey protein", price: "37.000" },
  { category: "COFFEE LOCA", name: "Mineral Water", price: "17.000" },
  { category: "COFFEE LOCA", name: "Regular Tea", price: "15.000" },
  { category: "COFFEE LOCA", name: "Artisan Tea", price: "32.000" },
  { category: "COFFEE LOCA", name: "Lemon Tea", price: "25.000" },
  { category: "COFFEE LOCA", name: "Strawberry Tea", price: "30.000" },
  { category: "COFFEE LOCA", name: "Matcha Tea", price: "28.000" },
  { category: "COFFEE LOCA", name: "Sparkling Water", price: "17.000" },
  { category: "COFFEE LOCA", name: "Sparkling Strawberry Lemonade", price: "32.000" },
  { category: "COFFEE LOCA", name: "Lime Coke", price: "25.000" },
  { category: "COFFEE LOCA", name: "Choco Redvelvet", price: "25.000" },
  { category: "COFFEE LOCA", name: "Peanut Butter Charcoal", price: "30.000" },
  { category: "COFFEE LOCA", name: "Classic Matcha Latte", price: "30.000" },
  { category: "COFFEE LOCA", name: "Creamy Chocolate", price: "30.000" },
  { category: "COFFEE LOCA", name: "Avocado Milo", price: "35.000" },
  { category: "COFFEE LOCA", name: "Earlgrey Milktea", price: "30.000" },
  { category: "COFFEE LOCA", name: "Mamatcha", detail: "Double matcha, matcha latte + matcha ice cream", price: "35.000" },
  { category: "FRESH JUICE", name: "Orange / Watermelon / Pineapple / Strawberry / Guava / Mango", price: "25.000" },
  { category: "FRESH JUICE", name: "Avocado / Soursop / Dragonfruit", price: "28.000" },
  { category: "FRESH JUICE", name: "Lemonade", price: "25.000" },
  { category: "FRESH JUICE", name: "Mix 2 Fruit", price: "32.000" },
  { category: "COFFEE", name: "Black", detail: "Americano, espresso", price: "25.000" },
  { category: "COFFEE", name: "White", detail: "Latte, cappuccino, piccolo, mocha", price: "27.000" },
  { category: "COFFEE", name: "Manual Brew & Cold Brew", detail: "Seasonal · ask our staff", price: "SEASONAL" },
  { category: "COFFEE LOCA", name: "Coffee Bonbon (Sanger)", detail: "Espresso + condensed milk", price: "25.000" },
  { category: "COFFEE LOCA", name: "Pump It Up!", detail: "Espresso + salt + lemon + sugar", price: "25.000" },
  { category: "COFFEE LOCA", name: "Shaken Tropical", detail: "Espresso + orange juice + mint", price: "27.000" },
  { category: "COFFEE LOCA", name: "Honey I'm Home", detail: "Shaken americano + honey", price: "27.000" },
  { category: "COFFEE LOCA", name: "Coffee COLA", detail: "Espresso + COLA + lemon", price: "27.000" },
  { category: "COFFEE LOCA", name: "Avocado Coffee", price: "32.000" },
  { category: "COFFEE LOCA", name: "Banana Macchiato", price: "32.000" },
  { category: "COFFEE LOCA", name: "Coconut Macchiato", price: "32.000" },
  { category: "COFFEE LOCA", name: "Choco Macchiato", price: "32.000" },
  { category: "COFFEE LOCA", name: "Peanutbutter Macchiato", price: "32.000" },
  { category: "COFFEE LOCA", name: "Matcha Macchiato", price: "35.000" },
  { category: "COFFEE LOCA", name: "Milktea Coffee", price: "32.000" },
  { category: "COFFEE LOCA", name: "Coffee Cream Unsweetened", price: "27.000" },
  { category: "FAVORIT KOPI SUSU", name: "Eskobar", price: "27.000" },
  { category: "FAVORIT KOPI SUSU", name: "Amazing", price: "27.000" },
  { category: "FAVORIT KOPI SUSU", name: "Traditional", price: "27.000" },
  { category: "FAVORIT KOPI SUSU", name: "Capheda", price: "27.000" },
  { category: "FAVORIT KOPI SUSU", name: "Cadocado", price: "27.000" },
];

function Wordmark({ inverse = false }: { inverse?: boolean }) {
  return (
    <a className={`wordmark${inverse ? " wordmark-inverse" : ""}`} href="#beranda" aria-label="Coffe Loca, kembali ke beranda">
      <img className="wordmark-logo" src="/white-coffee-bean.png" alt="" />
      <span className="wordmark-type"><span>COFFE <b>LOCA</b></span><small>GOOD COFFEE, GOOD COMPANY</small></span>
    </a>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return <span className={`menu-icon${open ? " menu-icon-open" : ""}`} aria-hidden="true"><i /><i /></span>;
}

function Navigation() {
  const [open, setOpen] = useState(false);
  const [lightSurface, setLightSurface] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const close = () => setOpen(false);
  useEffect(() => {
    let active = true;
    let supabase: ReturnType<typeof getSupabaseClient> | null = null;
    try {
      supabase = getSupabaseClient();
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
        <Wordmark inverse />
        <div className="header-actions">
          {user ? <a className="header-profile-link" href="/profile" aria-label={`Buka profil ${accountName}`} title={accountName}>{user.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="" /> : <span>{accountInitials}</span>}</a> : <a className="header-account-link" href="/login">LOGIN <span className="arrow-icon" aria-hidden="true" /></a>}
          <button className={`menu-toggle${open ? " is-open" : ""}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Tutup navigasi" : "Buka navigasi"}>
            <MenuIcon open={open} />
          </button>
        </div>
      </header>
      <AnimatePresence>
        {open && (
          <motion.div className="menu-overlay" initial={{ clipPath: "inset(0 0 100% 0)" }} animate={{ clipPath: "inset(0 0 0% 0)" }} exit={{ clipPath: "inset(0 0 100% 0)" }} transition={{ duration: 0.72, ease: [0.76, 0, 0.24, 1] }}>
            <div className="menu-inner">
              <div className="menu-top"><span><i /> NAVIGASI / COFFE LOCA</span></div>
              <div className="menu-content">
                <nav className="menu-links" aria-label="Navigasi utama">
                  {menuItems.map((item, index) => (
                    <motion.a key={item.number} href={item.href} onClick={close} initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 + index * 0.1, duration: 0.62, ease: [0.22, 1, 0.36, 1] }}>
                      <span className="menu-number">{item.number}</span><span className="menu-title-wrap"><span className="menu-title">{item.title}</span><small>{item.note}</small></span><span className="menu-arrow"><i className="arrow-icon" aria-hidden="true" /></span>
                    </motion.a>
                  ))}
                </nav>
              </div>
              <div className="menu-bottom">
                <div className="menu-account"><span className="eyebrow">AREA MEMBER</span><a href={user ? "/profile" : "/login"} onClick={close}>{user ? "LIHAT PROFILE" : "LOGIN / REGISTER"} <i className="arrow-icon" aria-hidden="true" /></a></div>
                <div><span className="eyebrow">SAPA KAMI</span><a href="mailto:hello@coffeeloca.id">hello@coffeeloca.id <i className="arrow-icon" aria-hidden="true" /></a></div>
                <div><span className="eyebrow">IKUTI CERITA</span><div className="social-links"><a href="https://instagram.com" target="_blank" rel="noreferrer">INSTAGRAM</a><a href="https://tiktok.com" target="_blank" rel="noreferrer">TIKTOK</a></div></div>
                <p><span>COFFE LOCA · MEDAN</span><br />KOPI YANG BAIK. TEMAN YANG BAIK.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.88, anchors: true });
    gsap.registerPlugin(ScrollTrigger);
    const updateScrollTrigger = () => ScrollTrigger.update();
    const raf = (time: number) => lenis.raf(time * 1000);
    lenis.on("scroll", updateScrollTrigger);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      lenis.off("scroll", updateScrollTrigger);
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
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
  return <p className="text-reveal" ref={textRef}>{Array.from(children).map((char, index) => <span data-char key={`${index}-${char}`}>{char === " " ? "\u00a0" : char}</span>)}</p>;
}

function MenuCategory({ number, title, subtitle, dishes }: { number: string; title: string; subtitle: string; dishes: Dish[] }) {
  const orderedDishes = dishes.some((dish) => dish.category)
    ? Array.from(new Set(dishes.map((dish) => dish.category))).flatMap((category) => dishes.filter((dish) => dish.category === category))
    : dishes;

  return (
    <section className={`menu-list-panel${title === "Coffee & Drinks" ? " menu-list-panel-drinks" : ""}`} data-nav-theme="light" aria-label={title}>
      <header className="menu-list-heading"><span className="menu-category-number">{number}</span><div><span className="menu-list-subtitle">{subtitle}</span><h3>{title}</h3></div><span className="menu-list-count">{String(orderedDishes.length).padStart(2, "0")} ITEMS</span></header>
      <ol className="menu-list">
        {orderedDishes.map((dish, index) => (
          <Fragment key={`${dish.category ?? title}-${dish.name}`}>
            {dish.category && (index === 0 || orderedDishes[index - 1].category !== dish.category) && <li className="menu-group-label"><span>{dish.category}</span></li>}
            <li className="menu-item-row">
              <span className="menu-item-index">{String(index + 1).padStart(2, "0")}</span><span className="menu-item-copy"><strong>{dish.name}</strong>{dish.detail && <small>{dish.detail}</small>}</span><span className="menu-item-price"><small>{dish.price === "SEASONAL" ? "" : "RP"}</small>{dish.price}</span>
            </li>
          </Fragment>
        ))}
      </ol>
    </section>
  );
}

function MenuSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeCategory, setActiveCategory] = useState<"comfort" | "snack" | "drinks">("comfort");

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
        start: "top 90%",
        once: true,
        batchMax: 5,
        onEnter: (rows) => gsap.to(rows, {
          autoAlpha: 1,
          y: 0,
          duration: 0.38,
          stagger: 0.065,
          ease: "power3.out",
          overwrite: "auto",
        }),
      });
    }, section);
    return () => context.revert();
  }, [activeCategory]);

  const activeDishes = activeCategory === "comfort" ? comfortFood : activeCategory === "snack" ? snacks : coffeeAndDrinks;

  return (
    <section ref={sectionRef} className="menu-section section-pad" id="menu">
      <div className="section-kicker section-kicker-dark menu-kicker"><span>02 / MENU COFFE LOCA</span><span>MAKAN ENAK, JEDA LEBIH LAMA</span></div>
      <div className="menu-heading"><div><span className="eyebrow"><i /> DARI YANG HANGAT SAMPAI YANG RENYAH</span><h2>Ada yang<br /><em>kamu suka.</em></h2></div><p>Temukan comfort food dan camilan favorit untuk menemani waktu di Loca.</p></div>
      <div className="menu-category-tabs" role="group" aria-label="Pilih kategori menu">
        <button className={activeCategory === "comfort" ? "is-active" : ""} id="menu-tab-comfort" aria-pressed={activeCategory === "comfort"} aria-controls="menu-panel" onClick={() => setActiveCategory("comfort")}>
          <span className="menu-tab-number">01</span><span className="menu-tab-copy"><strong>Comfort food</strong><small>YANG SELALU BIKIN NYAMAN</small></span><span className="menu-tab-count">{String(comfortFood.length).padStart(2, "0")}</span>
        </button>
        <button className={activeCategory === "snack" ? "is-active" : ""} id="menu-tab-snack" aria-pressed={activeCategory === "snack"} aria-controls="menu-panel" onClick={() => setActiveCategory("snack")}>
          <span className="menu-tab-number">02</span><span className="menu-tab-copy"><strong>Snack</strong><small>TEMAN NGOBROL &amp; JEDA</small></span><span className="menu-tab-count">{String(snacks.length).padStart(2, "0")}</span>
        </button>
        <button className={activeCategory === "drinks" ? "is-active" : ""} id="menu-tab-drinks" aria-pressed={activeCategory === "drinks"} aria-controls="menu-panel" onClick={() => setActiveCategory("drinks")}>
          <span className="menu-tab-number">03</span><span className="menu-tab-copy"><strong>Coffee &amp; Drinks</strong><small>KOPI, JUICE &amp; SIGNATURE LOCA</small></span><span className="menu-tab-count">{String(coffeeAndDrinks.length).padStart(2, "0")}</span>
        </button>
      </div>
      <div className="menu-list-grid" id="menu-panel" aria-live="polite" aria-labelledby={activeCategory === "comfort" ? "menu-tab-comfort" : activeCategory === "snack" ? "menu-tab-snack" : "menu-tab-drinks"}>
        <MenuCategory key={activeCategory} number={activeCategory === "comfort" ? "01" : activeCategory === "snack" ? "02" : "03"} title={activeCategory === "comfort" ? "Comfort Food" : activeCategory === "snack" ? "Snack" : "Coffee & Drinks"} subtitle={activeCategory === "comfort" ? "YANG SELALU BIKIN NYAMAN" : activeCategory === "snack" ? "TEMAN NGOBROL & JEDA" : "KOPI, JUICE & SIGNATURE LOCA"} dishes={activeDishes} />
      </div>
      <div className="menu-footnote"><span>{String(activeDishes.length).padStart(2, "0")} PILIHAN UNTUK DINIKMATI</span></div>
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
        .from(".location-copy > .eyebrow, .location-copy > h2, .location-copy > p", { autoAlpha: 0, y: 20, duration: 0.58, stagger: 0.1, ease: "power3.out" }, "-=0.16")
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
          <div className="location-rating"><span aria-label="Rating 4,4 dari 5">★★★★★</span><b>4,4</b><i>·</i><small>917 ulasan di Google</small></div>
          <div className="location-details">
            <article className="location-detail">
              <span className="location-detail-label"><i>01</i> ALAMAT KAMI</span>
              <p>Coffee LOCA Cafe Pokemon Boardgame<br />Jl. T. Amir Hamzah No. 11, Sei Agul, Medan Barat, Kota Medan, Sumatera Utara 20114</p>
              <a href="https://www.google.com/maps/search/?api=1&query=Coffee+LOCA+Cafe+Pokemon+Boardgame%2C+Jl.+T.+Amir+Hamzah+No.11%2C+Sei+Agul%2C+Medan" target="_blank" rel="noreferrer">LIHAT RUTE <span className="arrow-icon" aria-hidden="true" /></a>
            </article>
            <article className="location-detail">
              <span className="location-detail-label"><i>02</i> JAM OPERASIONAL</span>
              <p>Cek jam buka terbaru langsung di Google Maps.</p>
              <a href="https://www.google.com/maps/search/?api=1&query=Coffee+LOCA+Cafe+Pokemon+Boardgame%2C+Jl.+T.+Amir+Hamzah+No.11%2C+Sei+Agul%2C+Medan" target="_blank" rel="noreferrer">CEK JAM BUKA <span className="arrow-icon" aria-hidden="true" /></a>
            </article>
          </div>
        </div>
        <figure className="location-map">
          <div className="location-map-top"><span>COFFEE LOCA / MEDAN</span><a href="https://www.google.com/maps/search/?api=1&query=Coffee+LOCA+Cafe+Pokemon+Boardgame%2C+Jl.+T.+Amir+Hamzah+No.11%2C+Sei+Agul%2C+Medan" target="_blank" rel="noreferrer">BUKA DI GOOGLE MAPS <i className="arrow-icon" aria-hidden="true" /></a></div>
          <div className="location-map-orbit" aria-hidden="true"><span /><span /><span /></div>
          <iframe
            className="location-map-frame"
            src="https://maps.google.com/maps?q=Coffee%20LOCA%20Cafe%20Pokemon%20Boardgame%2C%20Jl.%20T.%20Amir%20Hamzah%20No.11%2C%20Sei%20Agul%2C%20Medan&amp;z=16&amp;output=embed"
            title="Peta Google Maps Coffee LOCA Cafe Pokemon Boardgame, Medan"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <div className="location-map-bottom"><span>BUKA PETA DAN MULAI JALAN</span><span>GOOD COFFEE, GOOD COMPANY</span></div>
        </figure>
      </div>
      <div className="location-bottomline"><span>DATANG UNTUK KOPI.</span><em>PULANG MEMBAWA CERITA.</em></div>
    </section>
  );
}

function ReservationSection() {
  const [submitted, setSubmitted] = useState(false);

  function handleReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <section className="reservation-section section-pad" id="reservation" data-nav-theme="light" aria-labelledby="reservation-title">
      <div className="section-kicker reservation-kicker"><span>03 / RESERVATION</span><span>SIAPKAN JEDA TERBAIKMU</span></div>
      <div className="reservation-layout">
        <div className="reservation-copy">
          <span className="eyebrow"><i /> MEJA UNTUK CERITA YANG BAIK</span>
          <h2 id="reservation-title">Simpan tempat<br /><em>untuk nanti.</em></h2>
          <p>Datang dengan tenang. Pilih waktu yang kamu suka, biar kami siapkan ruang untuk kopi dan cerita yang ingin kamu bagi.</p>
          <div className="reservation-stamp reservation-mark" aria-hidden="true"><span className="reservation-mark-ring"><img src="/white-coffee-bean.png" alt="" /></span></div>
          <div className="reservation-meta"><span><b>01</b> KIRIM PERMINTAAN</span><span><b>02</b> KAMI KONFIRMASI</span></div>
        </div>
        <div className="reservation-card">
          <div className="reservation-card-top"><span>TABLE REQUEST</span><span>COFFE LOCA / MEDAN</span></div>
          <div className="reservation-card-heading"><span>PILIH WAKTUMU</span><h3>See you at Loca.</h3></div>
          <form className="reservation-form" onSubmit={handleReservation}>
            <div className="reservation-field-grid">
              <label><span>TANGGAL</span><input type="date" name="date" required /></label>
              <label><span>JAM</span><select name="time" defaultValue="" required><option value="" disabled>Pilih jam</option><option>10:00</option><option>12:00</option><option>14:00</option><option>16:00</option><option>18:00</option><option>20:00</option></select></label>
            </div>
            <div className="reservation-field-grid">
              <label><span>JUMLAH ORANG</span><select name="guests" defaultValue="2" required><option value="1">1 orang</option><option value="2">2 orang</option><option value="3">3 orang</option><option value="4">4 orang</option><option value="5">5 orang</option><option value="6+">6+ orang</option></select></label>
              <label><span>NAMA</span><input type="text" name="name" placeholder="Nama kamu" required /></label>
            </div>
            <label><span>CATATAN KECIL <em>OPSIONAL</em></span><textarea name="note" rows={2} placeholder="Ada yang perlu kami siapkan?"></textarea></label>
            <button className="reservation-submit" type="submit"><span>{submitted ? "PERMINTAAN TERKIRIM" : "KIRIM PERMINTAAN"}</span><i className="arrow-icon" aria-hidden="true" /></button>
            {submitted && <p className="reservation-feedback" role="status">Terima kasih. Kami akan menghubungimu untuk konfirmasi meja.</p>}
          </form>
          <p className="reservation-note">Reservasi akan dikonfirmasi oleh tim Loca melalui kontak yang tersedia.</p>
        </div>
      </div>
    </section>
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
      gsap.from(".about-rituals > div", {
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
      <Navigation />
      <main>
        <SequenceScroll />
        <div className="story-world relative z-10 -mt-[100vh]">
          <section ref={aboutRef} className="about-section section-pad" id="cerita" data-nav-theme="light">
            <div className="section-kicker"><span>01 / AWAL CERITA</span><span>DIBUAT UNTUK DINIKMATI PELAN-PELAN</span></div>
            <div className="about-layout">
              <div className="about-heading"><span className="eyebrow"><i /> HALO, KAMU.</span><h2>Kopi enak.<br /><em>Hari yang baik.</em></h2></div>
              <div className="about-text">
                <TextReveal>Kami percaya hal sederhana bisa membuat hari terasa lebih baik. Secangkir kopi yang diracik dengan teliti. Sudut nyaman untuk menarik napas. Dan waktu yang tidak perlu diburu-buru.</TextReveal>
                <a className="underlined-link" href="#menu">LIHAT YANG KAMI SAJIKAN <span className="arrow-icon" aria-hidden="true" /></a>
              </div>
            </div>
            <div className="about-rituals" aria-label="Hal sederhana di Coffe Loca">
              <div><span>01</span><strong>Kopi yang diracik dengan teliti</strong><i className="ritual-dot" /></div>
              <div><span>02</span><strong>Waktu untuk menarik napas</strong><i className="ritual-dot" /></div>
              <div><span>03</span><strong>Ruang untuk berbagi cerita</strong><i className="ritual-dot" /></div>
            </div>
            <div className="about-scribble" aria-hidden="true"><svg viewBox="0 0 180 90"><path d="M4 71C42 7 112 3 176 38M35 86C74 41 124 34 170 52" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="m149 27 28 11-23 17" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg><span>take it easy</span></div>
          </section>

          <MenuSection />

          <ReservationSection />

          <LocationSection />

          <footer className="site-footer">
            <div className="footer-top"><Wordmark /><span className="footer-thanks">THANK YOU FOR TAKING A MOMENT.</span><a href="#beranda" className="back-top">BACK TO TOP <i className="arrow-icon arrow-up" aria-hidden="true" /></a></div>
            <div className="footer-bottom"><span>© COFFE LOCA 2026 — GOOD COFFEE, GOOD COMPANY.</span><span>MADE WITH CARE <i>✳</i></span><a href="#beranda">TO THE TOP <i className="arrow-icon arrow-up" aria-hidden="true" /></a></div>
          </footer>
        </div>
      </main>
    </>
  );
}
