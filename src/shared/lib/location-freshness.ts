import type { LiveLocation } from '@/repositories/location-repository';

export type VoyagerFreshness = 'live' | 'delayed' | 'stale' | 'offline_or_suspended' | 'never_reported';

export function getLocationFreshness(
  location: LiveLocation | undefined,
  isPresent: boolean,
  nowMs = Date.now(),
): VoyagerFreshness {
  if (!location) return 'never_reported';
  const capturedAt = new Date(location.capturedAt ?? location.updatedAt).getTime();
  const ageMs = Number.isFinite(capturedAt) ? Math.max(0, nowMs - capturedAt) : Number.POSITIVE_INFINITY;
  if (ageMs < 3_000) return 'live';
  if (ageMs < 10_000) return 'delayed';
  if (ageMs < 30_000 || isPresent) return 'stale';
  return 'offline_or_suspended';
}
