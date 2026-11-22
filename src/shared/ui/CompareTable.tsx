import { cn } from '@/shared/lib';
import { ChevronRightIcon } from './icons';

export interface CompareColumn {
  key: string;
  label: string;
  /** CSS colour of the person. */
  color: string;
}

export interface CompareCell {
  value: string;
  /** 0–1: a small bar in the column's colour under the value. */
  fraction?: number | null;
}

export interface CompareRow {
  key: string;
  label: string;
  /** One per column; null: nothing to compare (shown as "–"). */
  cells: (CompareCell | null)[];
  onOpen?: () => void;
}

export interface CompareTableProps {
  columns: CompareColumn[];
  rows: CompareRow[];
}

/**
 * People side by side: a row per thing, a column per person (their colour on top and in
 * the bars, values in plain text). Up to 3 people roomy; 4–5 narrower, row labels may
 * wrap onto two lines and the row arrow goes (the row stays tappable).
 */
export function CompareTable({ columns, rows }: CompareTableProps) {
  const narrow = columns.length > 3;
  const anyOpen = !narrow && rows.some((row) => row.onOpen);
  const cell = narrow ? 'w-11.5' : 'w-14';
  return (
    <div role="table" className="flex flex-col rounded-card bg-surface-2 px-4">
      <div role="row" className="flex items-end gap-0 pt-3 pb-1.5">
        <span role="columnheader" className="min-w-0 flex-1" />
        {columns.map((column) => (
          <span
            key={column.key}
            role="columnheader"
            className={cn(
              'flex shrink-0 flex-col items-center gap-1 truncate text-caption font-semibold text-text-muted',
              cell,
            )}
          >
            <span
              aria-hidden
              className="size-2 rounded-pill"
              style={{ backgroundColor: column.color }}
            />
            <span className="max-w-full truncate">{column.label}</span>
          </span>
        ))}
        {anyOpen && <span className="w-4 shrink-0" />}
      </div>
      {rows.map((row) => {
        const content = (
          <>
            <span
              role="rowheader"
              className={cn(
                'min-w-0 flex-1 pr-2 text-left text-subhead font-semibold',
                narrow ? 'line-clamp-2' : 'truncate',
              )}
            >
              {row.label}
            </span>
            {row.cells.map((c, index) => (
              <span
                key={columns[index]?.key ?? index}
                role="cell"
                className={cn(
                  'flex shrink-0 flex-col items-center gap-1 tabular-nums',
                  cell,
                  narrow ? 'text-footnote' : 'text-subhead',
                )}
              >
                {c ? (
                  <>
                    <span className="font-semibold">{c.value}</span>
                    {c.fraction != null && (
                      <span className="h-1 w-4/5 overflow-hidden rounded-pill bg-surface-3">
                        <span
                          className="block h-full rounded-pill"
                          style={{
                            width: `${String(Math.round(Math.min(1, Math.max(0, c.fraction)) * 100))}%`,
                            backgroundColor: columns[index]?.color,
                          }}
                        />
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-text-subtle">–</span>
                )}
              </span>
            ))}
            {anyOpen && <ChevronRightIcon aria-hidden className="w-4 shrink-0 text-text-subtle" />}
          </>
        );
        const line = 'flex min-h-tap w-full items-center border-t border-border py-2.5';
        return row.onOpen ? (
          <button
            key={row.key}
            type="button"
            role="row"
            onClick={row.onOpen}
            className={cn(line, 'active:bg-surface-3')}
          >
            {content}
          </button>
        ) : (
          <div key={row.key} role="row" className={line}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
