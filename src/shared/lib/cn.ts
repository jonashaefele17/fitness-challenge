import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Teach tailwind-merge our custom font-size tokens so `text-body` and `text-accent`
// are not treated as conflicting classes.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'caption',
            'footnote',
            'subhead',
            'body',
            'title-3',
            'title-2',
            'title-1',
            'large-title',
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
