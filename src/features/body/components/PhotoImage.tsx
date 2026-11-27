import { useCallback } from 'react';
import { cn } from '@/shared/lib';
import { useBodyPhotoUrl } from '../api/usePhotos';

/**
 * A picture picked on the device, shown before it is uploaded. The object URL lives exactly
 * as long as the <img> shows this blob (React 19 ref cleanup), so nothing leaks.
 */
export function BlobImage({
  blob,
  alt,
  className,
}: {
  blob: Blob;
  alt: string;
  className?: string;
}) {
  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img) return;
      const url = URL.createObjectURL(blob);
      img.src = url;
      return () => {
        URL.revokeObjectURL(url);
      };
    },
    [blob],
  );
  return <img ref={ref} alt={alt} draggable={false} className={cn('select-none', className)} />;
}

/**
 * A stored photo file (private bucket: signed on demand; files asked for in the same render
 * are signed with one request). A calm surface while signing.
 */
export function StoredImage({
  path,
  alt,
  className,
  placeholder = true,
}: {
  path: string;
  alt: string;
  className?: string;
  /** false: nothing while signing (e.g. something else shows underneath meanwhile). */
  placeholder?: boolean;
}) {
  const src = useBodyPhotoUrl(path);
  if (!src)
    return placeholder ? (
      <span aria-hidden className={cn('block bg-surface-3', className)} />
    ) : null;
  return <img src={src} alt={alt} draggable={false} className={cn('select-none', className)} />;
}
