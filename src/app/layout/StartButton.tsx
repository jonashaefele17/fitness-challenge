import { motion } from 'motion/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { StartTrainingSheet } from '@/features/training';
import { pressScale, spring } from '@/shared/design-tokens';
import { PlusIcon } from '@/shared/ui';
import { paths } from '../paths';

/** Round "+" next to the pill nav: start (or resume) a training. */
export function StartButton() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <motion.button
        type="button"
        aria-label="Training starten"
        whileTap={{ scale: pressScale }}
        transition={spring.press}
        className="pointer-events-auto flex size-nav shrink-0 items-center justify-center rounded-pill glass-accent text-title-1 text-on-accent"
        onClick={() => {
          setOpen(true);
        }}
      >
        <PlusIcon />
      </motion.button>
      <StartTrainingSheet
        open={open}
        onOpenChange={setOpen}
        onOpenWorkout={() => void navigate(paths.liveWorkout)}
      />
    </>
  );
}
