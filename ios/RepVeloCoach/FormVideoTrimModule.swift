import AVFoundation
import Foundation
import React

@objc(FormVideoTrimModule)
final class FormVideoTrimModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(trim:trimStartSeconds:trimEndSeconds:resolver:rejecter:)
  func trim(
    _ sourceUri: String,
    trimStartSeconds: NSNumber,
    trimEndSeconds: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let sourceUrl = makeFileURL(from: sourceUri)
    guard FileManager.default.fileExists(atPath: sourceUrl.path) else {
      reject("FORM_VIDEO_TRIM_SOURCE_MISSING", "Source video file was not found.", nil)
      return
    }

    let asset = AVURLAsset(url: sourceUrl)
    let durationSeconds = CMTimeGetSeconds(asset.duration)
    guard durationSeconds.isFinite, durationSeconds > 0 else {
      reject("FORM_VIDEO_TRIM_BAD_DURATION", "Source video duration is invalid.", nil)
      return
    }

    let trimStart = max(0, trimStartSeconds.doubleValue)
    let trimEnd = max(0, trimEndSeconds.doubleValue)
    let startSeconds = min(trimStart, durationSeconds)
    let endSeconds = max(startSeconds, durationSeconds - trimEnd)
    let outputDuration = endSeconds - startSeconds

    guard outputDuration >= 0.2 else {
      reject("FORM_VIDEO_TRIM_RANGE_TOO_SHORT", "Trim range is too short.", nil)
      return
    }

    guard let exportSession = AVAssetExportSession(
      asset: asset,
      presetName: AVAssetExportPresetHighestQuality
    ) else {
      reject("FORM_VIDEO_TRIM_EXPORT_UNAVAILABLE", "Video export session could not be created.", nil)
      return
    }

    let outputUrl = makeOutputURL(sourceUrl: sourceUrl)
    try? FileManager.default.removeItem(at: outputUrl)

    let startTime = CMTime(seconds: startSeconds, preferredTimescale: 600)
    let endTime = CMTime(seconds: endSeconds, preferredTimescale: 600)
    exportSession.outputURL = outputUrl
    exportSession.outputFileType = .mov
    exportSession.timeRange = CMTimeRange(start: startTime, end: endTime)
    exportSession.shouldOptimizeForNetworkUse = false

    exportSession.exportAsynchronously {
      switch exportSession.status {
      case .completed:
        resolve([
          "uri": outputUrl.absoluteString,
          "durationS": outputDuration,
        ])
      case .failed, .cancelled:
        let message = exportSession.error?.localizedDescription ?? "Video trim export failed."
        reject("FORM_VIDEO_TRIM_EXPORT_FAILED", message, exportSession.error)
      default:
        reject("FORM_VIDEO_TRIM_UNKNOWN_STATUS", "Video trim ended with an unknown status.", exportSession.error)
      }
    }
  }

  private func makeFileURL(from uri: String) -> URL {
    if let url = URL(string: uri), url.isFileURL {
      return url
    }
    return URL(fileURLWithPath: uri)
  }

  private func makeOutputURL(sourceUrl: URL) -> URL {
    let directory = sourceUrl.deletingLastPathComponent()
    let baseName = sourceUrl.deletingPathExtension().lastPathComponent
    let timestampMs = Int(Date().timeIntervalSince1970 * 1000)
    return directory.appendingPathComponent("\(baseName)_trimmed_\(timestampMs).mov")
  }
}
