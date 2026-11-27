import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BodyPhoto, PhotoPose } from '../types';
import { CheckinPhotoStep } from './CheckinPhotoStep';

vi.mock('../api/usePhotos', () => ({
  useBodyPhotoUrl: () => undefined,
}));

const poses: PhotoPose[] = [
  { key: 'front', label: 'Vorne', sort: 10 },
  { key: 'side', label: 'Seite', sort: 20 },
  { key: 'back', label: 'Hinten', sort: 30 },
];

const front: BodyPhoto = {
  id: 'p1',
  checkinId: 'c1',
  pose: 'front',
  path: 'u/c1/front-p1.jpg',
  thumbPath: 'u/c1/front-p1-thumb.jpg',
  width: 1200,
  height: 1600,
  bytes: 300_000,
  createdAt: '2026-11-01T08:00:00Z',
};

function renderStep(props: Partial<Parameters<typeof CheckinPhotoStep>[0]> = {}) {
  const onChange = vi.fn();
  const onLeave = vi.fn();
  const view = render(
    <CheckinPhotoStep
      poses={poses}
      existing={[]}
      photos={{}}
      previous={{}}
      formatDay={(day) => day}
      isLast
      onBack={undefined}
      onChange={onChange}
      onLeave={onLeave}
      {...props}
    />,
  );
  return { ...view, onChange, onLeave };
}

afterEach(cleanup);

describe('CheckinPhotoStep', () => {
  it('offers camera and library per empty pose, and skipping', () => {
    const { onLeave } = renderStep();
    expect(screen.getAllByRole('button', { name: 'Aufnehmen' })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Aus Mediathek' })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Überspringen' }));
    expect(onLeave).toHaveBeenCalled();
  });

  it('takes a picked file for its pose; only the camera input asks for the camera', () => {
    const { container, onChange } = renderStep();
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type=file]');
    expect(inputs).toHaveLength(6);
    expect(inputs[0]?.getAttribute('capture')).toBe('environment');
    expect(inputs[1]?.hasAttribute('capture')).toBe(false);
    const file = new File(['x'], 'side.jpg', { type: 'image/jpeg' });
    fireEvent.change(inputs[3] as HTMLInputElement, { target: { files: [file] } });
    expect(onChange).toHaveBeenCalledWith('side', file);
  });

  it('removes a kept photo (null) and shows last time as reference', () => {
    const { onChange } = renderStep({
      existing: [front],
      previous: { back: { photo: { ...front, id: 'p0', pose: 'back' }, onDate: '2026-10-01' } },
    });
    expect(screen.getByText('2026-10-01')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Überspringen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    expect(onChange).toHaveBeenCalledWith('front', null);
  });
});
