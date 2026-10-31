"use client";

import { useLayoutEffect } from "react";

/**
 * Landing-page scroll reveal. Sections stay server components and only opt in
 * with attributes; the CSS lives in globals.css ("Landing motion").
 *
 *   <div data-reveal>…</div>                fades up once when it enters the viewport
 *   <ul data-reveal-stagger>…</ul>          same, each direct child one step later
 *   style={revealDelay(200)}                extra delay in ms (see ./reveal.ts)
 *
 * Mount once per page. While mounted, <html> carries `reveal-ready`, which is
 * what hides elements before they reveal, so nothing is hidden without JS.
 */
export function RevealObserver() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add("reveal-ready");

    const targets = document.querySelectorAll<HTMLElement>("[data-reveal], [data-reveal-stagger]");
    targets.forEach((el) => {
      if (!el.hasAttribute("data-reveal-stagger")) return;
      // Index each child for the stagger delay; capped so long lists don't drag on.
      Array.from(el.children).forEach((child, i) => (child as HTMLElement).style.setProperty("--i", String(Math.min(i, 8))));
    });

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-in", "");
          io.unobserve(e.target);
        }
      },
      // Bottom -12%: trigger once the element is a little way into view (tune to taste).
      // Huge top margin: anything jumped past (anchor link, fast scroll, reload mid-page) counts as seen.
      { rootMargin: "100000px 0px -12% 0px" },
    );
    targets.forEach((el) => io.observe(el));

    return () => {
      io.disconnect();
      root.classList.remove("reveal-ready");
    };
  }, []);

  return null;
}
