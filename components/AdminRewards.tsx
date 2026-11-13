"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useConfirm } from "@/components/ConfirmDialog";
import { errorMessage, type Reward } from "@/lib/content";

type Status = { tone: "ok" | "error"; text: string } | null;
export const STAMP_CARD = 10;

/**
 * "Etalase hadiah": the owner / Admin Umum decide the rewards and how many stamps each costs
 * (10 stamps = 1 full card = free coffee, 40 = 4 cards = merchandise, …). Choosing a member on the
 * stamp desk lets staff redeem a reward — its price is subtracted from the member's stamps.
 */
export default function AdminRewards({ userId, member, onRedeemed }: { userId: string; member: { id: string; name: string; stamps: number } | null; onRedeemed: () => Promise<void> | void }) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [confirm, confirmDialog] = useConfirm();

  const load = useCallback(async () => {
    const { data, error } = await getSupabaseClient().from("rewards").select("id, title, detail, stamps_cost, is_active, created_at").order("stamps_cost", { ascending: true }).order("id", { ascending: true });
    if (error) setStatus({ tone: "error", text: errorMessage(error, "Hadiah gagal dimuat.") });
    else setRewards((data ?? []) as Reward[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addReward(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const detail = String(data.get("detail") ?? "").trim();
    const cost = Math.floor(Number(data.get("cost")));
    if (!title || !Number.isFinite(cost) || cost < 1) { setStatus({ tone: "error", text: "Isi nama hadiah dan jumlah stamp (minimal 1)." }); return; }
    setBusy(true);
    setStatus(null);
    const { error } = await getSupabaseClient().from("rewards").insert({ title, detail: detail || null, stamps_cost: cost, created_by: userId });
    setBusy(false);
    if (error) { setStatus({ tone: "error", text: errorMessage(error, "Hadiah gagal ditambahkan.") }); return; }
    form.reset();
    setStatus({ tone: "ok", text: "Hadiah ditambahkan ke etalase." });
    await load();
  }

  async function toggle(reward: Reward) {
    setBusy(true);
    const { error } = await getSupabaseClient().from("rewards").update({ is_active: !reward.is_active }).eq("id", reward.id);
    setBusy(false);
    if (error) setStatus({ tone: "error", text: errorMessage(error, "Status hadiah gagal diubah.") });
    else await load();
  }

  async function remove(reward: Reward) {
    const ok = await confirm({ title: `Hapus hadiah "${reward.title}"?`, message: "Hadiah hilang dari etalase. Riwayat penukaran yang sudah tercatat tidak terhapus.", confirmLabel: "YA, HAPUS", tone: "danger" });
    if (!ok) return;
    setBusy(true);
    const { error } = await getSupabaseClient().from("rewards").delete().eq("id", reward.id);
    setBusy(false);
    if (error) setStatus({ tone: "error", text: errorMessage(error, "Hadiah gagal dihapus.") });
    else await load();
  }

  async function redeem(reward: Reward) {
    if (!member) return;
    const ok = await confirm({
      title: `Tukar "${reward.title}" untuk ${member.name}?`,
      message: <>Stamp berkurang <b>{reward.stamps_cost}</b> ({member.stamps} → <b>{member.stamps - reward.stamps_cost}</b>) dan tercatat di riwayat.</>,
      confirmLabel: "YA, TUKAR",
    });
    if (!ok) return;
    setBusy(true);
    setStatus(null);
    const { error } = await getSupabaseClient().rpc("redeem_reward", { target_user_id: member.id, p_reward_id: reward.id });
    setBusy(false);
    if (error) { setStatus({ tone: "error", text: errorMessage(error, "Penukaran gagal.") }); return; }
    setStatus({ tone: "ok", text: `${reward.title} untuk ${member.name} sudah ditukar. Sisa ${member.stamps - reward.stamps_cost} stamp.` });
    await onRedeemed();
  }

  return (
    <div className="admin-panel card admin-rewards" id="reward-desk">
      <div className="card-topline"><span>ETALASE HADIAH</span><span>REDEEM DENGAN STAMP</span></div>
      <h2>Tukar hadiah.</h2>
      <p className="admin-rewards-member">
        {member ? <>Member terpilih: <b>{member.name}</b> · <b>{member.stamps}</b> stamp ({Math.floor(member.stamps / STAMP_CARD)} kartu penuh)</> : "Pilih atau scan member di Stamp Desk untuk menukar hadiah."}
      </p>
      {status && <p className={`notice${status.tone === "error" ? " notice-error" : ""}`} role={status.tone === "error" ? "alert" : "status"}>{status.text}</p>}

      {loading ? <p className="admin-empty">Memuat hadiah…</p> : rewards.length === 0 ? <p className="admin-empty">Belum ada hadiah. Tambahkan di bawah.</p> : (
        <ul className="admin-reward-grid">
          {rewards.map((reward) => {
            const enough = Boolean(member && member.stamps >= reward.stamps_cost);
            const cards = reward.stamps_cost / STAMP_CARD;
            return (
              <li key={reward.id} className={`${reward.is_active ? "" : "is-off"}${enough && reward.is_active ? " is-ready" : ""}`}>
                <span className="admin-reward-cost"><b>{reward.stamps_cost}</b>stamp</span>
                <strong>{reward.title}{!reward.is_active && <em>NONAKTIF</em>}</strong>
                {reward.detail && <small>{reward.detail}</small>}
                <small className="admin-reward-cards">{Number.isInteger(cards) ? `${cards} kartu penuh` : `${cards.toFixed(1)} kartu`}</small>
                <button type="button" className="admin-use-id admin-use-redeem" disabled={busy || !enough || !reward.is_active} onClick={() => redeem(reward)}>
                  {!member ? "PILIH MEMBER" : !reward.is_active ? "NONAKTIF" : enough ? "TUKAR" : `KURANG ${reward.stamps_cost - member.stamps}`}
                </button>
                <span className="admin-reward-tools">
                  <button type="button" disabled={busy} onClick={() => toggle(reward)}>{reward.is_active ? "Nonaktifkan" : "Aktifkan"}</button>
                  <button type="button" className="is-danger" disabled={busy} onClick={() => remove(reward)}>Hapus</button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <form className="admin-reward-form" onSubmit={addReward}>
        <label className="field"><span>NAMA HADIAH</span><input name="title" maxLength={80} placeholder="mis. Kaos Coffe Loca" required /></label>
        <label className="field"><span>STAMP DIBUTUHKAN</span><input name="cost" type="number" min={1} max={1000} step={1} inputMode="numeric" placeholder="40" required /></label>
        <label className="field admin-reward-detail"><span>KETERANGAN (OPSIONAL)</span><input name="detail" maxLength={200} placeholder="mis. 4 kartu penuh" /></label>
        <button className="btn-primary" type="submit" disabled={busy}><span>TAMBAH HADIAH</span><i className="arrow-icon" aria-hidden="true" /></button>
      </form>
      {confirmDialog}
    </div>
  );
}
