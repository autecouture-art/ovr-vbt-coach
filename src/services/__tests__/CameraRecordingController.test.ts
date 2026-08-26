import { describe, expect, it, vi } from "vitest";

import { CameraRecordingController } from "../CameraRecordingController";

describe("CameraRecordingController", () => {
  it("allows one active recording and makes repeated stop idempotent", async () => {
    let resolveRecording: (value: { uri: string }) => void = () => undefined;
    const recordAsync = vi.fn(
      () => new Promise<{ uri: string }>((resolve) => {
        resolveRecording = resolve;
      }),
    );
    const stopRecording = vi.fn(() => resolveRecording({ uri: "file:///capture.mov" }));
    const device = { recordAsync, stopRecording };
    const controller = new CameraRecordingController();

    controller.start(device);
    expect(() => controller.start(device)).toThrow(/already active/);

    const first = controller.stop(device);
    const second = controller.stop(device);
    await expect(first).resolves.toEqual({ uri: "file:///capture.mov" });
    await expect(second).resolves.toEqual({ uri: "file:///capture.mov" });
    expect(stopRecording).toHaveBeenCalledTimes(1);
    expect(controller.isRecording()).toBe(false);
  });

  it("clears the active operation when native recording rejects", async () => {
    const recordAsync = vi.fn(() => Promise.reject(new Error("camera interrupted")));
    const device = { recordAsync, stopRecording: vi.fn() };
    const controller = new CameraRecordingController();

    const operation = controller.start(device);
    await expect(operation.completion).rejects.toThrow("camera interrupted");
    await Promise.resolve();

    expect(controller.isRecording()).toBe(false);
    expect(() => controller.start(device)).not.toThrow();
  });
});
