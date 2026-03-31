import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import DatabaseService from '@/src/services/DatabaseService';
import { getApiBaseUrl, getResolvedApiHealth, type ApiHealthPayload } from '@/constants/oauth';
import { useTrainingStore } from '@/src/store/trainingStore';
import { trpc } from '@/lib/trpc';
import { getLocalLLMHealth, invokeDirectCoachChat, verifyLocalLLMConnection } from '@/src/services/LocalLLMService';
import { firstRouteParam, numberRouteParam } from '@/src/utils/routeParams';
import type { SessionData, SetData } from '@/src/types/index';

interface Message {
  id: string;
  role: 'user' | 'coach';
  text: string;
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  '今日のトレーニングを評価して',
  '次のセットの推奨を教えて',
  '疲労度を見て',
  '今日のポイントを3つ教えて',
];

type RouteParams = {
  source?: string | string[];
  message?: string | string[];
  currentExercise?: string | string[];
  currentSet?: string | string[];
  reps?: string | string[];
  loadKg?: string | string[];
  velocityLoss?: string | string[];
  meanVelocity?: string | string[];
  peakVelocity?: string | string[];
  sessionId?: string | string[];
  totalSets?: string | string[];
  totalVolume?: string | string[];
  notes?: string | string[];
  savedSetCount?: string | string[];
};

