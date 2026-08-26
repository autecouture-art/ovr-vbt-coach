import { describe, expect, it } from "vitest";
import { assessSessionDataCompleteness } from "../SessionDataCompleteness";
import type { SessionData, SetData } from "../../types/index";

const session = (readiness: SessionData["readiness"]): SessionData => ({
  session_id: "s1", date: "2026-08-05", total_volume: 0, total_sets: 1, readiness,
});
const set = (rpe: number | null): SetData => ({
  session_id: "s1", lift: "Chinning", set_index: 1, load_kg: 0, reps: 8,
  device_type: "manual", set_type: "normal", avg_velocity: null, velocity_loss: null,
  timestamp: "2026-08-05T01:00:00.000Z", rpe: rpe ?? undefined,
});

describe("assessSessionDataCompleteness", () => {
  it("warns without blocking when RPE and pain review are missing", () => {
    expect(assessSessionDataCompleteness(session(null), [set(null)])).toMatchObject({
      complete: false, missing_rpe_set_count: 1, missing_pain_review: true,
    });
  });

  it("does not treat the untouched default pain score zero as reviewed", () => {
    expect(
      assessSessionDataCompleteness(
        session({
          dieting: null,
          sleep_quality: null,
          pain_area: null,
          pain_score: 0,
          pain_reviewed: false,
          pain_reviewed_at: null,
          week_day: null,
          main_lift: null,
          day_role: null,
        }),
        [set(7)],
      ),
    ).toMatchObject({
      complete: false,
      missing_pain_review: true,
      warnings: ["痛みレビュー未入力"],
    });
  });

  it("marks a reviewed session complete", () => {
    expect(assessSessionDataCompleteness(session({
      dieting: null, sleep_quality: null, pain_area: null, pain_score: 0,
      pain_reviewed: true, pain_reviewed_at: "2026-08-05T00:00:00.000Z",
      week_day: null, main_lift: null, day_role: null,
    }), [set(7)])).toMatchObject({
      complete: true, warnings: [],
    });
  });
});
