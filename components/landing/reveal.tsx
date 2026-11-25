"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A section that animates into place when it scrolls into view: children with
 * `reveal-up`, `reveal-board` or `reveal-fill` rise, stand up or fill in.
 * Without JavaScript, or with reduced motion, everything simply shows.
 */
export function Reveal({ as: Tag = "div", className, children, ...rest }: { as?: "div" | "section" | "ul"; className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    // Only hide what isn't on screen yet, so nothing visible blinks.
    const box = el.getBoundingClientRect();
    if (box.top < window.innerHeight * 0.85) return;
    el.dataset.armed = "true";
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.shown = "true";
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as React.Ref<never>} className={cn(className)} {...rest}>
      {children}
    </Tag>
  );
}
