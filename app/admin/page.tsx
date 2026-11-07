"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

type Member = { id: string; full_name: string | null; points: number; role: string; created_at: string };

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberId, setMemberId] = useState("");
  const [points, setPoints] = useState("10");
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
        setStatus("QR member terbaca. Masukkan jumlah points lalu tambahkan.");
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
    async function load() {
      try {
        const supabase = getSupabaseClient();
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
          window.location.href = "/login";
          return;
        }
        const { data: current } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
        if (!current || !["admin", "owner"].includes(current.role)) {
          window.location.href = "/profile";
          return;
        }
        if (!active) return;
        setUser(auth.user);
        const { data } = await supabase.from("profiles").select("id, full_name, points, role, created_at").order("created_at", { ascending: false });
        if (data) setMembers(data as Member[]);
      } catch (error) {
        if (active) setStatus(error instanceof Error ? error.message : "Gagal membuka admin panel.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  async function awardPoints(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    const amount = Number(points);
    if (!memberId.trim() || !Number.isInteger(amount) || amount <= 0) {
      setStatus("Masukkan member ID dan jumlah points yang valid.");
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.rpc("award_points", { target_user_id: memberId.trim(), points_to_add: amount });
      if (error) throw error;
      setStatus(`${amount} points berhasil ditambahkan.`);
      setMemberId("");
      const { data } = await supabase.from("profiles").select("id, full_name, points, role, created_at").order("created_at", { ascending: false });
      if (data) setMembers(data as Member[]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Points gagal ditambahkan.");
    }
  }

  return (
    <main className="admin-page">
      <header className="admin-header"><a className="wordmark admin-wordmark" href="/"><img className="wordmark-logo" src="/white-coffee-bean.png" alt="" /><span className="wordmark-type"><span>COFFE <b>LOCA</b></span><small>GOOD COFFEE, GOOD COMPANY</small></span></a><a className="admin-back" href="/profile">PROFILE <span className="arrow-icon" aria-hidden="true" /></a></header>
      <section className="admin-layout">
        <div className="admin-heading"><span className="eyebrow"><i /> PRIVATE / ADMIN ACCESS</span><h1>Member<br /><em>control.</em></h1><p>Kelola akun dan points member Coffe Loca dari satu ruang.</p><span className="admin-role">{user?.user_metadata?.full_name || "AUTHORIZED STAFF"}</span></div>
        <div className="admin-content">
          <div className="admin-award-card"><div className="admin-card-label"><span>POINTS DESK</span><span>SCAN / ADD</span></div><h2>Tambahkan points.</h2><button className="admin-scan-toggle" type="button" onClick={() => setScannerOpen((value) => !value)}>{scannerOpen ? "TUTUP SCANNER" : "SCAN QR MEMBER"}</button>{scannerOpen && <div id="member-qr-reader" className="admin-qr-reader" />}<form onSubmit={awardPoints}><label><span>MEMBER ID / QR VALUE</span><input value={memberId} onChange={(event) => setMemberId(event.target.value)} placeholder="Tempel ID dari QR member" /></label><label><span>JUMLAH POINTS</span><input type="number" min="1" step="1" value={points} onChange={(event) => setPoints(event.target.value)} /></label><button type="submit">TAMBAH POINTS <i className="arrow-icon" aria-hidden="true" /></button></form>{status && <p className="admin-status" role="status">{status}</p>}</div>
          <div className="admin-members"><div className="admin-list-heading"><span>ALL MEMBERS</span><span>{members.length.toString().padStart(2, "0")} ACCOUNTS</span></div>{loading ? <p className="admin-empty">MEMUAT MEMBER...</p> : members.length === 0 ? <p className="admin-empty">Belum ada data profile.</p> : <div className="admin-member-list">{members.map((member) => <article key={member.id}><div><strong>{member.full_name || "Unnamed member"}</strong><small>{member.id}</small></div><span>{member.points.toLocaleString("id-ID")} pts</span></article>)}</div>}</div>
        </div>
      </section>
    </main>
  );
}
