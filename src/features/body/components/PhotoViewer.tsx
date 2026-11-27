import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { fade } from '@/shared/design-tokens';
import { cn } from '@/shared/lib';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, TrashIcon } from '@/shared/ui';
import {
  clampZoom,
  fittedSize,
  ZOOM_DOUBLE_TAP,
  ZOOM_NONE,
  zoomAround,
  type Size,
  type ZoomState,
} from '../photoView';
import type { BodyPhoto, PhotoPose } from '../types';
import { StoredImage } from './PhotoImage';

/** A horizontal drag this far (px) at normal size moves to the next pose. */
const SWIPE_DISTANCE = 56;
/** Two taps within this time (ms) and distance (px) are a double tap. */
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DISTANCE = 30;
/** Moving less than this (px) is still a tap. */
const TAP_SLOP = 10;

/**
 * A check-in's photos full screen: one pose at a time, pinch or double tap to zoom, drag to
 * look around, swipe (or the arrows, the pose names, ← →) to the other poses, delete at the
 * top right (with "Rückgängig", handled by the caller).
 */
export function PhotoViewer({
  open,
  onOpenChange,
  photos,
  poses,
  pose,
  onPoseChange,
  dayLabel,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The check-in's photos in pose order. */
  photos: BodyPhoto[];
  poses: readonly PhotoPose[];
  /** The pose shown. */
  pose: string;
  onPoseChange: (pose: string) => void;
  dayLabel: string;
  onDelete: (photo: BodyPhoto) => void;
}) {
  const index = Math.max(
    0,
    photos.findIndex((p) => p.pose === pose),
  );
  const photo = photos[index];
  const label = (key: string) => poses.find((p) => p.key === key)?.label ?? key;
  const go = (step: number) => {
    const next = photos[index + step];
    if (next) onPoseChange(next.pose);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && photo && (
          <Dialog.Portal forceMount>
            <Dialog.Content
              asChild
              forceMount
              aria-describedby={undefined}
              // It covers the whole screen: what is "outside" is the toast ("Rückgängig"),
              // which must not close it.
              onInteractOutside={(event) => {
                event.preventDefault();
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') go(-1);
                if (event.key === 'ArrowRight') go(1);
              }}
            >
              <motion.div
                className="fixed inset-0 z-40 flex flex-col bg-bg pt-safe pb-safe outline-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fade.base}
              >
                <div className="flex min-h-tap shrink-0 items-center justify-between gap-2 px-2 pt-2">
                  <Dialog.Close
                    aria-label="Schließen"
                    className="flex size-tap items-center justify-center rounded-pill text-text active:bg-surface-2"
                  >
                    <CloseIcon className="size-6" />
                  </Dialog.Close>
                  <Dialog.Title className="min-w-0 truncate text-subhead font-semibold">
                    {label(photo.pose)} · {dayLabel}
                  </Dialog.Title>
                  <button
                    type="button"
                    aria-label="Foto löschen"
                    onClick={() => {
                      onDelete(photo);
                    }}
                    className="flex size-tap items-center justify-center rounded-pill text-danger active:bg-surface-2"
                  >
                    <TrashIcon className="size-6" />
                  </button>
                </div>

                <div className="relative min-h-0 flex-1">
                  <ZoomableImage
                    key={photo.id}
                    photo={photo}
                    alt={`${label(photo.pose)}, ${dayLabel}`}
                    onSwipe={go}
                  />
                  {index > 0 && (
                    <button
                      type="button"
                      aria-label="Vorige Pose"
                      onClick={() => {
                        go(-1);
                      }}
                      className="absolute top-1/2 left-2 flex size-tap -translate-y-1/2 items-center justify-center rounded-pill glass text-text"
                    >
                      <ChevronLeftIcon className="size-5" />
                    </button>
                  )}
                  {index < photos.length - 1 && (
                    <button
                      type="button"
                      aria-label="Nächste Pose"
                      onClick={() => {
                        go(1);
                      }}
                      className="absolute top-1/2 right-2 flex size-tap -translate-y-1/2 items-center justify-center rounded-pill glass text-text"
                    >
                      <ChevronRightIcon className="size-5" />
                    </button>
                  )}
                </div>

                {photos.length > 1 && (
                  <div className="flex shrink-0 justify-center gap-1 px-gutter py-2">
                    {photos.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        aria-current={p.id === photo.id || undefined}
                        onClick={() => {
                          onPoseChange(p.pose);
                        }}
                        className={cn(
                          'min-h-tap rounded-pill px-4 text-footnote font-semibold active:bg-surface-2',
                          p.id === photo.id ? 'text-text' : 'text-text-subtle',
                        )}
                      >
                        {label(p.pose)}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

type Gesture =
  | { kind: 'pinch'; distance: number; mid: { x: number; y: number }; from: ZoomState }
  | { kind: 'pan'; x: number; y: number; from: ZoomState }
  | { kind: 'swipe'; x: number; y: number };

/**
 * The photo, zoomable without a library: pointer events (touch, pen, mouse) drive a CSS
 * transform. Pinch zooms around the fingers, a double tap zooms in at that point (or back
 * out), one finger pans a zoomed picture and swipes between poses at normal size.
 */
function ZoomableImage({
  photo,
  alt,
  onSwipe,
}: {
  photo: BodyPhoto;
  alt: string;
  onSwipe: (step: number) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const down = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState<ZoomState>(ZOOM_NONE);
  const [swipeX, setSwipeX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const viewport = (): { size: Size; cx: number; cy: number } => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { size: { width: 1, height: 1 }, cx: 0, cy: 0 };
    return {
      size: { width: rect.width, height: rect.height },
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
    };
  };
  const fitted = (size: Size) => fittedSize({ width: photo.width, height: photo.height }, size);
  /** A point relative to the centre of the viewport. */
  const local = (p: { x: number; y: number }) => {
    const v = viewport();
    return { x: p.x - v.cx, y: p.y - v.cy };
  };

  function start(current: ZoomState) {
    const points = [...pointers.current.values()];
    const [a, b] = points;
    if (a && b) {
      gesture.current = {
        kind: 'pinch',
        distance: Math.hypot(b.x - a.x, b.y - a.y),
        mid: local({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }),
        from: current,
      };
    } else if (a) {
      gesture.current =
        current.scale > 1
          ? { kind: 'pan', x: a.x, y: a.y, from: current }
          : { kind: 'swipe', ...a };
    } else {
      gesture.current = null;
    }
  }

  function onPointerDown(event: React.PointerEvent) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1)
      down.current = { x: event.clientX, y: event.clientY, moved: false };
    else if (down.current) down.current.moved = true;
    setDragging(true);
    start(zoom);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (
      down.current &&
      Math.hypot(event.clientX - down.current.x, event.clientY - down.current.y) > TAP_SLOP
    )
      down.current.moved = true;
    const g = gesture.current;
    if (!g) return;
    const { size } = viewport();
    const fit = fitted(size);
    if (g.kind === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b || g.distance === 0) return;
      const mid = local({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const scaled = zoomAround(
        g.from,
        (g.from.scale * Math.hypot(b.x - a.x, b.y - a.y)) / g.distance,
        g.mid,
        fit,
        size,
      );
      // Moving both fingers together drags the picture along.
      setZoom(
        clampZoom(
          { ...scaled, x: scaled.x + mid.x - g.mid.x, y: scaled.y + mid.y - g.mid.y },
          fit,
          size,
        ),
      );
    } else if (g.kind === 'pan') {
      setZoom(
        clampZoom(
          { ...g.from, x: g.from.x + event.clientX - g.x, y: g.from.y + event.clientY - g.y },
          fit,
          size,
        ),
      );
    } else {
      setSwipeX(event.clientX - g.x);
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    const g = gesture.current;
    if (g?.kind === 'swipe' && event.type === 'pointerup') {
      const dx = event.clientX - g.x;
      if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(event.clientY - g.y))
        onSwipe(dx < 0 ? 1 : -1);
    }
    setSwipeX(0);
    if (pointers.current.size > 0) {
      // One finger left after a pinch: it goes on panning from here.
      start(zoom);
      return;
    }
    gesture.current = null;
    setDragging(false);
    const tap = down.current && !down.current.moved && event.type === 'pointerup';
    down.current = null;
    if (!tap) return;
    const now = event.timeStamp;
    const last = lastTap.current;
    if (
      last &&
      now - last.t < DOUBLE_TAP_MS &&
      Math.hypot(event.clientX - last.x, event.clientY - last.y) < DOUBLE_TAP_DISTANCE
    ) {
      lastTap.current = null;
      const { size } = viewport();
      setZoom(
        zoom.scale > 1
          ? ZOOM_NONE
          : zoomAround(
              zoom,
              ZOOM_DOUBLE_TAP,
              local({ x: event.clientX, y: event.clientY }),
              fitted(size),
              size,
            ),
      );
    } else {
      lastTap.current = { t: now, x: event.clientX, y: event.clientY };
    }
  }

  return (
    <div
      ref={viewportRef}
      className="absolute inset-0 touch-none overflow-hidden select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className={cn(
          'absolute inset-0',
          !dragging && 'transition-transform duration-(--duration-base) ease-ios',
        )}
        style={{
          transform: `translate(${String(zoom.x + swipeX)}px, ${String(zoom.y)}px) scale(${String(zoom.scale)})`,
        }}
      >
        {/* The thumbnail (usually signed already) shows until the full size has loaded. */}
        <StoredImage
          path={photo.thumbPath}
          alt=""
          className="absolute inset-0 size-full object-contain"
        />
        <StoredImage
          path={photo.path}
          alt={alt}
          placeholder={false}
          className="absolute inset-0 size-full object-contain"
        />
      </div>
    </div>
  );
}
