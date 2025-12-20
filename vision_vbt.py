"""
OVR VBT Coach - Vision Recording Module
カメラによる動画記録機能（将来のVision-VBT用基盤）
"""
import cv2
import threading
import os
from datetime import datetime

class VideoRecorder:
    """トレーニング動画記録クラス"""
    
    def __init__(self, output_dir: str = "recordings"):
        self.output_dir = output_dir
        self.is_recording = False
        self.writer = None
        self.capture = None
        self.thread = None
        
        # 保存先ディレクトリ作成
        os.makedirs(output_dir, exist_ok=True)
        
    def start_recording(self, exercise: str = "set") -> str:
        """録画開始"""
        if self.is_recording:
            return None
            
        # カメラ初期化
        self.capture = cv2.VideoCapture(0)
        if not self.capture.isOpened():
            print("[Video] Camera not available")
            return None
            
        # ファイル名生成
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{exercise}_{timestamp}.mp4"
        filepath = os.path.join(self.output_dir, filename)
        
        # ビデオライター設定
        width = int(self.capture.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(self.capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = 30
        
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        self.writer = cv2.VideoWriter(filepath, fourcc, fps, (width, height))
        
        self.is_recording = True
        self.thread = threading.Thread(target=self._record_loop, daemon=True)
        self.thread.start()
        
        print(f"[Video] Recording started: {filepath}")
        return filepath
        
    def _record_loop(self):
        """録画ループ"""
        while self.is_recording:
            ret, frame = self.capture.read()
            if ret:
                self.writer.write(frame)
                
    def stop_recording(self):
        """録画停止"""
        if not self.is_recording:
            return
            
        self.is_recording = False
        
        if self.thread:
            self.thread.join(timeout=1)
            
        if self.capture:
            self.capture.release()
            
        if self.writer:
            self.writer.release()
            
        print("[Video] Recording stopped")
        
    def __del__(self):
        self.stop_recording()


class VisionVBT:
    """
    Vision-VBT: カメラベースの速度推定（将来実装用）
    
    注: 実際の速度推定にはMediaPipeやOpenCVのオプティカルフローが必要。
    現状は動画記録のみサポート。
    """
    
    def __init__(self):
        self.recorder = VideoRecorder()
        
    def estimate_velocity_from_video(self, video_path: str) -> float:
        """
        動画から速度を推定（将来実装）
        
        手法案:
        1. MediaPipe Poseでバーベル位置を追跡
        2. オプティカルフローで動き検出
        3. フレーム間の移動距離 / 時間 = 速度
        """
        # TODO: 実装予定
        print("[VisionVBT] Velocity estimation not implemented yet")
        return 0.0
        
    def calibrate_distance(self, known_distance_cm: float, pixel_distance: int):
        """
        距離キャリブレーション（将来実装）
        
        既知の距離（例: バーベルプレート直径45cm）を使って
        ピクセル→実距離の変換係数を計算
        """
        # TODO: 実装予定
        pass


if __name__ == "__main__":
    # 簡易テスト
    recorder = VideoRecorder()
    
    print("Recording for 5 seconds...")
    filepath = recorder.start_recording("test_squat")
    
    import time
    time.sleep(5)
    
    recorder.stop_recording()
    print(f"Saved to: {filepath}")



