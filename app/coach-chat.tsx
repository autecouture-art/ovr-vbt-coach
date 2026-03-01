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
import { useTrainingStore } from '@/src/store/trainingStore';

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

    useEffect(() => {
        // 画面を開いた時にセッションアドバイスを自動表示
        if (setHistory.length > 0) {
            const advice = AICoachService.getCoachingAdvice(setHistory, setHistory.length, settings);
            const summary = AICoachService.generateSessionSummary(setHistory);
            addCoachMessage(`現在のセッション状況：\n\n${summary}\n\n${advice.message}${advice.suggestedAction ? '\n\n💡 ' + advice.suggestedAction : ''}`);
        }
    }, []);

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

    const generateResponse = async (userText: string): Promise<string> => {
        const lowerText = userText.toLowerCase();

        // セッションコンテキスト
        const hasSession = setHistory.length > 0;
        const lastSet = hasSession ? setHistory[setHistory.length - 1] : null;
        const exercise = currentExercise?.name || '不明';
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
            const suggestion = AICoachService.suggestNextLoad(lastSet.avg_velocity, 'hypertrophy', load);
            const changeText = suggestion.percentChange > 0
                ? `+${suggestion.percentChange}%増 → ${suggestion.suggestedLoad}kg`
                : suggestion.percentChange < 0
                    ? `${suggestion.percentChange}%減 → ${suggestion.suggestedLoad}kg`
                    : `現状維持 ${load}kg`;
            return `🏋️ 次のセットの推奨重量：\n\n**${changeText}**\n\n理由: ${suggestion.reason}\n\n目標ゾーン: 💪 筋肥大ゾーン (0.5-0.75 m/s)`;
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
            // LLM API呼び出し（現在はルールベース実装）
            // 将来: const response = await fetch('https://api.openai.com/v1/...', ...)
            const response = await generateResponse(msgText);
            addCoachMessage(response);
        } catch (error) {
            addCoachMessage('⚠️ 応答の生成中にエラーが発生しました。もう一度お試しください。');
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
                    <Text style={styles.title}>🤖 AIコーチ</Text>
                    <View style={styles.onlineDot} />
                </View>
                <View style={{ width: 60 }} />
            </View>

            {/* セッション状態バー */}
            {setHistory.length > 0 && (
                <View style={styles.sessionBar}>
                    <Text style={styles.sessionBarText}>
                        🏋️ {currentExercise?.name || '不明'} {currentLoad}kg — {setHistory.length}セット完了
                    </Text>
                </View>
            )}

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
    container: { flex: 1, backgroundColor: '#0f0f1a' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e1e2e',
    },
    backText: { color: '#2196F3', fontSize: 16 },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
    sessionBar: {
        backgroundColor: '#1e1e2e', padding: 10,
        borderBottomWidth: 1, borderBottomColor: '#2a2a3a',
    },
    sessionBarText: { color: '#4CAF50', fontSize: 13, textAlign: 'center' },
    messageList: { flex: 1 },
    messageListContent: { padding: 16, gap: 12 },
    bubble: {
        maxWidth: '82%', padding: 14,
        borderRadius: 16, marginBottom: 4,
    },
    userBubble: {
        alignSelf: 'flex-end', backgroundColor: '#1565C0',
        borderBottomRightRadius: 4,
    },
    coachBubble: {
        alignSelf: 'flex-start', backgroundColor: '#1e1e2e',
        borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#2a2a3a',
    },
    bubbleText: { fontSize: 15, lineHeight: 22 },
    userText: { color: '#e3f2fd' },
    coachText: { color: '#ddd' },
    timeText: { fontSize: 10, color: '#666', marginTop: 4, alignSelf: 'flex-end' },
    quickQuestions: {
        maxHeight: 52, borderTopWidth: 1, borderTopColor: '#1e1e2e',
    },
    quickBtn: {
        paddingHorizontal: 14, paddingVertical: 8,
        backgroundColor: '#1e1e2e', borderRadius: 20,
        borderWidth: 1, borderColor: '#2196F3',
    },
    quickBtnText: { color: '#2196F3', fontSize: 13 },
    inputContainer: {
        flexDirection: 'row', alignItems: 'flex-end',
        padding: 12, borderTopWidth: 1, borderTopColor: '#1e1e2e', gap: 8,
    },
    input: {
        flex: 1, backgroundColor: '#1e1e2e',
        borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
        color: '#fff', fontSize: 15, maxHeight: 100,
        borderWidth: 1, borderColor: '#2a2a3a',
    },
    sendButton: {
        backgroundColor: '#2196F3', paddingHorizontal: 16,
        paddingVertical: 10, borderRadius: 20,
    },
    sendButtonDisabled: { backgroundColor: '#2a2a3a' },
    sendButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
