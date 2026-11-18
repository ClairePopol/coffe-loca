"use client";

import { useEffect, useState } from "react";

/**
 * Store-room pages (/store, /events): a browser refresh sends visitors back to the room chooser on "/".
 * Only a real reload does this. Arriving from the chooser, a link, a typed URL or the back button
 * (navigation types "navigate" / "back_forward") keeps the page. The cart lives in localStorage, so it survives.
 */
export default function ReloadToChooser() {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (entry?.type === "reload") {
      setLeaving(true);
      window.location.replace("/");
    }
  }, []);

  // cover the page while the redirect happens so the catalogue does not flash
  return leaving ? <div className="room-cover" aria-hidden="true" /> : null;
}
