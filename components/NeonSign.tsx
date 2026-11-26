"use client";

import { useEffect, useState } from "react";
import { SITE } from "@/lib/site";
import { periodForHour, type DayPeriod } from "@/lib/dayPeriod";

/** Small animated icon that follows the time of day: sunrise, bright sun, sunset, moon & stars. */
export function PeriodIcon({ period }: { period: DayPeriod }) {
  if (period === "malam") {
    return (
      <svg className="period-icon period-malam" viewBox="0 0 24 24" aria-hidden="true">
        <path className="moon" d="M17.5 14.5A7.5 7.5 0 0 1 9.5 6.5a7.5 7.5 0 1 0 8 8z" fill="currentColor" />
        <path className="star s1" d="M19 3l.8 1.8L21.6 5.6l-1.8.8L19 8.2l-.8-1.8-1.8-.8 1.8-.8z" fill="currentColor" />
        <circle className="star s2" cx="20.5" cy="12" r="1" fill="currentColor" />
      </svg>
    );
  }
  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg className={`period-icon period-${period}`} viewBox="0 0 24 24" aria-hidden="true">
      <clipPath id="period-horizon"><rect x="-4" y="-4" width="32" height="19.5" /></clipPath>
      <g clipPath={period === "siang" ? undefined : "url(#period-horizon)"}>
        <g className="rays">{rays.map((deg) => <path key={deg} d="M12 1.5v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" transform={`rotate(${deg} 12 12)`} />)}</g>
        <circle className="orb" cx="12" cy="12" r="5" fill="currentColor" />
      </g>
      {period !== "siang" && <path d="M2 18.5h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".8" />}
    </svg>
  );
}

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
  const period = periodForHour(Math.floor((now ?? 12 * 60) / 60));
  const isOpen = known && now >= SITE.hours.openMinutes && now < SITE.hours.closeMinutes;
  if (variant === "badge") {
    return (
      <span className={`status-badge ${isOpen ? "is-open" : "is-closed"}${known ? "" : " is-pending"} ${className}`} role="status" aria-label={isOpen ? "Sedang buka" : "Sudah tutup"}>
        <PeriodIcon period={period} />{isOpen ? "OPEN" : "CLOSED"}
      </span>
    );
  }
  return (
    <span className={`neon-sign ${isOpen ? "is-open" : "is-closed"}${known ? "" : " is-pending"} ${className}`} role="status" aria-label={isOpen ? "Sedang buka" : "Sudah tutup"}>
      <span className="neon-word">{isOpen ? "OPEN" : "CLOSED"}</span>
    </span>
  );
}
