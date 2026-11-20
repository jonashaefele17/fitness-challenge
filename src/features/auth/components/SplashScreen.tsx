import { motion } from 'motion/react';

/** Shown while the session is being restored. */
export function SplashScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Lädt">
      <motion.div
        aria-hidden
        className="size-16 rounded-card bg-accent"
        animate={{ scale: [1, 0.92, 1], opacity: [1, 0.7, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}
