import { describe, expect, it } from 'vitest';
import DeterministicVBTCoach from '../DeterministicVBTCoach';
import type { Exercise, SetData } from '../../types/index';

const exercise: Pick<Exercise, 'name' | 'category' | 'mvt'> = {
  name: 'Bench Press',
  category: 'bench',
  mvt: 0.1,
};

const makeSet = (overrides: Partial<SetData>): SetData => ({
  session_id: 'test-session',
  lift: 'Bench Press',
  set_index: 1,
  load_kg: 100,
  reps: 3,
  device_type: 'OVR Velocity',
  set_type: 'normal',
  avg_velocity: 0.35,
  velocity_loss: 8,
  timestamp: '2026-05-12T00:00:00.000Z',
  ...overrides,
});

describe('DeterministicVBTCoach', () => {
  it('returns collect_data when velocity is missing', () => {
    const decision = DeterministicVBTCoach.evaluate({
      setHistory: [makeSet({ avg_velocity: null })],
      exercise,
      phase: 'strength',
    });

    expect(decision.action).toBe('collect_data');
    expect(decision.confidence).toBe('low');
  });

  it('marks a top single complete inside the MVT target range', () => {
    const decision = DeterministicVBTCoach.evaluate({
      setHistory: [
        makeSet({
          set_type: 'top_single',
          reps: 1,
          avg_velocity: 0.18,
          velocity_loss: 0,
        }),
      ],
      exercise,
      phase: 'strength',
    });

    expect(decision.action).toBe('top_single_complete');
    expect(decision.severity).toBe('success');
    expect(decision.topSingleTargetText).toBe('0.17〜0.22 m/s');
  });

  it('reduces load when a top single is slower than target', () => {
    const decision = DeterministicVBTCoach.evaluate({
      setHistory: [
        makeSet({
          set_type: 'top_single',
          reps: 1,
          avg_velocity: 0.14,
          velocity_loss: 0,
        }),
      ],
      exercise,
      phase: 'strength',
    });

    expect(decision.action).toBe('reduce_load');
    expect(decision.severity).toBe('warning');
    expect(decision.loadAdjustmentPercent).toBeLessThan(0);
  });

  it('stops a backoff set when velocity loss reaches the threshold', () => {
    const decision = DeterministicVBTCoach.evaluate({
      setHistory: [makeSet({ set_type: 'backoff', velocity_loss: 26 })],
      exercise,
      phase: 'strength',
    });

    expect(decision.action).toBe('stop_set');
    expect(decision.severity).toBe('alert');
    expect(decision.velocityLossThreshold).toBe(25);
  });

  it('uses VL_last over legacy VL_avg for stop decisions', () => {
    const decision = DeterministicVBTCoach.evaluate({
      setHistory: [
        makeSet({
          set_type: 'backoff',
          velocity_loss: 12.5,
          velocity_loss_avg: 12.5,
          velocity_loss_last: 28.6,
          velocity_loss_min: 28.6,
        }),
      ],
      exercise,
      phase: 'strength',
    });

    expect(decision.action).toBe('stop_set');
    expect(decision.message).toContain('VL_last');
    expect(decision.reasons).toContain('velocity_loss_last_exceeded');
  });


  it('warns when a backoff set is near the threshold', () => {
    const decision = DeterministicVBTCoach.evaluate({
      setHistory: [makeSet({ set_type: 'backoff', velocity_loss: 23 })],
      exercise,
      phase: 'strength',
    });

    expect(decision.action).toBe('watch');
    expect(decision.severity).toBe('warning');
  });

  it('continues when velocity loss is safely under the threshold', () => {
    const decision = DeterministicVBTCoach.evaluate({
      setHistory: [makeSet({ set_type: 'backoff', velocity_loss: 9 })],
      exercise,
      phase: 'strength',
    });

    expect(decision.action).toBe('continue');
    expect(decision.severity).toBe('success');
  });

  it('holds load when manual ROM is shorter than the exercise threshold', () => {
    const decision = DeterministicVBTCoach.evaluate({
      setHistory: [
        makeSet({
          avg_velocity: 0.35,
          velocity_loss: 9,
          avg_rom_cm: 20,
        }),
      ],
      exercise: {
        ...exercise,
        min_rom_threshold: 30,
      },
      phase: 'strength',
    });

    expect(decision.action).toBe('hold_load');
    expect(decision.severity).toBe('warning');
    expect(decision.reasons).toContain('short_rom_quality_gate');
  });
});
