import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GarageTheme } from "@/src/constants/garageTheme";
import RestTimer from "@/src/components/session/RestTimer";
import type { SessionDecision } from "@/src/services/SessionDecisionService";
import type { Exercise, SetData } from "@/src/types/index";
import {
  adjustLoad,
  formatDashboardData,
  formatHeartRate,
  formatLoad,
  formatSetCardLines,
  formatVelocity,
  formatVelocityLoss,
  getConnectionStatus,
  getHeartRateStatus,
  getVideoStatus,
  type DashboardData,
  type DecisionData,
  type LiveData,
  type SetListItem,
} from "@/src/viewmodels/SessionDashboardViewModel";

type TabType = "LIVE" | "DECISION" | "SETS";

const TABS: TabType[] = ["LIVE", "DECISION", "SETS"];
const DASHBOARD_CONTROL_RESERVE = 180;

type ActionButton = {
  key: string;
  label: string;
  onPress: () => void;
};

type SetRef = Pick<SetListItem, "sessionId" | "lift" | "setIndex">;

interface SessionDashboardProps {
  currentExercise: Exercise | null;
  currentLift: string | null;
  currentLoad: number;
  currentReps: number;
  currentSetIndex: number;
  plannedSetCount: number | null;
  plannedRpe: number | null;
  setHistory: SetData[];
  currentHeartRate: number | null;
  restStartTime: number | null;
  isConnected: boolean;
  videoEnabled: boolean;
  isVideoActive: boolean;
  canReconnectSensor: boolean;
  isReconnectingSensor: boolean;
  sensorInputMuted: boolean;
  decision: SessionDecision | null;
  useMetric: boolean;
  onResumeSession: () => void;
  onUpdateLoad: (load: number) => void;
  onToggleSensorMuted: () => void;
  onOpenVideo: () => void;
  onEditSet: (setRef: SetRef) => void;
  onOpenRepDetail: (setRef: SetRef) => void;
  onConsultCoach: () => void;
  onOpenLegacyDetails: () => void;
  onEndSession: () => void;
  onGoToday: () => void;
  onReconnectSensor: () => void;
}

const DashboardHeader = memo(function DashboardHeader({
  onGoToday,
  currentExercise,
  currentLift,
  currentSetIndex,
  isConnected,
  currentHeartRate,
  isVideoActive,
  canReconnectSensor,
  isReconnectingSensor,
  onReconnectSensor,
}: {
  onGoToday: () => void;
  currentExercise: Exercise | null;
  currentLift: string | null;
  currentSetIndex: number;
  isConnected: boolean;
  currentHeartRate: number | null;
  isVideoActive: boolean;
  canReconnectSensor: boolean;
  isReconnectingSensor: boolean;
  onReconnectSensor: () => void;
}) {
  const vbtStatus = getConnectionStatus(isConnected);
  const hrStatus = getHeartRateStatus(currentHeartRate);
  const videoStatus = getVideoStatus(isVideoActive);

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.todayButton} onPress={onGoToday}>
        <Text style={styles.todayButtonText}>Today</Text>
      </TouchableOpacity>
      <View style={styles.headerMain}>
        <View style={styles.headerTitleBlock}>
          <Text numberOfLines={1} style={styles.exerciseName}>
            {currentExercise?.name || currentLift || "種目未選択"}
          </Text>
          <Text numberOfLines={1} style={styles.setText}>
            Set {currentSetIndex}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <StatusPill color={vbtStatus.color} text={vbtStatus.text} />
          <StatusPill color={hrStatus.color} text={`HR ${hrStatus.text}`} />
          <StatusPill color={videoStatus.color} text={videoStatus.text} />
        </View>
        {!isConnected && canReconnectSensor ? (
          <TouchableOpacity
            style={styles.reconnectButton}
            onPress={onReconnectSensor}
            disabled={isReconnectingSensor}
          >
            <Text style={styles.reconnectButtonText}>
              {isReconnectingSensor ? "再接続中..." : "センサーを再接続"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
});

const StatusPill = memo(function StatusPill({
  color,
  text,
}: {
  color: string;
  text: string;
}) {
  return (
    <View style={styles.statusPill}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text numberOfLines={1} style={styles.statusText}>
        {text}
      </Text>
    </View>
  );
});

const MetricCard = memo(function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text numberOfLines={1} style={styles.metricLabel}>
        {label}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>
        {value}
      </Text>
    </View>
  );
});

