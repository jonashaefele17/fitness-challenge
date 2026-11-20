// TEMPORARY: colourful filler so the glass navigation can be judged on staging.
// Remove before merging feat/foundation.
import { Card } from '@/shared/ui';

const swatches = [
  'bg-person-1',
  'bg-person-2',
  'bg-accent',
  'bg-person-3',
  'bg-person-4',
  'bg-person-5',
  'bg-person-6',
  'bg-person-7',
];

export function GlassPreview() {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <p className="text-footnote text-text-subtle">
        Vorschau-Inhalt (temporär) – zum Testen der Glas-Navigation nach unten scrollen.
      </p>
      {Array.from({ length: 12 }, (_, index) => (
        <Card key={index} padding="none" className="overflow-hidden">
          <div className={`h-24 ${swatches[index % swatches.length] ?? 'bg-accent'}`} />
          <div className="p-4">
            <p className="text-subhead font-semibold">Beispielkarte {index + 1}</p>
            <p className="text-footnote text-text-muted">Bankdrücken 4 × 8 · 80 kg · mit Max</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
