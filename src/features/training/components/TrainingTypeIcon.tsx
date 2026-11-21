import { useId, type ReactNode, type SVGProps } from 'react';

/**
 * Icons for training types (24 grid, currentColor), matching the navigation icons. Two
 * variants: "outline" (2 px round strokes; planned, lists) and "filled" (done workouts).
 * The key comes from training_types.icon; unknown keys get the neutral icon, so a new key in
 * the data never breaks the app.
 *
 * barbell, run, bike, football and table_tennis outlines and the barbell/bike filled shapes
 * are Tabler Icons (https://tabler.io/icons, MIT License, © Paweł Kuna); home_gym, mobility
 * (tree pose), generic and the other filled shapes are our own. Filled shapes cut their
 * details out with a mask, so they work on any background.
 */
const outline: Record<string, ReactNode> = {
  // Studio (Tabler "barbell")
  barbell: (
    <path d="M2 12h1M6 8H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2M6 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1zM9 12h6M15 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1zM18 8h2a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M22 12h-1" />
  ),
  // Home Gym: house with a dumbbell inside (clearly different from the studio)
  home_gym: (
    <>
      <path d="M3.5 10.5 12 4l8.5 6.5V20h-17z" />
      <path d="M8.5 15h7M8.5 13.2v3.6M15.5 13.2v3.6" />
    </>
  ),
  // Laufen (Tabler "run")
  run: (
    <>
      <circle cx="13" cy="4" r="1" />
      <path d="M4 17l5 1 .75-1.5M15 21v-4l-4-3 1-6M7 12V9l5-1 3 3 3 1" />
    </>
  ),
  // Radfahren (Tabler "bike")
  bike: (
    <>
      <circle cx="5" cy="18" r="3" />
      <circle cx="19" cy="18" r="3" />
      <circle cx="17" cy="5" r="1" />
      <path d="M12 19v-4l-3-3 5-4 2 3h3" />
    </>
  ),
  // Fußball (Tabler "ball-football")
  football: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7l4.76 3.45L15 16H9l-1.76-5.55zM12 7V3m3 13 2.5 3m-.74-8.55 3.74-1.45m-11.44 7.05-2.56 2.95m.74-8.55L3.24 9.55" />
    </>
  ),
  // Tischtennis (Tabler "ping-pong")
  table_tennis: (
    <>
      <path d="M12.718 20.713a7.64 7.64 0 0 1-7.48-12.755l.72-.72a7.643 7.643 0 0 1 9.105-1.283l2.387-2.345a2.08 2.08 0 0 1 3.057 2.815l-.116.126-2.346 2.387a7.644 7.644 0 0 1-1.052 8.864" />
      <circle cx="14" cy="18" r="3" />
      <path d="M9.3 5.3l9.4 9.4" />
    </>
  ),
  // Mobility: tree pose (on one leg, the other foot at the knee, arms joined over the head)
  mobility: (
    <>
      <circle cx="12" cy="6.8" r="1" />
      <path d="M9.6 11.2 7 6.6 12 1.2l5 5.4-2.6 4.6M12 9.6V15M12 15v6M12 15l-3.8 1.7L12 18.4" />
    </>
  ),
  // Anything else: a ring with a tick
  generic: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 9.8" />
    </>
  ),
};

