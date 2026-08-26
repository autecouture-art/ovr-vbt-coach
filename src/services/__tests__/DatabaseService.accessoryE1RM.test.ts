/* eslint-disable import/first */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: {
    appOwnership: null,
    executionEnvironment: null,
  },
}));

import DatabaseService from "../DatabaseService";

const service = DatabaseService as unknown as {
  db: {
    getFirstAsync: (
      sql: string,
      params: unknown[],
    ) => Promise<{ value: number | null } | null>;
    runAsync?: (
      sql: string,
      params: unknown[],
    ) => Promise<{ changes: number }>;
  } | null;
  getBestE1RMForLift: (
    lift: string,
    accessoryRepRangeOnly?: boolean,
  ) => Promise<number | null>;
  updateSessionNotes: (sessionId: string, notes: string) => Promise<void>;
};

describe("DatabaseService accessory e1RM history", () => {
  afterEach(() => {
    service.db = null;
  });

  it("filters sets and PR records to 5-15 reps for accessories", async () => {
    const sqlSeen: string[] = [];
    service.db = {
      getFirstAsync: async (sql) => {
        sqlSeen.push(sql);
        return {
          value: sql.includes("reps BETWEEN 5 AND 15") ? 76 : 95.3,
        };
      },
    };

    expect(
      await service.getBestE1RMForLift("Reverse Pec Deck Fly", true),
    ).toBe(76);
    expect(sqlSeen).toHaveLength(2);
    expect(sqlSeen.every((sql) => sql.includes("reps BETWEEN 5 AND 15"))).toBe(
      true,
    );
  });

  it("leaves BIG3 historical-best queries unrestricted", async () => {
    const sqlSeen: string[] = [];
    service.db = {
      getFirstAsync: async (sql) => {
        sqlSeen.push(sql);
        return { value: 95.3 };
      },
    };

    expect(await service.getBestE1RMForLift("Bench Press", false)).toBe(95.3);
    expect(sqlSeen.every((sql) => !sql.includes("reps BETWEEN 5 AND 15"))).toBe(
      true,
    );
  });

  it("throws when a session-note update affects no row", async () => {
    service.db = {
      getFirstAsync: async () => ({ value: null }),
      runAsync: async () => ({ changes: 0 }),
    };
    await expect(
      service.updateSessionNotes("missing-session", "notes"),
    ).rejects.toThrow("affected 0 rows");
  });

  it("verifies the stored session notes after one affected row", async () => {
    service.db = {
      getFirstAsync: async () => ({ notes: "stored notes" }) as never,
      runAsync: async () => ({ changes: 1 }),
    };
    await expect(
      service.updateSessionNotes("session-1", "stored notes"),
    ).resolves.toBeUndefined();
  });
});
