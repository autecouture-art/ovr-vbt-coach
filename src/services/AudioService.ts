/**
 * Audio Service
 * Handles voice feedback and sound effects
 */

import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { useTrainingStore } from '../store/trainingStore';

const AUDIO_NATIVE_ENABLED = Platform.OS !== 'web';

class AudioService {
  private isEnabled: boolean = true;
  private soundCache: { [key: string]: Audio.Sound } = {};
  private toneUriCache: { [key: string]: string } = {};
  private initialized: boolean = false;
  private initializePromise: Promise<void> | null = null;

  /**
   * Initialize Audio Service
   */
  async initialize(): Promise<void> {
    if (!AUDIO_NATIVE_ENABLED || this.initialized) return;
    if (this.initializePromise) {
      await this.initializePromise;
      return;
    }

    this.initializePromise = (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          shouldDuckAndroid: false,
        });
        this.initialized = true;
        console.log('Audio Service initialized');
      } catch (error) {
        console.error('Failed to initialize Audio Service:', error);
      } finally {
        this.initializePromise = null;
      }
    })();

    await this.initializePromise;
  }

  /**
   * Set enabled state
   */
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  /**
   * Speak text using Text-to-Speech
   */
  async speak(
    text: string,
    language: string = 'ja-JP',
    options?: { interrupt?: boolean; rate?: number }
  ): Promise<void> {
    if (!this.isEnabled || !AUDIO_NATIVE_ENABLED) return;

    try {
      if (!this.initialized) {
        await this.initialize();
      }
      if (options?.interrupt) {
        await Speech.stop();
      }
      const volume = useTrainingStore.getState().settings.audio_volume ?? 1.0;
      Speech.speak(text, {
        language,
        rate: options?.rate ?? 1.0,
        pitch: 1.0,
        volume,
      });
    } catch (error) {
      console.error('Speech error:', error);
    }
  }

  /**
   * AIコーチによる指導（日本語）
   */
  async speakCoach(text: string): Promise<void> {
    await this.speak(text, 'ja-JP');
  }

  /**
   * レップ直後のフィードバック
   */
  async announceRepFeedback(velocity: number, isGood: boolean): Promise<void> {
    if (!this.isEnabled) return;
    const speedText = `${velocity.toFixed(2)}`;
    const comment = isGood ? 'ナイススピード！' : 'もっと速く！';
    await this.speak(`${speedText}。${comment}`);
  }

  async announceRepCount(count: number): Promise<void> {
    if (!this.isEnabled) return;
    await this.speak(String(count), 'ja-JP', { interrupt: true, rate: 0.92 });
  }

  /**
   * セット中止勧告
   */
  async announceStopSet(reason: string): Promise<void> {
    if (!this.isEnabled) return;
    await this.playVelocityLimitAlert();
    await this.speak(`警告。${reason}。セットを終了してください。`, 'ja-JP', {
      interrupt: true,
      rate: 0.95,
    });
  }

  /**
   * Announce velocity
   */
  async announceVelocity(velocity: number): Promise<void> {
    const text = `${velocity.toFixed(2)}`;
    await this.speak(text, 'en-US'); // 数字は英語の方が聞き取りやすい場合がある
  }

  /**
   * Play feedback for rep completion
   */
  async playRepComplete(): Promise<void> {
    if (!this.isEnabled) return;
    await this.playTone(1320, 120);
  }

  /**
   * Announce Personal Record
   */
  async announcePR(): Promise<void> {
    if (!this.isEnabled) return;
    await this.speak('自己ベスト更新！おめでとうございます！');
  }

  /**
   * Announce Velocity Loss Warning
   */
  async announceVelocityLoss(): Promise<void> {
    if (!this.isEnabled) return;
    await this.playVelocityLimitAlert();
    await this.speak('速度低下を検知。セット終了。', 'ja-JP', { interrupt: true });
  }

  async playVelocityLimitAlert(): Promise<void> {
    if (!this.isEnabled) return;
    await this.playTone(1040, 150);
    await this.wait(90);
    await this.playTone(880, 190);
  }

  private wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private encodeBase64(bytes: Uint8Array) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let output = '';

    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i] ?? 0;
      const b = bytes[i + 1] ?? 0;
      const c = bytes[i + 2] ?? 0;
      const triple = (a << 16) | (b << 8) | c;

      output += alphabet[(triple >> 18) & 63];
      output += alphabet[(triple >> 12) & 63];
      output += i + 1 < bytes.length ? alphabet[(triple >> 6) & 63] : '=';
      output += i + 2 < bytes.length ? alphabet[triple & 63] : '=';
    }

    return output;
  }

  private getToneUri(frequencyHz: number, durationMs: number) {
    const key = `${frequencyHz}:${durationMs}`;
    if (this.toneUriCache[key]) {
      return this.toneUriCache[key];
    }

    const sampleRate = 22050;
    const sampleCount = Math.max(1, Math.floor((sampleRate * durationMs) / 1000));
    const pcmData = new Uint8Array(sampleCount * 2);

    for (let i = 0; i < sampleCount; i += 1) {
      const t = i / sampleRate;
      const attack = Math.min(1, i / (sampleRate * 0.01));
      const release = Math.min(1, (sampleCount - i) / (sampleRate * 0.02));
      const envelope = Math.max(0, Math.min(attack, release));
      const sample = Math.sin(2 * Math.PI * frequencyHz * t) * 0.55 * envelope;
      const intSample = Math.max(-1, Math.min(1, sample)) * 32767;
      const offset = i * 2;
      const value = intSample < 0 ? 0x10000 + Math.round(intSample) : Math.round(intSample);
      pcmData[offset] = value & 0xff;
      pcmData[offset + 1] = (value >> 8) & 0xff;
    }

    const header = new Uint8Array(44);
    const dataLength = pcmData.length;
    const fileLength = 36 + dataLength;
    const byteRate = sampleRate * 2;

    const writeString = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i += 1) {
        header[offset + i] = value.charCodeAt(i);
      }
    };
    const writeUint16 = (offset: number, value: number) => {
      header[offset] = value & 0xff;
      header[offset + 1] = (value >> 8) & 0xff;
    };
    const writeUint32 = (offset: number, value: number) => {
      header[offset] = value & 0xff;
      header[offset + 1] = (value >> 8) & 0xff;
      header[offset + 2] = (value >> 16) & 0xff;
      header[offset + 3] = (value >> 24) & 0xff;
    };

    writeString(0, 'RIFF');
    writeUint32(4, fileLength);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    writeUint32(16, 16);
    writeUint16(20, 1);
    writeUint16(22, 1);
    writeUint32(24, sampleRate);
    writeUint32(28, byteRate);
    writeUint16(32, 2);
    writeUint16(34, 16);
    writeString(36, 'data');
    writeUint32(40, dataLength);

    const wav = new Uint8Array(header.length + pcmData.length);
    wav.set(header, 0);
    wav.set(pcmData, header.length);

    const uri = `data:audio/wav;base64,${this.encodeBase64(wav)}`;
    this.toneUriCache[key] = uri;
    return uri;
  }

  private async playTone(frequencyHz: number, durationMs: number): Promise<void> {
    if (!AUDIO_NATIVE_ENABLED) return;

    if (!this.initialized) {
      await this.initialize();
    }

    const key = `tone:${frequencyHz}:${durationMs}`;
    let sound = this.soundCache[key];

    if (!sound) {
      const toneUri = this.getToneUri(frequencyHz, durationMs);
      const loaded = await Audio.Sound.createAsync(
        { uri: toneUri },
        { shouldPlay: false, volume: 1.0, isLooping: false }
      );
      sound = loaded.sound;
      this.soundCache[key] = sound;
    }

    await sound.setPositionAsync(0);
    await sound.setVolumeAsync(1.0);
    await sound.playAsync();
    await this.wait(durationMs + 40);
  }
}

export default new AudioService();