const LiveTab = memo(function LiveTab({
  liveData,
  useMetric,
  restStartTime,
  onLoadAdjust,
}: {
  liveData: LiveData;
  useMetric: boolean;
  restStartTime: number | null;
  onLoadAdjust: (direction: "up" | "down") => void;
}) {
  return (
    <View style={styles.pageContent}>
      <View style={styles.row}>
        <View style={styles.controlCard}>
          <Text style={styles.sectionLabel}>重量</Text>
          <View style={styles.adjustRow}>
            <TouchableOpacity
              style={styles.adjustButton}
              onPress={() => onLoadAdjust("down")}
            >
              <Text style={styles.adjustButtonText}>-2.5</Text>
            </TouchableOpacity>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.adjustValue}>
              {formatLoad(liveData.currentLoad, useMetric)}
            </Text>
            <TouchableOpacity
              style={styles.adjustButton}
              onPress={() => onLoadAdjust("up")}
            >
              <Text style={styles.adjustButtonText}>+2.5</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <View style={styles.row}>
        <MetricCard
          label="RPE"
          value={liveData.plannedRpe == null ? "--" : String(liveData.plannedRpe)}
        />
      </View>
      <View style={styles.panelCard}>
        <Text style={styles.sectionTitle}>直近セット</Text>
        <View style={styles.row}>
          <MetricCard
            label="平均速度"
            value={`${formatVelocity(liveData.latestSet.avgVelocity)} m/s`}
          />
          <MetricCard
            label="速度低下"
            value={formatVelocityLoss(liveData.latestSet.velocityLossLast)}
          />
        </View>
        <View style={styles.row}>
          <MetricCard
            label="ROM"
            value={
              liveData.latestSet.rom == null
                ? "--"
                : `${liveData.latestSet.rom.toFixed(1)} cm`
            }
          />
          <MetricCard label="心拍" value={formatHeartRate(liveData.currentHeartRate)} />
        </View>
      </View>
      <RestTimer restStartTime={restStartTime} />
    </View>
  );
});

const DecisionTab = memo(function DecisionTab({
  decisionData,
  useMetric,
}: {
  decisionData: DecisionData;
  useMetric: boolean;
}) {
  return (
    <View style={styles.pageContent}>
      <View style={styles.panelCard}>
        <Text style={styles.sectionTitle}>推奨プラン</Text>
        <DecisionRow
          label="重量"
          value={
            decisionData.recommendedLoad == null
              ? "--"
              : formatLoad(decisionData.recommendedLoad, useMetric)
          }
        />
        <DecisionRow
          label="Reps"
          value={
            decisionData.recommendedReps == null
              ? "--"
              : String(decisionData.recommendedReps)
          }
        />
        <DecisionRow label="ソース" value={decisionData.candidateSource || "--"} />
      </View>
      <View style={styles.row}>
        <MetricCard
          label="休憩"
          value={
            decisionData.recommendedRestMin == null
              ? "--"
              : `${decisionData.recommendedRestMin} min`
          }
        />
        <MetricCard
          label="心拍再開"
          value={
            decisionData.waitUntilHRBelow == null
              ? "--"
              : `${decisionData.waitUntilHRBelow} bpm`
          }
        />
      </View>
      <View style={styles.panelCard}>
        <Text style={styles.sectionTitle}>判断理由</Text>
        {decisionData.reasonBullets.length === 0 ? (
          <Text style={styles.emptyText}>まだ判断材料がありません</Text>
        ) : (
          decisionData.reasonBullets.map((reason) => (
            <Text key={reason} numberOfLines={2} style={styles.reasonText}>
              ・{reason}
            </Text>
          ))
        )}
      </View>
      <View style={styles.row}>
        <CompactCriteriaCard
          title="継続基準"
          items={decisionData.passCriteria}
          tone="success"
        />
        <CompactCriteriaCard
          title="停止基準"
          items={decisionData.stopCriteria}
          tone="danger"
        />
      </View>
    </View>
  );
});

const DecisionRow = memo(function DecisionRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.decisionRow}>
      <Text numberOfLines={1} style={styles.decisionLabel}>
        {label}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.decisionValue}>
        {value}
      </Text>
    </View>
  );
});

