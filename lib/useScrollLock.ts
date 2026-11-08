import { useEffect } from "react";

let lockCount = 0;

let startY = 0;

function rememberTouchStart(event: TouchEvent) {
  startY = event.touches[0]?.clientY ?? 0;
}

function blockTouchScroll(event: TouchEvent) {
  // Allow scrolling inside an overlay that opts in, but only while it can still scroll in the
  // swipe direction. At its top/bottom edge the swipe would leak to the page, so block it.
  const area = (event.target as Element | null)?.closest?.<HTMLElement>("[data-scroll-lock-allow]");
  if (area && area.scrollHeight > area.clientHeight + 1) {
    const deltaY = (event.touches[0]?.clientY ?? startY) - startY;
    const atTop = area.scrollTop <= 0;
    const atBottom = Math.ceil(area.scrollTop + area.clientHeight) >= area.scrollHeight;
    const pullingDown = deltaY > 0;
    if (!(pullingDown && atTop) && !(!pullingDown && atBottom)) return;
  }
  if (event.cancelable) event.preventDefault();
}

/**
 * Freezes page scroll while `active` is true, including finger swipes on iOS/Android
 * (mobile Safari ignores `overflow: hidden`). Wheel/keyboard scroll is paused separately
 * by stopping Lenis (see SmoothScroll). The layout is never changed, so scroll position,
 * GSAP ScrollTrigger and Lenis stay in sync.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (lockCount === 0) {
      document.addEventListener("touchstart", rememberTouchStart, { passive: true });
      document.addEventListener("touchmove", blockTouchScroll, { passive: false });
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.removeEventListener("touchstart", rememberTouchStart);
        document.removeEventListener("touchmove", blockTouchScroll);
      }
    };
  }, [active]);
}
