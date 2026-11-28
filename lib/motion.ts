"use client";

import { flushSync } from "react-dom";

/**
 * Corral's motion: short, calm, and from where things come from.
 * Every animated part also respects reduced motion (MotionConfig on the board,
 * and the CSS overrides in globals.css).
 */

/** Things moving to a new place: a card to another column, a row to a new rank. */
export const MOVE = { type: "spring", stiffness: 420, damping: 38, mass: 0.9 } as const;

/** Things arriving: a tray, a message, a card opening. A touch of bounce. */
export const ARRIVE = { type: "spring", stiffness: 380, damping: 28 } as const;

/** Small swaps: an amount rolling to its new number. */
export const QUICK = { duration: 0.22, ease: [0.3, 0.9, 0.3, 1] } as const;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Run a state change inside a View Transition (a quick cross-fade) where the browser has them. */
export function withViewTransition(update: () => void) {
  const doc = typeof document !== "undefined" ? (document as Document & { startViewTransition?: (cb: () => void) => unknown }) : null;
  if (!doc?.startViewTransition || prefersReducedMotion()) {
    update();
    return;
  }
  doc.startViewTransition(() => flushSync(update));
}
