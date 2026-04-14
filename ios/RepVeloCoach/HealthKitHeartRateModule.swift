import Foundation
import HealthKit
import React

@objc(HealthKitHeartRateModule)
final class HealthKitHeartRateModule: RCTEventEmitter {
  private let healthStore = HKHealthStore()
  private let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate)!
  private let heartRateUnit = HKUnit.count().unitDivided(by: HKUnit.minute())

  private var hasJSListeners = false
  private var isMonitoring = false
  private var queryAnchor: HKQueryAnchor?
  private var anchoredQuery: HKAnchoredObjectQuery?
  private var observerQuery: HKObserverQuery?
  private var lastHeartRateBpm: Double?

  override static func requiresMainQueueSetup() -> Bool {
    false
  }

  override func supportedEvents() -> [String]! {
    ["onHeartRateUpdate", "onHealthStatus"]
  }

  override func startObserving() {
    hasJSListeners = true
  }

  override func stopObserving() {
    hasJSListeners = false
  }

  @objc(authorize:rejecter:)
  func authorize(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard HKHealthStore.isHealthDataAvailable() else {
      resolve(false)
      return
    }

    let readTypes: Set<HKObjectType> = [heartRateType]

    healthStore.requestAuthorization(toShare: [], read: readTypes) { success, error in
      if let error {
        reject("HEALTHKIT_AUTH_FAILED", error.localizedDescription, error)
        return
      }
      self.emitStatus([
        "authorized": success,
        "available": true,
        "monitoring": self.isMonitoring,
      ])
      resolve(success)
    }
  }

  @objc(startMonitoring:rejecter:)
  func startMonitoring(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard HKHealthStore.isHealthDataAvailable() else {
      resolve(false)
      return
    }

    if isMonitoring {
      resolve(true)
      return
    }

    stopQueries()
    isMonitoring = true
    queryAnchor = nil
    lastHeartRateBpm = nil

    let observer = HKObserverQuery(sampleType: heartRateType, predicate: nil) { [weak self] _, completionHandler, error in
      guard let self else {
        completionHandler()
        return
      }

      if let error {
        self.emitStatus([
          "authorized": true,
          "available": true,
          "monitoring": self.isMonitoring,
          "error": error.localizedDescription,
        ])
        completionHandler()
        return
      }

      self.fetchLatestHeartRateSamples {
        completionHandler()
      }
    }

    observerQuery = observer
    healthStore.execute(observer)
    healthStore.enableBackgroundDelivery(for: heartRateType, frequency: .immediate) { _, _ in }

    fetchLatestHeartRateSamples { [weak self] in
      guard let self else {
        resolve(false)
        return
      }
      self.emitStatus([
        "authorized": true,
        "available": true,
        "monitoring": true,
        "lastHeartRateBpm": self.lastHeartRateBpm as Any,
      ])
      resolve(true)
    }
  }

  @objc
  func stopMonitoring() {
    isMonitoring = false
    stopQueries()
    emitStatus([
      "authorized": true,
      "available": true,
      "monitoring": false,
      "lastHeartRateBpm": lastHeartRateBpm as Any,
    ])
  }

  private func fetchLatestHeartRateSamples(completion: @escaping () -> Void) {
    let query = HKAnchoredObjectQuery(
      type: heartRateType,
      predicate: nil,
      anchor: queryAnchor,
      limit: HKObjectQueryNoLimit
    ) { [weak self] _, samples, _, newAnchor, error in
      guard let self else {
        completion()
        return
      }

      self.queryAnchor = newAnchor

      if let error {
        self.emitStatus([
          "authorized": true,
          "available": true,
          "monitoring": self.isMonitoring,
          "error": error.localizedDescription,
        ])
        completion()
        return
      }

      self.handle(samples: samples)
      completion()
    }

    query.updateHandler = { [weak self] _, samples, _, newAnchor, error in
      guard let self else {
        return
      }

      self.queryAnchor = newAnchor

      if let error {
        self.emitStatus([
          "authorized": true,
          "available": true,
          "monitoring": self.isMonitoring,
          "error": error.localizedDescription,
        ])
        return
      }

      self.handle(samples: samples)
    }

    anchoredQuery = query
    healthStore.execute(query)
  }

  private func handle(samples: [HKSample]?) {
    guard let quantitySamples = samples as? [HKQuantitySample], !quantitySamples.isEmpty else {
      return
    }

    let latest = quantitySamples.max { lhs, rhs in
      lhs.endDate < rhs.endDate
    }

    guard let latest else {
      return
    }

    let bpm = latest.quantity.doubleValue(for: heartRateUnit)
    lastHeartRateBpm = bpm

    if hasJSListeners {
      sendEvent(withName: "onHeartRateUpdate", body: [
        "bpm": bpm,
        "source": "healthkit_sample",
        "timestamp": latest.endDate.timeIntervalSince1970 * 1000,
      ])
    }
  }

  private func stopQueries() {
    if let anchoredQuery {
      healthStore.stop(anchoredQuery)
      self.anchoredQuery = nil
    }
    if let observerQuery {
      healthStore.stop(observerQuery)
      self.observerQuery = nil
    }
  }

  private func emitStatus(_ payload: [String: Any]) {
    if hasJSListeners {
      sendEvent(withName: "onHealthStatus", body: payload)
    }
  }
}
