import { motion } from 'motion/react';
import { useState } from 'react';
import { pressScale, spring } from '@/shared/design-tokens';
import { Card, PlusIcon, Sheet } from '@/shared/ui';

/** Round "+" next to the pill nav; opens the start flow (built in the training module). */
export function StartButton() {
  const [open, setOpen] = useState(false);

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
      <Sheet open={open} onOpenChange={setOpen} title="Training starten">
        <Card elevated className="text-subhead text-text-muted">
          Hier wählst du bald Trainingsart, Vorlage und mit wem du trainierst.
        </Card>
      </Sheet>
    </>
  );
}
