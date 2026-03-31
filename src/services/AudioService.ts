/**
 * Audio Service
 * Handles voice feedback and sound effects
 */

import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

class AudioService {
  private isEnabled: boolean = true;
  private soundCache: { [key: string]: Audio.Sound } = {};

  async initialize(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        allowsRecordingIOS: false,
        shouldDuckAndroid: true,
      });
      console.log('Audio Service initialized');
    } catch (error) {
      console.error('Failed to initialize Audio Service:', error);
    }
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  async speak(text: string, language: string = 'ja-JP'): Promise<void> {
    if (!this.isEnabled) return;

    try {
      Speech.speak(text, {
        language,
        rate: 1.1,
        pitch: 1.0,
      });
    } catch (error) {
      console.error('Speech error:', error);
    }
  }

  async speakCoach(text: string): Promise<void> {
    await this.speak(text, 'ja-JP');
  }

  async announceRepFeedback(velocity: number, isGood: boolean): Promise<void> {
    if (!this.isEnabled) return;
    const speedText = `${velocity.toFixed(2)}`;
    const comment = isGood ? 'ナイススピード！' : 'もっと速く！';
    await this.speak(`${speedText}。${comment}`);
  }

  async announceStopSet(reason: string): Promise<void> {
    if (!this.isEnabled) return;
    await this.speak(`警告。${reason}。セットを中止してください。`);
  }

  async announceVelocity(velocity: number): Promise<void> {
    const text = `${velocity.toFixed(2)}`;
    await this.speak(text, 'en-US');
  }

  async playRepComplete(): Promise<void> {
    if (!this.isEnabled) return;
    await this.speak('アップ', 'ja-JP');
  }

  async announcePR(): Promise<void> {
    if (!this.isEnabled) return;
    await this.speak('自己ベスト更新！おめでとうございます！');
  }

  async announceVelocityLoss(): Promise<void> {
    if (!this.isEnabled) return;
    await this.speak('速度低下を検知。セット終了。');
  }
}

export default new AudioService();
