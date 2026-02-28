/**
 * Audio Service
 * Handles voice feedback and sound effects
 */

import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

class AudioService {
  private isEnabled: boolean = true;
  private soundCache: { [key: string]: Audio.Sound } = {};

  /**
   * Initialize Audio Service
   */
  async initialize(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
      console.log('Audio Service initialized');
    } catch (error) {
      console.error('Failed to initialize Audio Service:', error);
    }
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
  async speak(text: string): Promise<void> {
    if (!this.isEnabled) return;

    try {
      Speech.speak(text, {
        language: 'en-US', // Default to English for numbers/tech terms
        rate: 1.0,
        pitch: 1.0,
      });
    } catch (error) {
      console.error('Speech error:', error);
    }
  }

  /**
   * Announce velocity
   */
  async announceVelocity(velocity: number): Promise<void> {
    const text = `${velocity.toFixed(2)}`;
    await this.speak(text);
  }

  /**
   * Play feedback for rep completion
   */
  async playRepComplete(): Promise<void> {
    if (!this.isEnabled) return;
    // TODO: Load and play a beep sound
    // For now, just use a short tick
     await this.speak('Tick'); 
  }

  /**
   * Announce Personal Record
   */
  async announcePR(): Promise<void> {
    if (!this.isEnabled) return;
    await this.speak('New Personal Record!');
  }

  /**
   * Announce Velocity Loss Warning
   */
  async announceVelocityLoss(): Promise<void> {
    if (!this.isEnabled) return;
    await this.speak('Velocity Loss Threshold Reached');
  }
}

export default new AudioService();