const CompactCriteriaCard = memo(function CompactCriteriaCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "success" | "danger";
}) {
  const borderColor = tone === "success" ? GarageTheme.success : GarageTheme.danger;
  return (
    <View style={[styles.criteriaCard, { borderColor }]}>
      <Text style={styles.criteriaTitle}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.criteriaText}>なし</Text>
      ) : (
        items.slice(0, 3).map((item) => (
          <Text key={item} numberOfLines={2} style={styles.criteriaText}>
            {item}
          </Text>
        ))
      )}
    </View>
  );
});

const SetsTab = memo(function SetsTab({
  setList,
  useMetric,
  onOpenRepDetail,
  onEditSet,
}: {
  setList: SetListItem[];
  useMetric: boolean;
  onOpenRepDetail: (setRef: SetRef) => void;
  onEditSet: (setRef: SetRef) => void;
}) {
  const visibleSetList = useMemo(() => setList.slice(-6).reverse(), [setList]);
  const hiddenCount = Math.max(0, setList.length - visibleSetList.length);

  const renderSetItem = useCallback(
    (item: SetListItem) => {
      const lines = formatSetCardLines(item, useMetric);
      return (
        <TouchableOpacity
          style={styles.setCard}
          onPress={() =>
            onOpenRepDetail({
              sessionId: item.sessionId,
              lift: item.lift,
              setIndex: item.setIndex,
            })
          }
          onLongPress={() =>
            onEditSet({
              sessionId: item.sessionId,
              lift: item.lift,
              setIndex: item.setIndex,
            })
          }
        >
          <View style={styles.setCardHeader}>
            <View style={styles.setCardTitleBlock}>
              <Text numberOfLines={1} style={styles.setCardTitle}>
                {lines.lift}
              </Text>
              <Text numberOfLines={1} style={styles.setCardIndex}>
                {lines.setLabel}
              </Text>
            </View>
            {item.isWarmup ? (
              <View style={styles.warmupBadge}>
                <Text style={styles.warmupText}>W</Text>
              </View>
            ) : null}
          </View>
          <Text numberOfLines={1} style={styles.setCardLoadReps}>
            {lines.loadAndReps}
          </Text>
          <Text numberOfLines={1} style={styles.setCardMetric}>
            {lines.metrics}
          </Text>
        </TouchableOpacity>
      );
    },
    [onEditSet, onOpenRepDetail, useMetric],
  );

  return (
    <View style={styles.pageContent}>
      <Text style={styles.sectionLabel}>タップで詳細、長押しで編集</Text>
      {setList.length === 0 ? (
        <Text style={styles.emptyText}>セットデータなし</Text>
      ) : (
        <>
          <View style={styles.setGrid}>
            {visibleSetList.map((item) => (
              <View
                key={`${item.sessionId}:${item.lift}:${item.setIndex}`}
                style={styles.setGridItem}
              >
                {renderSetItem(item)}
              </View>
            ))}
          </View>
          {hiddenCount > 0 ? (
            <Text style={styles.sectionLabel}>ほか {hiddenCount} 件</Text>
          ) : null}
        </>
      )}
    </View>
  );
});

