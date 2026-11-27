import { useEffect } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { downscaleImage } from '@/shared/lib/image';
import { supabase } from '@/shared/lib/supabase';
import {
  PHOTO_BUCKET,
  PHOTO_FULL,
  PHOTO_PURGE_GRACE_MS,
  PHOTO_THUMB,
  PHOTO_URL_EXPIRY_S,
  photoFilePaths,
  withPhoto,
  withoutPhoto,
} from '../photos';
import type { AddBodyPhotoInput, BodyCheckin, BodyPhoto, PhotoPose } from '../types';
import { bodyKeys } from './keys';

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

/** The fixed poses (Vorne, Seite, Hinten) in their order. Rarely changes: cached for a day. */
export function usePhotoPoses() {
  const userId = useUserId();
  return useQuery({
    queryKey: bodyKeys.photoPoses(userId),
    staleTime: 24 * 60 * 60_000,
    queryFn: async (): Promise<PhotoPose[]> => {
      const { data, error } = await supabase
        .from('body_photo_poses')
        .select('key, label, sort')
        .order('sort');
      if (error) throw error;
      return data;
    },
  });
}

// ---------------------------------------------------------------------------
// Purge: soft-deleted photos lose their files and rows after a grace period
// ---------------------------------------------------------------------------

/**
 * Removes the files of my photos deleted longer than the grace period ago (database time),
 * then their rows. Returns how many were purged. Failing files keep their rows, so the next
 * purge tries again.
 */
export async function purgeDeletedPhotos(): Promise<number> {
  const { data, error } = await supabase.rpc('body_photos_to_purge', {
    p_grace_seconds: Math.round(PHOTO_PURGE_GRACE_MS / 1000),
  });
  if (error) throw error;
  if (data.length === 0) return 0;
  const { error: removeError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .remove(data.flatMap((p) => [p.path, p.thumb_path]));
  if (removeError) throw removeError;
  const { error: deleteError } = await supabase
    .from('body_photos')
    .delete()
    .in(
      'id',
      data.map((p) => p.id),
    );
  if (deleteError) throw deleteError;
  return data.length;
}

let purgeTimer: ReturnType<typeof setTimeout> | undefined;
const purgedOnStart = new Set<string>();

/** Runs the purge once the grace period of a deletion just made has passed. */
export function schedulePhotoPurge() {
  clearTimeout(purgeTimer);
  purgeTimer = setTimeout(() => {
    // A failed purge is retried on the next start or deletion.
    purgeDeletedPhotos().catch(() => undefined);
  }, PHOTO_PURGE_GRACE_MS + 5_000);
}

/**
 * Purges once per app session when the body section opens (a closed app does not leave
 * files behind), and again after the grace period of anything deleted meanwhile.
 */
export function usePhotoPurgeOnStart() {
  const userId = useUserId();
  useEffect(() => {
    if (purgedOnStart.has(userId)) return;
    purgedOnStart.add(userId);
    purgeDeletedPhotos().catch(() => undefined);
    // Something deleted shortly before the start is still in its grace period.
    schedulePhotoPurge();
  }, [userId]);
}

// ---------------------------------------------------------------------------
// Adding, deleting, restoring (the check-in list is the cache of the photos)
// ---------------------------------------------------------------------------

function usePhotoCache() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const key = bodyKeys.checkins(userId);
  return {
    async change(change: (list: BodyCheckin[]) => BodyCheckin[]) {
      await queryClient.cancelQueries({ queryKey: key });
      const snapshot = queryClient.getQueryData<BodyCheckin[]>(key);
      if (snapshot) queryClient.setQueryData<BodyCheckin[]>(key, change(snapshot));
      return snapshot;
    },
    rollback(snapshot: BodyCheckin[] | undefined) {
      if (snapshot) queryClient.setQueryData(key, snapshot);
    },
    refresh: () => queryClient.invalidateQueries({ queryKey: key }),
  };
}

/**
 * Adds a photo to a saved check-in of mine (save the check-in first): downscales the picture
 * on the device (1600 px, thumbnail 320 px, JPEG without EXIF), uploads both files, then adds
 * the row. Replaces the live photo of the same pose (that one is purged later). Shows once
 * uploaded – for a preview meanwhile, use the picked file (URL.createObjectURL). A failed
 * step leaves no row; uploaded files are removed again.
 */
