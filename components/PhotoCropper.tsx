"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useScrollLock } from "@/lib/useScrollLock";

type Props = {
  file: File | Blob;
  /** width / height of the crop frame (reward photos are 4:3) */
  aspect?: number;
  /** exported width in px (height follows the aspect) */
  outWidth?: number;
  title?: string;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
};

type Pt = { x: number; y: number };
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

/**
 * Small in-page photo editor: the picture always covers a fixed-aspect frame; drag to pan,
 * pinch / scroll / slider to zoom, button to rotate 90°. Exports a WebP of the framed area.
 */
export default function PhotoCropper({ file, aspect = 4 / 3, outWidth = 800, title = "Atur foto", onCancel, onDone }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [off, setOff] = useState<Pt>({ x: 0, y: 0 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<{ off: Pt; zoom: number; center: Pt; dist: number } | null>(null);
  useScrollLock(true);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => setImg(el);
    el.onerror = () => setError("Foto tidak bisa dibaca. Coba file lain.");
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => { setZoom(1); setRot(0); setOff({ x: 0, y: 0 }); }, [img]);

  const rotated = rot % 180 !== 0;
  const iw = img ? (rotated ? img.naturalHeight : img.naturalWidth) : 1;
  const ih = img ? (rotated ? img.naturalWidth : img.naturalHeight) : 1;

  const frame = useCallback(() => {
    const w = stageRef.current?.clientWidth ?? 400;
    return { W: w, H: w / aspect };
  }, [aspect]);

  // keep the picture covering the whole frame
  const clamp = useCallback((o: Pt, z: number) => {
    const { W, H } = frame();
    const s = Math.max(W / iw, H / ih) * z;
    const mx = Math.max(0, (iw * s - W) / 2);
    const my = Math.max(0, (ih * s - H) / 2);
    return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) };
  }, [frame, iw, ih]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, W: number, H: number, o: Pt, z: number) => {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, W, H);
    if (!img) return;
    const s = Math.max(W / iw, H / ih) * z;
    ctx.save();
    ctx.translate(W / 2 + o.x, H / 2 + o.y);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (-img.naturalWidth * s) / 2, (-img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    ctx.restore();
  }, [img, iw, ih, rot]);

  // preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { W, H } = frame();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, W, H, off, zoom);
  }, [draw, frame, off, zoom]);

  useEffect(() => { setOff((o) => clamp(o, zoom)); }, [zoom, rot, clamp]);
  useEffect(() => {
    const onResize = () => setOff((o) => clamp(o, zoom));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp, zoom]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function snapshot() {
    const pts = [...pointers.current.values()];
    const center = pts.length > 1 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pts[0];
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { off, zoom, center, dist };
  }
  function onPointerDown(event: React.PointerEvent) {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    snapshot();
  }
  function onPointerMove(event: React.PointerEvent) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    if (pts.length > 1 && g.dist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, g.zoom * (dist / g.dist)));
      const center = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      setZoom(z);
      setOff(clamp({ x: g.off.x + (center.x - g.center.x), y: g.off.y + (center.y - g.center.y) }, z));
    } else {
      setOff(clamp({ x: g.off.x + (pts[0].x - g.center.x), y: g.off.y + (pts[0].y - g.center.y) }, zoom));
    }
  }
  function onPointerUp(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size) snapshot(); else gesture.current = null;
  }
  function onWheel(event: React.WheelEvent) {
    event.preventDefault();
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * (event.deltaY < 0 ? 1.08 : 0.92))));
  }

  async function save() {
    if (!img || busy) return;
    setBusy(true);
    try {
      const { W } = frame();
      const k = outWidth / W;
      const canvas = document.createElement("canvas");
      canvas.width = outWidth;
      canvas.height = Math.round(outWidth / aspect);
      const ctx = canvas.getContext("2d")!;
      draw(ctx, canvas.width, canvas.height, { x: off.x * k, y: off.y * k }, zoom);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
      if (!blob) throw new Error("Foto gagal diproses.");
      onDone(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Foto gagal diproses.");
      setBusy(false);
    }
  }

  return (
    <div className="confirm-backdrop" onClick={onCancel} data-lenis-prevent data-scroll-lock-allow>
      <div className="confirm-sheet pc-sheet" role="dialog" aria-modal="true" aria-labelledby="pc-title" onClick={(event) => event.stopPropagation()}>
        <div className="pc-head">
          <div><span className="auth-kicker">FOTO HADIAH</span><h2 id="pc-title">{title}</h2></div>
          <button type="button" className="pc-icon" onClick={() => setRot((r) => (r + 90) % 360)} aria-label="Putar 90 derajat" title="Putar 90°" disabled={!img}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" /></svg>
          </button>
        </div>
        <div ref={stageRef} className="pc-stage" style={{ aspectRatio: String(aspect) }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}>
          <canvas ref={canvasRef} aria-label="Pratinjau potongan foto" />
          <span className="pc-grid" aria-hidden="true" />
          {!img && !error && <span className="pc-loading">Memuat foto…</span>}
        </div>
        <div className="pc-controls">
          <span className="pc-zoom-label">ZOOM</span>
          <input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Zoom" disabled={!img} />
          <b>{zoom.toFixed(1)}×</b>
        </div>
        <p className="pc-hint">Geser foto untuk mengatur posisi · cubit atau scroll untuk zoom · tombol kanan atas untuk memutar. Yang tersimpan hanya bagian di dalam bingkai.</p>
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        <div className="confirm-actions">
          <button type="button" className="confirm-cancel" onClick={onCancel} disabled={busy}>BATAL</button>
          <button type="button" className="confirm-ok" onClick={save} disabled={!img || busy}>{busy ? "MENYIMPAN…" : "SIMPAN FOTO"}</button>
        </div>
      </div>
    </div>
  );
}
