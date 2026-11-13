"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { errorMessage, formatDateId, todayWib } from "@/lib/content";

type Scanned = { id: number; title: string; member_name: string | null; status: string; uses_left: number; uses_total: number; expires_at: string | null; is_active: boolean };
type View = { id: number; title: string; who: string; usesLeft: number; usesTotal: number; expires: string | null; problem: string | null; done: boolean };

/**
 * Cashier card shown after scanning a voucher QR ("LOCA-VOUCHER:<id>"). One tap records one use.
 * Reads through scan_voucher / use_member_voucher so Admin Coffee needs no access to the member list.
 */
export default function VoucherScan({ scan }: { scan: { id: number; nonce: number } | null }) {
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scan) return;
    let active = true;
    (async () => {
      const { data, error } = await getSupabaseClient().rpc("scan_voucher", { p_member_voucher_id: scan.id });
      if (!active) return;
      const row = data as Scanned | null;
      if (error || !row) {
        setView({ id: scan.id, title: "Voucher tidak ditemukan", who: "", usesLeft: 0, usesTotal: 0, expires: null, problem: errorMessage(error, "QR ini tidak cocok dengan voucher mana pun."), done: false });
      } else {
        const problem = row.status !== "active" || row.uses_left < 1 ? "Voucher ini sudah terpakai habis."
          : row.expires_at && row.expires_at < todayWib() ? "Voucher ini sudah kedaluwarsa."
          : !row.is_active ? "Voucher ini sudah dinonaktifkan." : null;
        setView({ id: row.id, title: row.title, who: row.member_name || "Member", usesLeft: row.uses_left, usesTotal: row.uses_total, expires: row.expires_at, problem, done: false });
      }
      window.setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    })();
    return () => { active = false; };
  }, [scan]);

  async function redeemNow() {
    if (!view) return;
    setBusy(true);
    const { error } = await getSupabaseClient().rpc("use_member_voucher", { p_member_voucher_id: view.id });
    setBusy(false);
    if (error) { setView({ ...view, problem: errorMessage(error, "Gagal me-redeem voucher.") }); return; }
    setView({ ...view, usesLeft: view.usesLeft - 1, done: true });
  }

  if (!view) return null;
  return (
    <div ref={ref} className={`admin-panel card admin-redeem${view.problem ? " is-problem" : view.done ? " is-done" : ""}`} role="status">
      <div className="card-topline"><span>REDEEM VOUCHER</span><button type="button" className="admin-redeem-close" onClick={() => setView(null)} aria-label="Tutup">×</button></div>
      <strong>{view.title}</strong>
      {view.who && <p>{view.who}{view.expires ? ` · s/d ${formatDateId(view.expires)}` : ""}</p>}
      {view.problem ? <p className="notice notice-error" role="alert">{view.problem}</p>
        : view.done ? <p className="notice">✓ Berhasil di-redeem.{view.usesLeft > 0 ? ` Sisa ${view.usesLeft}/${view.usesTotal}x.` : " Voucher sudah habis dipakai."}</p>
        : <>
            <p>Sisa {view.usesLeft}/{view.usesTotal}x — redeem 1x sekarang?</p>
            <button className="btn-primary" type="button" disabled={busy} onClick={redeemNow}><span>{busy ? "MEMPROSES..." : "REDEEM 1x"}</span><i className="arrow-icon" aria-hidden="true" /></button>
          </>}
    </div>
  );
}
