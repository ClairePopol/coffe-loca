"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

type Member = { id: string; full_name: string | null; stamps: number; role: string; created_at: string };

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberId, setMemberId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    if (!scannerOpen) return;
    let scanner: { clear: () => void } | null = null;
    import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
      const instance = new Html5QrcodeScanner("member-qr-reader", { fps: 10, qrbox: { width: 220, height: 220 } }, false);
      scanner = instance;
      instance.render((decodedText: string) => {
        setMemberId(decodedText);
        setStatus("QR member terbaca. Tekan tombol untuk memberikan 1 stamp.");
        setScannerOpen(false);
        instance.clear();
      }, () => undefined);
    });
    return () => {
      scanner?.clear();
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
          setStatus("Profile akun belum siap. Jalankan trigger profiles di Supabase, lalu refresh.");
          return;
        }
        if (!["admin", "owner"].includes(current.role)) {
          window.location.href = "/profile";
          return;
        }
        if (!active) return;
        setUser(authUser);
        const membersResult = await supabase.from("profiles").select("id, full_name, stamps, role, created_at").order("created_at", { ascending: false });
        if (membersResult.error) throw new Error(membersResult.error.message);
        setMembers((membersResult.data ?? []) as Member[]);
      } catch (error) {
        if (active) setStatus(error instanceof Error ? error.message : "Gagal membuka admin panel.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  async function awardStamp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    if (!memberId.trim()) {
      setStatus("Scan QR atau masukkan member ID terlebih dahulu.");
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.rpc("award_stamp", { target_user_id: memberId.trim() });
      if (error) throw error;
      setStatus("1 stamp berhasil ditambahkan ke member.");
      setMemberId("");
      const { data } = await supabase.from("profiles").select("id, full_name, stamps, role, created_at").order("created_at", { ascending: false });
      if (data) setMembers(data as Member[]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Points gagal ditambahkan.");
    }
  }

  return (
    <main className="admin-page">
      <header className="admin-header"><a className="wordmark admin-wordmark" href="/"><img className="wordmark-logo" src="/white-coffee-bean.png" alt="" /><span className="wordmark-type"><span>COFFE <b>LOCA</b></span><small>GOOD COFFEE, GOOD COMPANY</small></span></a><a className="admin-back" href="/profile">PROFILE <span className="arrow-icon" aria-hidden="true" /></a></header>
      <section className="admin-layout">
        <div className="admin-heading"><span className="eyebrow"><i /> PRIVATE / ADMIN ACCESS</span><h1>Member<br /><em>control.</em></h1><p>Kelola stamp member Coffe Loca dari satu ruang.</p><span className="admin-role">{user?.user_metadata?.full_name || "AUTHORIZED STAFF"}</span></div>
        <div className="admin-content">
          <div className="admin-award-card"><div className="admin-card-label"><span>STAMP DESK</span><span>SCAN / ADD 1</span></div><h2>Tambahkan stamp.</h2><button className="admin-scan-toggle" type="button" onClick={() => setScannerOpen((value) => !value)}>{scannerOpen ? "TUTUP SCANNER" : "SCAN QR MEMBER"}</button>{scannerOpen && <div id="member-qr-reader" className="admin-qr-reader" />}<form onSubmit={awardStamp}><label><span>MEMBER ID / QR VALUE</span><input value={memberId} onChange={(event) => setMemberId(event.target.value)} placeholder="Scan atau tempel ID member" /></label><button type="submit">TAMBAH 1 STAMP <i className="arrow-icon" aria-hidden="true" /></button></form>{status && <p className="admin-status" role="status">{status}</p>}</div>
          <div className="admin-members"><div className="admin-list-heading"><span>ALL MEMBERS</span><span>{members.length.toString().padStart(2, "0")} ACCOUNTS</span></div>{loading ? <p className="admin-empty">MEMUAT MEMBER...</p> : members.length === 0 ? <p className="admin-empty">Belum ada data profile.</p> : <div className="admin-member-list">{members.map((member) => <article key={member.id}><div><strong>{member.full_name || "Unnamed member"}</strong><small>{member.id}</small></div><span>{Math.min(member.stamps, 10).toLocaleString("id-ID")} / 10 stamp</span></article>)}</div>}</div>
        </div>
      </section>
    </main>
  );
}
