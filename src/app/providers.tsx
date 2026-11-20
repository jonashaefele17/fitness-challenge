import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { SessionProvider } from '@/features/auth';
import { createQueryClient } from '@/shared/lib';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {/* "user" follows the OS setting prefers-reduced-motion for every Motion animation. */}
      <MotionConfig reducedMotion="user">
        <SessionProvider>{children}</SessionProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
