/**
 * Velocity Zones - Dynamic calculation based on historical data
 * 履歴データベースの速度ゾーンを動的算出
 */

import type { VelocityZone } from '../types/index';
import DatabaseService from '../services/DatabaseService';

interface VelocityPercentiles {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  sampleCount: number;
}

const zoneCache = new Map<string, VelocityZone[]>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

/**
 * Calculate velocity percentiles from historical rep data
 */
export async function calculateVelocityPercentiles(
  lift: string
): Promise<VelocityPercentiles | null> {
  const sessions = await DatabaseService.getSessions();
  const allVelocities: number[] = [];

  for (const session of sessions.slice(0, 20)) {
    const reps = await DatabaseService.getRepsForSession(session.session_id);
    const validReps = reps.filter(
      r => r.lift === lift &&
           r.is_valid_rep &&
           !r.is_excluded &&
           !r.is_failed &&
           r.mean_velocity !== null &&
           r.mean_velocity > 0
    );
    allVelocities.push(...validReps.map(r => r.mean_velocity!));
  }

  if (allVelocities.length < 30) {
    return null; // Need at least 30 data points for reliable percentiles
  }

  allVelocities.sort((a, b) => a - b);

  const percentile = (p: number) => {
    const index = Math.min(
      allVelocities.length - 1,
      Math.max(0, Math.floor((allVelocities.length - 1) * p))
    );
    return allVelocities[index];
  };

  return {
    p10: percentile(0.10),
    p25: percentile(0.25),
    p50: percentile(0.50),
    p75: percentile(0.75),
    p90: percentile(0.90),
    sampleCount: allVelocities.length,
  };
}

/**
 * Generate dynamic velocity zones from percentiles
 */
export function createDynamicZones(percentiles: VelocityPercentiles): VelocityZone[] {
  return [
    {
      name: 'power',
      min_velocity: percentiles.p90,
      max_velocity: 999,
      load_range: '<40% 1RM',
      color: '#FFD700',
    },
    {
      name: 'strength_speed',
      min_velocity: percentiles.p75,
      max_velocity: percentiles.p90,
      load_range: '40-60% 1RM',
      color: '#FF8C00',
    },
    {
      name: 'hypertrophy',
      min_velocity: percentiles.p50,
      max_velocity: percentiles.p75,
      load_range: '60-80% 1RM',
      color: '#32CD32',
    },
    {
      name: 'strength',
      min_velocity: 0,
      max_velocity: percentiles.p50,
      load_range: '>80% 1RM',
      color: '#DC143C',
    },
  ];
}

/**
 * Get dynamic zones for an exercise with caching
 */
export async function getDynamicVelocityZones(lift: string): Promise<VelocityZone[]> {
  const now = Date.now();
  const cachedTime = cacheTimestamps.get(lift);

  if (cachedTime && now - cachedTime < CACHE_TTL && zoneCache.has(lift)) {
    return zoneCache.get(lift)!;
  }

  const percentiles = await calculateVelocityPercentiles(lift);

  if (!percentiles) {
    // Fall back to fixed zones
    return getFixedVelocityZones();
  }

  const zones = createDynamicZones(percentiles);
  zoneCache.set(lift, zones);
  cacheTimestamps.set(lift, now);

  return zones;
}

/**
 * Fixed zones as fallback
 */
function getFixedVelocityZones(): VelocityZone[] {
  return [
    {
      name: 'power',
      min_velocity: 1.0,
      max_velocity: 999,
      load_range: '<30% 1RM',
      color: '#FFD700',
    },
    {
      name: 'strength_speed',
      min_velocity: 0.75,
      max_velocity: 1.0,
      load_range: '30-60% 1RM',
      color: '#FF8C00',
    },
    {
      name: 'hypertrophy',
      min_velocity: 0.5,
      max_velocity: 0.75,
      load_range: '60-80% 1RM',
      color: '#32CD32',
    },
    {
      name: 'strength',
      min_velocity: 0.0,
      max_velocity: 0.5,
      load_range: '>80% 1RM',
      color: '#DC143C',
    },
  ];
}

/**
 * Clear zone cache (call after new data is saved)
 */
export function clearZoneCache(lift?: string): void {
  if (lift) {
    zoneCache.delete(lift);
    cacheTimestamps.delete(lift);
  } else {
    zoneCache.clear();
    cacheTimestamps.clear();
  }
}

export default {
  calculateVelocityPercentiles,
  createDynamicZones,
  getDynamicVelocityZones,
  clearZoneCache,
};