/** Filled shapes; `mask` is a unique id for the cut-outs. */
const filled: Record<string, (mask: string) => ReactNode> = {
  // Tabler "barbell" (filled)
  barbell: () => (
    <g fill="currentColor" stroke="none">
      <path d="M4 7a1 1 0 0 1 1 1v8a1 1 0 0 1-2 0v-3H2a1 1 0 0 1 0-2h1V8a1 1 0 0 1 1-1" />
      <path d="M20 7a1 1 0 0 1 1 1v3h1a1 1 0 0 1 0 2h-1v3a1 1 0 0 1-2 0V8a1 1 0 0 1 1-1" />
      <path d="M16 5a2 2 0 0 1 2 2v10a2 2 0 1 1-4 0v-4h-4v4a2 2 0 1 1-4 0V7a2 2 0 1 1 4 0v4h4V7a2 2 0 0 1 2-2" />
    </g>
  ),
  // Solid house, the dumbbell cut out
  home_gym: (mask) => (
    <>
      <mask id={mask}>
        <rect width="24" height="24" fill="white" />
        <path d="M8.5 15h7M8.5 13.2v3.6M15.5 13.2v3.6" stroke="black" strokeWidth={2} />
      </mask>
      <path d="M3.5 10.5 12 4l8.5 6.5V20h-17z" fill="currentColor" mask={`url(#${mask})`} />
    </>
  ),
  // Pictogram: full head, strong round limbs
  run: () => (
    <>
      <circle cx="13.2" cy="3.6" r="2.1" fill="currentColor" stroke="none" />
      <path d="M4 17l5 1 .75-1.5M15 21v-4l-4-3 1-6M7 12V9l5-1 3 3 3 1" strokeWidth={3.2} />
    </>
  ),
  // Tabler "bike" (filled)
  bike: () => (
    <g fill="currentColor" stroke="none">
      <path d="M5 14a4 4 0 1 1-4 4l.005-.2A4 4 0 0 1 5 14" />
      <path d="M19 14a4 4 0 1 1-4 4l.005-.2A4 4 0 0 1 19 14" />
      <path d="M14.832 7.445 16.535 10H19a1 1 0 0 1 .993.883L20 11a1 1 0 0 1-1 1h-3a1 1 0 0 1-.832-.445l-1.396-2.093-3.275 2.62 2.21 2.21a1 1 0 0 1 .284.577L13 15v4a1 1 0 0 1-2 0v-3.585l-2.707-2.708a1 1 0 0 1-.01-1.403l.092-.085 5-4a1 1 0 0 1 1.457.226" />
      <path d="M17 3a2 2 0 1 1-2 2l.005-.15A2 2 0 0 1 17 3" />
    </g>
  ),
  // Solid ball, the seams cut out (the centre patch stays solid)
  football: (mask) => (
    <>
      <mask id={mask}>
        <rect width="24" height="24" fill="white" />
        <path
          d="M12 7l4.76 3.45L15 16H9l-1.76-5.55zM12 7V2.5m3 13.5 2.8 3.4m-1.04-8.95 4.2-1.6m-11.92 7.2-2.84 3.4m1.04-8.95L2.8 9.5"
          stroke="black"
          strokeWidth={1.6}
          fill="none"
        />
      </mask>
      <circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" mask={`url(#${mask})`} />
    </>
  ),
  // Solid paddle face and handle, the rubber edge cut out; the ball solid too
  table_tennis: (mask) => (
    <>
      <mask id={mask}>
        <rect width="24" height="24" fill="white" />
        <path d="M9.3 5.3l9.4 9.4" stroke="black" strokeWidth={1.6} />
        <circle cx="14" cy="18" r="4.2" fill="black" />
      </mask>
      <g mask={`url(#${mask})`} fill="currentColor">
        <circle cx="10.7" cy="13.2" r="7.6" stroke="none" />
        <path d="M14.6 6.1l2.6-2.6a2.08 2.08 0 0 1 3 2.9l-2.6 2.6z" />
      </g>
      <circle cx="14" cy="18" r="3" fill="currentColor" stroke="none" />
    </>
  ),
  // Tree pose as a pictogram
  mobility: () => (
    <>
      <circle cx="12" cy="6.9" r="1.8" fill="currentColor" stroke="none" />
      <path
        d="M9.4 11.4 6.6 6.6 12 .9l5.4 5.7-2.8 4.8M12 9.9V15M12 15v6M12 15l-3.8 1.7L12 18.4"
        strokeWidth={2.8}
      />
    </>
  ),
  // Solid disc, the tick cut out
  generic: (mask) => (
    <>
      <mask id={mask}>
        <rect width="24" height="24" fill="white" />
        <path d="M8 12.5l2.7 2.7L16 9.8" stroke="black" strokeWidth={2.2} fill="none" />
      </mask>
      <circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" mask={`url(#${mask})`} />
    </>
  ),
};

export function TrainingTypeIcon({
  icon,
  variant = 'outline',
  ...props
}: {
  icon: string;
  /** filled: a done workout; outline: planned, lists, choices. */
  variant?: 'outline' | 'filled';
} & SVGProps<SVGSVGElement>) {
  const mask = useId();
  const key = icon in outline ? icon : 'generic';
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {variant === 'filled' ? (filled[key] ?? filled.generic)?.(mask) : outline[key]}
    </svg>
  );
}
