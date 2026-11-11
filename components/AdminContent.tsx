"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useConfirm } from "@/components/ConfirmDialog";
import { formatPhone } from "@/lib/phone";
import { errorMessage, formatDateId, type CafeEvent, type Promo, type Voucher, type VoucherGrant } from "@/lib/content";

type MemberLite = { id: string; full_name: string | null; phone: string | null; role: string };
type Tab = "voucher" | "promo" | "event";
type Status = { tone: "ok" | "error"; text: string } | null;
// How a voucher is handed out: to chosen members (multiple choice, incl. "select all") or to N random members.
type GiveMode = "pick" | "random";

const memberName = (member: MemberLite) => member.full_name || (member.phone ? formatPhone(member.phone) : member.id.slice(0, 8));

/**
 * Admin panel → "Konten": vouchers (given to chosen or random members), monthly promos and monthly events.
 * Everything here is what members see on /profile.
 */
export default function AdminContent({ members, userId }: { members: MemberLite[]; userId: string }) {
  const [tab, setTab] = useState<Tab>("voucher");
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [events, setEvents] = useState<CafeEvent[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [grants, setGrants] = useState<VoucherGrant[]>([]);
  const [confirm, confirmDialog] = useConfirm();

  // voucher giving UI
  const [giveFor, setGiveFor] = useState<number | null>(null);
  const [giveMode, setGiveMode] = useState<GiveMode>("pick");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pickQuery, setPickQuery] = useState("");
  const [randomCount, setRandomCount] = useState(1);
  const [holdersFor, setHoldersFor] = useState<number | null>(null);

  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const load = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const [p, e, v, g] = await Promise.all([
        supabase.from("promos").select("*").order("created_at", { ascending: false }),
        supabase.from("events").select("*").order("event_date", { ascending: true }),
        supabase.from("vouchers").select("*").order("created_at", { ascending: false }),
        supabase.from("member_vouchers").select("id, voucher_id, member_id, status, granted_at, used_at").order("granted_at", { ascending: false }),
      ]);
      const failed = p.error || e.error || v.error || g.error;
      if (failed) throw failed;
      setPromos((p.data ?? []) as Promo[]);
      setEvents((e.data ?? []) as CafeEvent[]);
      setVouchers((v.data ?? []) as Voucher[]);
      setGrants((g.data ?? []) as VoucherGrant[]);
    } catch (error) {
      setStatus({ tone: "error", text: errorMessage(error, "Konten gagal dimuat.") });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Run a write, then reload. Shows the success text (or the error) in the status line.
  async function run(action: () => PromiseLike<{ error: unknown }>, okText: string, fallback: string) {
    setBusy(true);
    setStatus(null);
    try {
      const { error } = await action();
      if (error) throw error;
      setStatus({ tone: "ok", text: okText });
      await load();
      return true;
    } catch (error) {
      setStatus({ tone: "error", text: errorMessage(error, fallback) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
  const optional = (value: string) => value || null;

  async function addVoucher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const ok = await run(
      () => getSupabaseClient().from("vouchers").insert({ title: text(data, "title"), detail: optional(text(data, "detail")), expires_at: optional(text(data, "date")), created_by: userId }),
      "Voucher dibuat. Tekan BERI untuk memberikannya ke member.",
      "Voucher gagal dibuat.",
    );
    if (ok) form.reset();
  }

  async function addPromo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const ok = await run(
      () => getSupabaseClient().from("promos").insert({ title: text(data, "title"), detail: optional(text(data, "detail")), badge: optional(text(data, "badge").toUpperCase()), valid_until: optional(text(data, "date")), created_by: userId }),
      "Promo ditambahkan dan langsung tampil di profil member.",
      "Promo gagal ditambahkan.",
    );
    if (ok) form.reset();
  }

  async function addEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const ok = await run(
      () => getSupabaseClient().from("events").insert({ title: text(data, "title"), detail: optional(text(data, "detail")), event_date: text(data, "date"), time_text: optional(text(data, "time")), created_by: userId }),
      "Acara ditambahkan dan langsung tampil di profil member.",
      "Acara gagal ditambahkan.",
    );
    if (ok) form.reset();
  }

  const toggleActive = (table: "promos" | "events" | "vouchers", id: number, next: boolean) =>
    run(() => getSupabaseClient().from(table).update({ is_active: next }).eq("id", id), next ? "Diaktifkan." : "Dinonaktifkan — tidak tampil lagi untuk member.", "Gagal mengubah status.");

  async function remove(table: "promos" | "events" | "vouchers", id: number, label: string) {
    const ok = await confirm({
      title: `Hapus “${label}”?`,
      message: table === "vouchers" ? "Voucher ini juga hilang dari semua member yang sudah menerimanya." : "Item ini tidak akan tampil lagi di profil member.",
      confirmLabel: "YA, HAPUS",
      tone: "danger",
    });
    if (!ok) return;
    await run(() => getSupabaseClient().from(table).delete().eq("id", id), "Dihapus.", "Gagal menghapus.");
  }

  function openGive(voucherId: number) {
    setGiveFor((current) => (current === voucherId ? null : voucherId));
    setGiveMode("pick");
    setPicked(new Set());
    setPickQuery("");
    setRandomCount(1);
  }

  const holdersOf = (voucherId: number) => new Set(grants.filter((grant) => grant.voucher_id === voucherId).map((grant) => grant.member_id));

  async function giveToPicked(voucherId: number) {
    const ids = [...picked];
    if (ids.length === 0) return setStatus({ tone: "error", text: "Pilih minimal 1 member." });
    const supabase = getSupabaseClient();
    setBusy(true);
    setStatus(null);
    try {
      const { data, error } = await supabase.rpc("grant_voucher", { p_voucher_id: voucherId, p_member_ids: ids });
      if (error) throw error;
      const granted = Number(data ?? 0);
      setStatus({ tone: "ok", text: `${granted} member menerima voucher.${granted < ids.length ? ` ${ids.length - granted} lainnya sudah punya.` : ""}` });
      setGiveFor(null);
      setPicked(new Set());
      await load();
    } catch (error) {
      setStatus({ tone: "error", text: errorMessage(error, "Voucher gagal diberikan.") });
    } finally {
      setBusy(false);
    }
  }

  async function giveRandom(voucherId: number, eligible: number) {
    const count = Math.min(Math.max(1, Math.floor(randomCount) || 1), 500);
    const ok = await confirm({
      title: `Beri voucher ke ${Math.min(count, eligible)} member acak?`,
      message: <>Dipilih acak dari member yang belum punya voucher ini ({eligible} member memenuhi syarat). Staff/admin tidak ikut diacak.</>,
      confirmLabel: "YA, ACAK & BERI",
    });
    if (!ok) return;
    setBusy(true);
    setStatus(null);
    try {
      const { data, error } = await getSupabaseClient().rpc("grant_voucher_random", { p_voucher_id: voucherId, p_count: count });
      if (error) throw error;
      const granted = Number(data ?? 0);
      setStatus({ tone: granted > 0 ? "ok" : "error", text: granted > 0 ? `${granted} member terpilih acak dan menerima voucher.` : "Tidak ada member yang memenuhi syarat." });
      setGiveFor(null);
      await load();
    } catch (error) {
      setStatus({ tone: "error", text: errorMessage(error, "Pemberian acak gagal.") });
    } finally {
      setBusy(false);
    }
  }

  const markUsed = (grantId: number) => run(() => getSupabaseClient().rpc("use_member_voucher", { p_member_voucher_id: grantId }), "Voucher ditandai terpakai.", "Gagal menandai voucher.");

  const togglePick = (id: string) => setPicked((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const changeGiveMode = (mode: GiveMode) => {
    setGiveMode(mode);
    setPicked(new Set());
  };

  const tabs: [Tab, string, number][] = [["voucher", "Voucher", vouchers.length], ["promo", "Promo", promos.length], ["event", "Acara", events.length]];

  return (
    <div className="admin-panel card admin-content-card">
      <div className="card-topline"><span>KONTEN PROFIL</span><span>TAMPIL DI HALAMAN MEMBER</span></div>
      <div className="admin-tabs is-three" role="tablist" aria-label="Jenis konten">
        {tabs.map(([value, label, count]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? "is-active" : ""} onClick={() => { setTab(value); setStatus(null); }}>{label} <span>{count}</span></button>
        ))}
      </div>
      {status && <p className={`notice admin-list-status${status.tone === "error" ? " notice-error" : ""}`} role={status.tone === "error" ? "alert" : "status"}>{status.text}</p>}

      {tab === "voucher" && (
        <div className="admin-tabpanel">
          <p className="admin-content-hint"><b>Rewards &amp; Voucher</b> — buat voucher, lalu kirim ke <b>member</b> pilihanmu (boleh lebih dari satu, ada pilih semua) atau ke <b>member acak</b>.</p>
          <form className="admin-content-form" onSubmit={addVoucher}>
            <label className="field"><span>NAMA VOUCHER / REWARD</span><input name="title" required maxLength={80} placeholder="Contoh: Gratis 1 Es Kopi Susu" /></label>
            <label className="field"><span>KETERANGAN (OPSIONAL)</span><textarea name="detail" maxLength={300} rows={2} placeholder="Syarat & ketentuan singkat" /></label>
            <label className="field"><span>BERLAKU SAMPAI (OPSIONAL)</span><input name="date" type="date" /></label>
            <button className="btn-primary" type="submit" disabled={busy}><span>{busy ? "MENYIMPAN..." : "BUAT VOUCHER"}</span><i className="arrow-icon" aria-hidden="true" /></button>
          </form>

          {loading ? <p className="admin-empty">Memuat…</p> : vouchers.length === 0 ? <p className="admin-empty">Belum ada voucher.</p> : (
            <ul className="admin-content-list">
              {vouchers.map((voucher) => {
                const mine = grants.filter((grant) => grant.voucher_id === voucher.id);
                const used = mine.filter((grant) => grant.status === "used").length;
                const holders = holdersOf(voucher.id);
                const eligible = members.filter((member) => member.role === "member" && !holders.has(member.id)).length;
                const q = pickQuery.trim().toLowerCase();
                const qDigits = q.replace(/\D/g, "");
                const qPhone = qDigits.startsWith("0") ? `62${qDigits.slice(1)}` : qDigits;
                const candidates = members.filter((member) => !q || (member.full_name ?? "").toLowerCase().includes(q) || (qDigits.length >= 4 && (member.phone ?? "").includes(qPhone)));
                // "Pilih semua" applies to what is currently listed (respects the search) and skips members who already hold this voucher.
                const selectable = candidates.filter((member) => !holders.has(member.id));
                const allPicked = selectable.length > 0 && selectable.every((member) => picked.has(member.id));
                return (
                  <li key={voucher.id} className={voucher.is_active ? "" : "is-off"}>
                    <div className="admin-content-row">
                      <div className="admin-content-info">
                        <strong>{voucher.title}{!voucher.is_active && <em>NONAKTIF</em>}</strong>
                        {voucher.detail && <small>{voucher.detail}</small>}
                        <span>{voucher.expires_at ? `Berlaku sampai ${formatDateId(voucher.expires_at)}` : "Tanpa batas waktu"} · {mine.length} penerima · {used} terpakai</span>
                      </div>
                      <div className="admin-content-actions">
                        <button type="button" className="admin-use-id" disabled={busy || !voucher.is_active} onClick={() => openGive(voucher.id)} aria-expanded={giveFor === voucher.id}>BERI</button>
                        <button type="button" className="admin-use-id" disabled={busy} onClick={() => toggleActive("vouchers", voucher.id, !voucher.is_active)}>{voucher.is_active ? "NONAKTIFKAN" : "AKTIFKAN"}</button>
                        <button type="button" className="admin-use-id admin-use-danger" disabled={busy} onClick={() => remove("vouchers", voucher.id, voucher.title)}>HAPUS</button>
                      </div>
                    </div>

                    {giveFor === voucher.id && (
                      <div className="admin-give">
                        <div className="admin-chips" role="group" aria-label="Cara memberi">
                          <button type="button" className={giveMode === "pick" ? "is-active" : ""} aria-pressed={giveMode === "pick"} onClick={() => changeGiveMode("pick")}>Member</button>
                          <button type="button" className={giveMode === "random" ? "is-active" : ""} aria-pressed={giveMode === "random"} onClick={() => changeGiveMode("random")}>Acak</button>
                        </div>
                        {giveMode === "pick" ? (
                          <>
                            <label className="field admin-search"><span className="sr-only">Cari member</span><input type="search" value={pickQuery} onChange={(event) => setPickQuery(event.target.value)} placeholder="Cari nama atau nomor HP" /></label>
                            <div className="admin-pick-bar">
                              <button
                                type="button"
                                className="admin-pick-all"
                                disabled={selectable.length === 0}
                                onClick={() => setPicked((current) => {
                                  const next = new Set(current);
                                  for (const member of selectable) { if (allPicked) next.delete(member.id); else next.add(member.id); }
                                  return next;
                                })}
                              >{allPicked ? "BATAL PILIH SEMUA" : `PILIH SEMUA (${selectable.length})`}</button>
                              <span>{picked.size} dipilih</span>
                            </div>
                            <ul className="admin-pick-list">
                              {candidates.length === 0 && <li className="admin-empty">Tidak ada member yang cocok.</li>}
                              {candidates.map((member) => {
                                const has = holders.has(member.id);
                                return (
                                  <li key={member.id}>
                                    <label className={has ? "is-has" : ""}>
                                      <input type="checkbox" checked={picked.has(member.id)} disabled={has} onChange={() => togglePick(member.id)} />
                                      <span><b>{memberName(member)}</b>{member.phone && member.full_name ? <small>{formatPhone(member.phone)}</small> : null}</span>
                                      {has && <em>SUDAH PUNYA</em>}
                                    </label>
                                  </li>
                                );
                              })}
                            </ul>
                            <button type="button" className="btn-primary" disabled={busy || picked.size === 0} onClick={() => giveToPicked(voucher.id)}><span>{picked.size === 0 ? "PILIH MEMBER DULU" : `BERI KE ${picked.size} MEMBER`}</span><i className="arrow-icon" aria-hidden="true" /></button>
                          </>
                        ) : (
                          <>
                            <label className="field"><span>JUMLAH MEMBER ACAK (MAKS. {eligible})</span><input type="number" min={1} max={Math.max(eligible, 1)} value={randomCount} onChange={(event) => setRandomCount(Number(event.target.value))} /></label>
                            <p className="admin-content-hint">Dipilih acak dari {eligible} member yang belum punya voucher ini.</p>
                            <button type="button" className="btn-primary" disabled={busy || eligible === 0} onClick={() => giveRandom(voucher.id, eligible)}><span>{eligible === 0 ? "TIDAK ADA MEMBER TERSISA" : "ACAK & BERI"}</span><i className="arrow-icon" aria-hidden="true" /></button>
                          </>
                        )}
                      </div>
                    )}

                    {mine.length > 0 && (
                      <>
                        <button type="button" className="admin-holders-toggle" aria-expanded={holdersFor === voucher.id} onClick={() => setHoldersFor((current) => (current === voucher.id ? null : voucher.id))}>{holdersFor === voucher.id ? "Sembunyikan penerima" : `Lihat penerima (${mine.length})`}</button>
                        {holdersFor === voucher.id && (
                          <ul className="admin-holders">
                            {mine.map((grant) => {
                              const member = memberById.get(grant.member_id);
                              return (
                                <li key={grant.id}>
                                  <span>{member ? memberName(member) : grant.member_id.slice(0, 8)}</span>
                                  {grant.status === "used" ? <em className="is-used">TERPAKAI</em> : <button type="button" className="admin-use-id" disabled={busy} onClick={() => markUsed(grant.id)}>TANDAI TERPAKAI</button>}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === "promo" && (
        <div className="admin-tabpanel">
          <p className="admin-content-hint"><b>This Month&rsquo;s Promo</b> — tampil untuk semua member yang login. Promo yang lewat tanggal berlaku otomatis disembunyikan.</p>
          <form className="admin-content-form" onSubmit={addPromo}>
            <label className="field"><span>JUDUL PROMO</span><input name="title" required maxLength={80} placeholder="Contoh: Beli 2 Gratis 1" /></label>
            <label className="field"><span>KETERANGAN</span><textarea name="detail" maxLength={300} rows={2} placeholder="Detail promo" /></label>
            <div className="admin-content-two">
              <label className="field"><span>LABEL (OPSIONAL)</span><input name="badge" maxLength={16} placeholder="NEW / HOT" /></label>
              <label className="field"><span>BERLAKU SAMPAI</span><input name="date" type="date" /></label>
            </div>
            <button className="btn-primary" type="submit" disabled={busy}><span>{busy ? "MENYIMPAN..." : "TAMBAH PROMO"}</span><i className="arrow-icon" aria-hidden="true" /></button>
          </form>
          {loading ? <p className="admin-empty">Memuat…</p> : promos.length === 0 ? <p className="admin-empty">Belum ada promo.</p> : (
            <ul className="admin-content-list">
              {promos.map((promo) => (
                <li key={promo.id} className={promo.is_active ? "" : "is-off"}>
                  <div className="admin-content-row">
                    <div className="admin-content-info">
                      <strong>{promo.title}{promo.badge && <em>{promo.badge}</em>}{!promo.is_active && <em>NONAKTIF</em>}</strong>
                      {promo.detail && <small>{promo.detail}</small>}
                      <span>{promo.valid_until ? `Berlaku sampai ${formatDateId(promo.valid_until)}` : "Tanpa batas waktu"}</span>
                    </div>
                    <div className="admin-content-actions">
                      <button type="button" className="admin-use-id" disabled={busy} onClick={() => toggleActive("promos", promo.id, !promo.is_active)}>{promo.is_active ? "NONAKTIFKAN" : "AKTIFKAN"}</button>
                      <button type="button" className="admin-use-id admin-use-danger" disabled={busy} onClick={() => remove("promos", promo.id, promo.title)}>HAPUS</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "event" && (
        <div className="admin-tabpanel">
          <p className="admin-content-hint"><b>What&rsquo;s Happening This Month</b> — tampil untuk semua member yang login, hanya acara bulan berjalan yang belum lewat.</p>
          <form className="admin-content-form" onSubmit={addEvent}>
            <label className="field"><span>NAMA ACARA</span><input name="title" required maxLength={80} placeholder="Contoh: Pokémon TCG Night" /></label>
            <label className="field"><span>KETERANGAN</span><textarea name="detail" maxLength={300} rows={2} placeholder="Detail acara" /></label>
            <div className="admin-content-two">
              <label className="field"><span>TANGGAL</span><input name="date" type="date" required /></label>
              <label className="field"><span>JAM (OPSIONAL)</span><input name="time" maxLength={30} placeholder="19.00 WIB" /></label>
            </div>
            <button className="btn-primary" type="submit" disabled={busy}><span>{busy ? "MENYIMPAN..." : "TAMBAH ACARA"}</span><i className="arrow-icon" aria-hidden="true" /></button>
          </form>
          {loading ? <p className="admin-empty">Memuat…</p> : events.length === 0 ? <p className="admin-empty">Belum ada acara.</p> : (
            <ul className="admin-content-list">
              {events.map((item) => (
                <li key={item.id} className={item.is_active ? "" : "is-off"}>
                  <div className="admin-content-row">
                    <div className="admin-content-info">
                      <strong>{item.title}{!item.is_active && <em>NONAKTIF</em>}</strong>
                      {item.detail && <small>{item.detail}</small>}
                      <span>{formatDateId(item.event_date)}{item.time_text ? ` · ${item.time_text}` : ""}</span>
                    </div>
                    <div className="admin-content-actions">
                      <button type="button" className="admin-use-id" disabled={busy} onClick={() => toggleActive("events", item.id, !item.is_active)}>{item.is_active ? "NONAKTIFKAN" : "AKTIFKAN"}</button>
                      <button type="button" className="admin-use-id admin-use-danger" disabled={busy} onClick={() => remove("events", item.id, item.title)}>HAPUS</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
