import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import DatabaseService from '@/src/services/DatabaseService';
import ExerciseService from '@/src/services/ExerciseService';
import { matchesExerciseQuery } from '@/src/utils/exerciseLocalization';
import type { Exercise } from '@/src/types/index';
import { useManualDraftStore } from '@/src/store/manualDraftStore';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

interface ParsedRow {
    exerciseName: string;
    load_kg?: number;
    reps?: number;
    sets?: number;
    rpe?: number;
    matchedExerciseId?: string;
}

export default function ImportScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const setManualDraft = useManualDraftStore(state => state.setDraft);

    const [inputText, setInputText] = useState('');
    const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

    // Load exercises to match names
    React.useEffect(() => {
        ExerciseService.getAllExercises().then(setExercises);
    }, []);

    const parseNumber = (value: unknown): number | undefined => {
        if (value === null || value === undefined) return undefined;
        const cleaned = String(value).replace(/[^0-9.\-]/g, '');
        if (!cleaned) return undefined;
        const parsed = parseFloat(cleaned);
        return Number.isFinite(parsed) ? parsed : undefined;
    };

    const matchExercise = (namePart: string) => {
        return exercises.find(e =>
            matchesExerciseQuery(e.name, namePart) ||
            matchesExerciseQuery(namePart, e.name)
        );
    };

    const inferCategory = (name: string): Exercise['category'] => {
        const normalized = name.toLowerCase();

        if (/squat|スクワット|フロントスクワット|ハックスクワット/.test(normalized)) return 'squat';
        if (/bench|ベンチ|ダンベルベンチ|インクライン/.test(normalized)) return 'bench';
        if (/dead|デッド|ルーマニアン|rdl/.test(normalized)) return 'deadlift';
        if (/press|プレス|ショルダー|ミリタリー/.test(normalized)) return 'press';
        if (/row|pull|ロー|ラット|懸垂|チンニング/.test(normalized)) return 'pull';
        return 'accessory';
    };

    const ensureExerciseExists = async (row: ParsedRow): Promise<ParsedRow> => {
        if (row.matchedExerciseId) {
            return row;
        }

        const existing = matchExercise(row.exerciseName);
        if (existing) {
            return {
                ...row,
                exerciseName: existing.name,
                matchedExerciseId: existing.id,
            };
        }

        const category = inferCategory(row.exerciseName);
        const created = await ExerciseService.addExercise({
            name: row.exerciseName.trim(),
            category,
            has_lvp: category !== 'accessory',
        });

        setExercises(current => [...current, created].sort((a, b) => a.name.localeCompare(b.name, 'ja')));

        return {
            ...row,
            exerciseName: created.name,
            matchedExerciseId: created.id,
        };
    };

    const expandRowsToManualDraft = (rows: ParsedRow[]) => {
        return rows.flatMap(row => {
            const setCount = Math.max(1, Math.round(row.sets ?? 1));

            return Array.from({ length: setCount }, () => ({
                exercise: row.exerciseName,
                loadKg: row.load_kg !== undefined ? String(row.load_kg) : '',
                reps: row.reps !== undefined ? String(row.reps) : '',
                rpe: row.rpe !== undefined ? String(row.rpe) : '',
            }));
        });
    };

    const parseLineBasedText = (rawText: string): ParsedRow[] => {
        const lines = rawText.split('\n');
        const result: ParsedRow[] = [];

        for (const line of lines) {
            if (!line.trim()) continue;
            const parts = line.split(/\t|,/).map(s => s.trim()).filter(Boolean);
            if (!parts.length) continue;

            const namePart = parts[0];
            const bestMatch = matchExercise(namePart);
            const numbers = parts.slice(1).map(parseNumber).filter((n): n is number => n !== undefined);

            result.push({
                exerciseName: bestMatch ? bestMatch.name : namePart,
                matchedExerciseId: bestMatch?.id,
                load_kg: numbers[0],
                reps: numbers[1],
                sets: numbers[2],
                rpe: numbers[3],
            });
        }
        return result;
    };

    const parseSheetRows = (rows: unknown[][]): ParsedRow[] => {
        if (!rows.length) return [];
        const normalized = rows.map(r => r.map(c => String(c ?? '').trim()));

        const findHeaderIndex = () => {
            const candidates = normalized.slice(0, 8);
            for (let i = 0; i < candidates.length; i++) {
                const joined = candidates[i].join(' ').toLowerCase();
                if (/(種目|exercise|name).*(重量|load|kg|reps|回数|セット|set)/.test(joined)) {
                    return i;
                }
            }
            return -1;
        };

        const headerIndex = findHeaderIndex();
        const result: ParsedRow[] = [];

        if (headerIndex >= 0) {
            const header = normalized[headerIndex].map(h => h.toLowerCase());
            const getCol = (keys: string[]) => header.findIndex(h => keys.some(k => h.includes(k)));
            const nameCol = getCol(['種目', 'exercise', 'name']);
            const loadCol = getCol(['重量', 'load', 'kg']);
            const repsCol = getCol(['回数', 'reps', 'rep']);
            const setsCol = getCol(['セット', 'set']);
            const rpeCol = getCol(['rpe']);

            for (const row of normalized.slice(headerIndex + 1)) {
                const namePart = nameCol >= 0 ? row[nameCol] : row[0];
                if (!namePart) continue;
                const bestMatch = matchExercise(namePart);
                result.push({
                    exerciseName: bestMatch ? bestMatch.name : namePart,
                    matchedExerciseId: bestMatch?.id,
                    load_kg: loadCol >= 0 ? parseNumber(row[loadCol]) : parseNumber(row[1]),
                    reps: repsCol >= 0 ? parseNumber(row[repsCol]) : parseNumber(row[2]),
                    sets: setsCol >= 0 ? parseNumber(row[setsCol]) : parseNumber(row[3]),
                    rpe: rpeCol >= 0 ? parseNumber(row[rpeCol]) : parseNumber(row[4]),
                });
            }
            return result;
        }

        for (const row of normalized) {
            const namePart = row[0];
            if (!namePart) continue;
            const bestMatch = matchExercise(namePart);
            result.push({
                exerciseName: bestMatch ? bestMatch.name : namePart,
                matchedExerciseId: bestMatch?.id,
                load_kg: parseNumber(row[1]),
                reps: parseNumber(row[2]),
                sets: parseNumber(row[3]),
                rpe: parseNumber(row[4]),
            });
        }
        return result;
    };

    const handlePickFile = async () => {
        try {
            const picked = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel',
                    'text/csv',
                    'text/plain',
                ],
                multiple: false,
                copyToCacheDirectory: true,
            });

            if (picked.canceled) return;
            const asset = picked.assets[0];
            if (!asset?.uri) {
                Alert.alert('エラー', 'ファイルの読み込みに失敗しました');
                return;
            }

            setIsParsing(true);
            setSelectedFileName(asset.name ?? '選択済みファイル');

            const lowerName = (asset.name ?? '').toLowerCase();
            let parsed: ParsedRow[] = [];

            if (lowerName.endsWith('.csv') || lowerName.endsWith('.txt')) {
                const raw = await FileSystem.readAsStringAsync(asset.uri);
                parsed = parseLineBasedText(raw);
                setInputText(raw);
            } else {
                const base64 = await FileSystem.readAsStringAsync(asset.uri, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                const workbook = XLSX.read(base64, { type: 'base64' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet, {
                    header: 1,
                    raw: false,
                    defval: '',
                }) as unknown[][];
                parsed = parseSheetRows(rows);
                setInputText('');
            }

            if (!parsed.length) {
                Alert.alert('解析結果', '有効な行を見つけられませんでした。列構成を確認してください。');
            }
            setParsedData(parsed);
        } catch (error) {
            console.error(error);
            Alert.alert('エラー', 'ファイル解析に失敗しました');
        } finally {
            setIsParsing(false);
        }
    };

    const handleParse = () => {
        if (!inputText.trim()) {
            Alert.alert('エラー', 'テキストを入力するか、Excelファイルを選択してください');
            return;
        }

        setIsParsing(true);
        try {
            const result = parseLineBasedText(inputText);
            setParsedData(result);
        } finally {
            setIsParsing(false);
        }
    };

    const handleImport = async () => {
        if (parsedData.length === 0 || isImporting) return;

        setIsImporting(true);
        try {
            const normalizedRows = await Promise.all(parsedData.map(ensureExerciseExists));
            setParsedData(normalizedRows);

            const draftSets = expandRowsToManualDraft(normalizedRows);
            if (draftSets.length === 0) {
                Alert.alert('エラー', '手動入力に引き継げるデータがありません');
                return;
            }

            setManualDraft(draftSets, selectedFileName ?? 'プログラム読み込み');

            Alert.alert(
                '手動入力へ引き継ぎ',
                `${normalizedRows.length}種目 / ${draftSets.length}セットを下書きとして渡しました。手動入力画面でそのまま編集・保存できます。`,
                [{ text: '開く', onPress: () => router.push('/manual' as any) }]
            );
        } catch (error) {
            console.error('Import handoff failed:', error);
            Alert.alert('エラー', '手動入力への引き継ぎに失敗しました');
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={[styles.header, { paddingTop: insets.top || 16 }]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <IconSymbol name="chevron.left" size={24} color="#ffb347" />
                        <Text style={styles.backText}>戻る</Text>
                    </TouchableOpacity>
                    <View style={styles.headerCopy}>
                        <Text style={styles.headerEyebrow}>PROGRAM DOCK</Text>
                        <Text style={styles.title}>プログラム読み込み</Text>
                    </View>
                </View>

                <ScrollView style={styles.content}>
                    <View style={styles.heroPanel}>
                        <Text style={styles.panelEyebrow}>UPLOAD LANE</Text>
                        <Text style={styles.instructions}>
                            Excelファイル（.xlsx/.xls/.csv）を直接選択して取り込めます。従来どおり貼り付け入力も可能です。
                        </Text>

                        <Text style={styles.formatHint}>
                            推奨フォーマット (タブまたはカンマ区切り):{'\n'}種目名 | 重量(kg) | 回数 | セット数
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.filePickButton} onPress={handlePickFile} disabled={isParsing}>
                        <Text style={styles.filePickButtonText}>Excelファイルを選択</Text>
                    </TouchableOpacity>
                    {selectedFileName && (
                        <Text style={styles.selectedFileText}>選択中: {selectedFileName}</Text>
                    )}

                    <TextInput
                        style={styles.textInput}
                        multiline
                        placeholder="ここにメニューをペースト..."
                        placeholderTextColor="#666"
                        value={inputText}
                        onChangeText={setInputText}
                        textAlignVertical="top"
                    />

                    <TouchableOpacity style={styles.parseButton} onPress={handleParse} disabled={isParsing}>
                        <IconSymbol name="doc.text.viewfinder" size={20} color="#fff" />
                        <Text style={styles.parseButtonText}>データを解析する</Text>
                    </TouchableOpacity>

                    {parsedData.length > 0 && (
                        <View style={styles.previewSection}>
                            <Text style={styles.panelEyebrow}>GRID PREVIEW</Text>
                            <Text style={styles.previewTitle}>プレビュー ({parsedData.length}件)</Text>

                            <View style={styles.previewList}>
                                {parsedData.map((row, index) => (
                                    <View key={index} style={styles.previewCard}>
                                        <View style={styles.previewHeader}>
                                            <Text style={[styles.previewName, !row.matchedExerciseId && styles.unmatchedName]}>
                                                {row.exerciseName}
                                            </Text>
                                            {!row.matchedExerciseId && (
                                                <Text style={styles.unmatchedBadge}>新規</Text>
                                            )}
                                        </View>

                                        <View style={styles.previewStats}>
                                            {row.load_kg !== undefined && (
                                                <Text style={styles.previewStat}>{row.load_kg}kg</Text>
                                            )}
                                            {row.reps !== undefined && (
                                                <Text style={styles.previewStat}>{row.reps} reps</Text>
                                            )}
                                            {row.sets !== undefined && (
                                                <Text style={styles.previewStat}>{row.sets} sets</Text>
                                            )}
                                        </View>
                                    </View>
                                ))}
                            </View>

                            <TouchableOpacity style={styles.importButton} onPress={handleImport} disabled={isImporting}>
                                <Text style={styles.importButtonText}>
                                    {isImporting ? '手動入力へ転送中...' : 'この内容で手動入力を作成'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#080808',
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#341810',
        backgroundColor: '#090909',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
    },
    backText: {
        color: '#ffb347',
        fontSize: 15,
        marginLeft: 4,
        fontWeight: '700',
        letterSpacing: 0.6,
    },
    headerCopy: {
        gap: 4,
    },
    headerEyebrow: {
        color: '#ff6a2a',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 2,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#fff5ee',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    heroPanel: {
        backgroundColor: '#111111',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#4b2116',
        padding: 16,
        marginBottom: 16,
    },
    panelEyebrow: {
        color: '#ff6a2a',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 2,
        marginBottom: 8,
    },
    instructions: {
        color: '#fff4eb',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 8,
    },
    formatHint: {
        color: '#c4b3a8',
        fontSize: 12,
        backgroundColor: '#191919',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#392017',
    },
    textInput: {
        backgroundColor: '#111111',
        color: '#fff',
        borderRadius: 18,
        padding: 16,
        minHeight: 150,
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#3f2117',
        marginBottom: 16,
    },
    filePickButton: {
        backgroundColor: '#ff5a1f',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 18,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#ff7a44',
    },
    filePickButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    selectedFileText: {
        color: '#c4b3a8',
        fontSize: 12,
        marginBottom: 12,
        fontWeight: '700',
    },
    parseButton: {
        backgroundColor: '#201611',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 18,
        gap: 8,
        borderWidth: 1,
        borderColor: '#5a2b1c',
    },
    parseButtonText: {
        color: '#ffb347',
        fontSize: 16,
        fontWeight: '800',
    },
    previewSection: {
        marginTop: 32,
        marginBottom: 40,
    },
    previewTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#fff5ee',
        marginBottom: 16,
    },
    previewList: {
        gap: 12,
        marginBottom: 24,
    },
    previewCard: {
        backgroundColor: '#111111',
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#432117',
    },
    previewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    previewName: {
        fontSize: 16,
        fontWeight: '800',
        color: '#fff6ef',
    },
    unmatchedName: {
        color: '#ffb347',
    },
    unmatchedBadge: {
        fontSize: 10,
        backgroundColor: '#2b1c15',
        color: '#ffb347',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        overflow: 'hidden',
        fontWeight: '800',
    },
    previewStats: {
        flexDirection: 'row',
        gap: 12,
    },
    previewStat: {
        color: '#c4b3a8',
        fontSize: 14,
        fontWeight: '700',
    },
    importButton: {
        backgroundColor: '#ff5a1f',
        padding: 16,
        borderRadius: 18,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ff7a44',
    },
    importButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
});
