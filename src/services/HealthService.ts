import {
  NativeEventEmitter,
  NativeModule,
  NativeModules,
  Platform,
} from "react-native";

type HeartRateSubscription =
  | { remove: () => void }
  | ReturnType<typeof setInterval>
  | null;

type HealthKitHeartRateNativeModule = NativeModule & {
  authorize: () => Promise<boolean>;
  startMonitoring: () => Promise<boolean>;
  stopMonitoring: () => void;
};

class HealthService {
  private nativeModule: HealthKitHeartRateNativeModule | null =
    Platform.OS === "ios"
      ? (NativeModules.HealthKitHeartRateModule as
          | HealthKitHeartRateNativeModule
          | undefined) ?? null
      : null;

  private nativeEmitter =
    Platform.OS === "ios" && this.nativeModule
      ? new NativeEventEmitter(this.nativeModule)
      : null;

  private heartRateListener: { remove: () => void } | null = null;

  async authorize(): Promise<boolean> {
    if (!this.nativeModule) {
      return false;
    }

    try {
      return await this.nativeModule.authorize();
    } catch (error) {
      console.error("[HealthService] authorize failed", error);
      return false;
    }
  }

  startHeartRateMonitoring(
    onUpdate: (bpm: number | null) => void,
  ): HeartRateSubscription {
    if (!this.nativeModule || !this.nativeEmitter) {
      const id = setInterval(() => onUpdate(null), 30000);
      return id;
    }

    this.heartRateListener?.remove();
    this.heartRateListener = this.nativeEmitter.addListener(
      "onHeartRateUpdate",
      (payload: { bpm?: number | null }) => {
        onUpdate(typeof payload?.bpm === "number" ? payload.bpm : null);
      },
    );

    void this.nativeModule.startMonitoring().catch((error) => {
      console.error("[HealthService] startMonitoring failed", error);
      onUpdate(null);
    });

    return this.heartRateListener;
  }

  stopHeartRateMonitoring(timerId: HeartRateSubscription) {
    if (timerId && typeof timerId === "object" && "remove" in timerId) {
      timerId.remove();
    } else if (timerId) {
      clearInterval(timerId);
    }

    this.heartRateListener?.remove();
    this.heartRateListener = null;
    this.nativeModule?.stopMonitoring();
  }
}

export default new HealthService();
