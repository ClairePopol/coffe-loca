"use client";

import { OWNER_WHATSAPP_URL } from "@/lib/owner";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { normalizePhone, phoneToAuthEmail } from "@/lib/phone";
import { PageFooter, PageHeader } from "@/components/PageShell";

type AuthMode = "login" | "register";

function friendlyAuthError(error: unknown, isRegister: boolean) {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : String(error ?? "");
  if (/invalid login credentials/i.test(message)) return "Nomor HP atau password salah.";
  if (/phone.*(already|registered|exists)|already.*phone/i.test(message)) return "Nomor HP ini sudah dipakai akun lain.";
  if (/already registered|already exists/i.test(message)) return "Nomor HP ini sudah terdaftar. Silakan login.";
  if (/email not confirmed/i.test(message)) return "Akun belum aktif. Admin perlu mematikan 'Confirm email' di Supabase.";
  if (/password should be at least|weak password/i.test(message)) return "Password minimal 6 karakter.";
  if (/rate limit|too many/i.test(message)) return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  if (/fetch|network/i.test(message)) return "Koneksi bermasalah. Periksa internet lalu coba lagi.";
  return message || (isRegister ? "Akun gagal dibuat. Coba lagi." : "Gagal masuk. Coba lagi.");
}

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  // Registered (or tried to log in) but not yet approved by the owner: no session is kept, only this popup is shown.
  const [waiting, setWaiting] = useState<"register" | "login" | null>(null);
  const router = useRouter();
  const isRegister = mode === "register";

  // The account only becomes usable once the owner approves it, so drop the session and show the "verify" popup.
  async function holdForApproval(kind: "register" | "login") {
    await getSupabaseClient().auth.signOut();
    setErrorMessage("");
    setWaiting(kind);
  }

  function closeWaiting() {
    setWaiting(null);
    setMode("login");
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrorMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    const formData = new FormData(event.currentTarget);
    const identifier = String(formData.get("phone") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();

    // Old accounts registered with email can still log in with their email address.
    const usesEmail = !isRegister && identifier.includes("@");
    const phone = usesEmail ? null : normalizePhone(identifier);
    if (!usesEmail && !phone) {
      setErrorMessage("Nomor HP belum benar. Contoh: 0812 3456 7890.");
      return;
    }
    if (isRegister) {
      if (!name) {
        setErrorMessage("Nama lengkap wajib diisi.");
        return;
      }
      if (password !== String(formData.get("password-confirmation") ?? "")) {
        setErrorMessage("Konfirmasi password belum sama.");
        return;
      }
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const email = usesEmail ? identifier : phoneToAuthEmail(phone!);
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name, phone } } });
        if (error) throw error;
        // Supabase returns a user without identities when the address is already registered.
        if (data.user && data.user.identities?.length === 0) throw new Error("User already registered");
        if (!data.session) {
          setErrorMessage("Akun dibuat, tapi belum bisa langsung masuk. Admin perlu mematikan 'Confirm email' di Supabase.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      if (isRegister) { await holdForApproval("register"); return; }
      const { data: me } = await supabase.auth.getUser();
      const { data: row } = me.user ? await supabase.from("profiles").select("role, approved").eq("id", me.user.id).maybeSingle() : { data: null };
      if (row && row.role === "member" && row.approved === false) { await holdForApproval("login"); return; }
      router.push("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(friendlyAuthError(error, isRegister));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell auth-page">
      <PageHeader />

      <section className="auth-layout" aria-labelledby="auth-title">
        <div className="auth-intro page-heading">
          <span className="eyebrow"><i /> COFFE LOCA / AREA MEMBER</span>
          <h1 id="auth-title">Simpan jeda<br /><em>favoritmu.</em></h1>
          <p>Masuk untuk mengumpulkan stamp, menyimpan pilihanmu, dan tetap dekat dengan cerita baru dari Loca.</p>
          <div className="auth-art" aria-hidden="true">
            <div className="auth-art-ring auth-art-ring-one" />
            <div className="auth-art-ring auth-art-ring-two" />
            <img src="/white-coffee-bean.png" alt="" />
          </div>
        </div>

        <div className="auth-card card">
          <div className="card-topline"><span>MEMBER ACCESS</span><span>MEDAN / 2026</span></div>
          {(<>
          <div className="auth-tabs" role="tablist" aria-label="Akses akun">
            <button id="auth-tab-login" type="button" className={mode === "login" ? "is-active" : ""} role="tab" aria-selected={mode === "login"} aria-controls="auth-panel" onClick={() => switchMode("login")}>LOGIN</button>
            <button id="auth-tab-register" type="button" className={mode === "register" ? "is-active" : ""} role="tab" aria-selected={mode === "register"} aria-controls="auth-panel" onClick={() => switchMode("register")}>REGISTER</button>
          </div>
          <div id="auth-panel" role="tabpanel" aria-labelledby={`auth-tab-${mode}`}>
            <div className="auth-card-heading" key={mode}>
              <span className="auth-kicker">{isRegister ? "BUAT RUANG KECILMU" : "SELAMAT DATANG KEMBALI"}</span>
              <h2>{isRegister ? "Mulai dari sini." : "Senang melihatmu."}</h2>
              <p>{isRegister ? "Buat akun untuk ikut dalam cerita Loca." : "Masuk dan lanjutkan jeda kecilmu."}</p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {isRegister && <label className="field"><span>NAMA LENGKAP</span><input name="name" type="text" placeholder="Nama kamu" autoComplete="name" required /></label>}
              <label className="field">
                <span>NOMOR HP</span>
                <input name="phone" type={isRegister ? "tel" : "text"} inputMode={isRegister ? "tel" : "text"} placeholder="0812 3456 7890" autoComplete={isRegister ? "tel" : "username"} required />
                <small className="field-hint">{isRegister ? "Pakai nomor WhatsApp aktif. Nomor ini jadi ID login kamu." : "Akun lama dengan email? Ketik email di sini."}</small>
              </label>
              <label className="field"><span>PASSWORD</span><div className="auth-password"><input name="password" type={showPassword ? "text" : "password"} placeholder="Minimal 6 karakter" autoComplete={isRegister ? "new-password" : "current-password"} minLength={6} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-pressed={showPassword}>{showPassword ? "SEMBUNYIKAN" : "LIHAT"}</button></div></label>
              {isRegister && <label className="field"><span>KONFIRMASI PASSWORD</span><input name="password-confirmation" type={showPassword ? "text" : "password"} placeholder="Ulangi password" autoComplete="new-password" minLength={6} required /></label>}
              {!isRegister && <div className="auth-form-meta"><span className="auth-forgot">Lupa password? <b>Minta bantuan kasir Coffe Loca.</b></span></div>}
              <button className="btn-primary" type="submit" disabled={loading}><span>{loading ? "MENGHUBUNGKAN..." : isRegister ? "BUAT AKUN" : "MASUK KE LOCA"}</span><span className="arrow-icon" aria-hidden="true" /></button>
              {errorMessage && <p className="notice notice-error" role="alert">{errorMessage}</p>}
            </form>
          </div>
          <p className="auth-switch">{isRegister ? "Sudah punya akun?" : "Belum punya akun?"} <button type="button" onClick={() => switchMode(isRegister ? "login" : "register")}>{isRegister ? "Login" : "Daftar sekarang"} <span className="arrow-icon" aria-hidden="true" /></button></p>
          </>)}
        </div>
      </section>
      {waiting && (
        <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="verify-title" onClick={closeWaiting}>
          <div className="auth-modal-card" onClick={(event) => event.stopPropagation()}>
            <button className="auth-modal-close" type="button" onClick={closeWaiting} aria-label="Tutup">×</button>
            <span className="auth-kicker">{waiting === "register" ? "AKUN BERHASIL DIDAFTARKAN" : "AKUN BELUM AKTIF"}</span>
            <h2 id="verify-title">Verify your account.</h2>
            <p>{waiting === "register"
              ? "Please verify your account — click the link below to chat the owner on WhatsApp. Your account can only be used after the owner approves it."
              : "Your account hasn't been approved yet, so you can't log in. Click the link below to chat the owner on WhatsApp and ask for approval."}</p>
            <p className="auth-modal-note">Sebutkan nama dan nomor HP yang kamu daftarkan. Akun diaktifkan oleh Owner / Admin Coffe Loca.</p>
            <a className="btn-primary" href={OWNER_WHATSAPP_URL} target="_blank" rel="noopener noreferrer"><span>CHAT OWNER DI WHATSAPP</span><span className="arrow-icon" aria-hidden="true" /></a>
            <button type="button" className="auth-link" onClick={closeWaiting}>KEMBALI KE LOGIN</button>
          </div>
        </div>
      )}
      <PageFooter items={["COFFE LOCA · MEDAN", "EST. WITH CARE", "© 2026"]} />
    </main>
  );
}