export function useAddBodyPhoto() {
  const cache = usePhotoCache();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: AddBodyPhotoInput): Promise<BodyPhoto> => {
      const id = input.id ?? crypto.randomUUID();
      const full = await downscaleImage(input.file, PHOTO_FULL);
      // From the downscaled one: oriented already and much cheaper to decode.
      const thumb = await downscaleImage(full.blob, PHOTO_THUMB);
      const { path, thumbPath } = photoFilePaths(userId, input.checkinId, input.pose, id);
      const bucket = supabase.storage.from(PHOTO_BUCKET);
      const options = { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' };

      const { error: fullError } = await bucket.upload(path, full.blob, options);
      if (fullError) throw fullError;
      const { error: thumbError } = await bucket.upload(thumbPath, thumb.blob, options);
      if (thumbError) {
        await bucket.remove([path]);
        throw thumbError;
      }
      const { error } = await supabase.rpc('add_body_photo', {
        p_checkin_id: input.checkinId,
        p_pose: input.pose,
        p_path: path,
        p_thumb_path: thumbPath,
        p_width: full.width,
        p_height: full.height,
        p_bytes: full.blob.size,
        p_id: id,
      });
      if (error) {
        await bucket.remove([path, thumbPath]);
        throw error;
      }
      return {
        id,
        checkinId: input.checkinId,
        pose: input.pose,
        path,
        thumbPath,
        width: full.width,
        height: full.height,
        bytes: full.blob.size,
        createdAt: new Date().toISOString(),
      };
    },
    onSuccess: async (photo) => {
      await cache.change((list) => withPhoto(list, photo));
      // A replaced photo waits for the purge.
      schedulePhotoPurge();
    },
    onSettled: cache.refresh,
  });
}

/** Delete a photo (soft; shows at once). Undo: useRestoreBodyPhoto(photo) within the toast. */
export function useDeleteBodyPhoto() {
  const cache = usePhotoCache();
  return useMutation({
    mutationFn: async (photo: BodyPhoto) => {
      const { error } = await supabase
        .from('body_photos')
        // The database stamps its own time.
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', photo.id);
      if (error) throw error;
    },
    onMutate: (photo) => cache.change((list) => withoutPhoto(list, photo.id)),
    onSuccess: () => {
      schedulePhotoPurge();
    },
    onError: (_error, _photo, snapshot) => {
      cache.rollback(snapshot);
    },
    onSettled: cache.refresh,
  });
}

/**
 * Undo of useDeleteBodyPhoto. Fails when its check-in is gone (restore the check-in with
 * useRestoreCheckin instead) or another photo has taken the pose meanwhile.
 */
export function useRestoreBodyPhoto() {
  const cache = usePhotoCache();
  return useMutation({
    mutationFn: async (photo: BodyPhoto) => {
      const { error } = await supabase
        .from('body_photos')
        .update({ deleted_at: null })
        .eq('id', photo.id);
      if (error) throw error;
    },
    onMutate: (photo) => cache.change((list) => withPhoto(list, photo)),
    onError: (_error, _photo, snapshot) => {
      cache.rollback(snapshot);
    },
    onSettled: cache.refresh,
  });
}

// ---------------------------------------------------------------------------
// Showing: signed URLs (the bucket is private)
// ---------------------------------------------------------------------------

// Paths asked for in the same tick are signed with one request.
let pendingPaths = new Map<string, ((url: string | Error) => void)[]>();
let flushScheduled = false;

async function flushSignRequests() {
  const batch = pendingPaths;
  pendingPaths = new Map();
  flushScheduled = false;
  const paths = [...batch.keys()];
  const settle = (path: string, result: string | Error) => {
    for (const done of batch.get(path) ?? []) done(result);
  };
  try {
    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(paths, PHOTO_URL_EXPIRY_S);
    if (error) throw error;
    const byPath = new Map(data.map((d) => [d.path, d]));
    for (const path of paths) {
      const signed = byPath.get(path);
      if (signed?.signedUrl) settle(path, signed.signedUrl);
      else settle(path, new Error(signed?.error ?? 'photo_not_found'));
    }
  } catch (error) {
    for (const path of paths)
      settle(path, error instanceof Error ? error : new Error(String(error)));
  }
}

function signPath(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const waiting = pendingPaths.get(path) ?? [];
    waiting.push((result) => {
      if (result instanceof Error) reject(result);
      else resolve(result);
    });
    pendingPaths.set(path, waiting);
    if (!flushScheduled) {
      flushScheduled = true;
      queueMicrotask(() => {
        void flushSignRequests();
      });
    }
  });
}

// Signed for PHOTO_URL_EXPIRY_S; used for at most half of that, then signed anew.
const URL_STALE_MS = (PHOTO_URL_EXPIRY_S * 1000) / 2;

function photoUrlQuery(userId: string, path: string) {
  return {
    queryKey: bodyKeys.photoUrls(userId, [path]),
    queryFn: () => signPath(path),
    staleTime: URL_STALE_MS,
    gcTime: URL_STALE_MS / 2,
    refetchInterval: URL_STALE_MS,
  };
}

/**
 * Signed URLs for photo files (thumbPath for lists, path for the large view), by path. One
 * request for everything asked for at once; each URL is cached on its own, so adding a
 * picture to a list does not reload the others. Paths not signed yet are missing.
 */
export function useBodyPhotoUrls(paths: readonly string[]): Record<string, string> {
  const userId = useUserId();
  return useQueries({
    queries: paths.map((path) => photoUrlQuery(userId, path)),
    combine: (results) => {
      const urls: Record<string, string> = {};
      results.forEach((result, i) => {
        const path = paths[i];
        if (path !== undefined && result.data) urls[path] = result.data;
      });
      return urls;
    },
  });
}

/** The signed URL of one photo file (null: none); undefined while signing. */
export function useBodyPhotoUrl(path: string | null): string | undefined {
  const userId = useUserId();
  return useQuery({ ...photoUrlQuery(userId, path ?? ''), enabled: path !== null }).data;
}
