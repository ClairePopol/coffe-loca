"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import { PageHeader } from "@/components/PageShell";

type Member = { id: string; full_name: string | null; stamps: number; role: string; created_at: string };
type Status = { tone: "ok" | "error"; text: string } | null;
const STAMP_GOAL = 10;
const MEMBER_FIELDS = "id, full_name, stamps, role, created_at";

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberId, setMemberId] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!scannerOpen) return;
    let scanner: { clear: () => Promise<void> | void } | null = null;
    import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
      const instance = new Html5QrcodeScanner("member-qr-reader", { fps: 10, qrbox: { width: 220, height: 220 } }, false);
      scanner = instance;
      instance.render((decodedText: string) => {
        setMemberId(decodedText);
        setStatus({ tone: "ok", text: "QR member terbaca. Tekan tombol untuk memberikan 1 stamp." });
        setScannerOpen(false);
      }, () => undefined);
    });
    return () => {
      Promise.resolve(scanner?.clear()).catch(() => undefined);
    };
  }, [scannerOpen]);

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
        if (!["admin", "owner"].includes(current.role)) {
          window.location.href = "/profile";
          return;
        }
        if (!active) return;
        setUser(authUser);
        const membersResult = await supabase.from("profiles").select(MEMBER_FIELDS).order("created_at", { ascending: false });
        if (membersResult.error) throw new Error(membersResult.error.message);
        if (active) setMembers((membersResult.data ?? []) as Member[]);
      } catch (error) {
        if (active) setStatus({ tone: "error", text: error instanceof Error ? error.message : "Gagal membuka admin panel." });
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  async function awardStamp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const target = memberId.trim();
    if (!target) {
      setStatus({ tone: "error", text: "Scan QR atau masukkan member ID terlebih dahulu." });
      return;
    }
    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.rpc("award_stamp", { target_user_id: target });
      if (error) throw error;
      const name = members.find((member) => member.id === target)?.full_name;
      setStatus({ tone: "ok", text: `1 stamp berhasil ditambahkan${name ? ` ke ${name}` : ""}.` });
      setMemberId("");
      const { data } = await supabase.from("profiles").select(MEMBER_FIELDS).order("created_at", { ascending: false });
      if (data) setMembers(data as Member[]);
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Stamp gagal ditambahkan." });
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((member) => (member.full_name ?? "").toLowerCase().includes(q) || member.id.toLowerCase().includes(q));
  }, [members, query]);
  const readyForReward = members.filter((member) => member.stamps >= STAMP_GOAL).length;
  const totalStamps = members.reduce((sum, member) => sum + Math.min(member.stamps, STAMP_GOAL), 0);

  return (
    <main className="page-shell admin-page">
      <PageHeader backHref="/profile" backLabel="KE PROFILE" />
      <section className="admin-layout">
        <div className="admin-heading page-heading">
          <span className="eyebrow"><i /> PRIVATE / ADMIN ACCESS</span>
          <h1>Member<br /><em>control.</em></h1>
          <p>Kelola stamp member Coffe Loca dari satu ruang.</p>
          <span className="admin-role">{user ? `MASUK SEBAGAI ${(user.user_metadata?.full_name || user.email || "STAFF").toUpperCase()}` : "AUTHORIZED STAFF ONLY"}</span>
          <dl className="admin-stats">
            <div><dt>MEMBER</dt><dd>{loading ? "—" : members.length}</dd></div>
            <div><dt>STAMP</dt><dd>{loading ? "—" : totalStamps}</dd></div>
            <div><dt>KOPI GRATIS</dt><dd>{loading ? "—" : readyForReward}</dd></div>
          </dl>
        </div>

        <div className="admin-content">
          <div className="admin-award-card card">
            <div className="card-topline"><span>STAMP DESK</span><span>SCAN / ADD 1</span></div>
            <h2>Tambahkan stamp.</h2>
            <button className="btn-ghost admin-scan-toggle" type="button" onClick={() => setScannerOpen((value) => !value)} aria-expanded={scannerOpen}>{scannerOpen ? "TUTUP SCANNER" : "SCAN QR MEMBER"}</button>
            {scannerOpen && <div id="member-qr-reader" className="admin-qr-reader" />}
            <form onSubmit={awardStamp}>
              <label className="field"><span>MEMBER ID / QR VALUE</span><input value={memberId} onChange={(event) => setMemberId(event.target.value)} placeholder="Scan atau tempel ID member" spellCheck={false} /></label>
              <button className="btn-primary" type="submit" disabled={submitting}><span>{submitting ? "MENAMBAHKAN..." : "TAMBAH 1 STAMP"}</span><i className="arrow-icon" aria-hidden="true" /></button>
            </form>
            {status && <p className={`notice${status.tone === "error" ? " notice-error" : ""}`} role={status.tone === "error" ? "alert" : "status"}>{status.text}</p>}
          </div>

          <div className="admin-members card">
            <div className="card-topline"><span>ALL MEMBERS</span><span>{String(filtered.length).padStart(2, "0")} / {String(members.length).padStart(2, "0")} ACCOUNTS</span></div>
            <label className="field admin-search"><span className="sr-only">Cari member</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau ID member" /></label>
            {loading ? <p className="admin-empty">Memuat member…</p> : filtered.length === 0 ? <p className="admin-empty">{members.length === 0 ? "Belum ada data profile." : "Tidak ada member yang cocok."}</p> : (
              <ul className="admin-member-list">
                {filtered.map((member) => {
                  const stamps = Math.min(member.stamps, STAMP_GOAL);
                  return (
                    <li key={member.id}>
                      <div className="admin-member-info">
                        <strong>{member.full_name || "Unnamed member"}{member.role !== "member" && <em>{member.role}</em>}</strong>
                        <small>{member.id}</small>
                      </div>
                      <div className="admin-member-stamps">
                        <span>{stamps} / {STAMP_GOAL}</span>
                        <i aria-hidden="true"><b style={{ width: `${(stamps / STAMP_GOAL) * 100}%` }} /></i>
                      </div>
                      <button type="button" className="admin-use-id" onClick={() => { setMemberId(member.id); setStatus(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>PILIH</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
