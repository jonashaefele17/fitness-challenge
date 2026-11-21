import type { TrendPoint } from '../types';

/** Tiny line chart of the last workouts with an up/down/flat trend marker. */
export function Sparkline({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) return null;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 64;
  const height = 20;
  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / span) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const trend = last > first ? '↑' : last < first ? '↓' : '→';

  return (
    <span
      className="flex items-center gap-1.5 text-footnote text-text-muted"
      aria-label={`Verlauf ${trend}`}
    >
      <svg
        viewBox={`-2 -2 ${String(width + 4)} ${String(height + 4)}`}
        width={width}
        height={height}
        aria-hidden
        className="overflow-visible text-accent"
      >
        <polyline
          points={coords.join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span aria-hidden>{trend}</span>
    </span>
  );
}
