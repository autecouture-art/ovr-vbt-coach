import { describe, expect, it } from "vitest";

import {
  buildLiveShareEventsUrl,
  buildRepVeloCoachCurrentPlanUrl,
  buildRepVeloCoachCrashHandoffsUrl,
  buildRepVeloCoachFeedbackBatchesUrl,
  buildRepVeloCoachIssueReceiptsUrl,
  buildRepVeloCoachIssuesUrl,
  buildRepVeloCoachSyncUrl,
  normalizeLiveShareBaseUrl,
} from "../LiveShareEndpoint";

describe("LiveShareEndpoint", () => {
  it("normalizes root and legacy event URLs", () => {
    expect(normalizeLiveShareBaseUrl("http://line93.local:3001/")).toBe(
      "http://line93.local:3001",
    );
    expect(normalizeLiveShareBaseUrl("http://line93.local:3001/events")).toBe(
      "http://line93.local:3001",
    );
    expect(normalizeLiveShareBaseUrl("http://line93.local:3001/api/repvelocoach/sync")).toBe(
      "http://line93.local:3001/api/repvelocoach",
    );
  });

  it("builds separate live event and snapshot sync routes", () => {
    expect(buildLiveShareEventsUrl("http://line93.local:3001")).toBe(
      "http://line93.local:3001/events",
    );
    expect(buildRepVeloCoachSyncUrl("http://line93.local:3001")).toBe(
      "http://line93.local:3001/api/repvelocoach/sync",
    );
    expect(buildRepVeloCoachSyncUrl("http://line93.local:3001/api/repvelocoach")).toBe(
      "http://line93.local:3001/api/repvelocoach/sync",
    );
    expect(buildRepVeloCoachCurrentPlanUrl("http://line93.local:3001")).toBe(
      "http://line93.local:3001/api/repvelocoach/plan/current",
    );
    expect(buildRepVeloCoachCurrentPlanUrl("http://line93.local:3001/api/repvelocoach")).toBe(
      "http://line93.local:3001/api/repvelocoach/plan/current",
    );
    expect(buildRepVeloCoachIssuesUrl("http://line93.local:3001")).toBe(
      "http://line93.local:3001/api/repvelocoach/issues",
    );
    expect(buildRepVeloCoachFeedbackBatchesUrl("http://line93.local:3001")).toBe(
      "http://line93.local:3001/api/repvelocoach/session-feedback-batches",
    );
    expect(buildRepVeloCoachIssueReceiptsUrl("http://line93.local:3001")).toBe(
      "http://line93.local:3001/api/repvelocoach/issues/receipts",
    );
    expect(buildRepVeloCoachCrashHandoffsUrl("http://line93.local:3001")).toBe(
      "http://line93.local:3001/api/repvelocoach/crash-handoffs",
    );
  });

  it("rejects non-HTTP and malformed URLs", () => {
    expect(normalizeLiveShareBaseUrl("file:///tmp/export.json")).toBeNull();
    expect(normalizeLiveShareBaseUrl("not a URL")).toBeNull();
  });
});
