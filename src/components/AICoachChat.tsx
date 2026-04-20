/**
 * AICoachChat Component
 * Chat interface for AI Coach with natural language input
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { GarageTheme } from '@/src/constants/garageTheme';
import { AICoachService } from '@/src/services/AICoachService';

export interface ChatMessage {
  id: string;
  type: 'user' | 'coach';
  text: string;
  timestamp: Date;
}

interface AICoachChatProps {
  onAdviceGenerated: (advice: any, parsedData: any) => void;
  lvp?: {
    slope: number;
    intercept: number;
    mvt?: number;
    r_squared: number;
    sample_count: number;
  };
}

export function AICoachChat({ onAdviceGenerated, lvp }: AICoachChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'coach',
      text: 'こんにちは！AIコーチです。今日のPR挑戦について相談しましょう！\n\n例：「ベンチプレスで110kgのPRを狙いたい」',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new message arrives
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      text: inputText.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsProcessing(true);

    // Parse the query
    setTimeout(() => {
      const parsedData = AICoachService.parsePRChallengeQuery(userMessage.text);

      if (!parsedData) {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'coach',
          text: 'すみません、もう少し具体的に教えてください。\n\n例：「ベンチプレスで110kgのPRを狙いたい」「100kgで0.35m/s出たから110kgいける？」',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setIsProcessing(false);
        return;
      }

      // Generate advice
      if (lvp) {
        const advice = AICoachService.generatePRChallengeAdvice(
          parsedData.targetWeight,
          parsedData.currentWeight,
          parsedData.currentVelocity,
          lvp
        );

        const coachMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'coach',
          text: `${advice.emoji} ${advice.message}\n\n${advice.suggestedAction || ''}`,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, coachMessage]);
        onAdviceGenerated(advice, parsedData);
      } else {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'coach',
          text: 'データが不足しています。まずは数回トレーニングしてLVPプロファイルを作成しましょう。',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }

      setIsProcessing(false);
    }, 500);
  };

  const suggestedQuestions = [
    'ベンチプレスで110kgのPRを狙いたい',
    '100kgで0.35m/s出たけど、110kgいける？',
    '今日の調子で何キロまでいける？',
  ];

  const handleSuggestedQuestion = (question: string) => {
    setInputText(question);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageRow,
              message.type === 'user' ? styles.userMessageRow : styles.coachMessageRow,
            ]}
          >
            <View
              style={[
                styles.messageBubble,
                message.type === 'user' ? styles.userBubble : styles.coachBubble,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  message.type === 'user' ? styles.userText : styles.coachText,
                ]}
              >
                {message.text}
              </Text>
            </View>
          </View>
        ))}
        {isProcessing && (
          <View style={[styles.messageRow, styles.coachMessageRow]}>
            <View style={[styles.messageBubble, styles.coachBubble]}>
              <Text style={styles.typingIndicator}>入力中...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.suggestionsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {suggestedQuestions.map((question, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionChip}
              onPress={() => handleSuggestedQuestion(question)}
            >
              <Text style={styles.suggestionText}>{question}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="メッセージを入力..."
          placeholderTextColor={GarageTheme.colors.textSecondary}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isProcessing) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || isProcessing}
        >
          <Text style={styles.sendButtonText}>送信</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GarageTheme.colors.background,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  coachMessageRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: GarageTheme.colors.primary,
    borderBottomRightRadius: 4,
  },
  coachBubble: {
    backgroundColor: GarageTheme.colors.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: GarageTheme.colors.border,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#FFF',
  },
  coachText: {
    color: GarageTheme.colors.text,
  },
  typingIndicator: {
    fontSize: 14,
    color: GarageTheme.colors.textSecondary,
    fontStyle: 'italic',
  },
  suggestionsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: GarageTheme.colors.border,
  },
  suggestionChip: {
    backgroundColor: GarageTheme.colors.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: GarageTheme.colors.border,
  },
  suggestionText: {
    fontSize: 13,
    color: GarageTheme.colors.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: GarageTheme.colors.border,
    backgroundColor: GarageTheme.colors.card,
  },
  input: {
    flex: 1,
    backgroundColor: GarageTheme.colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
    color: GarageTheme.colors.text,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: GarageTheme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: GarageTheme.colors.border,
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
