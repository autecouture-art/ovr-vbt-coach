/* eslint-disable import/first */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: {
    appOwnership: null,
    executionEnvironment: null,
  },
}));

import DatabaseService from "../DatabaseService";
import type { SetData } from "../../types/index";

const service = DatabaseService as unknown as {
  db: {
    runAsync: (sql: string, params: unknown[]) => Promise<{ changes: number }>;
  } | null;
  insertSet: (setData: SetData) => Promise<void>;
  updateSet: (
    sessionId: string,
    setIndex: number,
    values: { gear_json?: string | null; whereLift?: string; lift?: string },
  ) => Promise<void>;
};

describe("DatabaseService BIG3 gear persistence", () => {
  afterEach(() => {
    service.db = null;
  });

  it("writes the stable gear JSON into the sets row", async () => {
    let sqlSeen = "";
    let paramsSeen: unknown[] = [];
    service.db = {
      runAsync: async (sql, params) => {
        sqlSeen = sql;
        paramsSeen = params;
        return { changes: 1 };
      },
    };

    await service.insertSet({
      session_id: "session-gear",
      lift: "Low Bar Squat",
      set_index: 1,
      load_kg: 140,
      reps: 1,
      device_type: "OVR Velocity",
      set_type: "top_single",
      avg_velocity: 0.35,
      velocity_loss: 0,
      timestamp: "2026-08-15T00:00:00.000Z",
      gear_json: '{"gear":["belt","knee_sleeves"]}',
    });

    expect(sqlSeen).toContain("gear_json");
    expect(paramsSeen.at(-1)).toBe(
      '{"gear":["belt","knee_sleeves"]}',
    );
  });

  it("keeps legacy sets compatible by storing NULL when gear is absent", async () => {
    let paramsSeen: unknown[] = [];
    service.db = {
      runAsync: async (_sql, params) => {
        paramsSeen = params;
        return { changes: 1 };
      },
    };

    await service.insertSet({
      session_id: "legacy-session",
      lift: "Bench Press",
      set_index: 1,
      load_kg: 80,
      reps: 3,
      device_type: "manual",
      set_type: "normal",
      avg_velocity: null,
      velocity_loss: null,
      timestamp: "2026-08-15T00:00:00.000Z",
    });

    expect(paramsSeen.at(-1)).toBeNull();
  });

  it("updates recorded gear independently from VBT metrics", async () => {
    let sqlSeen = "";
    let paramsSeen: unknown[] = [];
    service.db = {
      runAsync: async (sql, params) => {
        sqlSeen = sql;
        paramsSeen = params;
        return { changes: 1 };
      },
    };

    await service.updateSet("session-gear", 2, {
      gear_json: '{"gear":["belt","wrist_wraps"]}',
      whereLift: "Bench Press",
    });

    expect(sqlSeen).toContain("gear_json = ?");
    expect(paramsSeen).toEqual([
      '{"gear":["belt","wrist_wraps"]}',
      "session-gear",
      2,
      "Bench Press",
    ]);
  });

  it("uses the original lift when an editable set is renamed", async () => {
    let sqlSeen = "";
    let paramsSeen: unknown[] = [];
    service.db = {
      runAsync: async (sql, params) => {
        sqlSeen = sql;
        paramsSeen = params;
        return { changes: 1 };
      },
    };

    await service.updateSet("session-gear", 2, {
      lift: "Bench Press",
      whereLift: "テンポベンチプレス",
    });

    expect(sqlSeen).toContain("lift = ?");
    expect(paramsSeen).toEqual([
      "Bench Press",
      "session-gear",
      2,
      "テンポベンチプレス",
    ]);
  });
});
