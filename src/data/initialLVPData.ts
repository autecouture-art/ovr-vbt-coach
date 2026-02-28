// ========================================
// LVP Initial Data
// Generated from OVR Export Data
// Generated: 2026-02-24T05:39:35.597238
// ========================================

import { LVPData } from '../types/index';

export const INITIAL_LVP_DATA: LVPData[] = [
  {
    lift: 'Larsen Bench Press',
    vmax: 1.374,
    v1rm: 0.17,
    slope: -0.0143,
    intercept: 1.374,
    r_squared: 0.978,
    last_updated: '2026-02-24T05:39:35.595210'
  }
];

// ========================================
// Exercise Categories (based on analyzed data)
// ========================================

export const INITIAL_EXERCISES = [
  {
    id: 'larsen_bench_press',
    name: 'Larsen Bench Press',
    category: 'bench',
    has_lvp: true,
  }
];
