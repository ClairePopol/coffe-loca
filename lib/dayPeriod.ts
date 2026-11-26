export type DayPeriod = "pagi" | "siang" | "sore" | "malam";

/** Time-of-day theme by Medan time (WIB): pagi 05–10, siang 10–15, sore 15–18, malam 18–05. */
export function periodForHour(hour: number): DayPeriod {
  if (hour >= 5 && hour < 10) return "pagi";
  if (hour >= 10 && hour < 15) return "siang";
  if (hour >= 15 && hour < 18) return "sore";
  return "malam";
}
