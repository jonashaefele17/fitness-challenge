import { useRef } from 'react';
import { Button, CameraIcon } from '@/shared/ui';
import type { PhotoAnswers } from '../checkinFlow';
import { shownPhotos } from '../photoView';
import type { BodyPhoto, PhotoPose } from '../types';
import { CheckinStepHeader } from './CheckinStepHeader';
import { BlobImage, StoredImage } from './PhotoImage';

/**
 * The photos screen of the Zwischenstand: per pose a tile with the picture (new, kept or
 * none), taking one with the camera or picking one from the library (the phone's own
 * pickers, no camera view of our own), and last time's photo of that pose small beside it.
 */
export function CheckinPhotoStep({
  poses,
  existing,
  photos,
  previous,
  formatDay,
  isLast,
  onBack,
  onChange,
  onLeave,
}: {
  poses: readonly PhotoPose[];
  /** The live photos of the check-in being changed (none for a new one). */
  existing: readonly BodyPhoto[];
  photos: PhotoAnswers;
  /** Per pose the photo of the previous check-in that has it. */
  previous: Record<string, { photo: BodyPhoto; onDate: string }>;
  formatDay: (day: string) => string;
  isLast: boolean;
  onBack: (() => void) | undefined;
  /** A new picture, null (removed) or undefined (back to the check-in's photo, or none). */
  onChange: (pose: string, answer: Blob | null | undefined) => void;
  onLeave: () => void;
}) {
  const shown = shownPhotos(poses, existing, photos).length;

  return (
    <div className="flex min-h-sheet-min flex-col gap-5 pt-1">
      <div className="flex flex-col gap-1">
        <CheckinStepHeader onBack={onBack} counter={null} />
        <h3 className="text-title-1 font-bold">Fotos</h3>
        <p className="text-subhead text-text-muted">
          Am besten immer am selben Ort, im selben Licht und mit demselben Abstand. Nur du siehst
          sie.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {poses.map((pose) => (
          <PoseTile
            key={pose.key}
            pose={pose}
            answer={photos[pose.key]}
            existing={existing.find((p) => p.pose === pose.key)}
            previous={previous[pose.key]}
            formatDay={formatDay}
            onChange={(answer) => {
              onChange(pose.key, answer);
            }}
          />
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-2 pb-2">
        <Button size="lg" onClick={onLeave}>
          {isLast ? 'Fertig' : 'Weiter'}
        </Button>
        {shown === 0 && (
          <Button variant="ghost" onClick={onLeave}>
            Überspringen
          </Button>
        )}
      </div>
    </div>
  );
}

function PoseTile({
  pose,
  answer,
  existing,
  previous,
  formatDay,
  onChange,
}: {
  pose: PhotoPose;
  answer: Blob | null | undefined;
  existing: BodyPhoto | undefined;
  previous: { photo: BodyPhoto; onDate: string } | undefined;
  formatDay: (day: string) => string;
  onChange: (answer: Blob | null | undefined) => void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const kept = answer === undefined ? existing : undefined;
  const filled = Boolean(answer) || kept !== undefined;

  const picked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // The same picture picked again must fire again.
    event.target.value = '';
    if (file) onChange(file);
  };

  return (
    <li className="flex gap-3 rounded-card bg-surface-2 p-3">
      <div className="relative aspect-3/4 w-32 shrink-0 overflow-hidden rounded-md bg-surface-3">
        {answer ? (
          <BlobImage blob={answer} alt={`${pose.label}, neu`} className="size-full object-cover" />
        ) : kept ? (
          <StoredImage path={kept.thumbPath} alt={pose.label} className="size-full object-cover" />
        ) : (
          <button
            type="button"
            aria-label={`${pose.label} aufnehmen`}
            onClick={() => camera.current?.click()}
            className="flex size-full flex-col items-center justify-center gap-1 text-text-subtle active:bg-surface-2"
          >
            <CameraIcon aria-hidden className="size-7" />
          </button>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-body font-semibold">{pose.label}</span>
        {previous && (
          <div className="flex items-center gap-2">
            <StoredImage
              path={previous.photo.thumbPath}
              alt={`${pose.label}, letztes Mal`}
              className="aspect-3/4 w-9 shrink-0 rounded-sm object-cover"
            />
            <span className="flex min-w-0 flex-col text-caption text-text-muted">
              <span>Letztes Mal</span>
              <span className="truncate">{formatDay(previous.onDate)}</span>
            </span>
          </div>
        )}
        <div className="mt-auto flex flex-col gap-2">
          {filled ? (
            <>
              <Button variant="tinted" onClick={() => library.current?.click()}>
                Ersetzen
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  // A kept photo is removed on saving; a new picture is simply dropped again.
                  onChange(existing ? null : undefined);
                }}
              >
                Entfernen
              </Button>
            </>
          ) : (
            <>
              <Button variant="tinted" onClick={() => camera.current?.click()}>
                Aufnehmen
              </Button>
              <Button variant="ghost" onClick={() => library.current?.click()}>
                Aus Mediathek
              </Button>
            </>
          )}
        </div>
      </div>
      {/* The phone's own pickers: the camera directly, or the library (on the iPhone it also
          offers the camera). */}
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        tabIndex={-1}
        aria-hidden
        className="hidden"
        onChange={picked}
      />
      <input
        ref={library}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden
        className="hidden"
        onChange={picked}
      />
    </li>
  );
}
