import { beforeEach, describe, expect, it, vi } from "vitest";

const setAudioModeAsync = vi.fn().mockResolvedValue(undefined);
const createAsync = vi.fn();
const notificationAsync = vi.fn().mockResolvedValue(undefined);
const speak = vi.fn();
const stop = vi.fn();

vi.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync,
    Sound: {
      createAsync,
    },
  },
}));

vi.mock("expo-haptics", () => ({
  NotificationFeedbackType: {
    Warning: "warning",
  },
  notificationAsync,
}));

vi.mock("expo-speech", () => ({
  speak,
  stop,
}));

const loadAudioService = async () => {
  vi.resetModules();
  const module = await import("../AudioService");
  return module.default;
};

describe("AudioService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setAudioModeAsync.mockClear();
    createAsync.mockReset();
    notificationAsync.mockClear();
    speak.mockReset();
    stop.mockClear();
    createAsync.mockResolvedValue({
      sound: {
        setPositionAsync: vi.fn().mockResolvedValue(undefined),
        setVolumeAsync: vi.fn().mockResolvedValue(undefined),
        playAsync: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("initializes with music-friendly audio mode so external music keeps playing", async () => {
    const AudioService = await loadAudioService();

    await AudioService.initialize();

    expect(setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        interruptionModeIOS: 0,
        interruptionModeAndroid: 2,
        playThroughEarpieceAndroid: false,
      }),
    );
  });

  it("does not stop speech/audio sessions before forced warning buzzer", async () => {
    const AudioService = await loadAudioService();
    const playPromise = AudioService.playWarningBuzzer({ force: true });

    await vi.runAllTimersAsync();
    await playPromise;

    expect(stop).not.toHaveBeenCalled();
    expect(notificationAsync).toHaveBeenCalledWith("warning");
    expect(createAsync).toHaveBeenCalled();
    expect(setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        interruptionModeIOS: 0,
        allowsRecordingIOS: false,
      }),
    );
    expect(setAudioModeAsync.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("reapplies music-friendly mode after speech completes", async () => {
    const AudioService = await loadAudioService();
    speak.mockImplementation((_text, options) => {
      options.onDone();
    });

    await AudioService.speak("0.50", "en-US");

    expect(speak).toHaveBeenCalledWith(
      "0.50",
      expect.objectContaining({
        language: "en-US",
      }),
    );
    expect(setAudioModeAsync.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
