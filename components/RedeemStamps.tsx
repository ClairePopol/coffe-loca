"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { errorMessage, type Reward } from "@/lib/content";
import { useScrollLock } from "@/lib/useScrollLock";

type Step = "loading" | "login" | "pending" | "choose" | "confirm" | "done" | "error";
type Item = Pick<Reward, "id" | "title" | "detail" | "stamps_cost">;

const bean = <svg viewBox="0 0 24 24"><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c0 1 1 1.5 1 2.5M11.5 3.5c0 1 1 1.5 1 2.5" /></svg>;

/** Hero button + popup: shows the stamp balance, lists only the rewards that balance can pay for, then asks "yakin?". */
export default function RedeemStamps() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="pill-button pill-button-light" onClick={() => setOpen(true)}><span>REDEEM STAMPS</span><span className="arrow-icon" aria-hidden="true" /></button>
      {open && <RedeemDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function RedeemDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("loading");
  const [balance, setBalance] = useState(0);
  const [rewards, setRewards] = useState<Item[]>([]);
  const [picked, setPicked] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useScrollLock(true);

  const load = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) { setStep("login"); return; }
      const [profileRes, rewardRes] = await Promise.all([
        supabase.from("profiles").select("stamps, role, approved").eq("id", user.id).maybeSingle(),
        supabase.from("rewards").select("id, title, detail, stamps_cost").eq("is_active", true).order("stamps_cost", { ascending: true }).order("id", { ascending: true }),
      ]);
      if (profileRes.error || !profileRes.data) throw profileRes.error ?? new Error("Profil tidak ditemukan.");
      if (rewardRes.error) throw rewardRes.error;
      const profile = profileRes.data;
      if (profile.role === "member" && profile.approved === false) { setStep("pending"); return; }
      setBalance(profile.stamps ?? 0);
      setRewards((rewardRes.data ?? []) as Item[]);
      setStep("choose");
    } catch (error) {
      setMessage(errorMessage(error, "Saldo stamp belum bisa dimuat."));
      setStep("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const affordable = rewards.filter((reward) => reward.stamps_cost <= balance);
  const nextReward = rewards.find((reward) => reward.stamps_cost > balance);

  async function redeem() {
    if (!picked) return;
    setBusy(true);
    const { error } = await getSupabaseClient().rpc("redeem_my_reward", { p_reward_id: picked.id });
    setBusy(false);
    if (error) { setMessage(errorMessage(error, "Penukaran belum berhasil.")); setStep("error"); return; }
    setBalance((value) => value - picked.stamps_cost);
    setStep("done");
  }

  return (
    <div className="confirm-backdrop" onClick={onClose} data-lenis-prevent data-scroll-lock-allow>
      <div className="confirm-sheet redeem-sheet" role="dialog" aria-modal="true" aria-labelledby="redeem-title" onClick={(event) => event.stopPropagation()}>
        <span className="confirm-icon" aria-hidden="true">{bean}</span>

        {step === "loading" && <><h2 id="redeem-title">Redeem Stamps</h2><p className="confirm-message">Sebentar, kami cek saldo stampmu…</p></>}

        {step === "login" && <>
          <h2 id="redeem-title">Masuk dulu, ya</h2>
          <p className="confirm-message">Masuk ke akun Coffe Loca-mu untuk melihat saldo stamp dan menukarnya dengan hadiah.</p>
          <div className="confirm-actions"><button type="button" className="confirm-cancel" onClick={onClose}>NANTI SAJA</button><a className="confirm-ok" href="/login">MASUK</a></div>
        </>}

        {step === "pending" && <>
          <h2 id="redeem-title">Akunmu belum aktif</h2>
          <p className="confirm-message">Stamp baru bisa ditukar setelah akunmu diverifikasi oleh owner. Hubungi owner lewat WhatsApp dari halaman profil, ya.</p>
          <div className="confirm-actions is-single"><a className="confirm-ok" href="/profile">BUKA PROFIL</a></div>
        </>}

        {step === "choose" && <>
          <h2 id="redeem-title">Redeem Stamps</h2>
          <div className="redeem-balance"><small>SALDO STAMP KAMU</small><strong>{balance}</strong><span>stamp</span></div>
          {affordable.length > 0 ? <>
            <p className="confirm-message">Dengan saldo ini, kamu bisa menukar:</p>
            <ul className="redeem-options">
              {affordable.map((reward) => (
                <li key={reward.id}>
                  <button type="button" onClick={() => { setPicked(reward); setStep("confirm"); }}>
                    <span><strong>{reward.title}</strong>{reward.detail && <small>{reward.detail}</small>}</span>
                    <b>{reward.stamps_cost}<i>stamp</i></b>
                  </button>
                </li>
              ))}
            </ul>
          </> : <p className="confirm-message">
            {rewards.length === 0 ? "Belum ada hadiah yang tersedia saat ini. Cek lagi nanti, ya!" : <>Saldomu belum cukup untuk menukar hadiah. Hadiah terdekat, <b>{nextReward?.title}</b>, butuh <b>{nextReward?.stamps_cost}</b> stamp — tinggal <b>{(nextReward?.stamps_cost ?? 0) - balance}</b> lagi. Yuk, ngopi dulu ☕</>}
          </p>}
          <div className="confirm-actions is-single"><button type="button" className="confirm-cancel" onClick={onClose}>TUTUP</button></div>
        </>}

        {step === "confirm" && picked && <>
          <h2 id="redeem-title">Tukar {picked.title}?</h2>
          <p className="confirm-message">
            Kamu akan memakai <b>{picked.stamps_cost} stamp</b>. Saldo berubah dari <b>{balance}</b> menjadi <b>{balance - picked.stamps_cost}</b> stamp.
            <br />Penukaran tidak bisa dibatalkan, jadi lakukan ini saat kamu sudah di kasir. Yakin mau lanjut?
          </p>
          <div className="confirm-actions">
            <button type="button" className="confirm-cancel" disabled={busy} onClick={() => setStep("choose")}>KEMBALI</button>
            <button type="button" className="confirm-ok" disabled={busy} onClick={redeem}>{busy ? "MEMPROSES…" : "YA, TUKAR SEKARANG"}</button>
          </div>
        </>}

        {step === "done" && picked && <>
          <h2 id="redeem-title">Berhasil! ☕</h2>
          <p className="confirm-message"><b>{picked.title}</b> sudah kamu tukar. Tunjukkan layar ini ke kasir Coffe Loca untuk menerimanya. Sisa saldomu <b>{balance}</b> stamp.</p>
          <div className="confirm-actions is-single"><button type="button" className="confirm-ok" onClick={onClose}>SELESAI</button></div>
        </>}

        {step === "error" && <>
          <h2 id="redeem-title">Ups, ada kendala</h2>
          <p className="confirm-message">{message}</p>
          <div className="confirm-actions"><button type="button" className="confirm-cancel" onClick={onClose}>TUTUP</button><button type="button" className="confirm-ok" onClick={() => { setStep("loading"); load(); }}>COBA LAGI</button></div>
        </>}
      </div>
    </div>
  );
}
