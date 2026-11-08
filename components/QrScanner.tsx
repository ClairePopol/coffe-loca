"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

type Props = { onResult: (text: string) => void; onClose: () => void };
type Phase = "starting" | "scanning" | "success" | "error";

const READER_ID = "loca-qr-reader";

export default function QrScanner({ onResult, onClose }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const doneRef = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState("");
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [cameraIndex, setCameraIndex] = useState<number | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  function finish(text: string) {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase("success");
    navigator.vibrate?.(60);
    window.setTimeout(() => onResultRef.current(text.trim()), 450);
  }

  useEffect(() => {
    let cancelled = false;
    let instance: Html5Qrcode | null = null;
    doneRef.current = false;
    setPhase("starting");
    setError("");
    setTorchOn(false);

    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;
        instance = new Html5Qrcode(READER_ID, { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
        scannerRef.current = instance;
        const camera = cameraIndex !== null && cameras[cameraIndex] ? cameras[cameraIndex].id : { facingMode: "environment" };
        await instance.start(camera, { fps: 12, aspectRatio: 1 }, (text) => finish(text), () => undefined);
        if (cancelled) { await instance.stop().catch(() => undefined); return; }
        setPhase("scanning");
        try {
          setTorchSupported(Boolean(instance.getRunningTrackCameraCapabilities().torchFeature().isSupported()));
        } catch { setTorchSupported(false); }
        if (cameras.length === 0) {
          Html5Qrcode.getCameras().then((list) => { if (!cancelled) setCameras(list); }).catch(() => undefined);
        }
      } catch (err) {
        if (cancelled) return;
        const message = String(err instanceof Error ? err.message : err);
        setError(/permission|notallowed|denied/i.test(message)
          ? "Akses kamera ditolak. Izinkan kamera di pengaturan browser, lalu coba lagi."
          : /notfound|no camera|requested device/i.test(message)
            ? "Kamera tidak ditemukan di perangkat ini. Coba scan dari foto."
            : "Kamera tidak bisa dibuka. Pastikan halaman dibuka lewat HTTPS, lalu coba lagi.");
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      const running = instance;
      scannerRef.current = null;
      if (running?.isScanning) running.stop().then(() => running.clear()).catch(() => undefined);
    };
    // cameras is intentionally read only when switching (cameraIndex/attempt change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraIndex, attempt]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function toggleTorch() {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      await scanner.getRunningTrackCameraCapabilities().torchFeature().apply(!torchOn);
      setTorchOn((value) => !value);
    } catch { setTorchSupported(false); }
  }

  function switchCamera() {
    if (cameras.length < 2) return;
    setCameraIndex((index) => ((index ?? 0) + 1) % cameras.length);
  }

  async function scanFromPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const current = scannerRef.current;
      if (current?.isScanning) await current.stop().catch(() => undefined);
      const fileScanner = current ?? new Html5Qrcode(READER_ID, { verbose: false });
      const text = await fileScanner.scanFile(file, false);
      finish(text);
    } catch {
      setError("QR tidak terbaca dari foto itu. Coba foto yang lebih jelas dan terang.");
      setPhase("error");
    }
  }

  return (
    <div className="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-scan-title" onClick={onClose} data-lenis-prevent>
      <div className="qr-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="qr-sheet-top">
          <div><span>STAMP DESK</span><h2 id="qr-scan-title">Scan QR member</h2></div>
          <button className="qr-close" type="button" onClick={onClose} aria-label="Tutup scanner">×</button>
        </div>

        <div className={`qr-viewport is-${phase}`}>
          <div id={READER_ID} className="qr-reader" />
          <div className="qr-frame" aria-hidden="true">
            <i /><i /><i /><i />
            {phase === "scanning" && <b className="qr-laser" />}
          </div>
          {phase === "starting" && <div className="qr-overlay-msg"><span className="qr-spinner" />Membuka kamera…</div>}
          {phase === "success" && <div className="qr-overlay-msg qr-overlay-success"><span className="qr-check" />QR terbaca</div>}
          {phase === "error" && (
            <div className="qr-overlay-msg qr-overlay-error">
              <p>{error}</p>
              <button type="button" onClick={() => setAttempt((value) => value + 1)}>COBA LAGI</button>
            </div>
          )}
        </div>

        <p className="qr-hint">Arahkan kamera ke QR di kartu member. Scan berjalan otomatis.</p>

        <div className="qr-controls">
          <button type="button" onClick={toggleTorch} disabled={!torchSupported || phase !== "scanning"} aria-pressed={torchOn}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 2h6l-1 7h4l-8 13 2-9H8z" /></svg>{torchOn ? "Flash on" : "Flash"}
          </button>
          <button type="button" onClick={switchCamera} disabled={cameras.length < 2 || phase === "starting"}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4zM9.5 13.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0M15 9l2 2-2 2" /></svg>Ganti kamera
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9.5a1 1 0 1 0 0-.01" /></svg>Dari foto
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={scanFromPhoto} />
        </div>
      </div>
    </div>
  );
}
