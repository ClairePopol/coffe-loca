"use client";

import { OWNER_WHATSAPP_URL } from "@/lib/owner";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { formatPhone, normalizePhone, phoneToAuthEmail, phoneToE164 } from "@/lib/phone";
import { PageFooter, PageHeader } from "@/components/PageShell";

type AuthMode = "login" | "register";
type OtpState = { phone: string; sendFailed: boolean };

// SMS OTP (Twilio via Supabase Phone Auth) is off until NEXT_PUBLIC_PHONE_OTP=true — see .env.example.
const OTP_ENABLED = process.env.NEXT_PUBLIC_PHONE_OTP === "true";
const OTP_COOLDOWN = 60;

function friendlyAuthError(error: unknown, isRegister: boolean) {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : String(error ?? "");
  if (/invalid login credentials/i.test(message)) return "Nomor HP atau password salah.";
  if (/phone.*(already|registered|exists)|already.*phone/i.test(message)) return "Nomor HP ini sudah dipakai akun lain.";
  if (/otp|token/i.test(message) && /expired|invalid/i.test(message)) return "Kode salah atau sudah kedaluwarsa.";
  if (/only request this after|after \d+ seconds/i.test(message)) return "Tunggu sebentar sebelum meminta kode lagi.";
  if (/sms|twilio|unsupported phone|phone provider/i.test(message)) return "Kode OTP belum bisa dikirim saat ini. Coba lagi nanti.";
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
  const [otp, setOtp] = useState<OtpState | null>(null);
  const [cooldown, setCooldown] = useState(0);
  // Registered (or logged in) but not yet approved by the owner: no session is kept, only this notice is shown.
  const [waiting, setWaiting] = useState(false);
  const router = useRouter();
  const isRegister = mode === "register";

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  // The account only becomes usable once the owner approves it, so drop the session and show the WhatsApp step.
  async function holdForApproval() {
    await getSupabaseClient().auth.signOut();
    setOtp(null);
    setErrorMessage("");
    setWaiting(true);
  }

  function finish() {
    holdForApproval();
  }

  // Step 2 of registration: confirm the phone number with the 6-digit code sent by Twilio.
  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!otp) return;
    setErrorMessage("");
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\D/g, "");
    if (code.length !== 6) {
      setErrorMessage("Masukkan 6 digit kode OTP.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await getSupabaseClient().auth.verifyOtp({ phone: phoneToE164(otp.phone), token: code, type: "phone_change" });
      if (error) throw error;
      finish();
    } catch (error) {
      setErrorMessage(friendlyAuthError(error, true));
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    if (!otp || cooldown > 0 || loading) return;
    setErrorMessage("");
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const phone = phoneToE164(otp.phone);
      // If the very first send failed there is no pending code to resend, so ask for a fresh one.
      const { error } = otp.sendFailed ? await supabase.auth.updateUser({ phone }) : await supabase.auth.resend({ type: "phone_change", phone });
      if (error) throw error;
      setOtp({ ...otp, sendFailed: false });
      setCooldown(OTP_COOLDOWN);
    } catch (error) {
      setErrorMessage(friendlyAuthError(error, true));
    } finally {
      setLoading(false);
    }
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
        if (OTP_ENABLED) {
          // The account already exists and is signed in; now prove the number is real. updateUser({ phone }) makes
          // Supabase send an SMS code through the configured provider (Twilio) and wait for verifyOtp().
          const { error: sendError } = await supabase.auth.updateUser({ phone: phoneToE164(phone!) });
          setOtp({ phone: phone!, sendFailed: Boolean(sendError) });
          if (sendError) setErrorMessage(friendlyAuthError(sendError, true));
          else setCooldown(OTP_COOLDOWN);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      if (isRegister) { await holdForApproval(); return; }
      const { data: me } = await supabase.auth.getUser();
      const { data: row } = me.user ? await supabase.from("profiles").select("role, approved").eq("id", me.user.id).maybeSingle() : { data: null };
      if (row && row.role === "member" && row.approved === false) { await holdForApproval(); return; }
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
          {waiting ? (
            <div id="auth-panel">
              <div className="auth-card-heading">
                <span className="auth-kicker">MENUNGGU PERSETUJUAN</span>
                <h2>Akunmu belum aktif.</h2>
                <p>Akun baru harus disetujui Owner Coffe Loca dulu sebelum bisa dipakai. Chat Owner lewat WhatsApp, sebutkan nama dan nomor HP yang kamu daftarkan. Setelah disetujui, kamu bisa login.</p>
              </div>
              <a className="btn-primary" href={OWNER_WHATSAPP_URL} target="_blank" rel="noopener noreferrer"><span>CHAT OWNER DI WHATSAPP</span><span className="arrow-icon" aria-hidden="true" /></a>
              <button type="button" className="auth-link" onClick={() => { setWaiting(false); setMode("login"); }}>KEMBALI KE LOGIN</button>
            </div>
          ) : otp ? (
            <div id="auth-panel">
              <div className="auth-card-heading">
                <span className="auth-kicker">VERIFIKASI NOMOR</span>
                <h2>Masukkan kodenya.</h2>
                <p>{otp.sendFailed ? `Kode belum terkirim ke ${formatPhone(otp.phone)}.` : `Kami mengirim kode 6 digit lewat SMS ke ${formatPhone(otp.phone)}.`}</p>
              </div>
              <form className="auth-form" onSubmit={handleVerify}>
                <label className="field auth-code">
                  <span>KODE OTP</span>
                  <input name="code" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="••••••" autoComplete="one-time-code" disabled={otp.sendFailed} required autoFocus />
                </label>
                <button className="btn-primary" type="submit" disabled={loading || otp.sendFailed}><span>{loading ? "MEMERIKSA..." : "VERIFIKASI"}</span><span className="arrow-icon" aria-hidden="true" /></button>
                {errorMessage && <p className="notice notice-error" role="alert">{errorMessage}</p>}
                <div className="auth-otp-actions">
                  <button type="button" className="auth-link" onClick={resendOtp} disabled={loading || cooldown > 0}>
                    {otp.sendFailed ? "KIRIM KODE" : cooldown > 0 ? `KIRIM ULANG (${cooldown}d)` : "KIRIM ULANG KODE"}
                  </button>
                  {otp.sendFailed && <button type="button" className="auth-link" onClick={finish}>LEWATI, VERIFIKASI NANTI</button>}
                </div>
              </form>
            </div>
          ) : (<>
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
      <PageFooter items={["COFFE LOCA · MEDAN", "EST. WITH CARE", "© 2026"]} />
    </main>
  );
}
