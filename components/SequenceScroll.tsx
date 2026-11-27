"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring, useTransform } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import RedeemStamps from "@/components/RedeemStamps";
import { SITE } from "@/lib/site";
import NeonSign from "@/components/NeonSign";

const FRAME_COUNT = 161;
const FRAME_PATH = "/image-sequence/ezgif-frame-";
const BACKGROUND = "#090502";

function imageUrl(index: number) {
  return `${FRAME_PATH}${String(index + 1).padStart(3, "0")}.jpg`;
}

/** The Google map from "Mampir ke Loca", also shown in the first hero screen (right card on desktop, under the hours box on phones).
 *  The iframe ignores the pointer so wheel/touch keep scrolling the page; a click anywhere opens Google Maps. */
function HeroLocMap({ compact = false }: { compact?: boolean }) {
  return (
    <figure className={`location-map hero-loc-map${compact ? " hero-loc-map-compact" : ""}`}>
      <div className="location-map-top"><span>COFFEE LOCA / MEDAN</span><a href={SITE.mapsUrl} target="_blank" rel="noreferrer">BUKA DI GOOGLE MAPS <i className="arrow-icon" aria-hidden="true" /></a></div>
      <a className="location-map-body" href={SITE.mapsUrl} target="_blank" rel="noreferrer" aria-label="Buka peta di Google Maps" tabIndex={-1}>
        <iframe className="location-map-frame" src={SITE.mapsEmbedUrl} title={`Peta Google Maps ${SITE.placeName}, Medan`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" tabIndex={-1} />
        <div className="location-map-orbit" aria-hidden="true"><span /><span /><span /></div>
      </a>
      {!compact && <figcaption className="location-map-bottom"><span>BUKA PETA DAN MULAI JALAN</span><span>GOOD COFFEE, GOOD COMPANY</span></figcaption>}
    </figure>
  );
}

function drawFrame(canvas: HTMLCanvasElement, image: HTMLImageElement) {
  if (!image.complete || !image.naturalWidth) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, rect.width, rect.height);

  const scale = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const offsetX = (rect.width - drawWidth) / 2;
  const offsetY = (rect.height - drawHeight) / 2;
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

export default function SequenceScroll() {
  const stageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const progressRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [preloaderProgress, setPreloaderProgress] = useState(0);
  const { scrollYProgress } = useScroll({ target: stageRef, offset: ["start start", "end end"] });
  const easedProgress = useSpring(scrollYProgress, { stiffness: 90, damping: 28, mass: 0.35 });

  useEffect(() => {
    const target = ready ? 100 : 70;
    const timer = window.setInterval(() => {
      setPreloaderProgress((value) => {
        if (value >= target) return value;
        return Math.min(target, value + (ready ? 5 : 1.2));
      });
    }, 24);
    return () => window.clearInterval(timer);
  }, [ready]);

  const draw = useCallback((progress: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const index = Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(progress * (FRAME_COUNT - 1))));
    // Frames stream in gradually: fall back to the nearest frame that is already loaded.
    const frames = imagesRef.current;
    const usable = (image?: HTMLImageElement) => !!image && image.complete && image.naturalWidth > 0;
    let image: HTMLImageElement | undefined;
    for (let i = index; i >= 0 && !image; i--) if (usable(frames[i])) image = frames[i];
    for (let i = index + 1; i < FRAME_COUNT && !image; i++) if (usable(frames[i])) image = frames[i];
    if (image) drawFrame(canvas, image);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let revealed = false;
    const frames: HTMLImageElement[] = new Array(FRAME_COUNT);
    imagesRef.current = frames;
    const reveal = () => {
      if (cancelled || revealed) return;
      revealed = true;
      setReady(true);
      requestAnimationFrame(() => draw(progressRef.current));
    };
    const loadFrame = (index: number) =>
      new Promise<void>((resolve) => {
        const image = new Image();
        image.decoding = "async";
        frames[index] = image;
        const done = () => {
          if (index === 0) reveal();
          resolve();
        };
        image.onload = () => { image.decode().catch(() => undefined).finally(done); };
        image.onerror = done;
        image.src = imageUrl(index);
      });

    // Only the first frame blocks the page. The rest stream in quietly, a few at a time, after it is shown.
    const CONCURRENCY = 3;
    let next = 1;
    const worker = async () => {
      while (!cancelled && next < FRAME_COUNT) {
        await loadFrame(next++);
        if (!cancelled && Math.round(progressRef.current * (FRAME_COUNT - 1)) === next - 1) draw(progressRef.current);
      }
    };
    const fallbackTimer = window.setTimeout(reveal, 3000);
    loadFrame(0).then(() => {
      if (cancelled) return;
      const start = () => { for (let i = 0; i < CONCURRENCY; i++) void worker(); };
      const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
      if (idle) idle(start, { timeout: 1500 }); else window.setTimeout(start, 300);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, [draw]);

  useMotionValueEvent(easedProgress, "change", (value) => {
    progressRef.current = value;
    draw(value);
  });

  useEffect(() => {
    const onResize = () => draw(progressRef.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  const titleOpacity = useTransform(easedProgress, [0, 0.06, 0.2], [1, 1, 0]);
  const titleY = useTransform(easedProgress, [0, 0.2], [0, -30]);
  const firstOpacity = useTransform(easedProgress, [0.22, 0.3, 0.43], [0, 1, 0]);
  const firstX = useTransform(easedProgress, [0.22, 0.31, 0.43], [-25, 0, -12]);
  const secondOpacity = useTransform(easedProgress, [0.48, 0.59, 0.73], [0, 1, 0]);
  const secondX = useTransform(easedProgress, [0.48, 0.6, 0.73], [25, 0, 12]);
  const ctaOpacity = useTransform(easedProgress, [0.78, 0.9, 0.99], [0, 1, 0.8]);
  const ctaY = useTransform(easedProgress, [0.78, 0.9], [22, 0]);
  const exitWashOpacity = useTransform(easedProgress, [0.84, 0.93, 1], [0, 0.22, 0.72]);

  return (
    <>
      <section ref={stageRef} id="beranda" className="sequence-stage" aria-label="Coffe Loca, good coffee and good company">
        <div className="sequence-sticky">
          <canvas ref={canvasRef} className="sequence-canvas" aria-label="Animasi kopi Coffe Loca yang bergerak mengikuti guliran halaman" />
          <div className="sequence-shade" />
          <motion.div className="sequence-exit-wash" style={{ opacity: exitWashOpacity }} aria-hidden="true" />
          <div className="sequence-copy">
            <motion.div className="hero-copy" style={{ opacity: titleOpacity, y: titleY }}>
              <span className="eyebrow"><i /> MEDAN SPECIALITY COFFEE</span>
              <h1><em><span className="hero-loca">LOCA</span><span className="hero-tion">-tion</span></em><span className="hero-for-row"><em>for</em><span className="hero-for-list"><span>coffee</span><span>food</span><span>hangout</span></span></span></h1>
              <article className="location-detail hero-address">
                <span className="location-detail-label"><i>01</i> ALAMAT KAMI</span>
                <p><strong>{SITE.placeName}</strong><br />{SITE.addressLine}, {SITE.addressCity}</p>
              </article>
              <a className="location-cta hero-direction" href={SITE.mapsUrl} target="_blank" rel="noreferrer"><span>DIRECTION</span><i className="arrow-icon" aria-hidden="true" /></a>
              <div className="hero-hours">
                <div className="hero-hours-copy"><span>JAM OPERASIONAL</span><strong>{SITE.hours.open} – {SITE.hours.close} <small>WIB</small></strong></div>
                <NeonSign variant="badge" className="status-in-box" />
              </div>
              <HeroLocMap compact />
            </motion.div>
            <motion.div className="hero-map-card" style={{ opacity: titleOpacity, y: titleY }}>
              <HeroLocMap />
            </motion.div>
            <motion.div className="story-copy story-left" style={{ opacity: firstOpacity, x: firstX }}>
              <h2>COFFEE</h2>
              <p className="story-beans">SPECIALITY COFFEE BLENDED 100% ARABICA<br />YOUR BEANS OPTIONS :</p>
              <div className="story-bean-row">
                <figure><img src="/beans/bold-berry.webp" alt="Bold Berry" width={600} height={600} loading="lazy" decoding="async" /><figcaption><b>BOLD BERRY</b><small>SWEET, JUICY, WELL BALANCE</small></figcaption></figure>
                <figure><img src="/beans/back-to-black.webp" alt="Back to Black" width={600} height={600} loading="lazy" decoding="async" /><figcaption><b>BACK TO BLACK</b><small>BOLD, SWEET, ROUNDED</small></figcaption></figure>
              </div>
              <p className="story-beans story-beans-mix">OR MIX BETWEEN <b>BOLD BERRY</b> &amp; <b>BACK TO BLACK</b></p>
            </motion.div>
            <motion.div className="story-copy story-right" style={{ opacity: secondOpacity, x: secondX }}>
              <h2>COMFORT <span className="story-red">FOOD</span></h2>
              <p className="story-hashtag">#YOURDAILYCOMFORTFOOD</p>
              <figure className="story-dish">
                <img src="/tongseng.webp" alt="Tongseng sapi" width={900} height={773} loading="lazy" decoding="async" />
                <figcaption>TONGSENG<br />AYAM/SAPI</figcaption>
              </figure>
            </motion.div>
            <motion.div className="hero-cta-copy" style={{ opacity: ctaOpacity, y: ctaY }}>
              <span className="eyebrow"><i /> THE LOCA WAY</span>
              <h2>Temui sudut<br /><em>favoritmu.</em></h2>
              <RedeemStamps />
            </motion.div>
          </div>
          <div className="sequence-footer"><img className="sequence-kata" src="/kata.webp" alt="Coffee, food, hangout" width={700} height={270} /></div>
          <div className="sequence-progress" aria-hidden="true"><motion.span style={{ scaleX: easedProgress, transformOrigin: "0% 50%" }} /></div>
        </div>
      </section>
      <AnimatePresence>
        {!ready || preloaderProgress < 100 ? <motion.div className="preloader" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}><div className="preloader-inner"><div className="preloader-wordmark"><img src="/white-coffee-bean.png" alt="" /> <span>COFFE <b>LOCA</b></span></div><div className="preloader-line"><motion.i initial={{ scaleX: 0 }} animate={{ scaleX: preloaderProgress / 100 }} transition={{ duration: 0.12 }} /></div><div className="preloader-meta"><span>BREWING A LITTLE MOMENT</span><span>{String(Math.round(preloaderProgress)).padStart(2, "0")}%</span></div></div></motion.div> : null}
      </AnimatePresence>
    </>
  );
}
