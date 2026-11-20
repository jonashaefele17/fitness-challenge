import { useState } from 'react';
import { personColorVar } from '@/shared/design-tokens';
import { cn } from '@/shared/lib';
import type { Profile } from '../types';

export interface AvatarProps {
  profile: Pick<Profile, 'displayName' | 'avatarUrl' | 'color'>;
  size?: 'md' | 'lg';
  className?: string;
}

const sizeClasses = { md: 'size-10 text-subhead', lg: 'size-16 text-title-2' } as const;

/** Round avatar with a ring in the person's fixed colour; falls back to the initial. */
export function Avatar({ profile, size = 'md', className }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = profile.avatarUrl !== null && !imageFailed;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-pill bg-surface-3 font-semibold outline-2 outline-offset-2 outline-solid',
        sizeClasses[size],
        className,
      )}
      style={{ outlineColor: personColorVar(profile.color) }}
    >
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
  );
}
