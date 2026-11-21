import { useState } from 'react';
import { personColorVar } from '@/shared/design-tokens';
import { cn } from '@/shared/lib';
import type { Profile } from '../types';

export interface AvatarProps {
  profile: Pick<Profile, 'displayName' | 'avatarUrl' | 'color'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'size-8 text-footnote',
  md: 'size-10 text-subhead',
  lg: 'size-16 text-title-2',
} as const;

/** Round avatar with a ring in the person's fixed colour; falls back to the initial. */
export function Avatar({ profile, size = 'md', className }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = profile.avatarUrl !== null && !imageFailed;

  return (
    // The coloured ring is drawn inside the box (border + gap), so it is never clipped
    // by scroll containers.
    <span
      className={cn(
        'inline-flex shrink-0 rounded-pill border-2 border-solid p-0.5 font-semibold',
        sizeClasses[size],
        className,
      )}
      style={{ borderColor: personColorVar(profile.color) }}
    >
      <span className="flex size-full items-center justify-center overflow-hidden rounded-pill bg-surface-3">
        {showImage ? (
          <img
            src={profile.avatarUrl ?? undefined}
            alt=""
            referrerPolicy="no-referrer"
            className="size-full object-cover"
            onError={() => {
              setImageFailed(true);
            }}
          />
        ) : (
          <span aria-hidden>{profile.displayName.charAt(0).toUpperCase()}</span>
        )}
      </span>
    </span>
  );
}
