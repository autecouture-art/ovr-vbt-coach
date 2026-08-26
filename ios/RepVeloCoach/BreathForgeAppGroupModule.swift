import Foundation
import React

@objc(BreathForgeAppGroupModule)
final class BreathForgeAppGroupModule: NSObject {
  private static let appGroupID = "group.com.autecouture.repvelocoach.breathforge30"
  private static let historyFileName = "breathforge.shared-history.v1.json"
  private static let scheduleFileName = "repvelo.breath-schedule.v1.json"
  private static let historySchema = "breathforge.shared-history.v1"
  private static let scheduleSchema = "repvelo.breath-schedule.v1"

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  // BREATHFORGE owns this file. RepVelo only returns the validated projection.
  @objc(readHistory:rejecter:)
  func readHistory(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let url = appGroupFileURL(named: Self.historyFileName) else {
      resolve(nil)
      return
    }
    guard FileManager.default.fileExists(atPath: url.path) else {
      resolve(nil)
      return
    }
    do {
      let data = try Data(contentsOf: url)
      guard isValidHistory(data) else {
        resolve(nil)
        return
      }
      resolve(String(decoding: data, as: UTF8.self))
    } catch {
      reject("BREATHFORGE_HISTORY_READ_FAILED", "Could not read shared BREATHFORGE history.", error)
    }
  }

  // RepVelo owns this file. The writer validates before an atomic replacement.
  @objc(writeSchedule:resolver:rejecter:)
  func writeSchedule(
    _ json: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let url = appGroupFileURL(named: Self.scheduleFileName) else {
      reject("BREATHFORGE_APP_GROUP_UNAVAILABLE", "The BREATHFORGE App Group is not available for this build.", nil)
      return
    }
    let data = Data(json.utf8)
    guard isValidSchedule(data) else {
      reject("BREATHFORGE_SCHEDULE_INVALID", "The BREATHFORGE schedule does not satisfy schema v1.", nil)
      return
    }
    do {
      try atomicWrite(data, to: url)
      resolve(true)
    } catch {
      reject("BREATHFORGE_SCHEDULE_WRITE_FAILED", "Could not write the shared BREATHFORGE schedule.", error)
    }
  }

  private func appGroupFileURL(named name: String) -> URL? {
    guard let directory = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: Self.appGroupID
    ) else {
      return nil
    }
    return directory.appendingPathComponent(name)
  }

  private func isValidHistory(_ data: Data) -> Bool {
    guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          object["schema"] as? String == Self.historySchema,
          let sessions = object["sessions"] as? [Any] else {
      return false
    }
    return sessions.allSatisfy(isValidHistorySession)
  }

  private func isValidHistorySession(_ value: Any) -> Bool {
    guard let session = value as? [String: Any],
          session["id"] as? String != nil,
          session["started_at"] as? String != nil,
          let mode = session["mode"] as? String,
          let quarterStep = session["quarter_step"] as? NSNumber,
          session["estimated_pressure_cmh2o"] as? NSNumber != nil,
          session["completed_breaths"] as? NSNumber != nil,
          let completion = session["completion_state"] as? String,
          !session.keys.contains("symptoms"),
          !session.keys.contains("notes") else {
      return false
    }
    let validMode = ["training", "warmUp"].contains(mode)
    let validStep = (0...40).contains(quarterStep.intValue)
    let validCompletion = ["complete", "partial"].contains(completion)
    return validMode && validStep && validCompletion
  }

  private func isValidSchedule(_ data: Data) -> Bool {
    guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          object["schema"] as? String == Self.scheduleSchema,
          let jstDate = object["jst_date"] as? String,
          let sessionID = object["repvelo_session_id"] as? String,
          let programDay = object["program_day"] as? String,
          let state = object["state"] as? String else {
      return false
    }
    let validDate = jstDate.range(of: "^\\d{4}-\\d{2}-\\d{2}$", options: .regularExpression) != nil
    return validDate && !sessionID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
      ["Day1", "Day2", "Day3"].contains(programDay) &&
      ["selected", "started", "completed"].contains(state)
  }

  private func atomicWrite(_ data: Data, to destination: URL) throws {
    let temporary = destination.deletingLastPathComponent()
      .appendingPathComponent(".\(destination.lastPathComponent).tmp")
    try data.write(to: temporary, options: .atomic)
    let manager = FileManager.default
    if manager.fileExists(atPath: destination.path) {
      _ = try manager.replaceItemAt(destination, withItemAt: temporary)
    } else {
      try manager.moveItem(at: temporary, to: destination)
    }
  }
}
