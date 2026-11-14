"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useConfirm } from "@/components/ConfirmDialog";
import PhotoCropper from "@/components/PhotoCropper";
import { errorMessage, uploadRewardBlob, type Reward } from "@/lib/content";

type Status = { tone: "ok" | "error"; text: string } | null;
type Crop = { source: Blob; title: string; mode: "new" } | { source: Blob; title: string; mode: "reward"; reward: Reward };
export const STAMP_CARD = 10;

/**
 * "Etalase hadiah": the owner / Admin Umum decide the rewards and how many stamps each costs
 * (10 stamps = 1 full card = free coffee, 40 = 4 cards = merchandise, …). Choosing a member on the
 * stamp desk lets staff redeem a reward — its price is subtracted from the member's stamps.
 * Photos go through PhotoCropper (4:3 frame, pan / zoom / rotate) before they are uploaded.
 */
export default function AdminRewards({ userId, member, onRedeemed }: { userId: string; member: { id: string; name: string; stamps: number } | null; onRedeemed: () => Promise<void> | void }) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  // photo for the "add reward" form: the cropped result + the original (so it can be re-cropped)
  const [newPhoto, setNewPhoto] = useState<{ blob: Blob; url: string; original: Blob } | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  const load = useCallback(async () => {
    const q = (cols: string) => getSupabaseClient().from("rewards").select(cols).order("stamps_cost", { ascending: true }).order("id", { ascending: true });
    let res = await q("id, title, detail, stamps_cost, is_active, created_at, image_url");
    if (res.error) res = await q("id, title, detail, stamps_cost, is_active, created_at"); // photo column not migrated yet
    const { data, error } = res;
    if (error) setStatus({ tone: "error", text: errorMessage(error, "Hadiah gagal dimuat.") });
    else setRewards((data ?? []) as unknown as Reward[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (newPhoto) URL.revokeObjectURL(newPhoto.url); }, [newPhoto]);

  function pickFile(file: File | undefined, next: (file: File) => void) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setStatus({ tone: "error", text: "File harus berupa gambar (JPG, PNG, WebP)." }); return; }
    setStatus(null);
    next(file);
  }

  async function cropDone(blob: Blob) {
    const current = crop;
    setCrop(null);
    if (!current) return;
    if (current.mode === "new") {
      setNewPhoto((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { blob, url: URL.createObjectURL(blob), original: current.source }; });
      return;
    }
    setBusy(true);
    try {
      const url = await uploadRewardBlob(getSupabaseClient(), blob);
      const { error } = await getSupabaseClient().from("rewards").update({ image_url: url }).eq("id", current.reward.id);
      if (error) throw error;
      setStatus({ tone: "ok", text: `Foto "${current.reward.title}" diperbarui.` });
      await load();
    } catch (error) {
      setStatus({ tone: "error", text: errorMessage(error, "Foto gagal diunggah.") });
    }
    setBusy(false);
  }

  // re-crop a photo that is already online
  async function editExisting(reward: Reward) {
    if (!reward.image_url) return;
    setBusy(true);
    try {
      const res = await fetch(reward.image_url, { cache: "no-store" });
      if (!res.ok) throw new Error("Foto lama tidak bisa diambil.");
      setCrop({ source: await res.blob(), title: `Edit foto · ${reward.title}`, mode: "reward", reward });
    } catch (error) {
      setStatus({ tone: "error", text: errorMessage(error, "Foto lama tidak bisa dibuka. Unggah foto baru saja.") });
    }
    setBusy(false);
  }

  async function removePhoto(reward: Reward) {
    const ok = await confirm({ title: `Hapus foto "${reward.title}"?`, message: "Hadiah tetap ada di etalase, hanya fotonya yang dihapus.", confirmLabel: "YA, HAPUS FOTO", tone: "danger" });
    if (!ok) return;
    setBusy(true);
    const { error } = await getSupabaseClient().from("rewards").update({ image_url: null }).eq("id", reward.id);
    setBusy(false);
    if (error) setStatus({ tone: "error", text: errorMessage(error, "Foto gagal dihapus.") });
    else await load();
  }

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
    let image_url: string | null = null;
    if (newPhoto) {
      try { image_url = await uploadRewardBlob(getSupabaseClient(), newPhoto.blob); }
      catch (error) { setBusy(false); setStatus({ tone: "error", text: errorMessage(error, "Foto gagal diunggah.") }); return; }
    }
    const { error } = await getSupabaseClient().from("rewards").insert({ title, detail: detail || null, stamps_cost: cost, created_by: userId, image_url });
    setBusy(false);
    if (error) { setStatus({ tone: "error", text: errorMessage(error, "Hadiah gagal ditambahkan.") }); return; }
    form.reset();
    setNewPhoto(null);
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
                {reward.image_url && <img className="reward-photo" src={reward.image_url} alt="" loading="lazy" />}
                <span className="admin-reward-cost"><b>{reward.stamps_cost}</b>stamp</span>
                <strong>{reward.title}{!reward.is_active && <em>NONAKTIF</em>}</strong>
                {reward.detail && <small>{reward.detail}</small>}
                <small className="admin-reward-cards">{Number.isInteger(cards) ? `${cards} kartu penuh` : `${cards.toFixed(1)} kartu`}</small>
                <button type="button" className="admin-use-id admin-use-redeem" disabled={busy || !enough || !reward.is_active} onClick={() => redeem(reward)}>
                  {!member ? "PILIH MEMBER" : !reward.is_active ? "NONAKTIF" : enough ? "TUKAR" : `KURANG ${reward.stamps_cost - member.stamps}`}
                </button>
                <span className="admin-reward-tools">
                  <label className={`reward-upload${busy ? " is-disabled" : ""}`}>{reward.image_url ? "Ganti foto" : "Tambah foto"}<input type="file" accept="image/*" hidden disabled={busy} onChange={(event) => { pickFile(event.target.files?.[0], (file) => setCrop({ source: file, title: `Foto · ${reward.title}`, mode: "reward", reward })); event.target.value = ""; }} /></label>
                  {reward.image_url && <button type="button" disabled={busy} onClick={() => editExisting(reward)}>Edit foto</button>}
                  {reward.image_url && <button type="button" disabled={busy} onClick={() => removePhoto(reward)}>Hapus foto</button>}
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
        <div className="field admin-reward-detail">
          <span>FOTO HADIAH (OPSIONAL)</span>
          {newPhoto ? (
            <div className="reward-new-photo">
              <img src={newPhoto.url} alt="Pratinjau foto hadiah" />
              <span>
                <button type="button" onClick={() => setCrop({ source: newPhoto.original, title: "Atur ulang foto", mode: "new" })}>Atur ulang</button>
                <label className="reward-upload">Pilih foto lain<input type="file" accept="image/*" hidden onChange={(event) => { pickFile(event.target.files?.[0], (file) => setCrop({ source: file, title: "Atur foto", mode: "new" })); event.target.value = ""; }} /></label>
                <button type="button" onClick={() => setNewPhoto(null)}>Hapus</button>
              </span>
            </div>
          ) : (
            <input type="file" accept="image/*" onChange={(event) => { pickFile(event.target.files?.[0], (file) => setCrop({ source: file, title: "Atur foto", mode: "new" })); event.target.value = ""; }} />
          )}
          <small className="field-hint">Setelah memilih foto kamu bisa geser, zoom, dan putar. Foto dipotong 4:3 dan disimpan maks. 800px.</small>
        </div>
        <button className="btn-primary" type="submit" disabled={busy}><span>TAMBAH HADIAH</span><i className="arrow-icon" aria-hidden="true" /></button>
      </form>
      {crop && <PhotoCropper file={crop.source} title={crop.title} onCancel={() => setCrop(null)} onDone={cropDone} />}
      {confirmDialog}
    </div>
  );
}
