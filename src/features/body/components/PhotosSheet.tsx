import { useState } from 'react';
import { showToast } from '@/shared/lib';
import { Button, Sheet } from '@/shared/ui';
import { useCheckins, useDeleteCheckin, useRestoreCheckin } from '../api/useCheckins';
import { useDeleteBodyPhoto, usePhotoPoses, useRestoreBodyPhoto } from '../api/usePhotos';
import { photoDeleteTarget } from '../photoView';
import { checkinsWithPhotos, photoOfPose, photosInPoseOrder } from '../photos';
import type { BodyCheckin, BodyPhoto } from '../types';
import { PhotoCompareSheet } from './PhotoCompareSheet';
import { StoredImage } from './PhotoImage';
import { PhotoViewer } from './PhotoViewer';

const listDate = new Intl.DateTimeFormat('de', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const viewerDate = new Intl.DateTimeFormat('de', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const date = (day: string) => new Date(`${day}T12:00:00`);

/**
 * Ich → Körper → Zwischenstand → Fotos: the check-ins with photos, newest first, each with
 * its pictures in pose order (tap: large). "Vergleichen" puts two of them side by side.
 * Stays mounted (closed) so that "Rückgängig" works after the last photo is gone.
 */
export function PhotosSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const checkins = useCheckins().data ?? [];
  const poses = usePhotoPoses().data ?? [];
  const deletePhoto = useDeleteBodyPhoto();
  const restorePhoto = useRestoreBodyPhoto();
  const deleteCheckin = useDeleteCheckin();
  const restoreCheckin = useRestoreCheckin();
  const [shown, setShown] = useState<{ checkinId: string; pose: string } | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const list = checkinsWithPhotos(checkins);
  const viewed = shown ? checkins.find((c) => c.id === shown.checkinId) : undefined;
  const viewedPhotos = viewed ? photosInPoseOrder(viewed.photos, poses) : [];

  function remove(checkin: BodyCheckin, photo: BodyPhoto) {
    const ordered = photosInPoseOrder(checkin.photos, poses);
    const at = ordered.findIndex((p) => p.id === photo.id);
    // Stay on the check-in with the next pose (else the one before), or close when none is left.
    const next = ordered[at + 1] ?? ordered[at - 1];
    if (next) setShown({ checkinId: checkin.id, pose: next.pose });
    else setViewerOpen(false);

    if (photoDeleteTarget(checkin, photo) === 'checkin') {
      // Without measurements an empty check-in would still count as done: it goes too.
      deleteCheckin.mutate(checkin.id, {
        onError: () => {
          showToast('Foto konnte nicht gelöscht werden.');
        },
      });
      showToast('Foto und Zwischenstand gelöscht', {
        label: 'Rückgängig',
        onAction: () => {
          restoreCheckin.mutate(checkin);
        },
      });
      return;
    }
    deletePhoto.mutate(photo, {
      onError: () => {
        showToast('Foto konnte nicht gelöscht werden.');
      },
    });
    showToast('Foto gelöscht', {
      label: 'Rückgängig',
      onAction: () => {
        restorePhoto.mutate(photo, {
          onError: () => {
            showToast('Foto konnte nicht wiederhergestellt werden.');
          },
        });
      },
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Fotos"
      action={
        list.length >= 2 ? (
          <Button
            variant="ghost"
            onClick={() => {
              setCompareOpen(true);
            }}
          >
            Vergleichen
          </Button>
        ) : undefined
      }
    >
      {list.length === 0 ? (
        <p className="text-subhead text-text-muted">Noch keine Fotos.</p>
      ) : (
        <ul className="flex flex-col gap-3 pt-1">
          {list.map((checkin) => (
            <li key={checkin.id} className="flex flex-col gap-2 rounded-card bg-surface-2 p-3">
              <span className="text-subhead font-semibold">
                {listDate.format(date(checkin.onDate))}
              </span>
              {/* One column per pose, so the poses line up from one check-in to the next. */}
              <div className="grid grid-cols-3 gap-2">
                {poses.map((pose) => {
                  const photo = photoOfPose(checkin, pose.key);
                  return photo ? (
                    <button
                      key={pose.key}
                      type="button"
                      aria-label={`${pose.label}, ${viewerDate.format(date(checkin.onDate))}`}
                      onClick={() => {
                        setShown({ checkinId: checkin.id, pose: pose.key });
                        setViewerOpen(true);
                      }}
                      className="aspect-3/4 overflow-hidden rounded-md bg-surface-3 active:opacity-80"
                    >
                      <StoredImage
                        path={photo.thumbPath}
                        alt=""
                        className="size-full object-cover"
                      />
                    </button>
                  ) : (
                    <span
                      key={pose.key}
                      aria-hidden
                      className="aspect-3/4 rounded-md border border-dashed border-border"
                    />
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}

      <PhotoViewer
        open={viewerOpen && viewedPhotos.length > 0}
        onOpenChange={setViewerOpen}
        photos={viewedPhotos}
        poses={poses}
        pose={shown?.pose ?? ''}
        onPoseChange={(pose) => {
          if (shown) setShown({ ...shown, pose });
        }}
        dayLabel={viewed ? viewerDate.format(date(viewed.onDate)) : ''}
        onDelete={(photo) => {
          if (viewed) remove(viewed, photo);
        }}
      />
      <PhotoCompareSheet
        open={compareOpen}
        onOpenChange={setCompareOpen}
        checkins={list}
        poses={poses}
      />
    </Sheet>
  );
}
