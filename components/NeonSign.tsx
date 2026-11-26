"use client";

import { useEffect, useState } from "react";
import { SITE } from "@/lib/site";

/** Retro neon OPEN / CLOSED sign. Follows Medan time (WIB, UTC+7) and flips to CLOSED outside opening hours. */
export default function NeonSign({ className = "", variant = "neon" }: { className?: string; variant?: "neon" | "badge" }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
      const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
      setNow(get("hour") * 60 + get("minute"));
    };
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const known = now !== null;
  const isOpen = known && now >= SITE.hours.openMinutes && now < SITE.hours.closeMinutes;
  if (variant === "badge") {
    return (
      <span className={`status-badge ${isOpen ? "is-open" : "is-closed"}${known ? "" : " is-pending"} ${className}`} role="status" aria-label={isOpen ? "Sedang buka" : "Sudah tutup"}>
        <i aria-hidden="true" />{isOpen ? "OPEN" : "CLOSED"}
      </span>
    );
  }
  return (
    <span className={`neon-sign ${isOpen ? "is-open" : "is-closed"}${known ? "" : " is-pending"} ${className}`} role="status" aria-label={isOpen ? "Sedang buka" : "Sudah tutup"}>
      <span className="neon-word">{isOpen ? "OPEN" : "CLOSED"}</span>
    </span>
  );
}
