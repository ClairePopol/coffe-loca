"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

type AuthMode = "login" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();
  const isRegister = mode === "register";

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setSubmitted(false);
    setErrorMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(false);
    setErrorMessage("");
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (isRegister) {
      const name = String(formData.get("name") ?? "").trim();
      const confirmation = String(formData.get("password-confirmation") ?? "");
      if (password !== confirmation) {
        setErrorMessage("Konfirmasi password belum sama.");
        return;
      }
      if (!name) {
        setErrorMessage("Nama lengkap wajib diisi.");
        return;
      }
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const result = isRegister
        ? await supabase.auth.signUp({ email, password, options: { data: { full_name: String(formData.get("name") ?? "").trim() } } })
        : await supabase.auth.signInWithPassword({ email, password });

      if (result.error) throw result.error;
      if (!isRegister) {
        router.push("/");
        router.refresh();
      } else {
        setSubmitted(true);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-orbit auth-orbit-one" aria-hidden="true" />
      <div className="auth-orbit auth-orbit-two" aria-hidden="true" />
      <header className="auth-header">
        <a className="wordmark auth-wordmark" href="/" aria-label="Coffe Loca, kembali ke beranda">
          <img className="wordmark-logo" src="/white-coffee-bean.png" alt="" />
          <span className="wordmark-type"><span>COFFE <b>LOCA</b></span><small>GOOD COFFEE, GOOD COMPANY</small></span>
        </a>
        <a className="auth-back-link" href="/">KEMBALI KE BERANDA <span className="arrow-icon" aria-hidden="true" /></a>
      </header>

      <section className="auth-layout" aria-labelledby="auth-title">
        <div className="auth-intro">
          <span className="eyebrow"><i /> COFFE LOCA / AREA MEMBER</span>
          <h1 id="auth-title">Simpan jeda<br /><em>favoritmu.</em></h1>
          <p>Masuk untuk menyimpan pilihanmu dan tetap dekat dengan cerita baru dari Loca.</p>
          <div className="auth-art" aria-hidden="true">
            <div className="auth-art-ring auth-art-ring-one" />
            <div className="auth-art-ring auth-art-ring-two" />
            <img src="/white-coffee-bean.png" alt="" />
            <span className="auth-art-index">LOCA / 01</span>
          </div>
          <div className="auth-note"><span>01</span><p>GOOD COFFEE.<br />GOOD COMPANY.</p><span className="auth-note-line" /></div>
        </div>

        <div className="auth-card">
          <div className="auth-card-topline"><span>MEMBER ACCESS</span><span>MEDAN / 2026</span></div>
          <div className="auth-tabs" role="tablist" aria-label="Akses akun">
            <button className={mode === "login" ? "is-active" : ""} role="tab" aria-selected={mode === "login"} onClick={() => switchMode("login")}>LOGIN</button>
            <button className={mode === "register" ? "is-active" : ""} role="tab" aria-selected={mode === "register"} onClick={() => switchMode("register")}>REGISTER</button>
          </div>
          <div className="auth-card-heading">
            <span className="auth-kicker">{isRegister ? "BUAT RUANG KECILMU" : "SELAMAT DATANG KEMBALI"}</span>
            <h2>{isRegister ? "Mulai dari sini." : "Senang melihatmu."}</h2>
            <p>{isRegister ? "Buat akun untuk ikut dalam cerita Loca." : "Masuk dan lanjutkan jeda kecilmu."}</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister && <label><span>NAMA LENGKAP</span><input name="name" type="text" placeholder="Nama kamu" autoComplete="name" required /></label>}
            <label><span>EMAIL</span><input name="email" type="email" placeholder="kamu@email.com" autoComplete="email" required /></label>
            <label><span>PASSWORD</span><div className="auth-password"><input name="password" type={showPassword ? "text" : "password"} placeholder="••••••••" autoComplete={isRegister ? "new-password" : "current-password"} minLength={6} required /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "SEMBUNYIKAN" : "LIHAT"}</button></div></label>
            {isRegister && <label><span>KONFIRMASI PASSWORD</span><input name="password-confirmation" type={showPassword ? "text" : "password"} placeholder="••••••••" autoComplete="new-password" minLength={6} required /></label>}
            {!isRegister && <div className="auth-form-meta"><label className="auth-check"><input type="checkbox" name="remember" /><span>INGAT AKU</span></label><a href="mailto:hello@coffeeloca.id?subject=Lupa%20password">LUPA PASSWORD?</a></div>}
            <button className="auth-submit" type="submit" disabled={loading}><span>{loading ? "MENGHUBUNGKAN..." : isRegister ? "BUAT AKUN" : "MASUK KE LOCA"}</span><span className="arrow-icon" aria-hidden="true" /></button>
            {errorMessage && <p className="auth-feedback auth-feedback-error" role="alert">{errorMessage}</p>}
            {submitted && <p className="auth-feedback" role="status">{isRegister ? "Akun dibuat. Cek email untuk konfirmasi sebelum login." : "Berhasil masuk. Selamat datang di Loca."}</p>}
          </form>
          <p className="auth-switch">{isRegister ? "Sudah punya akun?" : "Belum punya akun?"} <button type="button" onClick={() => switchMode(isRegister ? "login" : "register")}>{isRegister ? "LOGIN" : "REGISTER"} <span className="arrow-icon" aria-hidden="true" /></button></p>
        </div>
      </section>
      <footer className="auth-footer"><span>COFFE LOCA · MEDAN</span><span>EST. WITH CARE</span><span>© 2026</span></footer>
    </main>
  );
}
