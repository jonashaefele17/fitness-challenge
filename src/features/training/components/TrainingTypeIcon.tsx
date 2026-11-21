import type { ReactNode, SVGProps } from 'react';

/**
 * Line icons for training types (24 grid, 2 px round strokes, currentColor), matching the
 * navigation icons. The key comes from training_types.icon; unknown keys get the neutral
 * icon, so a new key in the data never breaks the app.
 *
 * barbell, run, bike, football, table_tennis and mobility are Tabler Icons
 * (https://tabler.io/icons, MIT License, © Paweł Kuna); home_gym and generic are our own.
 */
const paths: Record<string, ReactNode> = {
  // Studio (Tabler "barbell")
  barbell: (
    <path d="M2 12h1M6 8H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2M6 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1zM9 12h6M15 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1zM18 8h2a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M22 12h-1" />
  ),
  // Home Gym: house with a dumbbell inside (own; clearly different from the studio)
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
  // Mobility (Tabler "yoga")
  mobility: (
    <>
      <circle cx="12" cy="4" r="1" />
      <path d="M4 20h4l1.5-3M17 20l-1-5h-5l1-7M4 10l4-1 4-1 4 1.5 4 1.5" />
    </>
  ),
  // Anything else: a ring with a tick (own)
  generic: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 9.8" />
    </>
  ),
};

export function TrainingTypeIcon({ icon, ...props }: { icon: string } & SVGProps<SVGSVGElement>) {
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
      {paths[icon] ?? paths.generic}
    </svg>
  );
}
