/* eslint-disable import/first */
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  NativeModules: {},
  Platform: { OS: "ios" },
}));

vi.mock("expo-linking", () => ({
  canOpenURL: vi.fn(() => Promise.resolve(false)),
  openURL: vi.fn(() => Promise.resolve()),
}));

import {
  buildBreathSchedule,
  completedBreathSessionsThisWeek,
  jstDateID,
  jstWeekStartDateID,
  programDayFromReadiness,
} from "../BreathForgeIntegrationService";

describe("BreathForgeIntegrationService", () => {
  it("builds the single-writer schedule contract from a Day selection", () => {
    const schedule = buildBreathSchedule(
      {
        repVeloSessionID: "session-42",
        readinessWeekDay: "Week12-Day2",
        state: "started",
        programPlanID: "week12",
        programPlanVersion: "2026-08-10-v1",
      },
      new Date("2026-08-09T15:30:00.000Z"),
    );

    expect(schedule).toEqual({
      schema: "repvelo.breath-schedule.v1",
      generated_at: "2026-08-09T15:30:00.000Z",
      jst_date: "2026-08-10",
      repvelo_session_id: "session-42",
      program_day: "Day2",
      state: "started",
      program_plan_id: "week12",
      program_plan_version: "2026-08-10-v1",
    });
  });

  it("rejects missing session IDs and non Day1-3 selections", () => {
    expect(programDayFromReadiness("Week2-Day4")).toBeNull();
    expect(
      buildBreathSchedule({
        repVeloSessionID: "",
        readinessWeekDay: "Week2-Day1",
        state: "selected",
      }),
    ).toBeNull();
  });

  it("uses JST for date boundaries and weekly completion", () => {
    const now = new Date("2026-08-09T15:30:00.000Z"); // Mon 00:30 JST
    expect(jstDateID(now)).toBe("2026-08-10");
    expect(jstWeekStartDateID(now)).toBe("2026-08-10");
    expect(
      completedBreathSessionsThisWeek(
        {
          schema: "breathforge.shared-history.v1",
          updated_at: now.toISOString(),
          sessions: [
            {
              id: "new",
              started_at: "2026-08-09T15:01:00.000Z",
              mode: "training",
              quarter_step: 12,
              estimated_pressure_cmh2o: 72,
              completed_breaths: 30,
              rpe: 7,
              form_quality: "fullAndStrong",
              completion_state: "complete",
              repvelo_session_id: null,
            },
            {
              id: "prior-week",
              started_at: "2026-08-09T14:59:00.000Z",
              mode: "training",
              quarter_step: 12,
              estimated_pressure_cmh2o: 72,
              completed_breaths: 30,
              rpe: 7,
              form_quality: "fullAndStrong",
              completion_state: "complete",
              repvelo_session_id: null,
            },
          ],
        },
        now,
      ),
    ).toBe(1);
  });
});
