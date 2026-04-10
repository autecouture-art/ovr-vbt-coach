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
import { RepData } from "../types/index";

interface Props {
  visible: boolean;
  reps: RepData[];
  setIndex: number;
  lift: string;
  loadKg?: number;
  onClose: () => void;
  onEditSetLoad?: () => void;
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
  onClose,
  onEditSetLoad,
  onExcludeRep,
  onMarkFailedRep,
  onMarkSetupRep,
  onAddMissedRep,
}: Props) {
  const setReps = useMemo(() => {
    return reps.filter(
      (rep) => rep.set_index === setIndex && rep.lift === lift,
    );
  }, [lift, reps, setIndex]);

  const trackedReps = useMemo(
    () =>
      setReps.filter(
        (rep) => !rep.is_excluded && !rep.is_failed && rep.is_valid_rep,
      ),
    [setReps],
  );

  const calculateVL = (rep: RepData) => {
    const trackedIndex = trackedReps.findIndex(
      (item) =>
        (item.id ?? String(item.rep_index)) ===
        (rep.id ?? String(rep.rep_index)),
    );
    if (trackedIndex <= 0) return "0.0";
    const firstRepVel = trackedReps[0]?.mean_velocity ?? 0;
    const currentVel = trackedReps[trackedIndex]?.mean_velocity ?? 0;
    if (!firstRepVel) return "0.0";
    return (((firstRepVel - currentVel) / firstRepVel) * 100).toFixed(1);
  };

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

          <ScrollView style={styles.scrollArea}>
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
                const vlText = isExcluded ? "除外" : `${calculateVL(rep)}%`;
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
  scrollArea: {
    padding: 16,
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
