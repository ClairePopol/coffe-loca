"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

type Profile = { points: number };

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile>({ points: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        const supabase = getSupabaseClient();
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) {
          window.location.href = "/login";
          return;
        }
        if (!active) return;
        setUser(authData.user);
        const { data } = await supabase.from("profiles").select("points").eq("id", authData.user.id).maybeSingle();
        if (active && data) setProfile({ points: data.points ?? 0 });
      } catch {
        // The profile page still works with a zero point balance before the table is created.
      } finally {
        if (active) setLoading(false);
      }
    }
    loadProfile();
    return () => { active = false; };
  }, []);

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Loca member";
  const initials = useMemo(() => displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase() || "L", [displayName]);

  async function signOut() {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <main className="profile-page">
      <header className="profile-header">
        <a className="wordmark profile-wordmark" href="/" aria-label="Kembali ke Coffe Loca">
          <img className="wordmark-logo" src="/white-coffee-bean.png" alt="" />
          <span className="wordmark-type"><span>COFFE <b>LOCA</b></span><small>GOOD COFFEE, GOOD COMPANY</small></span>
        </a>
        <a className="profile-back" href="/">KEMBALI KE BERANDA <span className="arrow-icon" aria-hidden="true" /></a>
      </header>

      <section className="profile-layout" aria-labelledby="profile-title">
        <div className="profile-card">
          <div className="profile-card-top"><span>YOUR LOCA PROFILE</span><span>MEDAN / 2026</span></div>
          {loading ? <div className="profile-loading">MEMBUKA PROFILE...</div> : <>
            <div className="profile-identity"><div className="profile-avatar">{user?.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="" /> : initials}</div><div><span className="profile-kicker">MEMBER COFFE LOCA</span><h2 id="profile-title">{displayName}</h2><p>{user?.email}</p></div></div>
            <div className="profile-points"><div><span>LOCA POINTS</span><strong>{profile.points.toLocaleString("id-ID")}</strong><small>POINTS YANG KAMU KUMPULKAN</small></div><span className="profile-points-mark">✳</span></div>
            <div className="profile-actions"><a href="#reservation">BUAT RESERVASI <span className="arrow-icon" aria-hidden="true" /></a><button type="button" onClick={signOut}>KELUAR <span className="arrow-icon arrow-up" aria-hidden="true" /></button></div>
          </>}
        </div>
      </section>
      <footer className="profile-footer"><span>COFFE LOCA · MEDAN</span><span>TAKE IT EASY</span><span>© 2026</span></footer>
    </main>
  );
}
