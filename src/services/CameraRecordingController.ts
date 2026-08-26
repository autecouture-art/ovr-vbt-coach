export type CameraRecordingResult = { uri?: string | null } | null | undefined;

export type CameraRecordingDevice = {
  recordAsync: (options?: { maxDuration?: number }) => Promise<CameraRecordingResult>;
  stopRecording: () => void;
};

export type CameraCaptureOperation = {
  id: string;
  startedAt: string;
  completion: Promise<CameraRecordingResult>;
};

/**
 * Serializes the native camera operation. UI components own presentation only;
 * this controller makes duplicate start/stop and teardown safe.
 */
export class CameraRecordingController {
  private active: CameraCaptureOperation | null = null;
  private stopping: Promise<CameraRecordingResult> | null = null;
  private activeDevice: CameraRecordingDevice | null = null;

  isRecording(): boolean {
    return this.active != null;
  }

  start(device: CameraRecordingDevice, maxDuration = 180): CameraCaptureOperation {
    if (this.active) {
      throw new Error("Camera recording is already active");
    }

    const id = `capture_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const startedAt = new Date().toISOString();
    const completion = device.recordAsync({ maxDuration });
    const operation: CameraCaptureOperation = { id, startedAt, completion };
    this.active = operation;
    this.activeDevice = device;

    // Keep cleanup independent from the caller's recording result. `finally`
    // creates a second rejected promise when native recording fails, which can
    // otherwise surface as an unhandled rejection while the overlay is already
    // handling the original failure.
    void completion.then(
      () => this.finishOperation(id),
      () => this.finishOperation(id),
    );

    return operation;
  }

  async stop(device?: CameraRecordingDevice | null): Promise<CameraRecordingResult> {
    const active = this.active;
    if (!active) return null;
    if (this.stopping) return this.stopping;

    this.stopping = active.completion;
    try {
      (device ?? this.activeDevice)?.stopRecording();
    } catch {
      // Some native camera implementations throw after an interruption. The
      // pending recording promise remains the source of truth.
    }
    return this.stopping;
  }

  async interrupt(device?: CameraRecordingDevice | null): Promise<CameraRecordingResult> {
    return this.stop(device);
  }

  private finishOperation(id: string): void {
    if (this.active?.id === id) {
      this.active = null;
      this.activeDevice = null;
    }
    this.stopping = null;
  }
}
