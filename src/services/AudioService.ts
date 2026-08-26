/**
 * Audio Service
 * Handles voice feedback and sound effects
 */

import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";

// Keep Apple Music/Spotify playing during session cues.
// expo-av: iOS MixWithOthers=0, Android DuckOthers=2.
const INTERRUPTION_MODE_IOS_MIX_WITH_OTHERS = 0;
const INTERRUPTION_MODE_ANDROID_DUCK_OTHERS = 2;
const SPEECH_FALLBACK_TIMEOUT_MS = 3000;
const AUDIO_MODE_REAPPLY_THROTTLE_MS = 1500;
const MUSIC_FRIENDLY_AUDIO_MODE = {
  playsInSilentModeIOS: true,
  staysActiveInBackground: false,
  allowsRecordingIOS: false,
  shouldDuckAndroid: true,
  interruptionModeIOS: INTERRUPTION_MODE_IOS_MIX_WITH_OTHERS,
  interruptionModeAndroid: INTERRUPTION_MODE_ANDROID_DUCK_OTHERS,
  playThroughEarpieceAndroid: false,
} as const;
const VL_WARNING_BEEP_URI =
  "data:audio/wav;base64,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";
const VL_WARNING_BEEP_MS = 220;

class AudioService {
  private isEnabled: boolean = true;
  private volume: number = 1.0;
  private soundCache: { [key: string]: Audio.Sound } = {};
  private audioModePromise: Promise<void> | null = null;
  private lastAudioModeAppliedAt: number = 0;

  async initialize(): Promise<void> {
    await this.keepExternalAudioAlive("initialize");
  }

  async keepExternalAudioAlive(reason: string = "external-audio"): Promise<void> {
    await this.applyMusicFriendlyAudioMode(reason, true);
  }

  private async applyMusicFriendlyAudioMode(
    reason: string,
    force: boolean = false,
  ): Promise<void> {
    const now = Date.now();
    if (
      !force &&
      now - this.lastAudioModeAppliedAt < AUDIO_MODE_REAPPLY_THROTTLE_MS
    ) {
      return;
    }

    if (this.audioModePromise) {
      return this.audioModePromise;
    }

    this.audioModePromise = Audio.setAudioModeAsync(MUSIC_FRIENDLY_AUDIO_MODE)
      .then(() => {
        this.lastAudioModeAppliedAt = Date.now();
      })
      .catch((error) => {
        console.error(`Failed to keep external audio alive (${reason}):`, error);
      })
      .finally(() => {
        this.audioModePromise = null;
      });

    try {
      await this.audioModePromise;
      if (force) {
        console.log(`Audio Service applied music-friendly mode: ${reason}`);
      }
    } finally {
      this.audioModePromise = null;
    }
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  getVolume(): number {
    return this.volume;
  }

  async speak(
    text: string,
    language: string = "ja-JP",
    volume?: number,
  ): Promise<void> {
    if (!this.isEnabled) return;
    await this.applyMusicFriendlyAudioMode("speech-before");

    return new Promise((resolve) => {
      let didResolve = false;
      const resolveOnce = () => {
        if (didResolve) return;
        didResolve = true;
        clearTimeout(timeout);
        void this.applyMusicFriendlyAudioMode("speech-after", true);
        resolve();
      };
      const timeout = setTimeout(resolveOnce, SPEECH_FALLBACK_TIMEOUT_MS);

      try {
        Speech.speak(text, {
          language,
          rate: language === "ja-JP" ? 1.0 : 1.08,
          pitch: language === "ja-JP" ? 1.18 : 1.04,
          volume: volume ?? this.volume,
          onDone: resolveOnce,
          onStopped: resolveOnce,
          onError: (error) => {
            console.error("Speech error:", error);
            resolveOnce();
          },
        });
      } catch (error) {
        console.error("Speech error:", error);
        resolveOnce();
      }
    });
  }

  async speakCoach(text: string): Promise<void> {
    await this.speak(text, "ja-JP");
  }

  private async playSound(
    cacheKey: string,
    source: Parameters<typeof Audio.Sound.createAsync>[0],
    durationMs: number,
  ): Promise<void> {
    await this.applyMusicFriendlyAudioMode(`sound-before:${cacheKey}`);
    let sound = this.soundCache[cacheKey];
    if (!sound) {
      const created = await Audio.Sound.createAsync(source, {
        shouldPlay: false,
        volume: this.volume,
      });
      sound = created.sound;
      this.soundCache[cacheKey] = sound;
    }

    await sound.setPositionAsync(0);
    await sound.setVolumeAsync(this.volume);
    await sound.playAsync();
    await new Promise((resolve) => setTimeout(resolve, durationMs));
    await this.applyMusicFriendlyAudioMode(`sound-after:${cacheKey}`, true);
  }

  async playWarningBuzzer(options: { force?: boolean } = {}): Promise<void> {
    if (!this.isEnabled && !options.force) return;
    await this.applyMusicFriendlyAudioMode("warning-before", true);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (error) {
      console.warn("Haptics warning failed:", error);
    }
    try {
      await this.playSound(
        "vl-warning-beep",
        { uri: VL_WARNING_BEEP_URI },
        VL_WARNING_BEEP_MS,
      );
    } catch (error) {
      console.warn("Warning beep failed, falling back to speech:", error);
      if (this.isEnabled) {
        await this.speak("ピピッ", "ja-JP", Math.min(1, this.volume));
      } else if (options.force) {
        Speech.speak("ピピッ", {
          language: "ja-JP",
          rate: 1.2,
          pitch: 1.25,
          volume: Math.min(1, this.volume),
        });
      }
    }
    await this.applyMusicFriendlyAudioMode("warning-after", true);
  }

  async announceRepFeedback(velocity: number, isGood: boolean): Promise<void> {
    if (!this.isEnabled) return;
    const speedText = `${velocity.toFixed(2)}`;
    const comment = isGood ? "ナイススピード！" : "もっと速く！";
    await this.speak(`${speedText}。${comment}`);
  }

  async announceStopSet(
    reason: string,
    options: { forceBuzzer?: boolean; speakReason?: boolean } = {},
  ): Promise<void> {
    if (!this.isEnabled && !options.forceBuzzer) return;
    await this.playWarningBuzzer({ force: options.forceBuzzer });
    if (options.speakReason ?? this.isEnabled) {
      await this.speak(reason || "VLカット", "ja-JP");
    }
  }

  async announceVelocity(velocity: number): Promise<void> {
    const text = `${velocity.toFixed(2)}`;
    await this.speak(text, "en-US");
  }

  async playRepComplete(): Promise<void> {
    if (!this.isEnabled) return;
    await this.speak("アップ", "ja-JP");
  }

  async announceSetStartReminder(): Promise<void> {
    if (!this.isEnabled) return;
    await this.speak("記録中", "ja-JP", Math.min(0.75, this.volume));
  }

  async announcePR(): Promise<void> {
    if (!this.isEnabled) return;
    await this.speak("自己ベスト更新！おめでとうございます！");
  }

  async announceVelocityLoss(): Promise<void> {
    if (!this.isEnabled) return;
    await this.speak("速度低下を検知。セット終了。");
  }
}

export default new AudioService();
