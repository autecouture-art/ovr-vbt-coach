import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testFilePath = fileURLToPath(import.meta.url);
const sessionScreenSource = readFileSync(
  resolve(dirname(testFilePath), "..", "SessionScreen.tsx"),
  "utf8",
);
const sessionDashboardSource = readFileSync(
  resolve(
    dirname(testFilePath),
    "..",
    "..",
    "components",
    "session",
    "SessionDashboard.tsx",
  ),
  "utf8",
);
const homeScreenSource = readFileSync(
  resolve(dirname(testFilePath), "..", "..", "..", "app", "(tabs)", "index.tsx"),
  "utf8",
);
const sessionGateSource = readFileSync(
  resolve(dirname(testFilePath), "..", "..", "..", "app", "(tabs)", "session.tsx"),
  "utf8",
);

describe("SessionScreen supervisor-plan load-control contract", () => {
  it("quick-launches a supervisor row from home without auto-starting a measurement set", () => {
    expect(homeScreenSource).toContain("syncCurrentPlanIfChanged()");
    expect(homeScreenSource).toContain("supervisorRowId: row.row_id");
    expect(homeScreenSource).toContain("supervisorWeekDay: `Week${row.week}-${row.day}`");
    expect(homeScreenSource).toContain("quickLaunchToken:");
    expect(homeScreenSource).toContain("autoOpen: '1'");
    expect(sessionGateSource).toContain('quickLaunchParams.autoOpen === "1"');
    expect(sessionGateSource).toContain("<LoadedSessionScreen {...quickLaunchParams} />");
    expect(sessionScreenSource).toContain("quickLaunchAppliedTokenRef");
    expect(sessionScreenSource).toContain("ホームの監督メニューから設定");
    expect(sessionScreenSource).not.toContain("startSet();\n  }, [\n    autoOpen");
  });

  it("exposes reconnect after a known sensor disconnect", () => {
    expect(sessionScreenSource).toMatch(
      /const handleReconnectSensor = async \(\) => \{[\s\S]*?BLEService\.reconnect\(\)/,
    );
    expect(sessionScreenSource).toMatch(
      /!isConnected && BLEService\.getLastDeviceInfo\(\)\.id/,
    );
    expect(sessionScreenSource).toContain("センサーを再接続");
    expect(sessionScreenSource).toContain(
      "canReconnectSensor={Boolean(BLEService.getLastDeviceInfo().id)}",
    );
    expect(sessionScreenSource).toContain(
      "onReconnectSensor={() => void handleReconnectSensor()}",
    );
  });

  it("routes every user load-control entry point through the shared helper", () => {
    expect(sessionScreenSource).toMatch(
      /const adjustLoad = \(amount: number\) => \{\s*applyUserSelectedLoad\(currentLoad \+ amount\);/,
    );
    expect(sessionScreenSource).toMatch(
      /const commitLoadInput = \(text: string\) => \{[\s\S]*?applyUserSelectedLoad\(val\);/,
    );
    expect(sessionScreenSource).toMatch(
      /const handleLoadChange = \(text: string\) => \{[\s\S]*?applyUserSelectedLoad\(val\);/,
    );
    expect(sessionScreenSource).toMatch(
      /onUpdateLoad=\{\(load\) => \{\s*applyUserSelectedLoad\(load\);\s*\}\}/,
    );
  });

  it("hides the separate suggested-load candidate for stale plans", () => {
    expect(sessionScreenSource).toMatch(
      /settings\.session_display_suggestions &&\s*isSessionActive &&\s*supervisorProgramPlanExecutable &&\s*suggestedLoad !== null/,
    );
  });

  it("keeps supervisor input visible and opens the plan manager when rows are unavailable", () => {
    expect(sessionScreenSource).toContain(
      "監督メニューから入力",
    );
    expect(sessionScreenSource).toContain(
      'router.replace("/(tabs)/import")',
    );
    expect(sessionScreenSource).toContain(
      "supervisorRecommendationEmptyMessage",
    );
    expect(sessionScreenSource).not.toMatch(
      /settings\.session_display_suggestions &&\s*supervisorRecommendationRows\.length > 0/,
    );
  });

  it("does not restore the legacy stale-plan Alert hard lock", () => {
    expect(sessionScreenSource).not.toContain("監督メニュー期限外");
    expect(sessionScreenSource).not.toContain("shouldBlockSupervisorPlanIncrease");
    expect(sessionScreenSource).not.toContain(
      "showSupervisorPlanIncreaseBlockedAlert",
    );
  });

  it("passes the effective VL threshold into a visible quality goal and both consultation packets", () => {
    expect(sessionScreenSource).toContain(
      "configuredVelocityLossThresholdPct: effectiveLiveVelocityLossThreshold",
    );
    expect(sessionScreenSource).toContain("品質目標:");
    expect(sessionScreenSource).toMatch(/nextSetQualityGoal: sessionDecision\.nextSetQualityGoal/);
    expect(sessionScreenSource).toMatch(/quality_goal: sessionDecision\.nextSetQualityGoal/);
  });

  it("preserves latest DB markers at completion and tracks explicit pain review", () => {
    expect(sessionScreenSource).toMatch(
      /const latestDbSession = await DatabaseService\.getSession\(\s*currentSession\.session_id/,
    );
    expect(sessionScreenSource).toMatch(
      /buildSessionNotesWithReadiness\(\s*latestDbSession\.notes,\s*currentSession\.notes,\s*completionReadiness/,
    );
    expect(sessionScreenSource).toContain(
      "pain_reviewed: readinessPainReviewedAt != null",
    );
    expect(sessionScreenSource).toContain("痛み未確認");
  });

  it("uses deterministic consultation ids and exposes unsaved-history warnings", () => {
    expect(sessionScreenSource.match(/buildConsultationId\(\{/g)).toHaveLength(2);
    expect(sessionScreenSource).toContain(
      "コピーは完了しましたが、相談履歴は保存できませんでした",
    );
    expect(sessionScreenSource).not.toMatch(
      /const consultationHistoryId = `chappy_\$\{Date\.now\(\)\}/,
    );
  });

  it("stores session and packet dates using the JST training day", () => {
    expect(sessionScreenSource).toContain("date: getJstTrainingDayId(startedAt)");
    expect(sessionScreenSource).toContain("date: getJstTrainingDayId()");
    expect(sessionScreenSource).toMatch(
      /date: getJstTrainingDayId\(\s*currentSession\.start_timestamp \?\? currentSession\.date/,
    );
    expect(sessionScreenSource).not.toContain(
      'new Date().toISOString().split("T")[0]',
    );
  });

  it("advances through multiple supervisor rows for the same exercise", () => {
    expect(sessionScreenSource).toContain(
      "resolveSupervisorRowsForExercise(",
    );
    expect(sessionScreenSource).toContain(
      "selectActiveSupervisorRowForSets(",
    );
    expect(sessionScreenSource).toMatch(
      /exactRemainingRow\?\.row \?\?\s*summary\.remainingRows\[0\]\?\.row/,
    );
    expect(sessionScreenSource).not.toContain(
      "resolveSupervisorRowForExercise(",
    );
  });

  it("shows VL and REP together with a same-load VL-gated PR target", () => {
    expect(sessionScreenSource).toContain(
      "DatabaseService.getHistoricalSetsAtLoad(currentLoad)",
    );
    expect(sessionScreenSource).toContain(
      "buildVelocityLossRepPRTarget({",
    );
    expect(sessionScreenSource).toContain("VL_last");
    expect(sessionScreenSource).toContain(">REPS</Text>");
    expect(sessionScreenSource).toContain("以内 REP PR");
    expect(sessionScreenSource).toContain("REPでPR");
    expect(sessionScreenSource).toContain("focusModeVlRepHeroRow");
  });

  it("removes planned input cards while preserving internal plan data", () => {
    expect(sessionDashboardSource).not.toContain("予定 Reps");
    expect(sessionDashboardSource).not.toContain("予定 Sets");
    expect(sessionScreenSource).not.toContain("予定セット");
    expect(sessionScreenSource).not.toContain("予定レップ");
    expect(sessionScreenSource).not.toContain("予定残");
    expect(sessionScreenSource).not.toContain("RPE目安");
    expect(sessionScreenSource).not.toContain("plannedInputsGrid");
    expect(sessionScreenSource).toContain(
      "plannedReps: executableCurrentSupervisorRow?.reps ?? currentReps",
    );
    expect(sessionScreenSource).toContain("plannedSetCount");
    expect(sessionScreenSource).toContain("plannedSetText");
    expect(sessionScreenSource).toContain("plannedRpe");
    expect(sessionScreenSource).toContain("setPlannedRpe(row.rpe_target)");
  });

  it("records and surfaces BIG3 gear without affecting non-BIG3 exercises", () => {
    expect(sessionScreenSource).toContain("<Big3GearSelector");
    expect(sessionScreenSource).toContain("resolveCurrentGearJson");
    expect(sessionScreenSource).toContain("gear_json");
    expect(sessionScreenSource).toContain("使用ギア:");
    expect(sessionScreenSource).toContain(
      "ギア {formatBig3GearSummary(set.gear_json)}",
    );
  });
});
