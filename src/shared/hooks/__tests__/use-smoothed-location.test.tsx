import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import type { LiveLocation } from '@/repositories/location-repository';
import {
  getLocationAnimationDuration,
  interpolateHeading,
  interpolateLongitude,
  useSmoothedLocation,
} from '@/shared/hooks/use-smoothed-location';

type FrameCallback = (timestamp: number) => void;

const originalRequestAnimationFrame = global.requestAnimationFrame;
const originalCancelAnimationFrame = global.cancelAnimationFrame;

let nextFrameId = 1;
let pendingFrames = new Map<number, FrameCallback>();

function location(overrides: Partial<LiveLocation> = {}): LiveLocation {
  return {
    userId: 'user-1',
    lat: 0,
    lng: 0,
    heading: 350,
    updatedAt: '2026-08-04T12:00:00.000Z',
    ...overrides,
  };
}

function runNextFrame(): void {
  const entry = pendingFrames.entries().next().value as [number, FrameCallback] | undefined;
  if (!entry) throw new Error('Expected a pending animation frame.');
  const [id, callback] = entry;
  pendingFrames.delete(id);
  callback(Date.now());
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-08-04T12:00:00.000Z') });
  nextFrameId = 1;
  pendingFrames = new Map();
  global.requestAnimationFrame = ((callback: FrameCallback) => {
    const id = nextFrameId++;
    pendingFrames.set(id, callback);
    return id;
  }) as typeof requestAnimationFrame;
  global.cancelAnimationFrame = ((id: number) => {
    pendingFrames.delete(id);
  }) as typeof cancelAnimationFrame;
});

afterEach(() => {
  global.requestAnimationFrame = originalRequestAnimationFrame;
  global.cancelAnimationFrame = originalCancelAnimationFrame;
  jest.useRealTimers();
});

describe('location interpolation helpers', () => {
  test('derives animation duration from packet cadence and clamps very short or long gaps', () => {
    const start = '2026-08-04T12:00:00.000Z';

    expect(getLocationAnimationDuration(start, '2026-08-04T12:00:01.000Z')).toBe(900);
    expect(getLocationAnimationDuration(start, '2026-08-04T12:00:00.100Z')).toBe(250);
    expect(getLocationAnimationDuration(start, '2026-08-04T12:00:03.000Z')).toBe(1800);
    expect(getLocationAnimationDuration('invalid', start)).toBe(900);
  });

  test('interpolates longitude across the dateline by the short path', () => {
    expect(interpolateLongitude(179, -179, 0.5)).toBe(-180);
    expect(interpolateLongitude(-179, 179, 0.5)).toBe(-180);
  });

  test('interpolates heading through north rather than rotating the long way around', () => {
    expect(interpolateHeading(350, 10, 0.5)).toBe(0);
    expect(interpolateHeading(10, 350, 0.5)).toBe(0);
    expect(interpolateHeading(null, 90, 0.5)).toBe(90);
    expect(interpolateHeading(90, null, 0.5)).toBeNull();
  });
});

describe('useSmoothedLocation', () => {
  test('progresses between fixes on animation frames and lands exactly on the target', async () => {
    const initial = location({ lng: 179 });
    const target = location({
      lat: 10,
      lng: -179,
      heading: 10,
      updatedAt: '2026-08-04T12:00:01.000Z',
    });
    const view = await renderHook(
      ({ value, reduceMotion }: { value: LiveLocation; reduceMotion: boolean }) => useSmoothedLocation(value, reduceMotion),
      { initialProps: { value: initial, reduceMotion: false } },
    );

    await view.rerender({ value: target, reduceMotion: false });
    expect(view.result.current).toMatchObject({ lat: 0, lng: 179, heading: 350 });

    await act(async () => {
      jest.setSystemTime(new Date('2026-08-04T12:00:00.450Z'));
      runNextFrame();
    });
    expect(view.result.current).toMatchObject({ lat: 5, lng: -180, heading: 0 });

    await act(async () => {
      jest.setSystemTime(new Date('2026-08-04T12:00:00.900Z'));
      runNextFrame();
    });
    expect(view.result.current).toMatchObject({ lat: 10, lng: -179, heading: 10 });
    expect(pendingFrames.size).toBe(0);
  });

  test('snaps on the next frame after a long location gap instead of tweening stale road', async () => {
    const initial = location();
    const recovered = location({
      lat: 42,
      lng: -71,
      heading: 90,
      updatedAt: '2026-08-04T12:00:11.000Z',
    });
    const view = await renderHook(
      ({ value, reduceMotion }: { value: LiveLocation; reduceMotion: boolean }) => useSmoothedLocation(value, reduceMotion),
      { initialProps: { value: initial, reduceMotion: false } },
    );

    await view.rerender({ value: recovered, reduceMotion: false });
    await act(async () => runNextFrame());

    expect(view.result.current).toEqual(recovered);
    expect(pendingFrames.size).toBe(0);
  });

  test('returns the newest fix immediately when Reduce Motion is enabled', async () => {
    const initial = location();
    const target = location({
      lat: 10,
      lng: 20,
      heading: 45,
      updatedAt: '2026-08-04T12:00:01.000Z',
    });
    const view = await renderHook(
      ({ value, reduceMotion }: { value: LiveLocation; reduceMotion: boolean }) => useSmoothedLocation(value, reduceMotion),
      { initialProps: { value: initial, reduceMotion: false } },
    );

    await view.rerender({ value: target, reduceMotion: true });

    expect(view.result.current).toEqual(target);
  });
});
