"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/** Local yyyy-mm-dd key for a date. */
export const dayKey = (value: string | Date) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const fromKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const rangeKeys = (from: Date, to: Date) => {
  const keys: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) keys.push(dayKey(d));
  return keys;
};
const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

type Props = {
  selected: string[];
  onChange: (days: string[]) => void;
  /** Days that have activity — shown with a dot. */
  activeDays?: Set<string>;
};

export default function MultiDatePicker({ selected, onChange, activeDays }: Props) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const lastClicked = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const sorted = [...selected].sort();
  const summary = sorted.length === 0
    ? "Semua tanggal"
    : sorted.length === 1
      ? fromKey(sorted[0]).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
      : `${sorted.length} tanggal dipilih`;

  const todayKey = dayKey(today);
  const presets: [string, string[]][] = [
    ["Hari ini", [todayKey]],
    ["Kemarin", [dayKey(addDays(today, -1))]],
    ["7 hari", rangeKeys(addDays(today, -6), today)],
    ["30 hari", rangeKeys(addDays(today, -29), today)],
    ["Bulan ini", rangeKeys(new Date(today.getFullYear(), today.getMonth(), 1), today)],
  ];
  const presetActive = (keys: string[]) => keys.length === selected.length && keys.every((k) => selectedSet.has(k));

  function toggle(key: string, withShift: boolean) {
    if (withShift && lastClicked.current) {
      const [a, b] = [lastClicked.current, key].sort();
      const next = new Set(selected);
      rangeKeys(fromKey(a), fromKey(b)).forEach((k) => next.add(k));
      onChange([...next]);
    } else {
      onChange(selectedSet.has(key) ? selected.filter((k) => k !== key) : [...selected, key]);
    }
    lastClicked.current = key;
  }

  // Calendar grid (weeks start on Monday)
  const first = month;
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1))];
  const isCurrentMonth = first.getFullYear() === today.getFullYear() && first.getMonth() === today.getMonth();

  return (
    <div className={`mdp${open ? " is-open" : ""}`} ref={rootRef}>
      <button type="button" className={`mdp-trigger${selected.length ? " has-value" : ""}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /></svg>
        <span>{summary}</span>
        {selected.length > 0 && <i role="button" tabIndex={0} aria-label="Hapus filter tanggal" onClick={(e) => { e.stopPropagation(); onChange([]); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onChange([]); } }}>×</i>}
      </button>

      {open && (
        <div className="mdp-pop" role="dialog" aria-label="Pilih tanggal">
          <div className="mdp-presets">
            {presets.map(([label, keys]) => (
              <button key={label} type="button" className={presetActive(keys) ? "is-active" : ""} onClick={() => onChange(keys)}>{label}</button>
            ))}
          </div>
          <div className="mdp-head">
            <button type="button" onClick={() => setMonth(new Date(first.getFullYear(), first.getMonth() - 1, 1))} aria-label="Bulan sebelumnya">‹</button>
            <strong>{first.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</strong>
            <button type="button" onClick={() => setMonth(new Date(first.getFullYear(), first.getMonth() + 1, 1))} disabled={isCurrentMonth} aria-label="Bulan berikutnya">›</button>
          </div>
          <div className="mdp-grid">
            {WEEKDAYS.map((d) => <span key={d} className="mdp-wd">{d}</span>)}
            {cells.map((date, i) => {
              if (!date) return <span key={`e${i}`} />;
              const key = dayKey(date);
              const future = date > today;
              const on = selectedSet.has(key);
              return (
                <button key={key} type="button" disabled={future} aria-pressed={on} className={`mdp-day${on ? " is-on" : ""}${key === todayKey ? " is-today" : ""}`} onClick={(e) => toggle(key, e.shiftKey)}>
                  {date.getDate()}
                  {activeDays?.has(key) && <i aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <p className="mdp-hint">Ketuk beberapa tanggal untuk memilih lebih dari satu. Di komputer, tahan Shift untuk memilih rentang.</p>
          <div className="mdp-foot">
            <button type="button" onClick={() => onChange([])} disabled={!selected.length}>Hapus</button>
            <button type="button" className="mdp-done" onClick={() => setOpen(false)}>Selesai{selected.length ? ` (${selected.length})` : ""}</button>
          </div>
        </div>
      )}
    </div>
  );
}
