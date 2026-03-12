/**
 * AICoachChat Screen
 * AIコーチとのリアルタイム会話画面
 * LLM APIと接続可能な設計（現在は高度なルールベース実装）
 */

import React, { useState, useRef, useEffect } from 'react';
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
import { useRouter } from 'expo-router';
import AICoachService from '@/src/services/AICoachService';
import DatabaseService from '@/src/services/DatabaseService';
import { getApiBaseUrl } from '@/constants/oauth';
import { useTrainingStore } from '@/src/store/trainingStore';
import { trpc } from '@/lib/trpc';
import { getLocalizedExerciseName } from '@/src/utils/exerciseLocalization';

interface Message {
    id: string;
    role: 'user' | 'coach';
    text: string;
    timestamp: Date;
}

// クイック質問テンプレート
const QUICK_QUESTIONS = [
    '今日のトレーニングを評価して',
    '次のセットの推奨重量は？',
    '疲労度を教えて',
    '今日の速度ゾーンを分析して',
    'PRまであとどれくらい？',
];

const PHASE_LABELS: Record<string, string> = {
    power: 'パワー',
    hypertrophy: '筋肥大',
    strength: '筋力',
    peaking: 'ピーキング',
};

export default function AICoachChatScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const scrollViewRef = useRef<ScrollView>(null);
    const { setHistory, currentExercise, currentLoad, currentSession, settings } = useTrainingStore();

    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'coach',
            text: '🤖 AIコーチへようこそ！\nトレーニングに関する質問や相談を自由に入力してください。\n\nセッションデータをもとにパーソナルアドバイスを提供します。',
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('checking');
    const [apiStatusDetail, setApiStatusDetail] = useState('');
    const coachChatMutation = trpc.ai.coachChat.useMutation();
    const resolvedApiBaseUrl = getApiBaseUrl();

    useEffect(() => {
        // 画面を開いた時にセッションアドバイスを自動表示
        if (setHistory.length > 0) {
            const advice = AICoachService.getCoachingAdvice(setHistory, setHistory.length, settings);
            const summary = AICoachService.generateSessionSummary(setHistory);
            addCoachMessage(`現在のセッション状況：\n\n${summary}\n\n${advice.message}${advice.suggestedAction ? '\n\n💡 ' + advice.suggestedAction : ''}`);
        }
    }, []);

    useEffect(() => {
        void checkApiHealth();
    }, [resolvedApiBaseUrl]);

    const addCoachMessage = (text: string) => {
        const msg: Message = {
            id: Date.now().toString(),
            role: 'coach',
            text,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, msg]);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    };

    const checkApiHealth = async () => {
        if (!resolvedApiBaseUrl) {
            setApiStatus('error');
            setApiStatusDetail('API URL が未設定です');
            return;
        }

        setApiStatus('checking');
        try {
            const response = await fetch(`${resolvedApiBaseUrl}/api/health`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            setApiStatus('ok');
            setApiStatusDetail('AIサーバー接続OK');
        } catch (error) {
            const detail = error instanceof Error ? error.message : 'unknown';
            setApiStatus('error');
            setApiStatusDetail(`API未接続: ${detail}`);
        }
    };

    const buildTrainingContext = async () => {
        const today = new Date().toISOString().split('T')[0];
        const volumeKg = setHistory.reduce((sum, s) => sum + (s.load_kg * s.reps), 0);
        const velocityList = setHistory
            .map(s => s.avg_velocity)
            .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
        const velocityAvg = velocityList.length
            ? velocityList.reduce((a, b) => a + b, 0) / velocityList.length
            : null;
        const velocityLatest = velocityList.length ? velocityList[velocityList.length - 1] : null;

        let recentSessions: Array<{ date: string; total_sets?: number; total_volume?: number }> = [];
        try {
            const sessions = await DatabaseService.getSessions();
            recentSessions = sessions.slice(0, 5).map(s => ({
                date: s.date,
                total_sets: s.total_sets,
                total_volume: s.total_volume,
            }));
        } catch {
            recentSessions = [];
        }

        return {
            today,
            currentExercise: currentExercise ? getLocalizedExerciseName(currentExercise.name) : null,
            currentLoad: Number.isFinite(currentLoad) ? currentLoad : null,
            isSessionActive: Boolean(currentSession),
            setCount: setHistory.length,
            volumeKg,
            velocityAvg,
            velocityLatest,
            trainingPhase: settings.target_training_phase,
            velocityLossThreshold: settings.velocity_loss_threshold,
            recentSessions,
        };
    };

    const generateResponse = async (userText: string): Promise<string> => {
        const lowerText = userText.toLowerCase();

        // セッションコンテキスト
        const hasSession = setHistory.length > 0;
        const lastSet = hasSession ? setHistory[setHistory.length - 1] : null;
        const exercise = currentExercise ? getLocalizedExerciseName(currentExercise.name) : '不明';
        const load = currentLoad;

        // 過去のセッション取得
        let recentSessions = [];
        try {
            recentSessions = await DatabaseService.getSessions();
        } catch { }

        // 速度ゾーン評価
        if (lowerText.includes('速度') || lowerText.includes('ゾーン') || lowerText.includes('評価') || lowerText.includes('分析')) {
            if (!hasSession) {
                return '📊 まだセッションデータがありません。トレーニングを開始してからご相談ください！';
            }
            const advice = AICoachService.getCoachingAdvice(setHistory, setHistory.length, settings);
            const summary = AICoachService.generateSessionSummary(setHistory);
            return `📊 セッション分析結果：\n\n${summary}\n\n${advice.emoji} ${advice.message}${advice.suggestedAction ? '\n\n💡 推奨: ' + advice.suggestedAction : ''}`;
        }

        // 疲労度チェック
        if (lowerText.includes('疲労') || lowerText.includes('疲れ') || lowerText.includes('きつい')) {
            if (!hasSession) return '💪 トレーニングを開始してから疲労度を評価できます。';
            const velocities = setHistory.filter(s => s.avg_velocity).map(s => s.avg_velocity!);
            if (velocities.length < 2) return '📊 もう数セット記録してから疲労度を評価できます。';
            const drop = ((velocities[0] - velocities[velocities.length - 1]) / velocities[0]) * 100;
            if (drop > 20) return `⚠️ 速度が${drop.toFixed(1)}%低下しています。疲労が蓄積しているサインです。\n\n今すぐ休憩するか、セッションを終了することをお勧めします。`;
            if (drop > 10) return `⚡ 速度が${drop.toFixed(1)}%低下しています。適度な疲労です。\n\nもう1〜2セット続けられますが、無理は禁物です。`;
            return `✅ 速度の低下は${drop.toFixed(1)}%です。まだパフォーマンスは良好です！`;
        }

        // 推奨重量
        if (lowerText.includes('重量') || lowerText.includes('推奨') || lowerText.includes('次') || lowerText.includes('増やす')) {
            if (!lastSet || !lastSet.avg_velocity) {
                return `💡 現在 ${exercise} ${load}kg で取り組んでいます。\nデータが蓄積されると推奨重量を計算できます。`;
            }
            const suggestion = AICoachService.suggestNextLoad(
                lastSet.avg_velocity,
                settings.target_training_phase,
                load
            );
            const changeText = suggestion.percentChange > 0
                ? `+${suggestion.percentChange}%増 → ${suggestion.suggestedLoad}kg`
                : suggestion.percentChange < 0
                    ? `${suggestion.percentChange}%減 → ${suggestion.suggestedLoad}kg`
                    : `現状維持 ${load}kg`;
            return `🏋️ 次のセットの推奨重量：\n\n**${changeText}**\n\n理由: ${suggestion.reason}\n\n目標フェーズ: ${PHASE_LABELS[settings.target_training_phase] || settings.target_training_phase}`;
        }

        // PR進捗
        if (lowerText.includes('pr') || lowerText.includes('記録') || lowerText.includes('あとどれ')) {
            try {
                const pr = await DatabaseService.getBestPR(exercise, 'e1rm');
                if (!pr) {
                    return `🏆 ${exercise}のPRデータがまだありません。\nセッションを重ねるとPR達成度を追跡できます！`;
                }
                return `🏆 ${exercise} の現在のPR：\n\n推定1RM: ${pr.value.toFixed(1)} kg\n達成日: ${pr.date}\n\n引き続き記録を更新していきましょう！💪`;
            } catch {
                return '📊 PR情報の取得中にエラーが発生しました。';
            }
        }

        // 今日の評価
        if (lowerText.includes('今日') || lowerText.includes('評価') || lowerText.includes('どうだった')) {
            if (!hasSession) {
                return recentSessions.length > 0
                    ? `📅 最近のトレーニング: ${recentSessions.length}セッション記録されています。\n今日はまだセッションを開始していません。準備ができたら始めましょう！`
                    : '📅 まだセッションデータがありません。最初のトレーニングを記録しましょう！';
            }
            const summary = AICoachService.generateSessionSummary(setHistory);
            return `📊 今日のトレーニング評価：\n\n${summary}\n\n継続は力なり！次回もがんばりましょう 💪`;
        }

        // デフォルト応答
        return `🤖 ご質問ありがとうございます。\n\n現在のデータ：\n• 種目: ${exercise}\n• 重量: ${load}kg\n• セット数: ${setHistory.length}\n\n「速度分析」「疲労度」「推奨重量」「PR進捗」などについてご相談できます！`;
    };

    const handleSend = async (text?: string) => {
        const msgText = text || input.trim();
        if (!msgText || loading) return;

        setInput('');
        setLoading(true);

        // ユーザーメッセージを追加
        const userMsg: Message = {
            id: Date.now().toString() + '_u',
            role: 'user',
            text: msgText,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMsg]);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            const context = await buildTrainingContext();
            const historyForLLM = messages.slice(-10).map(m => ({
                role: m.role,
                text: m.text,
            }));
            const result = await coachChatMutation.mutateAsync({
                message: msgText,
                history: historyForLLM,
                context,
            });
            const response = result.text || await generateResponse(msgText);
            addCoachMessage(response);
        } catch (error) {
            const fallback = await generateResponse(msgText);
            const reason =
                error instanceof Error &&
                error.message.includes('ZAI_API_KEY is invalid')
                    ? 'ローカルのZAI APIキーが無効です。'
                    : error instanceof Error && error.message.includes('ZAI_API_BALANCE_EXHAUSTED')
                        ? 'ZAI API の残高またはリソースパッケージが不足しています。'
                    : error instanceof Error &&
                      (error.message.includes('ZAI_API_KEY') || error.message.includes('OPENAI_API_KEY'))
                        ? 'ローカルのZAI APIキーが未設定です。'
                        : error instanceof Error && error.message.includes('fetch')
                            ? `ローカルAPIサーバーに接続できません。現在の接続先: ${resolvedApiBaseUrl}`
                            : 'GLM接続に失敗しました。';
            addCoachMessage(`⚠️ ${reason} ローカル解析で回答します。\n\n${fallback}`);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (date: Date) => {
        return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={90}
        >
            {/* ヘッダー */}
            <View style={[styles.header, { paddingTop: (insets.top || 0) + 12 }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.backText}>← 戻る</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerEyebrow}>RACE ENGINEER</Text>
                    <View style={styles.headerTitleRow}>
                        <Text style={styles.title}>AIコーチ</Text>
                        <View style={styles.onlineDot} />
                        <Text style={styles.headerStatus}>LIVE</Text>
                    </View>
                </View>
                <View style={{ width: 60 }} />
            </View>

            {/* セッション状態バー */}
            {setHistory.length > 0 && (
                <View style={styles.sessionBar}>
                    <Text style={styles.sessionBarText}>
                        🏋️ {currentExercise ? getLocalizedExerciseName(currentExercise.name) : '不明'} {currentLoad}kg — {setHistory.length}セット完了
                    </Text>
                </View>
            )}

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
                </View>
                <TouchableOpacity style={styles.apiRetryButton} onPress={checkApiHealth}>
                    <Text style={styles.apiRetryButtonText}>再確認</Text>
                </TouchableOpacity>
            </View>

            {/* メッセージ一覧 */}
            <ScrollView
                ref={scrollViewRef}
                style={styles.messageList}
                contentContainerStyle={styles.messageListContent}
            >
                {messages.map((msg) => (
                    <View
                        key={msg.id}
                        style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.coachBubble]}
                    >
                        <Text style={[styles.bubbleText, msg.role === 'user' ? styles.userText : styles.coachText]}>
                            {msg.text}
                        </Text>
                        <Text style={styles.timeText}>{formatTime(msg.timestamp)}</Text>
                    </View>
                ))}
                {loading && (
                    <View style={[styles.bubble, styles.coachBubble]}>
                        <ActivityIndicator size="small" color="#2196F3" />
                    </View>
                )}
            </ScrollView>

            {/* クイック質問 */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.quickQuestions}
                contentContainerStyle={{ padding: 8, gap: 8 }}
            >
                {QUICK_QUESTIONS.map((q, idx) => (
                    <TouchableOpacity
                        key={idx}
                        style={styles.quickBtn}
                        onPress={() => handleSend(q)}
                        disabled={loading}
                    >
                        <Text style={styles.quickBtnText}>{q}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* 入力エリア */}
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    value={input}
                    onChangeText={setInput}
                    placeholder="AIコーチに相談する..."
                    placeholderTextColor="#666"
                    multiline
                    maxLength={500}
                    returnKeyType="send"
                    onSubmitEditing={() => handleSend()}
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
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#341810',
        backgroundColor: '#090909',
    },
    backText: { color: '#ffb347', fontSize: 15, fontWeight: '700', letterSpacing: 0.6 },
    headerCenter: { alignItems: 'center', gap: 4 },
    headerEyebrow: { color: '#ff6a2a', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 20, fontWeight: '800', color: '#f6f2ee' },
    onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#89ff5d' },
    headerStatus: { color: '#d8d0ca', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
    sessionBar: {
        backgroundColor: '#111111',
        marginHorizontal: 16,
        marginTop: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#4b2116',
    },
    sessionBarText: { color: '#ffc27d', fontSize: 12, textAlign: 'center', fontWeight: '700', letterSpacing: 0.4 },
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
    apiStatusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    apiStatusDotOk: {
        backgroundColor: '#67d34f',
    },
    apiStatusDotChecking: {
        backgroundColor: '#ffb347',
    },
    apiStatusDotError: {
        backgroundColor: '#ff5a36',
    },
    apiStatusCopy: {
        flex: 1,
    },
    apiStatusTitle: {
        color: '#fff0e7',
        fontSize: 12,
        fontWeight: '800',
        marginBottom: 2,
    },
    apiStatusText: {
        color: '#bda69b',
        fontSize: 11,
    },
    apiRetryButton: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#5a2b1c',
        backgroundColor: '#181313',
    },
    apiRetryButtonText: {
        color: '#ffb347',
        fontSize: 11,
        fontWeight: '700',
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
        flexDirection: 'row', alignItems: 'flex-end',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#341810',
        gap: 8,
        backgroundColor: '#090909',
    },
    input: {
        flex: 1,
        backgroundColor: '#121212',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        color: '#fff',
        fontSize: 15,
        maxHeight: 100,
        borderWidth: 1,
        borderColor: '#4b2116',
    },
    sendButton: {
        backgroundColor: '#ff5a1f',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    sendButtonDisabled: { backgroundColor: '#37251e' },
    sendButtonText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
});
