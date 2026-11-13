"use client";

import { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import { PageHeader } from "@/components/PageShell";
import QrScanner from "@/components/QrScanner";
import { useConfirm } from "@/components/ConfirmDialog";
import MultiDatePicker, { dayKey } from "@/components/MultiDatePicker";
import AdminContent from "@/components/AdminContent";
import AdminRewards from "@/components/AdminRewards";
import VoucherScan from "@/components/VoucherScan";
import { VOUCHER_QR_PREFIX } from "@/lib/content";
import { formatPhone } from "@/lib/phone";
import { assignableRoles, canEditRoleOf, canManageCoffee, canManageStore, isAdminUp, isStaff, roleLabel, type Role } from "@/lib/roles";

type Member = { id: string; full_name: string | null; phone: string | null; stamps: number; role: string; approved: boolean; created_at: string };
type StampLog = { id: number; created_at: string; action: "add" | "redeem"; amount: number; stamps_before: number; stamps_after: number; member_id: string; member_name: string | null; admin_id: string | null; admin_name: string | null; reward_title: string | null };
type Status = { tone: "ok" | "error"; text: string } | null;
type Scanned = { id: string; full_name: string | null; stamps: number; approved: boolean };
type LogFilter = "all" | "add" | "redeem";

const STAMP_GOAL = 10;
const MEMBER_FIELDS = "id, full_name, phone, stamps, role, approved, created_at";
const LOG_FIELDS = "id, created_at, action, amount, stamps_before, stamps_after, member_id, member_name, admin_id, admin_name, reward_title";
const LOG_PAGE = 15;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const errorText = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "";
  if (/stamp_logs|award_stamps|redeem_reward|rewards|scan_member|scan_voucher|reward_title|is_admin_up|set_member_role|can_manage|profiles\.phone|column .*phone/.test(message) && /does not exist|not find|schema cache/i.test(message)) {
    return "Fitur ini butuh update database. Jalankan supabase/profiles.sql di Supabase SQL Editor, lalu refresh.";
  }
  return message || fallback;
};
const formatDateTime = (value: string) => new Date(value).toLocaleString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const localDay = dayKey;
const startOfKey = (key: string) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d); };

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [logs, setLogs] = useState<StampLog[]>([]);
  const [logsError, setLogsError] = useState("");
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState(1);
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [voucherScan, setVoucherScan] = useState<{ id: number; nonce: number } | null>(null);
  const [query, setQuery] = useState("");
  const [logFilter, setLogFilter] = useState<LogFilter>("all");
  const [logDays, setLogDays] = useState<string[]>([]);
  const [logsVersion, setLogsVersion] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [todayLogs, setTodayLogs] = useState<StampLog[]>([]);
  const [role, setRole] = useState<Role>("member");
  const [section, setSection] = useState<"coffee" | "store">("coffee");
  const [listStatus, setListStatus] = useState<Status>(null);
  const [tab, setTab] = useState<"members" | "logs">("members");
  const memberListRef = useRef<HTMLUListElement>(null);
  const [logLimit, setLogLimit] = useState(LOG_PAGE);
  const closeScanner = useCallback(() => setScannerOpen(false), []);
  const [confirm, confirmDialog] = useConfirm();

  const [scanned, setScanned] = useState<Scanned | null>(null);
  const listed = members.find((member) => member.id === memberId.trim());
  const selected: { id: string; full_name: string | null; stamps: number } | undefined = listed ?? (scanned && scanned.id === memberId.trim() ? scanned : undefined);
  // Stamps keep stacking: the card shows the current round (a full card stays 10/10 until the next stamp).
  const selectedStamps = selected?.stamps ?? 0;
  const selectedOnCard = selectedStamps > 0 && selectedStamps % STAMP_GOAL === 0 ? STAMP_GOAL : selectedStamps % STAMP_GOAL;
  const adminUp = isAdminUp(role);

  const refresh = useCallback(async () => {
    const supabase = getSupabaseClient();
    const midnight = startOfKey(dayKey(new Date()));
    const [membersResult, todayResult] = await Promise.all([
      supabase.from("profiles").select(MEMBER_FIELDS).order("created_at", { ascending: false }),
      supabase.from("stamp_logs").select(LOG_FIELDS).gte("created_at", midnight.toISOString()).order("created_at", { ascending: false }),
    ]);
    if (membersResult.error) throw new Error(membersResult.error.message);
    setMembers((membersResult.data ?? []) as Member[]);
    if (!todayResult.error) setTodayLogs((todayResult.data ?? []) as StampLog[]);
    setLogsVersion((value) => value + 1);
  }, []);

  // Admin Coffee cannot list members, so a scanned / pasted member ID is looked up through scan_member.
  useEffect(() => {
    const id = memberId.trim();
    if (!user || !UUID_PATTERN.test(id) || members.some((member) => member.id === id)) return;
    let active = true;
    getSupabaseClient().rpc("scan_member", { p_member_id: id }).then(({ data, error }) => {
      if (!active) return;
      if (error || !data) setScanned(null);
      else setScanned(data as Scanned);
    });
    return () => { active = false; };
  }, [memberId, user, members]);

  // Stamp history: latest 300 by default, or everything inside the picked dates.
  useEffect(() => {
    if (!user || !isAdminUp(role)) return;
    let active = true;
    (async () => {
      setLogsLoading(true);
      let request = getSupabaseClient().from("stamp_logs").select(LOG_FIELDS).order("created_at", { ascending: false });
      if (logDays.length) {
        const sorted = [...logDays].sort();
        const from = startOfKey(sorted[0]);
        const to = startOfKey(sorted[sorted.length - 1]);
        to.setDate(to.getDate() + 1);
        request = request.gte("created_at", from.toISOString()).lt("created_at", to.toISOString()).limit(5000);
      } else {
        request = request.limit(300);
      }
      const { data, error } = await request;
      if (!active) return;
      if (error) setLogsError(errorText(error, "Riwayat gagal dimuat."));
      else { setLogsError(""); setLogs((data ?? []) as StampLog[]); }
      setLogsLoading(false);
    })();
    return () => { active = false; };
  }, [user, role, logDays, logsVersion]);

  useEffect(() => {
    let active = true;
    const pause = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
    async function load() {
      try {
        const supabase = getSupabaseClient();
        let authUser: User | null = null;
        for (let attempt = 0; attempt < 3 && !authUser; attempt += 1) {
          const { data: sessionData } = await supabase.auth.getSession();
          authUser = sessionData.session?.user ?? null;
          if (!authUser) {
            const { data: authData } = await supabase.auth.getUser();
            authUser = authData.user ?? null;
          }
          if (!authUser) await pause(350);
        }
        if (!authUser) {
          window.location.href = "/login";
          return;
        }
        let current: { role: string } | null = null;
        let profileError: Error | null = null;
        for (let attempt = 0; attempt < 3 && !current; attempt += 1) {
          const result = await supabase.from("profiles").select("role").eq("id", authUser.id).maybeSingle();
          if (result.error) profileError = new Error(result.error.message);
          current = result.data;
          if (!current) await pause(350);
        }
        if (profileError && !current) throw profileError;
        if (!current) {
          if (active) setStatus({ tone: "error", text: "Profile akun belum siap. Jalankan trigger profiles di Supabase, lalu refresh." });
          return;
        }
        if (!isStaff(current.role)) {
          window.location.href = "/profile";
          return;
        }
        if (!active) return;
        setRole(current.role as Role);
        setSection(canManageCoffee(current.role) ? "coffee" : "store");
        setUser(authUser);
        if (isAdminUp(current.role)) await refresh();
      } catch (error) {
        if (active) setStatus({ tone: "error", text: errorText(error, "Gagal membuka admin panel.") });
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => { setLogLimit(LOG_PAGE); }, [logFilter, logDays]);

  function chooseMember(id: string, message?: string) {
    setMemberId(id);
    setAmount(1);
    setStatus(message ? { tone: "ok", text: message } : null);
    document.getElementById("stamp-desk")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleScan(text: string) {
    setScannerOpen(false);
    if (text.startsWith(VOUCHER_QR_PREFIX)) {
      const id = Number(text.slice(VOUCHER_QR_PREFIX.length));
      if (Number.isInteger(id) && id > 0) { setVoucherScan({ id, nonce: Date.now() }); return; }
    }
    if (!UUID_PATTERN.test(text)) {
      setStatus({ tone: "error", text: "QR ini bukan QR member Coffe Loca. Minta member membuka kartu di halaman Profile." });
      return;
    }
    chooseMember(text, "QR member terbaca. Pilih jumlah stamp.");
  }

  async function awardStamps(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const target = memberId.trim();
    if (!target) {
      setStatus({ tone: "error", text: "Scan QR atau masukkan member ID terlebih dahulu." });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await getSupabaseClient().rpc("award_stamps", { target_user_id: target, amount });
      if (error) throw error;
      const log = data as StampLog;
      const name = log?.member_name || selected?.full_name || "member";
      setStatus({ tone: "ok", text: `+${log?.amount ?? amount} stamp untuk ${name}. Total sekarang ${log?.stamps_after ?? "?"} stamp.` });
      if (log) setScanned((current) => (current && current.id === log.member_id ? { ...current, stamps: log.stamps_after } : current));
      setAmount(1);
      await refresh();
    } catch (error) {
      setStatus({ tone: "error", text: errorText(error, "Stamp gagal ditambahkan.") });
    } finally {
      setSubmitting(false);
    }
  }

  async function changeRole(member: Member, nextRole: Role) {
    if (nextRole === member.role) return;
    const ok = await confirm({
      title: `Ubah role ${member.full_name || "member"}?`,
      message: <>Dari <b>{roleLabel(member.role)}</b> menjadi <b>{roleLabel(nextRole)}</b>.{nextRole === "owner" ? " Owner punya akses penuh, termasuk mengatur semua role." : ""}</>,
      confirmLabel: "YA, UBAH ROLE",
      tone: nextRole === "owner" || nextRole === "admin" ? "danger" : "default",
    });
    if (!ok) return;
    setListStatus(null);
    try {
      const { error } = await getSupabaseClient().rpc("set_member_role", { target_user_id: member.id, new_role: nextRole });
      if (error) throw error;
      setListStatus({ tone: "ok", text: `${member.full_name || "Member"} sekarang ${roleLabel(nextRole)}.` });
      await refresh();
    } catch (error) {
      setListStatus({ tone: "error", text: errorText(error, "Role gagal diubah.") });
    }
  }

  async function setApproval(member: Member, approve: boolean) {
    const ok = await confirm({
      title: approve ? `Verifikasi ${member.full_name || "member"}?` : `Cabut verifikasi ${member.full_name || "member"}?`,
      message: approve ? "Akun ini akan aktif dan bisa memakai kartu member, voucher, dan promo." : "Akun ini kembali ke status menunggu verifikasi.",
      confirmLabel: approve ? "YA, VERIFIKASI" : "YA, CABUT",
      tone: approve ? "default" : "danger",
    });
    if (!ok) return;
    setListStatus(null);
    try {
      const { error } = await getSupabaseClient().rpc("set_member_approval", { target_user_id: member.id, is_approved: approve });
      if (error) throw error;
      setListStatus({ tone: "ok", text: approve ? `${member.full_name || "Member"} sudah diverifikasi.` : `Verifikasi ${member.full_name || "member"} dicabut.` });
      await refresh();
    } catch (error) {
      setListStatus({ tone: "error", text: errorText(error, "Verifikasi gagal diubah.") });
    }
  }

  // Members still waiting for verification only appear in the "Verifikasi member" card, not in the lists below.
  const verifiedMembers = useMemo(() => members.filter((member) => member.role !== "member" || member.approved), [members]);
  const pendingMembers = useMemo(() => members.filter((member) => member.role === "member" && !member.approved).sort((a, b) => a.created_at.localeCompare(b.created_at)), [members]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    // Phone search accepts 0812…, 812… or 62812…
    const qPhone = qDigits.startsWith("0") ? `62${qDigits.slice(1)}` : qDigits;
    const list = q ? verifiedMembers.filter((member) => (member.full_name ?? "").toLowerCase().includes(q) || member.id.toLowerCase().includes(q) || (qDigits.length >= 4 && (member.phone ?? "").includes(qPhone))) : verifiedMembers;
    return [...list].sort((a, b) => Number(b.stamps >= STAMP_GOAL) - Number(a.stamps >= STAMP_GOAL));
  }, [verifiedMembers, query]);
  // Show exactly 5 member rows and scroll the rest. Rows differ in height (the Owner sees a role select), so measure them.
  useLayoutEffect(() => {
    const list = memberListRef.current;
    if (!list) return;
    const fit = () => {
      if (list.offsetParent === null) return; // tab hidden → nothing to measure
      const rows = Array.from(list.children).slice(0, 5) as HTMLElement[];
      list.style.maxHeight = rows.length >= 5 ? `${rows.reduce((sum, row) => sum + row.offsetHeight, 0)}px` : "";
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [filtered, role, tab, loading]);
  const logDaySet = useMemo(() => new Set(logDays), [logDays]);
  const visibleLogs = useMemo(() => logs.filter((log) => (logFilter === "all" || log.action === logFilter) && (!logDaySet.size || logDaySet.has(localDay(log.created_at)))), [logs, logFilter, logDaySet]);
  const activeDays = useMemo(() => new Set([...logs, ...todayLogs].map((log) => localDay(log.created_at))), [logs, todayLogs]);
  const readyForReward = verifiedMembers.filter((member) => member.stamps >= STAMP_GOAL).length;
  const stampsToday = todayLogs.filter((log) => log.action === "add").reduce((sum, log) => sum + log.amount, 0);
  const redeemedToday = todayLogs.filter((log) => log.action === "redeem").length;

  return (
    <main className="page-shell admin-page">
      <PageHeader backHref="/profile" backLabel="KE PROFILE" />
      <section className="admin-layout">
        <div className="admin-heading page-heading">
          <span className="eyebrow"><i /> PRIVATE / ADMIN ACCESS</span>
          <h1>{section === "store" ? <>Store<br /><em>control.</em></> : <>Member<br /><em>control.</em></>}</h1>
          <p>{section === "store" ? "Kelola produk dan pesanan Loca Store." : adminUp ? "Kelola stamp, hadiah, voucher, promo, dan acara Coffe Loca dari satu ruang." : "Scan kartu stamp dan voucher member di kasir."}</p>
          <span className="admin-role">{user ? <>MASUK SEBAGAI {(user.user_metadata?.full_name || user.email || "STAFF").toUpperCase()} <b>{roleLabel(role).toUpperCase()}</b></> : "AUTHORIZED STAFF ONLY"}</span>
          {section === "coffee" && adminUp && <dl className="admin-stats">
            <div><dt>MEMBER</dt><dd>{loading ? "—" : verifiedMembers.length}</dd></div>
            <div><dt>STAMP HARI INI</dt><dd>{loading ? "—" : stampsToday}</dd></div>
            <div><dt>MIN. 10 STAMP</dt><dd>{loading ? "—" : readyForReward}</dd></div>
          </dl>}
          {section === "coffee" && adminUp && redeemedToday > 0 && <p className="admin-today">☕ {redeemedToday} hadiah ditukar hari ini.</p>}
        </div>

        <div className="admin-content">
          {user && (
            <div className="admin-sections" role="tablist" aria-label="Area admin">
              {canManageCoffee(role) && <button type="button" role="tab" aria-selected={section === "coffee"} className={section === "coffee" ? "is-active" : ""} onClick={() => setSection("coffee")}><span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c0 1 1 1.5 1 2.5M11.5 3.5c0 1 1 1.5 1 2.5" /></svg></span><span><strong>Coffee</strong><small>{adminUp ? "Stamp, hadiah, voucher & member" : "Scan stamp & voucher"}</small></span></button>}
              {canManageStore(role) && <button type="button" role="tab" aria-selected={section === "store"} className={section === "store" ? "is-active" : ""} onClick={() => setSection("store")}><span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2" /></svg></span><span><strong>Store</strong><small>Produk &amp; pesanan</small></span></button>}
            </div>
          )}

          {section === "store" && user && (
            <div className="admin-store card">
              <div className="card-topline"><span>LOCA STORE</span><span>SEGERA HADIR</span></div>
              <h2>Panel Store sedang disiapkan.</h2>
              <p>Begitu Loca Store dibuka, semua pengelolaan toko ada di sini. Hanya Admin Store, Admin Umum, dan Owner yang bisa membuka area ini.</p>
              <ul className="admin-store-grid">
                <li><b>01</b><strong>Produk</strong><small>Tambah beans, merchandise &amp; harga</small></li>
                <li><b>02</b><strong>Stok</strong><small>Pantau sisa barang</small></li>
                <li><b>03</b><strong>Pesanan</strong><small>Proses &amp; kirim pesanan</small></li>
              </ul>
            </div>
          )}

          {section === "coffee" && canManageCoffee(role) && (<>
          <div className="admin-award-card card" id="stamp-desk">
            <div className="card-topline"><span>STAMP DESK</span><span>SCAN / ADD 1–10</span></div>
            <h2>Tambahkan stamp.</h2>
            <button className="admin-scan-button" type="button" onClick={() => setScannerOpen(true)}>
              <span className="admin-scan-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M7 12h10" /></svg></span>
              <span><strong>Scan QR member / voucher</strong><small>Baca kartu member (stamp) atau voucher yang mau di-redeem</small></span>
              <i className="arrow-icon" aria-hidden="true" />
            </button>
            <div className="admin-or"><span>ATAU MASUKKAN MANUAL</span></div>
            <form onSubmit={awardStamps}>
              <label className="field"><span>MEMBER ID / QR VALUE</span><input value={memberId} onChange={(event) => setMemberId(event.target.value)} placeholder="Scan atau tempel ID member" spellCheck={false} /></label>

              {selected && (
                <div className="admin-selected">
                  <div className="admin-selected-head">
                    <div><small>MEMBER TERPILIH</small><strong>{selected.full_name || "Unnamed member"}</strong></div>
                    <span className="admin-selected-count"><b>{selectedStamps}</b> stamp</span>
                  </div>
                  <div className="admin-dots" aria-hidden="true">
                    {Array.from({ length: STAMP_GOAL }, (_, index) => {
                      const filled = index < selectedOnCard;
                      const preview = !filled && selectedOnCard < STAMP_GOAL && index < selectedOnCard + amount;
                      return <i key={index} className={`${filled ? "is-filled" : ""}${preview ? " is-preview" : ""}`} />;
                    })}
                  </div>
                  <small className="admin-selected-note">{Math.floor(selectedStamps / STAMP_GOAL)} kartu penuh · 10 stamp = 1 kopi gratis{adminUp ? ", atau tabung untuk hadiah lain" : ""}</small>
                </div>
              )}

              <fieldset className="admin-amount">
                <legend>JUMLAH STAMP</legend>
                <div className="admin-amount-grid" role="radiogroup" aria-label="Jumlah stamp">
                  {Array.from({ length: STAMP_GOAL }, (_, index) => {
                    const value = index + 1;
                    return <button key={value} type="button" role="radio" aria-checked={amount === value} className={amount === value ? "is-active" : ""} onClick={() => setAmount(value)}>{value}</button>;
                  })}
                </div>
                {selected && <small>{selectedStamps} → <b>{selectedStamps + amount}</b> stamp{Math.floor((selectedStamps + amount) / STAMP_GOAL) > Math.floor(selectedStamps / STAMP_GOAL) ? " · kartu penuh bertambah" : ""}</small>}
              </fieldset>
              <button className="btn-primary" type="submit" disabled={submitting}><span>{submitting ? "MENYIMPAN..." : `TAMBAH ${amount} STAMP`}</span><i className="arrow-icon" aria-hidden="true" /></button>
            </form>
            {status && <p className={`notice${status.tone === "error" ? " notice-error" : ""}`} role={status.tone === "error" ? "alert" : "status"}>{status.text}</p>}
          </div>

          <VoucherScan scan={voucherScan} />

          {adminUp && user && (<>
          <div className="admin-panel card admin-verify" id="verify-desk">
            <div className="card-topline"><span>VERIFIKASI MEMBER</span><span>{pendingMembers.length} MENUNGGU</span></div>
            {listStatus && <p className={`notice${listStatus.tone === "error" ? " notice-error" : ""}`} role={listStatus.tone === "error" ? "alert" : "status"}>{listStatus.text}</p>}
            {loading ? <p className="admin-empty">Memuat…</p> : pendingMembers.length === 0 ? <p className="admin-empty">Tidak ada member yang menunggu verifikasi.</p> : (
              <ul className="admin-verify-list">
                {pendingMembers.map((member) => (
                  <li key={member.id}>
                    <div><strong>{member.full_name || "Unnamed member"}</strong>{member.phone ? <span>{formatPhone(member.phone)}</span> : null}<small>Daftar {formatDateTime(member.created_at)}</small></div>
                    <button type="button" className="admin-use-id admin-use-redeem" onClick={() => setApproval(member, true)}>VERIFIKASI</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <AdminRewards userId={user.id} member={selected ? { id: selected.id, name: selected.full_name || "member", stamps: selected.stamps } : null} onRedeemed={refresh} />

          <div className="admin-panel card">
            <div className="admin-tabs" role="tablist" aria-label="Data admin">
              <button id="admin-tab-members" type="button" role="tab" aria-selected={tab === "members"} aria-controls="admin-panel-members" className={tab === "members" ? "is-active" : ""} onClick={() => setTab("members")}>Member <span>{verifiedMembers.length}</span></button>
              <button id="admin-tab-logs" type="button" role="tab" aria-selected={tab === "logs"} aria-controls="admin-panel-logs" className={tab === "logs" ? "is-active" : ""} onClick={() => setTab("logs")}>Riwayat stamp <span>{logs.length}</span></button>
            </div>
            <div className="admin-tabpanel" id="admin-panel-members" role="tabpanel" aria-labelledby="admin-tab-members" hidden={tab !== "members"}>
            {listStatus && <p className={`notice admin-list-status${listStatus.tone === "error" ? " notice-error" : ""}`} role={listStatus.tone === "error" ? "alert" : "status"}>{listStatus.text}</p>}
            <label className="field admin-search"><span className="sr-only">Cari member</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, nomor HP, atau ID" /></label>
            {loading ? <p className="admin-empty">Memuat member…</p> : filtered.length === 0 ? <p className="admin-empty">{verifiedMembers.length === 0 ? "Belum ada member terverifikasi." : "Tidak ada member yang cocok."}</p> : (
              <ul className="admin-member-list" ref={memberListRef}>
                {filtered.map((member) => {
                  const stamps = member.stamps;
                  const full = stamps >= STAMP_GOAL;
                  const onCard = stamps > 0 && stamps % STAMP_GOAL === 0 ? STAMP_GOAL : stamps % STAMP_GOAL;
                  return (
                    <li key={member.id} className={full ? "is-full" : ""}>
                      <div className="admin-member-info">
                        <strong>{member.full_name || "Unnamed member"}{member.role !== "member" && <em>{roleLabel(member.role)}</em>}{member.id === user?.id && <em className="is-you">Kamu</em>}</strong>
                        {member.phone ? <span className="admin-member-phone">{formatPhone(member.phone)}</span> : null}
                        <small>{member.id}</small>
                        {canEditRoleOf(role, member.role, member.id === user?.id) && (
                          <label className="admin-role-select">
                            <span>Role</span>
                            <select value={member.role} onChange={(event) => changeRole(member, event.target.value as Role)}>
                              {!assignableRoles(role).includes(member.role as Role) && <option value={member.role} disabled>{roleLabel(member.role)}</option>}
                              {assignableRoles(role).map((value) => <option key={value} value={value}>{roleLabel(value)}</option>)}
                            </select>
                          </label>
                        )}
                      </div>
                      <div className="admin-member-stamps">
                        <span>{full ? `${stamps} stamp ☕` : `${stamps} / ${STAMP_GOAL}`}</span>
                        <i aria-hidden="true"><b style={{ width: `${(onCard / STAMP_GOAL) * 100}%` }} /></i>
                      </div>
                      <button type="button" className="admin-use-id" onClick={() => chooseMember(member.id)}>PILIH</button>
                    </li>
                  );
                })}
              </ul>
            )}
            </div>

            <div className="admin-tabpanel" id="admin-panel-logs" role="tabpanel" aria-labelledby="admin-tab-logs" hidden={tab !== "logs"}>
            <div className="admin-log-filters">
              <div className="admin-chips" role="group" aria-label="Filter aktivitas">
                {([["all", "Semua"], ["add", "Tambah stamp"], ["redeem", "Tukar hadiah"]] as [LogFilter, string][]).map(([value, label]) => (
                  <button key={value} type="button" className={logFilter === value ? "is-active" : ""} aria-pressed={logFilter === value} onClick={() => setLogFilter(value)}>{label}</button>
                ))}
              </div>
              <MultiDatePicker selected={logDays} onChange={setLogDays} activeDays={activeDays} />
            </div>
            {logDays.length > 0 && !logsError && <p className="admin-log-summary">{visibleLogs.length} aktivitas pada {logDays.length} tanggal · <b>+{visibleLogs.filter((log) => log.action === "add").reduce((sum, log) => sum + log.amount, 0)} stamp</b> · <b>{visibleLogs.filter((log) => log.action === "redeem").length} hadiah ditukar</b></p>}
            {logsError ? <p className="notice notice-error">{logsError}</p> : loading || logsLoading ? <p className="admin-empty">Memuat riwayat…</p> : visibleLogs.length === 0 ? <p className="admin-empty">{logs.length === 0 ? "Belum ada aktivitas stamp." : "Tidak ada aktivitas untuk filter ini."}</p> : (
              <ol className="admin-log-list">
                {visibleLogs.slice(0, logLimit).map((log) => (
                  <li key={log.id} className={`is-${log.action}`}>
                    <span className="admin-log-icon" aria-hidden="true">{log.action === "redeem" ? "☕" : `+${log.amount}`}</span>
                    <div>
                      <p>
                        <strong>{log.admin_name || "Admin"}</strong>
                        {log.action === "redeem" ? <> menukar <b>{log.reward_title || "hadiah"}</b> ({log.amount} stamp) untuk </> : <> menambah <b>{log.amount} stamp</b> ke </>}
                        <strong>{log.member_name || "member"}</strong>
                      </p>
                      <small><time dateTime={log.created_at}>{formatDateTime(log.created_at)}</time> · {log.stamps_before} → {log.stamps_after} stamp</small>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {visibleLogs.length > logLimit && <button type="button" className="admin-more" onClick={() => setLogLimit((value) => value + LOG_PAGE)}>TAMPILKAN LEBIH BANYAK <span>{logLimit} / {visibleLogs.length}</span></button>}
            </div>
          </div>
          <AdminContent members={verifiedMembers} userId={user.id} />
          </>)}
          </>)}
        </div>
      </section>
      {scannerOpen && <QrScanner onResult={handleScan} onClose={closeScanner} />}
      {confirmDialog}
    </main>
  );
}
