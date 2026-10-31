import type { CSSProperties } from "react";

/** Extra delay before a `data-reveal` element animates, e.g. `style={revealDelay(150)}`. */
export const revealDelay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;

/** Step between children of a `data-reveal-stagger` container (default 90ms). */
export const revealStagger = (ms: number) => ({ "--stagger": `${ms}ms` }) as CSSProperties;

/** Body of an inline <script> placed before the sections: hides reveal targets before first paint so they don't flash. */
export const REVEAL_BOOT = "document.documentElement.classList.add('reveal-ready')";
