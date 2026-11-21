import type { Transition } from 'motion/react';

/**
 * Motion tokens for JS animations (Motion library).
 * Reduced motion is handled globally via <MotionConfig reducedMotion="user">.
 */
export const spring = {
  /** Sheets sliding up/down: soft with a slight settle. */
  sheet: { type: 'spring', stiffness: 380, damping: 38, mass: 0.9 },
  /** Small UI elements (tab indicator, chips). */
  snappy: { type: 'spring', stiffness: 520, damping: 40 },
  /** Small elements popping in, with a little overshoot (avatars, badges). */
  pop: { type: 'spring', stiffness: 600, damping: 22 },
  /** Press feedback on buttons. */
  press: { type: 'spring', stiffness: 700, damping: 35 },
} as const satisfies Record<string, Transition>;

export const fade = {
  fast: { duration: 0.15, ease: [0.32, 0.72, 0, 1] },
  base: { duration: 0.25, ease: [0.32, 0.72, 0, 1] },
} as const satisfies Record<string, Transition>;

export const pressScale = 0.97;

/** A sheet with another sheet on top shrinks back (iOS sheet stack). */
export const sheetBehindScale = 0.92;

/**
 * The sheet behind dims itself too and lights up again a little slower than the overlay
 * fades, so you notice it was there all along.
 */
export const sheetBehind = {
  transition: { duration: 0.45, ease: [0.32, 0.72, 0, 1] },
} as const satisfies { transition: Transition };

/** Drag distance (px) or velocity (px/s) after which a sheet dismisses. */
export const sheetDismiss = { offset: 120, velocity: 500 } as const;
