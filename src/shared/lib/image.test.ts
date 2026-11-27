import { describe, expect, it } from 'vitest';
import { downscaleSteps, fitWithin, qualitySteps } from './image';

describe('fitWithin', () => {
  it('scales the longer side down to maxEdge, aspect kept', () => {
    expect(fitWithin({ width: 3024, height: 4032 }, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin({ width: 4032, height: 3024 }, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin({ width: 4000, height: 4000 }, 320)).toEqual({ width: 320, height: 320 });
  });

  it('never upscales', () => {
    expect(fitWithin({ width: 800, height: 600 }, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin({ width: 1600, height: 900 }, 1600)).toEqual({ width: 1600, height: 900 });
  });

  it('rounds to whole pixels and keeps at least one', () => {
    expect(fitWithin({ width: 1000, height: 333 }, 320)).toEqual({ width: 320, height: 107 });
    expect(fitWithin({ width: 10000, height: 1 }, 320)).toEqual({ width: 320, height: 1 });
  });

  it('refuses an image without size', () => {
    expect(() => fitWithin({ width: 0, height: 100 }, 320)).toThrow();
  });
});

describe('downscaleSteps', () => {
  it('halves while more than twice the target is left, then the target', () => {
    expect(downscaleSteps({ width: 1200, height: 1600 }, { width: 240, height: 320 })).toEqual([
      { width: 600, height: 800 },
      { width: 240, height: 320 },
    ]);
    expect(downscaleSteps({ width: 3024, height: 4032 }, { width: 240, height: 320 })).toEqual([
      { width: 1512, height: 2016 },
      { width: 756, height: 1008 },
      { width: 240, height: 320 },
    ]);
  });

  it('is one step for small reductions and for no change', () => {
    expect(downscaleSteps({ width: 2000, height: 1500 }, { width: 1600, height: 1200 })).toEqual([
      { width: 1600, height: 1200 },
    ]);
    expect(downscaleSteps({ width: 800, height: 600 }, { width: 800, height: 600 })).toEqual([
      { width: 800, height: 600 },
    ]);
  });
});

describe('qualitySteps', () => {
  it('goes down in steps of 0.1 to the minimum', () => {
    expect(qualitySteps(0.8, 0.5)).toEqual([0.8, 0.7, 0.6, 0.5]);
  });

  it('is just the quality when it is at or below the minimum', () => {
    expect(qualitySteps(0.5, 0.5)).toEqual([0.5]);
    expect(qualitySteps(0.4, 0.5)).toEqual([0.4]);
  });
});