export default function AICoachChatScreen() {
  const router = useRouter();
  const navigationState = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<RouteParams>();
  const scrollViewRef = useRef<ScrollView>(null);
  const { currentExercise, currentSession, settings } = useTrainingStore();

  const routeSource = firstRouteParam(params.source) ?? 'direct';
  const routeMessage = firstRouteParam(params.message) ?? '';
  const routeExercise = firstRouteParam(params.currentExercise) ?? null;
  const routeCurrentSet = numberRouteParam(params.currentSet);
  const routeReps = numberRouteParam(params.reps);
  const routeLoadKg = numberRouteParam(params.loadKg);
  const routeVelocityLoss = numberRouteParam(params.velocityLoss);
  const routeMeanVelocity = numberRouteParam(params.meanVelocity);
  const routePeakVelocity = numberRouteParam(params.peakVelocity);
  const routeSessionId = firstRouteParam(params.sessionId) ?? '';
  const routeTotalSets = numberRouteParam(params.totalSets);
  const routeTotalVolume = numberRouteParam(params.totalVolume);
  const routeNotes = firstRouteParam(params.notes) ?? '';
  const routeSavedSetCount = numberRouteParam(params.savedSetCount);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'coach',
      text: 'AIコーチです。接続状態を確認しながら相談できます。',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [apiStatusDetail, setApiStatusDetail] = useState('');
  const [resolvedApiBaseUrl, setResolvedApiBaseUrl] = useState(getApiBaseUrl());
  const [apiHealth, setApiHealth] = useState<ApiHealthPayload | null>(null);
  const coachChatMutation = trpc.ai.coachChat.useMutation();

  useEffect(() => {
    void DatabaseService.initialize();
    if (routeMessage) {
      setInput((prev) => prev || routeMessage);
    }
    void checkApiHealth();
  }, [routeMessage]);

  const routeContextSummary = useMemo(() => {
    const parts = [routeSource];
    if (routeExercise) {
      parts.push(routeExercise);
    }
    if (routeLoadKg !== null || routeReps !== null) {
      parts.push(`${routeLoadKg ?? '-'}kg x ${routeReps ?? '-'}`);
    }
    return parts.join(' / ');
  }, [routeExercise, routeLoadKg, routeReps, routeSource]);

  const addCoachMessage = (text: string) => {
    const msg: Message = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: 'coach',
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, msg]);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const checkApiHealth = async () => {
    setApiStatus('checking');
    const localHealth = await getLocalLLMHealth().catch(() => null);
    if (localHealth?.hasApiKey) {
      setResolvedApiBaseUrl(localHealth.apiUrl);
      setApiHealth(null);

      const verifyResult = await verifyLocalLLMConnection().catch(() => null);
      if (verifyResult?.ok) {
        setApiStatus('ok');
        setApiStatusDetail(`${verifyResult.detail} (${localHealth.apiUrl})`);
      } else {
        setApiStatus('error');
        setApiStatusDetail(`${verifyResult?.detail ?? 'ローカル直接接続に失敗しました。'} (${localHealth.apiUrl})`);
      }
      return;
    }

    const { baseUrl, health } = await getResolvedApiHealth(true);
    setResolvedApiBaseUrl(baseUrl);
    setApiHealth(health);

    if (!baseUrl) {
      setApiStatus('error');
      setApiStatusDetail('API URL が未設定です');
      return;
    }

    if (!health?.ok) {
      setApiStatus('error');
      setApiStatusDetail(`API未接続 (${baseUrl})`);
      return;
    }

    setApiStatus('ok');
    const modelLabel = health.llm?.model ? ` / model: ${health.llm.model}` : '';
    const portLabel = health.port ? ` / port: ${health.port}` : '';
    if (!health.llm?.hasApiKey) {
      setApiStatusDetail(`AIサーバー接続OK / ZAI_API_KEY未設定${portLabel} (${baseUrl})`);
    } else {
      setApiStatusDetail(`AIサーバー接続OK${modelLabel}${portLabel} (${baseUrl})`);
    }
  };

  const buildTrainingContext = async () => {
    const sessions = await DatabaseService.getSessions().catch(() => [] as SessionData[]);
    const recentSessions = await Promise.all(
      sessions.slice(0, 5).map(async (session) => {
        const sets = await DatabaseService.getSetsForSession(session.session_id).catch(() => [] as SetData[]);
        const lifts = Array.from(new Set(sets.map((set) => set.lift).filter(Boolean)));
        const totalVolume = sets.reduce((sum, set) => sum + set.load_kg * set.reps, 0) || session.total_volume;
        return {
          date: session.date,
          total_sets: sets.length || session.total_sets,
          total_volume: totalVolume,
          lifts,
        };
      }),
    );

    const effectiveExercise = routeExercise ?? currentExercise?.name ?? null;
    let sameLiftRecentSets: Array<{
      date: string;
      lift: string;
      set_index: number;
      load_kg: number;
      reps: number;
      velocity_loss: number | null;
    }> = [];

    if (effectiveExercise) {
      const sameLiftRecords = await Promise.all(
        sessions.slice(0, 5).map(async (session) => {
          const sets = await DatabaseService.getSetsForSession(session.session_id).catch(() => [] as SetData[]);
          return sets
            .filter((set) => set.lift === effectiveExercise)
            .map((set) => ({
              date: session.date,
              lift: set.lift,
              set_index: set.set_index,
              load_kg: set.load_kg,
              reps: set.reps,
              velocity_loss: set.velocity_loss,
            }));
        }),
      );
      sameLiftRecentSets = sameLiftRecords.flat().slice(0, 8);
    }

    let focusSession: {
      session_id: string;
      date: string;
      lifts: string[];
      total_sets: number;
      total_volume: number;
      notes?: string;
    } | null = null;

    if (routeSessionId) {
      const [session, sets] = await Promise.all([
        DatabaseService.getSession(routeSessionId).catch(() => null),
        DatabaseService.getSetsForSession(routeSessionId).catch(() => [] as SetData[]),
      ]);

      if (session) {
        focusSession = {
          session_id: session.session_id,
          date: session.date,
          lifts: Array.from(new Set(sets.map((set) => set.lift).filter(Boolean))),
          total_sets: sets.length || session.total_sets,
          total_volume: sets.reduce((sum, set) => sum + set.load_kg * set.reps, 0) || session.total_volume,
          notes: session.notes,
        };
      }
    }

    return {
      today: new Date().toISOString().split('T')[0],
      source: routeSource,
      currentExercise: effectiveExercise,
      currentSet: routeCurrentSet ?? currentSession?.sets?.length ?? null,
      currentReps: routeReps,
      currentLoadKg: routeLoadKg,
      velocityLossPercent: routeVelocityLoss,
      currentMeanVelocity: routeMeanVelocity,
      currentPeakVelocity: routePeakVelocity,
      routeNotes: routeNotes || null,
      sessionId: routeSessionId || null,
      requestedTotalSets: routeTotalSets,
      requestedTotalVolume: routeTotalVolume,
      savedSetCount: routeSavedSetCount,
      isSessionActive: Boolean(currentSession),
      recentSessions,
      sameLiftRecentSets,
      focusSession,
      settings,
    };
  };

  const generateFallback = async (userText: string) => {
    const context = await buildTrainingContext();
    return [
      'ローカル要約:',
      `- 入口: ${context.source}`,
      `- 現在種目: ${context.currentExercise ?? 'なし'}`,
      `- セット: ${context.currentSet ?? '-'} / reps: ${context.currentReps ?? '-'}`,
      `- 重量: ${context.currentLoadKg ?? '-'} kg`,
      `- VL: ${context.velocityLossPercent ?? '-'}%`,
      `- 最近の記録: ${context.recentSessions.length}件`,
      `- 質問: ${userText}`,
    ].join('\n');
  };

  const handleSend = async (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText || loading) return;

    setInput('');
    setLoading(true);

    const userMsg: Message = {
      id: `${Date.now()}_u`,
      role: 'user',
      text: msgText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const context = await buildTrainingContext();
      const history = messages
        .filter((message) => message.id !== 'welcome')
        .slice(-12)
        .map((message) => ({
          role: message.role,
          text: message.text,
        }));
      const localHealth = await getLocalLLMHealth().catch(() => null);

      if (localHealth?.hasApiKey) {
        const text = await invokeDirectCoachChat({
          message: msgText,
          history,
          context,
        });
        addCoachMessage(text);
      } else {
        const result = await coachChatMutation.mutateAsync({
          message: msgText,
          history,
          context,
        });
        addCoachMessage(result.text);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const fallback = await generateFallback(msgText);
      const reason =
        errorMessage.includes('ZAI_API_KEY is invalid')
          ? 'ZAI APIキーが無効です。'
          : errorMessage.includes('ZAI_API_BALANCE_EXHAUSTED')
            ? 'ZAI API の残高またはパッケージが不足しています。'
            : errorMessage.includes('ZAI_API_KEY')
              ? 'ZAI APIキーが未設定です。'
              : errorMessage.includes('fetch')
                ? `接続先に到達できません。現在の接続先: ${resolvedApiBaseUrl}`
                : `GLM接続に失敗しました。(${errorMessage.slice(0, 120)})`;

      void checkApiHealth();
      addCoachMessage(`${reason}\n\n${fallback}`);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) =>
    `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={[styles.header, { paddingTop: (insets.top || 0) + 12 }]}> 
        <TouchableOpacity onPress={() => (navigationState.canGoBack() ? router.back() : router.replace('/'))}>
          <Text style={styles.backText}>← 戻る</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEyebrow}>RACE ENGINEER</Text>
          <Text style={styles.title}>AIコーチ</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.apiStatusBar}>
        <View
          style={[
            styles.apiStatusDot,
            apiStatus === 'ok'
              ? styles.apiStatusDotOk
              : apiStatus === 'checking'
                ? styles.apiStatusDotChecking
                : styles.apiStatusDotError,
          ]}
        />
        <View style={styles.apiStatusCopy}>
          <Text style={styles.apiStatusTitle}>
            {apiStatus === 'ok' ? 'GLM 接続可能' : apiStatus === 'checking' ? '接続確認中' : 'GLM 未接続'}
          </Text>
          <Text style={styles.apiStatusText}>{apiStatusDetail || resolvedApiBaseUrl}</Text>
          {apiHealth?.llm ? (
            <Text style={styles.apiStatusMeta}>
              {apiHealth.llm.hasApiKey ? 'LLM key: configured' : 'LLM key: missing'}
              {apiHealth.llm.model ? ` / model: ${apiHealth.llm.model}` : ''}
            </Text>
          ) : apiStatus === 'ok' && apiStatusDetail.includes('ローカル直接接続') ? (
            <Text style={styles.apiStatusMeta}>mode: direct / local key configured</Text>
          ) : null}
        </View>
        <TouchableOpacity style={styles.apiRetryButton} onPress={checkApiHealth}>
          <Text style={styles.apiRetryButtonText}>再確認</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contextBanner}>
        <Text style={styles.contextBannerTitle}>現在の相談コンテキスト</Text>
        <Text style={styles.contextBannerText}>{routeContextSummary}</Text>
      </View>

      <ScrollView ref={scrollViewRef} style={styles.messageList} contentContainerStyle={styles.messageListContent}>
        {messages.map((msg) => (
          <View key={msg.id} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.coachBubble]}>
            <Text style={[styles.bubbleText, msg.role === 'user' ? styles.userText : styles.coachText]}>{msg.text}</Text>
            <Text style={styles.timeText}>{formatTime(msg.timestamp)}</Text>
          </View>
        ))}
        {loading ? (
          <View style={[styles.bubble, styles.coachBubble]}>
            <ActivityIndicator size="small" color="#2196F3" />
          </View>
        ) : null}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickQuestions} contentContainerStyle={{ padding: 8, gap: 8 }}>
        {QUICK_QUESTIONS.map((question) => (
          <TouchableOpacity key={question} style={styles.quickBtn} onPress={() => handleSend(question)} disabled={loading}>
            <Text style={styles.quickBtnText}>{question}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="AIコーチに相談する..."
          placeholderTextColor="#666"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
          onPress={() => handleSend()}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendButtonText}>送信</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#341810',
    backgroundColor: '#090909',
  },
  backText: { color: '#ffb347', fontSize: 15, fontWeight: '700', letterSpacing: 0.6 },
  headerCenter: { alignItems: 'center', gap: 4 },
  headerEyebrow: { color: '#ff6a2a', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  title: { fontSize: 20, fontWeight: '800', color: '#f6f2ee' },
  apiStatusBar: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#3f261d',
    backgroundColor: '#101010',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  apiStatusDot: { width: 10, height: 10, borderRadius: 5 },
  apiStatusDotOk: { backgroundColor: '#67d34f' },
  apiStatusDotChecking: { backgroundColor: '#ffb347' },
  apiStatusDotError: { backgroundColor: '#ff5a36' },
  apiStatusCopy: { flex: 1 },
  apiStatusTitle: { color: '#fff0e7', fontSize: 12, fontWeight: '800', marginBottom: 2 },
  apiStatusText: { color: '#bda69b', fontSize: 11 },
  apiStatusMeta: { color: '#7fa0b1', fontSize: 10, marginTop: 4 },
  apiRetryButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#5a2b1c',
    backgroundColor: '#181313',
  },
  apiRetryButtonText: { color: '#ffb347', fontSize: 11, fontWeight: '700' },
  contextBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#101010',
  },
  contextBannerTitle: {
    color: '#d8b6a6',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  contextBannerText: {
    color: '#f2ebe6',
    fontSize: 13,
    fontWeight: '600',
  },
  messageList: { flex: 1 },
  messageListContent: { padding: 16, gap: 12, paddingBottom: 24 },
  bubble: {
    maxWidth: '86%',
    padding: 14,
    borderRadius: 18,
    marginBottom: 4,
    borderWidth: 1,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#521a12',
    borderColor: '#ff6a2a',
    borderBottomRightRadius: 4,
  },
  coachBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#111111',
    borderBottomLeftRadius: 4,
    borderColor: '#3b2218',
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#fff5ed' },
  coachText: { color: '#ece5df' },
  timeText: { fontSize: 10, color: '#8c7a70', marginTop: 4, alignSelf: 'flex-end' },
  quickQuestions: {
    maxHeight: 60,
    borderTopWidth: 1,
    borderTopColor: '#341810',
    backgroundColor: '#090909',
  },
  quickBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#141414',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#5a2b1c',
  },
  quickBtnText: { color: '#ffb347', fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#341810',
    backgroundColor: '#090909',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 110,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#141414',
    color: '#fff5ed',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2e2e2e',
  },
  sendButton: {
    minWidth: 64,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5b3428',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: '#fff3eb',
    fontSize: 16,
    fontWeight: '800',
  },
});
