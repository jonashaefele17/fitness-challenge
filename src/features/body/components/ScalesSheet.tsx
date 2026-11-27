import { useState } from 'react';
import { showToast } from '@/shared/lib';
import { Button, ChevronRightIcon, SegmentedControl, Sheet, TextField } from '@/shared/ui';
import {
  useArchiveScale,
  useCreateScale,
  useScaleOffsetSuggestion,
  useScales,
  useSetMainScale,
  useUpdateScale,
} from '../api/useWeight';
import { formatSignedKg, offsetText, parseOffsetAmount, sameOffset, formatKg } from '../format';
import type { Scale } from '../types';

/**
 * My scales. With two or more in use, one is the main scale and the others show their
 * difference to it; with one (or none) none of that appears.
 */
export function ScalesSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const scales = useScales().data ?? [];
  const active = scales.filter((s) => !s.archived);
  const archived = scales.filter((s) => s.archived);
  const several = active.length >= 2;
  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const create = useCreateScale();
  const archive = useArchiveScale();
  const opened = scales.find((s) => s.id === openId) ?? null;

  function addScale() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setName('');
    create.mutate(
      { name: trimmed },
      {
        onError: () => {
          showToast('Waage konnte nicht angelegt werden.');
        },
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Waagen">
      <div className="flex flex-col gap-5 pt-1">
        {!several && (
          <p className="text-footnote text-text-muted">
            Wiegst du dich auf mehreren Waagen, zum Beispiel zuhause und im Studio? Leg sie hier an,
            dann gleicht die App den Unterschied zwischen ihnen aus.
          </p>
        )}
        {active.length > 0 && (
          <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
            {active.map((scale) => (
              <li key={scale.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(scale.id);
                  }}
                  className="flex min-h-tap w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-3"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body">{scale.name}</span>
                    {several && (
                      <span className="truncate text-footnote text-text-muted">
                        {scale.isMain ? 'Hauptwaage' : offsetText(scale.offsetKg)}
                      </span>
                    )}
                  </span>
                  <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addScale();
          }}
        >
          <div className="min-w-0 flex-1">
            <TextField
              label="Neue Waage"
              placeholder={active.length === 0 ? 'z. B. Zuhause' : 'z. B. Studio'}
              maxLength={40}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </div>
          <Button type="submit" variant="tinted" disabled={name.trim() === ''}>
            Hinzufügen
          </Button>
        </form>

        {archived.length > 0 && (
          <details className="rounded-card bg-surface-2 px-4">
            <summary className="flex min-h-tap cursor-pointer items-center text-subhead font-semibold text-text-muted">
              Archiviert ({archived.length})
            </summary>
            <ul className="flex flex-col pb-2">
              {archived.map((scale) => (
                <li key={scale.id} className="flex min-h-tap items-center justify-between gap-3">
                  <span className="truncate text-subhead">{scale.name}</span>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      archive.mutate({ scaleId: scale.id, archive: false });
                    }}
                  >
                    Wieder aufnehmen
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <ScaleSheet
        scale={opened}
        main={several ? (active.find((s) => s.isMain) ?? null) : null}
        onClose={() => {
          setOpenId(null);
        }}
      />
    </Sheet>
  );
}

/** One scale: name, its difference to the main scale (only with several), main, archive. */
function ScaleSheet({
  scale,
  main,
  onClose,
}: {
  scale: Scale | null;
  /** The main scale while several are in use, else null (no offsets then). */
  main: Scale | null;
  onClose: () => void;
}) {
  const update = useUpdateScale();
  const setMain = useSetMainScale();
  const archive = useArchiveScale();
  const failed = () => {
    showToast('Änderung konnte nicht gespeichert werden.');
  };

  function archiveScale(target: Scale) {
    onClose();
    archive.mutate(
      { scaleId: target.id, archive: true },
      {
        onSuccess: () => {
          showToast(`„${target.name}“ archiviert`, {
            label: 'Rückgängig',
            onAction: () => {
              archive.mutate({ scaleId: target.id, archive: false });
            },
          });
        },
        onError: (error) => {
          showToast(
            error.message.includes('main_scale_in_use')
              ? 'Mach zuerst eine andere Waage zur Hauptwaage'
              : 'Waage konnte nicht archiviert werden.',
          );
        },
      },
    );
  }

  return (
    <Sheet
      open={scale !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={scale?.name ?? 'Waage'}
    >
      {scale && (
        <div className="flex flex-col gap-5 pt-1">
          <NameField
            key={scale.id}
            scale={scale}
            onSave={(name) => {
              update.mutate({ scaleId: scale.id, name }, { onError: failed });
            }}
          />
          {main && !scale.isMain && (
            <Offset
              key={`${scale.id}:${String(scale.offsetKg)}`}
              scale={scale}
              mainName={main.name}
              onSave={(offsetKg) => {
                update.mutate({ scaleId: scale.id, offsetKg }, { onError: failed });
              }}
            />
          )}
          <div className="flex flex-col gap-2">
            {main && !scale.isMain && (
              <Button
                variant="tinted"
                fullWidth
                onClick={() => {
                  setMain.mutate(scale.id, {
                    onSuccess: () => {
                      showToast(`„${scale.name}“ ist jetzt die Hauptwaage`);
                    },
                    onError: failed,
                  });
                }}
              >
                Zur Hauptwaage machen
              </Button>
            )}
            <Button
              variant="danger"
              fullWidth
              onClick={() => {
                archiveScale(scale);
              }}
            >
              Archivieren
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function NameField({ scale, onSave }: { scale: Scale; onSave: (name: string) => void }) {
  const [name, setName] = useState(scale.name);
  const save = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== scale.name) onSave(trimmed);
    else setName(scale.name);
  };
  return (
    <TextField
      label="Name"
      maxLength={40}
      value={name}
      enterKeyHint="done"
      onChange={(event) => {
        setName(event.target.value);
      }}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

type Direction = 'more' | 'less';

/**
 * The difference to the main scale: suggested from days weighed on both, or set by hand
 * (amount plus "mehr"/"weniger": the iPhone's decimal keypad has no minus).
 */
function Offset({
  scale,
  mainName,
  onSave,
}: {
  scale: Scale;
  mainName: string;
  onSave: (offsetKg: number) => void;
}) {
  const suggestion = useScaleOffsetSuggestion(scale.id).data;
  const [amount, setAmount] = useState(formatKg(Math.abs(scale.offsetKg)));
  const [direction, setDirection] = useState<Direction>(scale.offsetKg < 0 ? 'less' : 'more');
  const parsed = parseOffsetAmount(amount);
  const draft = parsed === null ? null : direction === 'less' ? -parsed : parsed;
  const changed = draft !== null && !sameOffset(draft, scale.offsetKg);
  const suggested = suggestion?.suggestedOffsetKg ?? null;
  const commonDays = suggestion?.commonDays ?? 0;

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-footnote font-semibold text-text-muted">Unterschied zu „{mainName}“</h3>
      <p className="text-subhead">
        {scale.name} {offsetText(scale.offsetKg)}.
      </p>

      {suggestion && commonDays > 0 && suggested !== null
        ? !sameOffset(suggested, scale.offsetKg) && (
            <div className="flex items-center justify-between gap-3 rounded-card bg-surface-2 py-2 pr-2 pl-4">
              <span className="text-subhead">
                Aus {commonDays} gemeinsamen {commonDays === 1 ? 'Tag' : 'Tagen'}:{' '}
                <span className="font-semibold tabular-nums">{formatSignedKg(suggested)} kg</span>
              </span>
              <Button
                variant="tinted"
                onClick={() => {
                  onSave(Math.round(suggested * 10) / 10);
                }}
              >
                Übernehmen
              </Button>
            </div>
          )
        : suggestion !== undefined && (
            <p className="text-footnote text-text-muted">
              Wiege dich einmal am selben Tag auf beiden Waagen, dann schlägt die App den
              Unterschied vor.
            </p>
          )}

      <div className="flex items-center gap-2">
        <label className="flex shrink-0 items-center gap-1.5">
          <span className="sr-only">Unterschied in kg</span>
          <input
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            className="h-tap w-20 rounded-md border border-border bg-surface-2 px-3 text-center text-body tabular-nums focus:border-accent focus:outline-none"
          />
          <span className="text-subhead text-text-muted">kg</span>
        </label>
        <div className="min-w-0 flex-1">
          <SegmentedControl
            label="Richtung"
            value={direction}
            onChange={setDirection}
            options={[
              { value: 'more', label: 'mehr' },
              { value: 'less', label: 'weniger' },
            ]}
          />
        </div>
      </div>
      {changed && (
        <Button
          fullWidth
          onClick={() => {
            onSave(draft);
          }}
        >
          Speichern
        </Button>
      )}
    </section>
  );
}
