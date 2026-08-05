import { useEffect, useRef, useState } from 'react';

import type { LiveLocation } from '@/repositories/location-repository';

const DEFAULT_ANIMATION_MS = 900;
const MIN_ANIMATION_MS = 250;
const MAX_ANIMATION_MS = 1800;
const SNAP_AFTER_GAP_MS = 10000;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

// Longitude needs the shortest path around the globe: a normal numeric lerp
// from 179.9 to -179.9 would send a marker almost 360 degrees the wrong way.
export function interpolateLongitude(from: number, to: number, progress: number): number {
  const delta = ((to - from + 540) % 360) - 180;
  const value = from + delta * progress;
  return ((value + 540) % 360) - 180;
}

export function interpolateHeading(from: number | null, to: number | null, progress: number): number | null {
  if (to === null) return null;
  if (from === null) return to;
  const delta = ((to - from + 540) % 360) - 180;
  return (from + delta * progress + 360) % 360;
}

export function getLocationAnimationDuration(previousUpdatedAt: string, nextUpdatedAt: string): number {
  const gap = new Date(nextUpdatedAt).getTime() - new Date(previousUpdatedAt).getTime();
  if (!Number.isFinite(gap) || gap <= 0) return DEFAULT_ANIMATION_MS;
  return clamp(gap * 0.9, MIN_ANIMATION_MS, MAX_ANIMATION_MS);
}

// Keeps raw locations authoritative in useLiveLocations while rendering a
// marker through intermediate geographic coordinates at the display frame
// rate. A new packet starts from the point currently on screen, so network
// jitter or a packet arriving midway through an animation never causes a
// teleport. Long foreground/reconnect gaps snap to the recovered current
// position rather than animating across miles of stale road.
export function useSmoothedLocation(location: LiveLocation, reduceMotion: boolean): LiveLocation {
  const [displayedLocation, setDisplayedLocation] = useState<LiveLocation>(() => location);
  const displayedRef = useRef(location);
  const previousTargetRef = useRef(location);

  useEffect(() => {
    const previousTarget = previousTargetRef.current;
    previousTargetRef.current = location;

    let frameId: number | null = null;

    if (reduceMotion) {
      displayedRef.current = location;
      frameId = requestAnimationFrame(() => setDisplayedLocation(location));
      return () => cancelAnimationFrame(frameId!);
    }

    const timestampGap = new Date(location.updatedAt).getTime() - new Date(previousTarget.updatedAt).getTime();
    if (timestampGap > SNAP_AFTER_GAP_MS) {
      displayedRef.current = location;
      frameId = requestAnimationFrame(() => setDisplayedLocation(location));
      return () => cancelAnimationFrame(frameId!);
    }

    const from = displayedRef.current;
    if (from.lat === location.lat && from.lng === location.lng && from.heading === location.heading) {
      // Common while stopped and also true on the initial mount. Keep the
      // freshest metadata without running a no-op animation every second.
      displayedRef.current = location;
      return;
    }

    const duration = getLocationAnimationDuration(previousTarget.updatedAt, location.updatedAt);
    const startedAt = Date.now();

    const animate = () => {
      const progress = clamp((Date.now() - startedAt) / duration, 0, 1);
      const next: LiveLocation = {
        ...location,
        lat: from.lat + (location.lat - from.lat) * progress,
        lng: interpolateLongitude(from.lng, location.lng, progress),
        heading: interpolateHeading(from.heading, location.heading, progress),
      };
      displayedRef.current = next;
      setDisplayedLocation(next);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [location, reduceMotion]);

  return reduceMotion ? location : displayedLocation;
}
