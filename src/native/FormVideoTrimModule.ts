import { NativeModules, Platform } from "react-native";

type NativeTrimResult = {
  uri: string;
  durationS?: number;
};

type NativeFormVideoTrimModule = {
  trim: (
    sourceUri: string,
    trimStartSeconds: number,
    trimEndSeconds: number,
  ) => Promise<NativeTrimResult>;
};

const nativeModule = NativeModules.FormVideoTrimModule as
  | NativeFormVideoTrimModule
  | undefined;

export async function trimFormVideoNative(
  sourceUri: string,
  trimStartSeconds: number,
  trimEndSeconds: number,
): Promise<NativeTrimResult> {
  if (Platform.OS !== "ios" || !nativeModule) {
    throw new Error("フォーム動画の物理トリムは現在iOS実機のみ対応です。");
  }

  return nativeModule.trim(sourceUri, trimStartSeconds, trimEndSeconds);
}
