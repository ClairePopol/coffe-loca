import type Lenis from "lenis";

/** The page's Lenis instance (set by SmoothScroll), so other components can scroll smoothly. */
export const lenisRef: { current: Lenis | null } = { current: null };
