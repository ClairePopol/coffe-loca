"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring, useTransform } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

const FRAME_COUNT = 161;
const FRAME_PATH = "/image-sequence/ezgif-frame-";
const BACKGROUND = "#090502";

function imageUrl(index: number) {
  return `${FRAME_PATH}${String(index + 1).padStart(3, "0")}.jpg`;
}

function drawFrame(canvas: HTMLCanvasElement, image: HTMLImageElement) {
  if (!image.complete || !image.naturalWidth) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.8);
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);
  const [preloaderProgress, setPreloaderProgress] = useState(0);
  const { scrollYProgress } = useScroll({ target: stageRef, offset: ["start start", "end end"] });
  const easedProgress = useSpring(scrollYProgress, { stiffness: 90, damping: 28, mass: 0.35 });

  useEffect(() => {
    const target = ready ? 100 : Math.min(92, (loaded / FRAME_COUNT) * 100);
    const timer = window.setInterval(() => {
      setPreloaderProgress((value) => {
        if (value >= target) return value;
        return Math.min(target, value + (ready ? 2.5 : 1.2));
      });
    }, 24);
    return () => window.clearInterval(timer);
  }, [loaded, ready]);

  const draw = useCallback((progress: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const index = Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(progress * (FRAME_COUNT - 1))));
    const image = imagesRef.current[index];
    if (image) drawFrame(canvas, image);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let firstFrameReady = false;
    const revealWhenUsable = () => {
      if (cancelled || firstFrameReady) return;
      firstFrameReady = true;
      setReady(true);
      requestAnimationFrame(() => draw(progressRef.current));
    };
    const frames = Array.from({ length: FRAME_COUNT }, (_, index) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (cancelled) return;
        setLoaded((value) => value + 1);
        if (index === 0) revealWhenUsable();
      };
      image.onerror = () => {
        if (cancelled) return;
        setLoaded((value) => value + 1);
        if (index === 0) revealWhenUsable();
      };
      image.src = imageUrl(index);
      return image;
    });
    imagesRef.current = frames;
    const fallbackTimer = window.setTimeout(revealWhenUsable, 5000);
    Promise.all(frames.map((image) => image.decode().catch(() => undefined))).then(() => revealWhenUsable());
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
              <span className="eyebrow"><i /> SLOW MADE · FRESH POURED</span>
              <h1>A little<br /><em>Loca moment.</em></h1>
              <p>Kopi yang baik, teman yang baik, dan jeda kecil yang memang kamu butuhkan.</p>
              <a className="text-link hero-link" href="#cerita">MASUK KE CERITA <span className="arrow-icon arrow-down-right" aria-hidden="true" /></a>
            </motion.div>
            <motion.div className="story-copy story-left" style={{ opacity: firstOpacity, x: firstX }}>
              <span className="eyebrow"><i /> MADE FOR SLOW MORNINGS</span>
              <h2>Mulai hari<br /><em>tanpa buru-buru.</em></h2>
              <p>Ambil napas. Pilih kopi favorit. Biarkan pagi menyusul.</p>
            </motion.div>
            <motion.div className="story-copy story-right" style={{ opacity: secondOpacity, x: secondX }}>
              <span className="eyebrow"><i /> GOOD COFFEE, GOOD COMPANY</span>
              <h2>Rasa yang baik<br /><em>lebih enak dibagi.</em></h2>
              <p>Datang sendiri atau bawa cerita. Selalu ada tempat.</p>
            </motion.div>
            <motion.div className="hero-cta-copy" style={{ opacity: ctaOpacity, y: ctaY }}>
              <span className="eyebrow"><i /> THE LOCA WAY</span>
              <h2>Temui sudut<br /><em>favoritmu.</em></h2>
              <a className="pill-button pill-button-light" href="#ruang-loca"><span>KENALAN DENGAN LOCA</span><span className="arrow-icon" aria-hidden="true" /></a>
            </motion.div>
          </div>
          <div className="sequence-footer"><span>01 — 04 <i /> THE LOCA STORY</span><span className="scroll-cue"><i /> SCROLL TO SLOW DOWN</span><span>GOOD COFFEE, GOOD COMPANY</span></div>
          <div className="sequence-progress" aria-hidden="true"><motion.span style={{ scaleX: easedProgress, transformOrigin: "0% 50%" }} /></div>
        </div>
      </section>
      <AnimatePresence>
        {!ready || preloaderProgress < 100 ? <motion.div className="preloader" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}><div className="preloader-inner"><div className="preloader-wordmark"><img src="/white-coffee-bean.png" alt="" /> <span>COFFE <b>LOCA</b></span></div><div className="preloader-line"><motion.i initial={{ scaleX: 0 }} animate={{ scaleX: preloaderProgress / 100 }} transition={{ duration: 0.12 }} /></div><div className="preloader-meta"><span>BREWING A LITTLE MOMENT</span><span>{String(Math.round(preloaderProgress)).padStart(2, "0")}%</span></div></div></motion.div> : null}
      </AnimatePresence>
    </>
  );
}
