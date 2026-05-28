import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FormVideoRecord, RepData } from "../types/index";

interface Props {
  visible: boolean;
  reps: RepData[];
  setIndex: number;
  lift: string;
  loadKg?: number;
  setStartedAt?: string | null;
  setEndedAt?: string | null;
  setCompletedAt?: string | null;
  restDurationS?: number | null;
  formVideos?: FormVideoRecord[];
  onClose: () => void;
  onEditSetLoad?: () => void;
  onOpenVideo?: (video: FormVideoRecord) => void;
  onShareVideo?: (video: FormVideoRecord) => void;
  onDeleteVideo?: (video: FormVideoRecord) => void;
  onExcludeRep?: (repId: string, reason: string) => void;
  onMarkFailedRep?: (repId: string, isFailed: boolean) => void;
  onMarkSetupRep?: (repId: string) => void;
  onAddMissedRep?: () => void;
}

export function RepDetailModal({
  visible,
  reps,
  setIndex,
  lift,
  loadKg,
  setStartedAt,
  setEndedAt,
  setCompletedAt,
  restDurationS,
  formVideos = [],
  onClose,
  onEditSetLoad,
  onOpenVideo,
  onShareVideo,
  onDeleteVideo,
  onExcludeRep,
  onMarkFailedRep,
  onMarkSetupRep,
  onAddMissedRep,
}: Props) {
  const setReps = useMemo(() => {
    if (!visible) return [];
    return reps.filter(
      (rep) => rep.set_index === setIndex && rep.lift === lift,
    );
  }, [lift, reps, setIndex, visible]);

  const trackedReps = useMemo(
    () =>
      setReps.filter(
        (rep) => !rep.is_excluded && !rep.is_failed && rep.is_valid_rep,
      ),
    [setReps],
  );

  const velocityLossByRepId = useMemo(() => {
    const firstRepVel = trackedReps[0]?.mean_velocity ?? 0;
    const map = new Map<string, string>();
    trackedReps.forEach((rep, index) => {
      const repId = rep.id ?? String(rep.rep_index);
      if (index <= 0 || !firstRepVel) {
        map.set(repId, "0.0");
        return;
      }
      const currentVel = rep.mean_velocity ?? 0;
      map.set(
        repId,
        (((firstRepVel - currentVel) / firstRepVel) * 100).toFixed(1),
      );
    });
    return map;
  }, [trackedReps]);

  const timingRows = useMemo(() => {
    const startedAt = setStartedAt ? new Date(setStartedAt) : null;
    const endedAt =
      setEndedAt || setCompletedAt
        ? new Date(setEndedAt ?? setCompletedAt!)
        : null;
    const setDurationS =
      startedAt && endedAt
        ? Math.max(
            0,
            Math.round((endedAt.getTime() - startedAt.getTime()) / 1000),
          )
        : null;

    return [
      { label: "開始", value: startedAt ? formatDateTime(startedAt) : "-" },
      { label: "終了", value: endedAt ? formatDateTime(endedAt) : "-" },
      {
        label: "セット時間",
        value: setDurationS != null ? formatDuration(setDurationS) : "-",
      },
      {
        label: "前休憩",
        value:
          restDurationS != null
            ? formatDuration(Math.round(restDurationS))
            : "-",
      },
    ];
  }, [restDurationS, setCompletedAt, setEndedAt, setStartedAt]);

  const setSummary = useMemo(() => {
    const velocityValues = trackedReps
      .map((rep) => rep.mean_velocity)
      .filter((value): value is number => value != null && value > 0);
    const peakVelocityValues = trackedReps
      .map((rep) => rep.peak_velocity)
      .filter((value): value is number => value != null && value > 0);
    const powerValues = trackedReps
      .map((rep) => rep.mean_power_w)
      .filter((value): value is number => value != null && value > 0);
    const peakPowerValues = trackedReps
      .map((rep) => rep.peak_power_w)
      .filter((value): value is number => value != null && value > 0);
    const romValues = trackedReps
      .map((rep) => rep.rom_cm)
      .filter((value): value is number => value != null && value > 0);
    const durationValues = trackedReps
      .map((rep) => rep.rep_duration_ms)
      .filter((value): value is number => value != null && value > 0);
    const startedAt = setStartedAt ? new Date(setStartedAt) : null;
    const endedAt =
      setEndedAt || setCompletedAt
        ? new Date(setEndedAt ?? setCompletedAt!)
        : null;
    const setDurationS =
      startedAt && endedAt
        ? Math.max(0, (endedAt.getTime() - startedAt.getTime()) / 1000)
        : null;
    const bestVelocityRep = trackedReps.reduce<RepData | null>((best, rep) => {
      if (rep.mean_velocity == null) return best;
      if (!best || (best.mean_velocity ?? 0) < rep.mean_velocity) return rep;
      return best;
    }, null);
    const bestPowerRep = trackedReps.reduce<RepData | null>((best, rep) => {
      if (rep.mean_power_w == null) return best;
      if (!best || (best.mean_power_w ?? 0) < rep.mean_power_w) return rep;
      return best;
    }, null);
    const firstVelocity = velocityValues[0] ?? null;
    const lastVelocity = velocityValues[velocityValues.length - 1] ?? null;
    const firstToLastLoss =
      firstVelocity != null && lastVelocity != null && firstVelocity > 0
        ? ((firstVelocity - lastVelocity) / firstVelocity) * 100
        : null;

    return {
      totalReps: setReps.length,
      trackedReps: trackedReps.length,
      excludedReps: setReps.filter((rep) => rep.is_excluded).length,
      failedReps: setReps.filter((rep) => rep.is_failed).length,
      setupReps: setReps.filter(
        (rep) => rep.exclusion_reason === "setup_reaction",
      ).length,
      avgVelocity: average(velocityValues),
      peakVelocity: max(peakVelocityValues),
      velocitySpread:
        velocityValues.length >= 2
          ? max(velocityValues)! - min(velocityValues)!
          : null,
      firstToLastLoss,
      avgPower: average(powerValues),
      peakPower: max(peakPowerValues),
      avgRom: average(romValues),
      minRom: min(romValues),
      maxRom: max(romValues),
      avgRepDurationMs: average(durationValues),
      density:
        setDurationS != null && setDurationS > 0
          ? trackedReps.length / (setDurationS / 60)
          : null,
      volume: loadKg != null ? loadKg * trackedReps.length : null,
      bestVelocityRep,
      bestPowerRep,
    };
  }, [loadKg, setCompletedAt, setEndedAt, setReps, setStartedAt, trackedReps]);

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>
                {lift || "Unknown"} / Set {setIndex}
              </Text>
              <Text style={styles.subtitle}>
                {loadKg != null ? `${loadKg} kg` : "重量未設定"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {onEditSetLoad ? (
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerActionBtn}
                onPress={onEditSetLoad}
              >
                <Ionicons name="create-outline" size={16} color="#ff8c42" />
                <Text style={styles.headerActionText}>重量を修正</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.timingPanel}>
            {timingRows.map((row) => (
              <View key={row.label} style={styles.timingItem}>
                <Text style={styles.timingLabel}>{row.label}</Text>
                <Text style={styles.timingValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          <ScrollView style={styles.scrollArea}>
            {setReps.length > 0 ? (
              <View style={styles.summaryPanel}>
                <View style={styles.summaryHeaderRow}>
                  <Text style={styles.summaryTitle}>SET SUMMARY</Text>
                  <Text style={styles.summaryMeta}>
                    有効 {setSummary.trackedReps}/{setSummary.totalReps} reps
                  </Text>
                </View>

                <View style={styles.highlightGrid}>
                  <MetricCard
                    label="Avg V"
                    value={
                      setSummary.avgVelocity != null
                        ? `${setSummary.avgVelocity.toFixed(2)} m/s`
                        : "-"
                    }
                  />
                  <MetricCard
                    label="Peak V"
                    value={
                      setSummary.peakVelocity != null
                        ? `${setSummary.peakVelocity.toFixed(2)} m/s`
                        : "-"
                    }
                  />
                  <MetricCard
                    label="Avg P"
                    value={
                      setSummary.avgPower != null
                        ? `${Math.round(setSummary.avgPower)} W`
                        : "-"
                    }
                  />
                  <MetricCard
                    label="Peak P"
                    value={
                      setSummary.peakPower != null
                        ? `${Math.round(setSummary.peakPower)} W`
                        : "-"
                    }
                  />
                  <MetricCard
                    label="失速"
                    value={
                      setSummary.firstToLastLoss != null
                        ? `${setSummary.firstToLastLoss.toFixed(1)}%`
                        : "-"
                    }
                  />
                  <MetricCard
                    label="密度"
                    value={
                      setSummary.density != null
                        ? `${setSummary.density.toFixed(1)} rep/min`
                        : "-"
                    }
                  />
                </View>

                <View style={styles.detailGrid}>
                  <DetailLine
                    label="ベスト速度"
                    value={
                      setSummary.bestVelocityRep?.mean_velocity != null
                        ? `#${setSummary.bestVelocityRep.rep_index} / ${setSummary.bestVelocityRep.mean_velocity.toFixed(2)} m/s`
                        : "-"
                    }
                  />
                  <DetailLine
                    label="ベストパワー"
                    value={
                      setSummary.bestPowerRep?.mean_power_w != null
                        ? `#${setSummary.bestPowerRep.rep_index} / ${Math.round(setSummary.bestPowerRep.mean_power_w)} W`
                        : "-"
                    }
                  />
                  <DetailLine
                    label="ROM平均/範囲"
                    value={
                      setSummary.avgRom != null &&
                      setSummary.minRom != null &&
                      setSummary.maxRom != null
                        ? `${setSummary.avgRom.toFixed(1)} cm / ${setSummary.minRom.toFixed(1)}-${setSummary.maxRom.toFixed(1)}`
                        : "-"
                    }
                  />
                  <DetailLine
                    label="速度幅"
                    value={
                      setSummary.velocitySpread != null
                        ? `${setSummary.velocitySpread.toFixed(2)} m/s`
                        : "-"
                    }
                  />
                  <DetailLine
                    label="平均rep時間"
                    value={
                      setSummary.avgRepDurationMs != null
                        ? `${(setSummary.avgRepDurationMs / 1000).toFixed(2)} s`
                        : "-"
                    }
                  />
                  <DetailLine
                    label="ボリューム"
                    value={
                      setSummary.volume != null
                        ? `${Math.round(setSummary.volume)} kg`
                        : "-"
                    }
                  />
                  <DetailLine
                    label="除外/失敗/SETUP"
                    value={`${setSummary.excludedReps} / ${setSummary.failedReps} / ${setSummary.setupReps}`}
                  />
                </View>
              </View>
            ) : null}

            {formVideos.length > 0 ? (
              <View style={styles.videoPanel}>
                <View style={styles.summaryHeaderRow}>
                  <Text style={styles.summaryTitle}>FORM VIDEOS</Text>
                  <Text style={styles.summaryMeta}>
                    {formVideos.length} clips
                  </Text>
                </View>
                {formVideos.map((video, index) => (
                  <View key={video.id} style={styles.videoRow}>
                    <View style={styles.videoInfo}>
                      <Text style={styles.videoTitle}>
                        Clip {index + 1} / {formatDuration(Math.round(video.duration_s ?? 0))}
                      </Text>
                      <Text style={styles.videoMeta}>
                        {formatVideoRange(video.started_at, video.ended_at)}
                      </Text>
                    </View>
                    <View style={styles.videoActions}>
                      {onOpenVideo ? (
                        <TouchableOpacity
                          style={styles.videoActionBtn}
                          onPress={() => onOpenVideo(video)}
                        >
                          <Ionicons
                            name="play-outline"
                            size={17}
                            color="#5ec8ff"
                          />
                        </TouchableOpacity>
                      ) : null}
                      {onShareVideo ? (
                        <TouchableOpacity
                          style={styles.videoActionBtn}
                          onPress={() => onShareVideo(video)}
                        >
                          <Ionicons
                            name="share-outline"
                            size={17}
                            color="#ffb347"
                          />
                        </TouchableOpacity>
                      ) : null}
                      {onDeleteVideo ? (
                        <TouchableOpacity
                          style={[styles.videoActionBtn, styles.videoDeleteBtn]}
                          onPress={() => onDeleteVideo(video)}
                        >
                          <Ionicons
                            name="unlink-outline"
                            size={17}
                            color="#ff6b6b"
                          />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {onAddMissedRep && (
              <TouchableOpacity
                style={styles.addRepButton}
                onPress={onAddMissedRep}
              >
                <Text style={styles.addRepButtonText}>+ レップを追加</Text>
              </TouchableOpacity>
            )}
            {setReps.length === 0 ? (
              <Text style={styles.emptyText}>記録されたレップがありません</Text>
            ) : (
              setReps.map((rep) => {
                const repId = rep.id || String(rep.rep_index);
                const isSetupRep = rep.exclusion_reason === "setup_reaction";
                const isExcluded = Boolean(rep.is_excluded);
                const vlText = isExcluded
                  ? "除外"
                  : `${velocityLossByRepId.get(repId) ?? "0.0"}%`;
                return (
                  <View
                    key={`${rep.lift}_${rep.set_index}_${rep.rep_index}_${repId}`}
                    style={[
                      styles.repRow,
                      rep.is_failed && styles.repRowFailed,
                      isSetupRep && styles.repRowSetup,
                    ]}
                  >
                    <View style={styles.repInfo}>
                      <View style={styles.repHeaderRow}>
                        <Text
                          style={[
                            styles.repNumber,
                            rep.is_failed && styles.repNumberFailed,
                          ]}
                        >
                          #{rep.rep_index}
                        </Text>
                        {isSetupRep ? (
                          <Text style={[styles.badge, styles.setupBadge]}>
                            SETUP
                          </Text>
                        ) : null}
                        {rep.is_failed ? (
                          <Text style={[styles.badge, styles.failedBadge]}>
                            FAILED
                          </Text>
                        ) : null}
                        {isExcluded && !isSetupRep ? (
                          <Text style={[styles.badge, styles.excludedBadge]}>
                            除外
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.metrics}>
                        <Text
                          style={[
                            styles.metricText,
                            rep.is_failed && styles.metricTextFailed,
                          ]}
                        >
                          V: {rep.mean_velocity?.toFixed(2) ?? "-"} m/s
                        </Text>
                        <Text
                          style={[
                            styles.metricText,
                            rep.is_failed && styles.metricTextFailed,
                          ]}
                        >
                          P:{" "}
                          {rep.mean_power_w != null
                            ? `${Math.round(rep.mean_power_w)} W`
                            : "-"}
                        </Text>
                        <Text
                          style={[
                            styles.metricText,
                            rep.is_failed && styles.metricTextFailed,
                          ]}
                        >
                          ROM: {rep.rom_cm?.toFixed(1) ?? "-"} cm
                        </Text>
                        <Text
                          style={[
                            styles.metricText,
                            rep.is_failed && styles.metricTextFailed,
                          ]}
                        >
                          PV: {rep.peak_velocity?.toFixed(2) ?? "-"} m/s
                        </Text>
                        <Text
                          style={[
                            styles.metricText,
                            rep.is_failed && styles.metricTextFailed,
                          ]}
                        >
                          PP:{" "}
                          {rep.peak_power_w != null
                            ? `${Math.round(rep.peak_power_w)} W`
                            : "-"}
                        </Text>
                        <Text
                          style={[
                            styles.metricText,
                            rep.is_failed && styles.metricTextFailed,
                          ]}
                        >
                          Time: {formatRepTime(rep.timestamp, setStartedAt)}
                        </Text>
                        <Text
                          style={[
                            styles.metricText,
                            rep.is_failed && styles.metricTextFailed,
                          ]}
                        >
                          Dur:{" "}
                          {rep.rep_duration_ms != null
                            ? `${(rep.rep_duration_ms / 1000).toFixed(2)}s`
                            : "-"}
                        </Text>
                        <Text
                          style={[
                            styles.metricText,
                            styles.vlText,
                            rep.is_failed && styles.metricTextFailed,
                          ]}
                        >
                          VL: {vlText}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.actionButtons}>
                      {onMarkSetupRep && !isExcluded ? (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.setupActionBtn]}
                          onPress={() => onMarkSetupRep(repId)}
                        >
                          <Ionicons
                            name="construct-outline"
                            size={16}
                            color="#5ec8ff"
                          />
                          <Text
                            style={[styles.actionBtnText, { color: "#5ec8ff" }]}
                          >
                            SETUP
                          </Text>
                        </TouchableOpacity>
                      ) : null}

                      {onMarkFailedRep && !isExcluded ? (
                        <TouchableOpacity
                          style={[
                            styles.actionBtn,
                            rep.is_failed ? styles.unfailBtn : styles.failBtn,
                          ]}
                          onPress={() => onMarkFailedRep(repId, !rep.is_failed)}
                        >
                          <Ionicons
                            name={
                              rep.is_failed
                                ? "checkmark-circle-outline"
                                : "close-circle-outline"
                            }
                            size={18}
                            color={rep.is_failed ? "#4CAF50" : "#FF9800"}
                          />
                          <Text
                            style={[
                              styles.actionBtnText,
                              { color: rep.is_failed ? "#4CAF50" : "#FF9800" },
                            ]}
                          >
                            {rep.is_failed ? "失敗取消" : "失敗"}
                          </Text>
                        </TouchableOpacity>
                      ) : null}

                      {onExcludeRep && !isExcluded ? (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.excludeBtn]}
                          onPress={() => onExcludeRep(repId, "user_removed")}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color="#f44336"
                          />
                          <Text
                            style={[styles.actionBtnText, { color: "#f44336" }]}
                          >
                            除外
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricCardLabel}>{label}</Text>
      <Text style={styles.metricCardValue}>{value}</Text>
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const average = (values: number[]): number | null => {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const min = (values: number[]): number | null =>
  values.length > 0 ? Math.min(...values) : null;

const max = (values: number[]): number | null =>
  values.length > 0 ? Math.max(...values) : null;

const formatDateTime = (date: Date): string =>
  date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  return `${minutes}:${restSeconds.toString().padStart(2, "0")}`;
};

const formatRepTime = (
  timestamp: string,
  setStartedAt?: string | null,
): string => {
  const repTime = new Date(timestamp);
  if (Number.isNaN(repTime.getTime())) return "-";
  const clock = repTime.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  if (!setStartedAt) return clock;

  const startedAt = new Date(setStartedAt);
  if (Number.isNaN(startedAt.getTime())) return clock;
  const offsetS = Math.max(
    0,
    Math.round((repTime.getTime() - startedAt.getTime()) / 1000),
  );
  return `${clock} (+${formatDuration(offsetS)})`;
};

const formatVideoRange = (startedAt: string, endedAt: string): string => {
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  const startText = Number.isNaN(start.getTime())
    ? "-"
    : start.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
  const endText = Number.isNaN(end.getTime())
    ? "-"
    : end.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
  return `${startText} - ${endText}`;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#1E1E1E",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: "76%",
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  subtitle: {
    color: "#999",
    fontSize: 13,
    marginTop: 4,
  },
  closeBtn: {
    padding: 4,
  },
  headerActions: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2b2b2b",
  },
  headerActionBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ff8c42",
    backgroundColor: "rgba(255, 140, 66, 0.08)",
  },
  headerActionText: {
    color: "#ff8c42",
    fontSize: 13,
    fontWeight: "700",
  },
  timingPanel: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2b2b2b",
  },
  timingItem: {
    flexBasis: "48%",
    backgroundColor: "#161616",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  timingLabel: {
    color: "#888",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  timingValue: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  scrollArea: {
    padding: 16,
  },
  summaryPanel: {
    backgroundColor: "#141414",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2f2f2f",
  },
  summaryHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  summaryTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  summaryMeta: {
    color: "#aaa",
    fontSize: 12,
    fontWeight: "700",
  },
  highlightGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCard: {
    flexBasis: "31%",
    flexGrow: 1,
    minWidth: 88,
    backgroundColor: "#242424",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 10,
  },
  metricCardLabel: {
    color: "#8d8d8d",
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 4,
  },
  metricCardValue: {
    color: "#ffb347",
    fontSize: 14,
    fontWeight: "900",
  },
  detailGrid: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#2b2b2b",
    paddingTop: 10,
    gap: 8,
  },
  detailLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  detailLabel: {
    color: "#8d8d8d",
    fontSize: 12,
    fontWeight: "700",
  },
  detailValue: {
    flex: 1,
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  videoPanel: {
    backgroundColor: "#101820",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#26445c",
  },
  videoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(94, 200, 255, 0.16)",
  },
  videoInfo: {
    flex: 1,
  },
  videoTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  videoMeta: {
    color: "#91a4b7",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  videoActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  videoActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  videoDeleteBtn: {
    borderColor: "rgba(255, 107, 107, 0.45)",
    backgroundColor: "rgba(255, 107, 107, 0.08)",
  },
  addRepButton: {
    backgroundColor: "#ff7a1a",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#ffb347",
  },
  addRepButtonText: {
    color: "#fff5ee",
    fontSize: 16,
    fontWeight: "bold",
  },
  emptyText: {
    color: "#888",
    textAlign: "center",
    marginTop: 40,
    fontSize: 16,
  },
  repRow: {
    backgroundColor: "#2C2C2E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#383838",
  },
  repRowFailed: {
    borderLeftColor: "#FF9800",
    borderLeftWidth: 4,
    backgroundColor: "rgba(255, 152, 0, 0.05)",
  },
  repRowSetup: {
    borderLeftColor: "#5ec8ff",
    borderLeftWidth: 4,
    backgroundColor: "rgba(94, 200, 255, 0.06)",
  },
  repInfo: {
    flex: 1,
  },
  repHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  repNumber: {
    color: "#A0A0A0",
    fontSize: 14,
    fontWeight: "bold",
  },
  repNumberFailed: {
    color: "#FF9800",
  },
  badge: {
    fontSize: 10,
    fontWeight: "bold",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  setupBadge: {
    color: "#5ec8ff",
    borderColor: "#5ec8ff",
  },
  failedBadge: {
    color: "#FF9800",
    borderColor: "#FF9800",
  },
  excludedBadge: {
    color: "#f44336",
    borderColor: "#f44336",
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  metricTextFailed: {
    color: "#FF9800",
    textDecorationLine: "line-through",
  },
  vlText: {
    color: "#FF9500",
  },
  actionButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  setupActionBtn: {
    borderColor: "#5ec8ff",
    backgroundColor: "rgba(94, 200, 255, 0.08)",
  },
  failBtn: {
    borderColor: "#FF9800",
    backgroundColor: "rgba(255, 152, 0, 0.1)",
  },
  unfailBtn: {
    borderColor: "#4CAF50",
    backgroundColor: "rgba(76, 175, 80, 0.1)",
  },
  excludeBtn: {
    borderColor: "#f44336",
    backgroundColor: "rgba(244, 67, 54, 0.08)",
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 4,
  },
});