const SessionDashboard = memo(function SessionDashboard({
  currentExercise,
  currentLift,
  currentLoad,
  currentReps,
  currentSetIndex,
  plannedSetCount,
  plannedRpe,
  setHistory,
  currentHeartRate,
  restStartTime,
  isConnected,
  videoEnabled,
  isVideoActive,
  canReconnectSensor,
  isReconnectingSensor,
  sensorInputMuted,
  decision,
  useMetric,
  onResumeSession,
  onUpdateLoad,
  onToggleSensorMuted,
  onOpenVideo,
  onEditSet,
  onOpenRepDetail,
  onConsultCoach,
  onOpenLegacyDetails,
  onEndSession,
  onGoToday,
  onReconnectSensor,
}: SessionDashboardProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("LIVE");
  const dashboardData: DashboardData = useMemo(
    () =>
      formatDashboardData({
        currentLoad,
        currentReps,
        plannedSetCount,
        plannedRpe,
        setHistory,
        currentHeartRate,
        restStartTime,
        isConnected,
        isVideoRecording: isVideoActive,
        decision,
      }),
    [
      currentLoad,
      currentReps,
      plannedSetCount,
      plannedRpe,
      setHistory,
      currentHeartRate,
      restStartTime,
      isConnected,
      isVideoActive,
      decision,
    ],
  );
  const pageWidth = Math.max(width - 32, 280);
  const latestSetRef = dashboardData.sets[dashboardData.sets.length - 1] ?? null;

  const scrollToTab = useCallback(
    (tab: TabType) => {
      const tabIndex = TABS.indexOf(tab);
      setActiveTab(tab);
      scrollRef.current?.scrollTo({ x: pageWidth * tabIndex, animated: true });
    },
    [pageWidth],
  );

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      setActiveTab(TABS[nextIndex] ?? "LIVE");
    },
    [pageWidth],
  );

  const handleLoadAdjust = useCallback(
    (direction: "up" | "down") => {
      onUpdateLoad(adjustLoad(currentLoad, direction));
    },
    [currentLoad, onUpdateLoad],
  );

  const secondaryButtons = useMemo<ActionButton[]>(
    () => [
      {
        key: "sensor",
        label: sensorInputMuted ? "入力ON" : "入力OFF",
        onPress: onToggleSensorMuted,
      },
      ...(videoEnabled
        ? [{ key: "video", label: isVideoActive ? "録画中" : "動画", onPress: onOpenVideo }]
        : []),
      ...(latestSetRef
        ? [
            {
              key: "edit",
              label: "最新編集",
              onPress: () =>
                onEditSet({
                  sessionId: latestSetRef.sessionId,
                  lift: latestSetRef.lift,
                  setIndex: latestSetRef.setIndex,
                }),
            },
          ]
        : []),
      {
        key: "coach",
        label: "チャッピーコーチ",
        onPress: onConsultCoach,
      },
      {
        key: "detail",
        label: "旧詳細",
        onPress: onOpenLegacyDetails,
      },
      {
        key: "end",
        label: "終了",
        onPress: onEndSession,
      },
    ],
    [
      isVideoActive,
      latestSetRef,
      onConsultCoach,
      onEditSet,
      onEndSession,
      onOpenLegacyDetails,
      onOpenVideo,
      onToggleSensorMuted,
      sensorInputMuted,
      videoEnabled,
    ],
  );

  return (
    <View
      style={[styles.container, { paddingBottom: insets.bottom + DASHBOARD_CONTROL_RESERVE }]}
    >
      <DashboardHeader
        onGoToday={onGoToday}
        currentExercise={currentExercise}
        currentLift={currentLift}
        currentSetIndex={currentSetIndex}
        isConnected={isConnected}
        currentHeartRate={currentHeartRate}
        isVideoActive={isVideoActive}
        canReconnectSensor={canReconnectSensor}
        isReconnectingSensor={isReconnectingSensor}
        onReconnectSensor={onReconnectSensor}
      />
      <View style={styles.segmentedControl}>
        {TABS.map((tab) => {
          const active = tab === activeTab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.segmentButton, active && styles.segmentButtonActive]}
              onPress={() => scrollToTab(tab)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.tabFrame}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumEnd}
          scrollEventThrottle={16}
        >
          <View style={[styles.page, { width: pageWidth }]}>
            <LiveTab
              liveData={dashboardData.live}
              useMetric={useMetric}
              restStartTime={restStartTime}
              onLoadAdjust={handleLoadAdjust}
            />
          </View>
          <View style={[styles.page, { width: pageWidth }]}>
            <DecisionTab decisionData={dashboardData.decision} useMetric={useMetric} />
          </View>
          <View style={[styles.page, { width: pageWidth }]}>
            <SetsTab
              setList={dashboardData.sets}
              useMetric={useMetric}
              onOpenRepDetail={onOpenRepDetail}
              onEditSet={onEditSet}
            />
          </View>
        </ScrollView>
      </View>
      <View style={[styles.controls, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={styles.primaryButton} onPress={onResumeSession}>
          <Text style={styles.primaryButtonText}>休憩を再開</Text>
        </TouchableOpacity>
        <View style={styles.secondaryControls}>
          {secondaryButtons.map((button) => (
            <TouchableOpacity
              key={button.key}
              style={styles.controlButton}
              onPress={button.onPress}
            >
              <Text numberOfLines={1} style={styles.controlButtonText}>
                {button.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GarageTheme.background,
  },
  header: {
    backgroundColor: GarageTheme.surface,
    borderBottomColor: GarageTheme.borderStrong,
    borderBottomWidth: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  todayButton: {
    alignSelf: "flex-start",
    backgroundColor: GarageTheme.chip,
    borderColor: GarageTheme.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14,
  },
  todayButtonText: {
    color: GarageTheme.accentSoft,
    fontSize: 14,
    fontWeight: "600",
  },
  headerMain: {
    gap: 10,
  },
  headerTitleBlock: {
    gap: 2,
  },
  exerciseName: {
    color: GarageTheme.textStrong,
    fontSize: 22,
    fontWeight: "700",
  },
  setText: {
    color: GarageTheme.textMuted,
    fontSize: 13,
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
  },
  reconnectButton: {
    alignSelf: "flex-start",
    backgroundColor: GarageTheme.panel,
    borderColor: GarageTheme.accent,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  reconnectButtonText: {
    color: GarageTheme.accentSoft,
    fontSize: 13,
    fontWeight: "700",
  },
  statusPill: {
    alignItems: "center",
    backgroundColor: GarageTheme.panel,
    borderColor: GarageTheme.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 10,
  },
  statusDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  statusText: {
    color: GarageTheme.textMuted,
    flexShrink: 1,
    fontSize: 12,
  },
  segmentedControl: {
    backgroundColor: GarageTheme.surfaceAlt,
    borderColor: GarageTheme.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 16,
    overflow: "hidden",
  },
  segmentButton: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  segmentButtonActive: {
    backgroundColor: GarageTheme.accent,
  },
  segmentText: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: GarageTheme.textStrong,
  },
  tabFrame: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 14,
  },
  page: {
    flex: 1,
  },
  pageContent: {
    flex: 1,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  controlCard: {
    backgroundColor: GarageTheme.surface,
    borderColor: GarageTheme.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 10,
    padding: 12,
  },
  sectionLabel: {
    color: GarageTheme.textSubtle,
    fontSize: 12,
  },
  sectionTitle: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: "700",
  },
  adjustRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  adjustButton: {
    alignItems: "center",
    backgroundColor: GarageTheme.accent,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 58,
    paddingHorizontal: 8,
  },
  adjustButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "700",
  },
  adjustValue: {
    color: GarageTheme.textStrong,
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  metricCard: {
    backgroundColor: GarageTheme.surface,
    borderColor: GarageTheme.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minHeight: 82,
    padding: 12,
  },
  metricLabel: {
    color: GarageTheme.textSubtle,
    fontSize: 12,
  },
  metricValue: {
    color: GarageTheme.textStrong,
    fontSize: 18,
    fontWeight: "700",
  },
  panelCard: {
    backgroundColor: GarageTheme.surface,
    borderColor: GarageTheme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  decisionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  decisionLabel: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    width: 60,
  },
  decisionValue: {
    color: GarageTheme.textStrong,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
  },
  reasonText: {
    color: GarageTheme.text,
    fontSize: 13,
    lineHeight: 18,
  },
  criteriaCard: {
    backgroundColor: GarageTheme.surface,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minHeight: 116,
    padding: 12,
  },
  criteriaTitle: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "700",
  },
  criteriaText: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  setGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  setGridItem: {
    width: "48%",
  },
  setCard: {
    backgroundColor: GarageTheme.surface,
    borderColor: GarageTheme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    justifyContent: "center",
    minHeight: 74,
    paddingHorizontal: 8,
    paddingVertical: 7,
    width: "100%",
  },
  setCardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 6,
  },
  setCardTitleBlock: {
    flex: 1,
    flexDirection: "row",
    gap: 4,
    minWidth: 0,
  },
  setCardTitle: {
    color: GarageTheme.textStrong,
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    minWidth: 0,
  },
  setCardIndex: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  setCardLoadReps: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "700",
  },
  setCardMetric: {
    color: GarageTheme.textMuted,
    fontSize: 11,
  },
  warmupBadge: {
    backgroundColor: GarageTheme.warning,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  warmupText: {
    color: GarageTheme.textStrong,
    fontSize: 10,
    fontWeight: "700",
  },
  emptyText: {
    color: GarageTheme.textSubtle,
    fontSize: 13,
  },
  controls: {
    backgroundColor: GarageTheme.surface,
    borderTopColor: GarageTheme.borderStrong,
    borderTopWidth: 1,
    bottom: 0,
    gap: 8,
    left: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    position: "absolute",
    right: 0,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: GarageTheme.accent,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
  },
  primaryButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  controlButton: {
    alignItems: "center",
    backgroundColor: GarageTheme.panel,
    borderColor: GarageTheme.border,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: "31%",
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 8,
  },
  controlButtonText: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
});

export default SessionDashboard;
