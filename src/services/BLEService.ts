/**
 * BLE Service for RepVelo Velocity Device
 * Handles Bluetooth Low Energy communication with RepVelo Velocity sensor
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RepVeloData } from '../types/index';

// Platform-specific imports
let PermissionsAndroid: any = null;
if (Platform.OS === 'android') {
  try {
    const { PermissionsAndroid: AndroidPermissions } = require('react-native');
    PermissionsAndroid = AndroidPermissions;
  } catch (e) {
    console.warn('PermissionsAndroid not found', e);
  }
}

// RepVelo Velocity Device Constants
const DEVICE_NAME_PREFIX = 'OVR_Velocity';
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const NOTIFY_CHARACTERISTIC_UUID = '14001dc2-5089-47d3-84bc-7c3d418389aa';
const SCAN_DURATION = 5000; // 5 seconds
const EXPECTED_DATA_SIZE = 16; // bytes
const LAST_DEVICE_KEY = 'repvelo:last-device';

// Helper function to decode base64 to byte array (React Native compatible)
function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper function to read little-endian float from byte array
function readFloatLE(bytes: Uint8Array, offset: number): number {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  for (let i = 0; i < 4; i++) {
    view.setUint8(i, bytes[offset + i]);
  }
  return view.getFloat32(0, true); // true = little-endian
}

// Helper function to read little-endian uint16 from byte array
function readUInt16LE(bytes: Uint8Array, offset: number): number {
  if (offset + 2 > bytes.length) return 0;
  return bytes[offset] | (bytes[offset + 1] << 8);
}

export interface BLEServiceCallbacks {
  onDataReceived?: (data: RepVeloData) => void;
  onConnectionStatusChanged?: (isConnected: boolean) => void;
  onError?: (error: string) => void;
  onDeviceFound?: (device: any) => void;
  onDevicesDiscovered?: (devices: any[]) => void;
  onScanStateChanged?: (isScanning: boolean) => void;
  onDebugInfo?: (info: string) => void;
}

class BLEService {
  private manager: any = null;
  private device: any = null;
  private bleModuleLoaded: boolean = false;
  private BleManagerClass: any = null;
  private lastConnectedDeviceId: string | null = null;  // 前回接続したデバイスID
  private lastConnectedDeviceName: string | null = null;  // 前回接続したデバイス名
  private isScanning: boolean = false;
  private callbacks: BLEServiceCallbacks = {};
  private discoveredDevices: any[] = [];
  private notificationMonitor: any = null;
  private discoveredServices: any[] = [];
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private reconnectTimer: any = null;
  private isWeb: boolean = Platform.OS === 'web';
  private debugEnabled: boolean = __DEV__;
  private lastDeviceHydrationPromise: Promise<void> | null = null;
  private mockModeEnabled: boolean = false;
  private mockConnected: boolean = false;
  private mockNotificationTimer: ReturnType<typeof setInterval> | null = null;
  private mockRepCounter: number = 0;
  private mockScanTimer: ReturnType<typeof setTimeout> | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private disconnectSubscription: { remove?: () => void } | null = null;
  private manualDisconnectRequested: boolean = false;
  private reconnectInFlight: boolean = false;

  constructor() {
    void this.hydrateLastDeviceInfo();
  }

  /**
   * Log debug info
   */
  private debug(message: string) {
    if (!this.debugEnabled) return;
    console.log('[BLE]', message);
    this.callbacks.onDebugInfo?.(message);
  }

  private async hydrateLastDeviceInfo(): Promise<void> {
    if (this.lastDeviceHydrationPromise) {
      await this.lastDeviceHydrationPromise;
      return;
    }

    this.lastDeviceHydrationPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(LAST_DEVICE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as { id?: string; name?: string };
        this.lastConnectedDeviceId = parsed.id ?? null;
        this.lastConnectedDeviceName = parsed.name ?? null;
      } catch (error) {
        this.debug(`Failed to hydrate last device info: ${error}`);
      } finally {
        this.lastDeviceHydrationPromise = null;
      }
    })();

    await this.lastDeviceHydrationPromise;
  }

  private async persistLastDeviceInfo(): Promise<void> {
    try {
      if (!this.lastConnectedDeviceId) return;
      await AsyncStorage.setItem(
        LAST_DEVICE_KEY,
        JSON.stringify({
          id: this.lastConnectedDeviceId,
          name: this.lastConnectedDeviceName,
        })
      );
    } catch (error) {
      this.debug(`Failed to persist last device info: ${error}`);
    }
  }

  private async clearLastDeviceInfo(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LAST_DEVICE_KEY);
    } catch (error) {
      this.debug(`Failed to clear last device info: ${error}`);
    }
  }

  private setScanningState(isScanning: boolean) {
    if (this.isScanning === isScanning) return;
    this.isScanning = isScanning;
    this.callbacks.onScanStateChanged?.(isScanning);
    this.debug(`Scanning ${isScanning ? 'started' : 'stopped'}`);
  }

  private clearDisconnectSubscription() {
    if (this.disconnectSubscription?.remove) {
      this.disconnectSubscription.remove();
    }
    this.disconnectSubscription = null;
  }

  private registerDisconnectListener(deviceId: string) {
    this.clearDisconnectSubscription();

    if (!this.manager || typeof this.manager.onDeviceDisconnected !== 'function') {
      return;
    }

    this.disconnectSubscription = this.manager.onDeviceDisconnected(
      deviceId,
      async (error: any) => {
        if (this.manualDisconnectRequested) {
          return;
        }

        this.debug(`Device disconnected unexpectedly${error ? `: ${error.message || error}` : ''}`);
        this.device = null;
        await this.stopNotifications();

        const reconnected = await this.attemptAutoReconnect('unexpected disconnect');
        if (!reconnected) {
          this.callbacks.onConnectionStatusChanged?.(false);
        }
      }
    );
  }

  private async attemptAutoReconnect(reason: string): Promise<boolean> {
    if (this.reconnectInFlight) {
      this.debug(`Reconnect already in progress (${reason})`);
      return true;
    }

    this.debug(`Attempting auto reconnect (${reason})...`);
    const reconnected = await this.reconnect();
    if (reconnected) {
      await this.startNotifications();
    }
    return reconnected;
  }

  private isStandardExpoGo(): boolean {
    return Constants.appOwnership === 'expo' && Constants.executionEnvironment === 'storeClient';
  }

  private createMockManager() {
    return {
      state: async () => 'PoweredOff',
      startDeviceScan: () => { },
      stopDeviceScan: () => { },
      destroy: () => { },
      monitorCharacteristicForService: () => { },
      retrieveConnectedDevices: async () => [],
      onStateChange: () => ({ remove: () => { } }),
    };
  }

  private createMockDevice() {
    return {
      id: 'sim-ovr-velocity-001',
      name: 'OVR Velocity Simulator',
      rssi: -42,
      connect: async () => this.createMockDevice(),
      discoverAllServicesAndCharacteristics: async () => this.createMockDevice(),
      isConnected: async () => this.mockConnected,
      cancelConnection: async () => {
        this.mockConnected = false;
      },
      services: async () => [],
    };
  }

  private isUsingMockTransport(): boolean {
    return this.mockModeEnabled && __DEV__ && Platform.OS === 'ios';
  }

  enableMockMode(enabled: boolean) {
    this.mockModeEnabled = enabled;
    this.debug(`Mock BLE mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  isMockModeEnabled(): boolean {
    return this.isUsingMockTransport();
  }

  private createMockRepData(): RepVeloData {
    this.mockRepCounter += 1;

    const phaseIndex = this.mockRepCounter % 5;
    const phaseVelocity = [0.74, 0.68, 0.61, 0.56, 0.49][phaseIndex];
    const mean_velocity = Number((phaseVelocity + (Math.random() * 0.04 - 0.02)).toFixed(2));
    const peak_velocity = Number((mean_velocity + 0.12 + Math.random() * 0.06).toFixed(2));
    const rom_cm = Number((44 + Math.random() * 14).toFixed(1));
    const rep_duration_ms = Math.round(850 + Math.random() * 450);
    const mean_power_w = Math.round(650 + mean_velocity * 320);
    const peak_power_w = Math.round(mean_power_w * 1.18);

    return {
      mean_velocity,
      peak_velocity,
      rom_cm,
      rep_duration_ms,
      mean_power_w,
      peak_power_w,
      timestamp: Date.now(),
    };
  }

  private loadBleModule(): boolean {
    if (this.bleModuleLoaded) {
      return !!this.BleManagerClass;
    }

    this.bleModuleLoaded = true;

    if (this.isWeb) {
      this.debug('Web環境: BLE機能は利用できません（ネイティブ環境のみ）');
      return false;
    }

    try {
      const bleModule = require('react-native-ble-plx');
      this.BleManagerClass = bleModule.BleManager;
      return !!this.BleManagerClass;
    } catch (e) {
      console.warn('BLE module not found or failed to load lazily:', e);
      this.BleManagerClass = null;
      return false;
    }
  }

  private ensureManager(): boolean {
    if (this.manager) return true;

    if (this.isStandardExpoGo()) {
      this.debug('Standard Expo Go detected: BLE features are disabled. Please use a Development Build.');
      this.manager = this.createMockManager();
      return true;
    }

    if (!this.loadBleModule() || !this.BleManagerClass) {
      this.debug('BleManager class not available');
      return false;
    }

    try {
      this.manager = new this.BleManagerClass();
      this.manager.onStateChange?.((state: string) => {
        this.debug(`Bluetooth state changed: ${state}`);
        if (state === 'PoweredOn' && this.lastConnectedDeviceId) {
          this.debug('BT powered on, trying to reconnect to last device...');
          this.reconnect();
        }
      }, true);
      return true;
    } catch (e) {
      console.warn('Failed to initialize BleManager lazily:', e);
      this.manager = this.createMockManager();
      return false;
    }
  }

  /**
   * Request Bluetooth permissions (Android only)
   */
  async requestPermissions(): Promise<boolean> {
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) return false;

    if (Platform.OS === 'android' && PermissionsAndroid) {
      try {
        if ((Platform.Version as number) >= 31) {
          // Android 12+
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);

          return (
            granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
          );
        } else {
          // Android 11 and below
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
      } catch (error) {
        console.error('Permission request failed:', error);
        return false;
      }
    }
    // iOS permissions are handled via Info.plist
    return true;
  }

  /**
   * Initialize BLE Manager
   */
  async initialize(): Promise<boolean> {
    if (this.isWeb) {
      this.debug('Web環境: BLE初期化をスキップ');
      return false;
    }

    if (this.isUsingMockTransport()) {
      await this.hydrateLastDeviceInfo();
      this.debug('Simulator mock BLE initialized');
      return true;
    }

    if (!this.ensureManager()) {
      this.debug('BLE Manager not initialized');
      return false;
    }

    // For Expo Go, just return false gracefully
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) {
      this.callbacks.onError?.('BLE is not supported in Expo Go. Please use a Development Build or the IPA.');
      return false;
    }

    try {
      await this.hydrateLastDeviceInfo();
      const state = await this.manager.state();
      if (state !== 'PoweredOn') {
        this.callbacks.onError?.('Bluetooth is not powered on');
        return false;
      }
      return true;
    } catch (error) {
      this.callbacks.onError?.(`BLE initialization failed: ${error}`);
      return false;
    }
  }

  /**
   * Set callbacks for BLE events
   */
  setCallbacks(callbacks: BLEServiceCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Scan for RepVelo Velocity devices
   * iOSではUUIDフィルターなしでスキャン（iOSの制限対応）
   */
  async scanForDevices(): Promise<void> {
    if (this.isWeb) {
      this.callbacks.onError?.('Web環境: BLEスキャンは利用できません');
      return;
    }

    if (this.isUsingMockTransport()) {
      this.setScanningState(true);
      this.discoveredDevices = [];
      if (this.mockScanTimer) {
        clearTimeout(this.mockScanTimer);
        this.mockScanTimer = null;
      }
      const mockDevice = this.createMockDevice();
      this.mockScanTimer = setTimeout(() => {
        this.discoveredDevices = [mockDevice];
        this.callbacks.onDevicesDiscovered?.(this.discoveredDevices);
        this.callbacks.onDeviceFound?.(mockDevice);
        this.setScanningState(false);
        this.mockScanTimer = null;
      }, 450);
      return;
    }

    if (!this.ensureManager()) {
      this.callbacks.onError?.('BLE manager is unavailable');
      return;
    }

    // Expo Go check
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) {
      this.callbacks.onError?.('BLE scanning is disabled in Expo Go');
      return;
    }

    if (this.isScanning) {
      this.debug('Already scanning');
      return;
    }

    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      this.callbacks.onError?.('Bluetooth permissions not granted');
      return;
    }

    this.setScanningState(true);
    this.discoveredDevices = [];

    // iOSではUUIDフィルターなしでスキャン（より多くのデバイスを検出）
    const serviceUUIDs = Platform.OS === 'ios' ? [] : [SERVICE_UUID];

    this.debug('Starting BLE scan...');

    try {
      let repVeloFound = false;
      this.manager.startDeviceScan(
        serviceUUIDs,
        { allowDuplicates: false },
        (error: any, device: any) => {
          if (error) {
            console.error('Scan error:', error);
            this.callbacks.onError?.(`Scan error: ${error.message}`);
            this.stopScan();
            return;
          }

          if (device) {
            const existingIndex = this.discoveredDevices.findIndex(d => d.id === device.id);
            if (existingIndex === -1) {
              this.discoveredDevices.push(device);
              this.debug(`Device found: ${device.name || '(unnamed)'} (${device.id})`);
              this.callbacks.onDevicesDiscovered?.(this.discoveredDevices);

              if (!repVeloFound && device.name && this.isRepVeloDevice(device.name)) {
                repVeloFound = true;
                this.debug(`RepVelo Velocity device found!`);
                this.callbacks.onDeviceFound?.(device);
                this.stopScan();
              }
            }
          }
        }
      );
    } catch (e) {
      this.debug(`Start Scan Error: ${e}`);
      this.setScanningState(false);
      return;
    }

    const scanDuration = Platform.OS === 'ios' ? 10000 : SCAN_DURATION;
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
    this.scanTimer = setTimeout(() => {
      const repveloDevice = this.discoveredDevices.find(d =>
        d.name && this.isRepVeloDevice(d.name)
      );
      if (!repveloDevice) {
        this.debug(`Scan complete. Found ${this.discoveredDevices.length} devices, no RepVelo device.`);
      }
      this.stopScan();
    }, scanDuration);
  }

  /**
   * Check if device name matches RepVelo Velocity
   */
  private isRepVeloDevice(name: string): boolean {
    const normalizedName = String(name ?? "").toLowerCase();
    const repveloKeywords = ["repvelo", "velocity", "ovr"];
    return repveloKeywords.some((keyword) => normalizedName.indexOf(keyword) !== -1);
  }

  /**
   * Stop scanning
   */
  stopScan() {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.mockScanTimer) {
      clearTimeout(this.mockScanTimer);
      this.mockScanTimer = null;
    }
    if (this.isUsingMockTransport()) {
      this.setScanningState(false);
      return;
    }
    if (this.isScanning && this.manager) {
      this.manager.stopDeviceScan();
    }
    this.setScanningState(false);
  }

  /**
   * Discover and log all services and characteristics
   */
  private async discoverServices(device: any): Promise<any[]> {
    try {
      this.debug('Discovering services...');
      const services = await device.services();
      this.discoveredServices = services;

      this.debug(`Found ${services.length} services:`);
      for (const service of services) {
        this.debug(`  Service: ${service.uuid}`);

        const characteristics = await service.characteristics();
        for (const char of characteristics) {
          const props = [];
          if (char.isReadable) props.push('readable');
          if (char.isNotifiable) props.push('notifiable');
          if (char.isIndicatable) props.push('indicatable');
          this.debug(`    Characteristic: ${char.uuid} [${props.join(', ')}]`);
        }
      }

      return services;
    } catch (error) {
      this.debug(`Error discovering services: ${error}`);
      return [];
    }
  }

  /**
   * Find a readable characteristic for data
   */
  private async findReadableCharacteristic(): Promise<any | null> {
    if (!this.device) return null;

    try {
      for (const service of this.discoveredServices) {
        const characteristics = await service.characteristics();
        for (const char of characteristics) {
          if (char.isReadable) {
            this.debug(`Found readable characteristic: ${char.uuid}`);
            return char;
          }
        }
      }
    } catch (error) {
      this.debug(`Error finding readable characteristic: ${error}`);
    }
    return null;
  }

  /**
   * Find a notifiable characteristic
   */
  private async findNotifiableCharacteristic(): Promise<any | null> {
    if (!this.device) return null;

    try {
      for (const service of this.discoveredServices) {
        const characteristics = await service.characteristics();
        for (const char of characteristics) {
          if (char.isNotifiable || char.isIndicatable) {
            this.debug(`Found notifiable characteristic: ${char.uuid}`);
            return char;
          }
        }
      }
    } catch (error) {
      this.debug(`Error finding notifiable characteristic: ${error}`);
    }
    return null;
  }

  /**
   * Connect to a device
   */
  async connectToDevice(device: any): Promise<boolean> {
    if (this.isUsingMockTransport()) {
      this.stopScan();
      this.device = this.createMockDevice();
      this.mockConnected = true;
      this.manualDisconnectRequested = false;
      this.lastConnectedDeviceId = device?.id ?? 'sim-ovr-velocity-001';
      this.lastConnectedDeviceName = device?.name ?? 'OVR Velocity Simulator';
      this.reconnectAttempts = 0;
      await this.persistLastDeviceInfo();
      this.callbacks.onConnectionStatusChanged?.(true);
      this.debug(`Connected to mock device: ${this.lastConnectedDeviceName}`);
      return true;
    }

    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) return false;

    if (!this.ensureManager()) {
      this.callbacks.onError?.('BLE manager is unavailable');
      return false;
    }

    try {
      this.debug(`Connecting to ${device.name}...`);
      this.stopScan();
      this.manualDisconnectRequested = false;
      this.clearDisconnectSubscription();

      const connectedDevice = await device.connect();
      this.debug('Device connected, discovering services...');

      await connectedDevice.discoverAllServicesAndCharacteristics();
      this.device = connectedDevice;

      // デバイス情報を保存（再接続用）
      this.lastConnectedDeviceId = device.id;
      this.lastConnectedDeviceName = device.name;
      this.reconnectAttempts = 0;
      await this.persistLastDeviceInfo();

      // Discover and log all services for debugging
      await this.discoverServices(connectedDevice);
      this.registerDisconnectListener(connectedDevice.id);

      this.callbacks.onConnectionStatusChanged?.(true);
      this.debug('Connected successfully');

      // 接続監視開始
      this.startHeartbeat();

      return true;
    } catch (error) {
      console.error('Connection failed:', error);
      this.callbacks.onError?.(`Connection failed: ${error}`);
      this.callbacks.onConnectionStatusChanged?.(false);
      return false;
    }
  }

  /**
   * Reconnect to the last connected device
   */
  async reconnect(): Promise<boolean> {
    if (this.reconnectInFlight) {
      this.debug('Reconnect skipped because another reconnect is already running');
      return false;
    }

    if (this.isUsingMockTransport()) {
      await this.hydrateLastDeviceInfo();
      const mockDevice = this.createMockDevice();
      return this.connectToDevice({
        id: this.lastConnectedDeviceId ?? mockDevice.id,
        name: this.lastConnectedDeviceName ?? mockDevice.name,
        rssi: mockDevice.rssi,
      });
    }

    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) return false;

    if (!this.ensureManager()) {
      this.debug('BLE manager unavailable for reconnect');
      return false;
    }

    await this.hydrateLastDeviceInfo();

    if (!this.lastConnectedDeviceId) {
      this.debug('No previous device to reconnect to');
      return false;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.debug('Max reconnect attempts reached');
      return false;
    }

    this.reconnectInFlight = true;
    this.reconnectAttempts++;
    this.debug(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);

    try {
      // 前回のデバイス情報をクリア
      this.device = null;

      // デバイスを取得して再接続
      const device = await this.manager.retrieveConnectedDevices([]);
      const targetDevice = device.find((d: any) => d.id === this.lastConnectedDeviceId);

      if (targetDevice) {
        return await this.connectToDevice(targetDevice);
      }

      // デバイスが見つからない場合はスキャンして検索
      this.debug('Device not found in connected devices, scanning...');
      return await this.scanAndReconnect();
    } catch (error) {
      this.debug(`Reconnect failed: ${error}`);
      return false;
    } finally {
      this.reconnectInFlight = false;
    }
  }

  /**
   * Scan and reconnect to the last device
   */
  private async scanAndReconnect(): Promise<boolean> {
    if (!this.ensureManager()) {
      return false;
    }

    return new Promise((resolve) => {
      this.setScanningState(true);
      let settled = false;

      const cleanup = () => {
        if (this.scanTimer) {
          clearTimeout(this.scanTimer);
          this.scanTimer = null;
        }
        this.stopScan();
      };

      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      this.scanTimer = setTimeout(() => {
        finish(false);
      }, 10000);

      this.manager.startDeviceScan(
        [],
        { allowDuplicates: false },
        (error: any, device: any) => {
          if (error) {
            this.debug(`Scan error during reconnect: ${error.message}`);
            finish(false);
            return;
          }

          if (device && device.id === this.lastConnectedDeviceId) {
            cleanup();
            settled = true;
            this.connectToDevice(device)
              .then(resolve)
              .catch(() => resolve(false));
          }
        }
      );
    });
  }

  /**
   * Get last connected device info
   */
  getLastDeviceInfo(): { id: string | null, name: string | null } {
    return {
      id: this.lastConnectedDeviceId,
      name: this.lastConnectedDeviceName,
    };
  }

  /**
   * Start listening for notifications
   * Tries multiple approaches to get data
   */
  async startNotifications(): Promise<boolean> {
    if (this.isUsingMockTransport()) {
      await this.stopNotifications();
      this.mockNotificationTimer = setInterval(() => {
        if (!this.mockConnected) return;
        this.callbacks.onDataReceived?.(this.createMockRepData());
      }, 1400);
      this.debug('Mock notifications started');
      return true;
    }

    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) return false;

    if (!this.device) {
      this.callbacks.onError?.('No device connected');
      return false;
    }

    await this.stopNotifications();
    this.debug('Starting data reception...');

    // First, try to find and monitor a notifiable characteristic
    const notifiableChar = await this.findNotifiableCharacteristic();

    if (notifiableChar) {
      this.debug(`Setting up monitor for: ${notifiableChar.uuid}`);

      try {
        this.notificationMonitor = this.device.monitorCharacteristicForService(
          notifiableChar.serviceUUID,
          notifiableChar.uuid,
          (error: any, characteristic: any) => {
            if (error) {
              this.debug(`Notification error: ${error.message}`);
              this.callbacks.onError?.(`Notification error: ${error.message}`);
              return;
            }

            if (characteristic?.value) {
              this.debug(`Received data: ${characteristic.value}`);
              this.handleNotification(characteristic);
            } else {
              this.debug('Received notification without value');
            }
          }
        );

        // Also try to read once to get initial data
        try {
          const readValue = await notifiableChar.read();
          if (readValue?.value) {
            this.debug(`Initial read: ${readValue.value}`);
            this.handleNotification(readValue);
          }
        } catch (readError) {
          this.debug(`Initial read failed: ${readError}`);
        }

        this.debug('Monitoring started');
        return true;

      } catch (error) {
        this.debug(`Monitor setup failed: ${error}`);
      }
    }

    // Fallback: try to find a readable characteristic and poll it
    this.debug('No notifiable characteristic found, trying readable...');
    const readableChar = await this.findReadableCharacteristic();

    if (readableChar) {
      this.debug(`Polling readable characteristic: ${readableChar.uuid}`);

      // Read once immediately
      try {
        const value = await readableChar.read();
        if (value?.value) {
          this.handleNotification(value);
        }
      } catch (error) {
        this.debug(`Read failed: ${error}`);
      }

      // Set up polling
      if (this.notificationMonitor) {
        clearInterval(this.notificationMonitor);
      }

      this.notificationMonitor = setInterval(async () => {
        try {
          const value = await readableChar!.read();
          if (value?.value) {
            this.handleNotification(value);
          }
        } catch (error) {
          // Ignore read errors during polling
        }
      }, 100); // Poll every 100ms for lower UI latency

      this.debug('Polling started (100ms interval)');
      return true;
    }

    this.callbacks.onError?.('No readable or notifiable characteristic found');
    return false;
  }

  /**
   * Handle incoming notification data
   */
  private handleNotification(characteristic: any) {
    try {
      const base64Data = characteristic.value;
      if (!base64Data) {
        this.debug('No value in characteristic');
        return;
      }

      // Decode base64 to byte array
      const bytes = base64ToBytes(base64Data);
      this.debug(`Data received: ${bytes.length} bytes`);

      if (bytes.length !== EXPECTED_DATA_SIZE) {
        this.debug(`Warning: Expected ${EXPECTED_DATA_SIZE} bytes, got ${bytes.length}`);
        // Don't return - try to parse anyway
      }

      // Parse RepVelo velocity data
      const parsedData = this.parseVelocityData(bytes);

      if (parsedData) {
        this.debug(`Parsed: v=${parsedData.mean_velocity.toFixed(2)} m/s`);
        this.callbacks.onDataReceived?.(parsedData);
      } else {
        this.debug('Failed to parse data');
      }
    } catch (error) {
      this.debug(`Error handling notification: ${error}`);
    }
  }

  /**
  * Parse velocity data from byte array
  * RepVelo Velocity Protocol:
  * Position 0-1:  Peak Velocity (cm/s) ÷ 100 → m/s
  * Position 2-3:  Mean Power (W)
  * Position 4-5:  Peak Power (W)
  * Position 6-7:  Mean Velocity (cm/s) ÷ 100 → m/s
  * Position 8-9:  ROM (mm) ÷ 10 → cm
  * Position 10-11: (reserved)
  * Position 12-13: (reserved)
  * Position 14-15: Rep Duration (ms)
  */
  private parseVelocityData(bytes: Uint8Array): RepVeloData | null {
    try {
      if (bytes.length < 16) {
        this.debug(`Data too short: ${bytes.length} bytes`);
        return null;
      }

      // Parse all UInt16 values (little-endian)
      // 解析結果(2026-02-23):
      // pos 0-1: Peak Velocity?
      // pos 2-3: ROM (0.1 inch単位 -> raw/3.937 = cm)
      // pos 4-5: Mean Velocity (0.01 m/s単位)
      // pos 6-7: ?? (Peak Velocity?)
      // pos 8-9: Mean Power (1 W単位)
      const peak_v_raw = readUInt16LE(bytes, 0);
      const rom_raw = readUInt16LE(bytes, 2);
      const mean_v_raw = readUInt16LE(bytes, 4);
      const peak_p_raw = readUInt16LE(bytes, 6);
      const mean_p_raw = readUInt16LE(bytes, 8);
      const _reserved1 = readUInt16LE(bytes, 10);
      const _reserved2 = readUInt16LE(bytes, 12);
      const duration_raw = readUInt16LE(bytes, 14); // ms

      // ---------------------------------------------------------
      // 直接計測+物理公式検証による最終確定係数 (2026-02-23)
      //
      //  ■ Mean Velocity (pos 4-5): raw / 100
      //    raw=142 → 1.42 m/s ✅ | raw=90 → 0.90 m/s ✅
      //  ■ Mean Power (pos 8-9): raw * 1.0
      //    raw=1113 → 1113 W ✅ | raw=708 → 709 W ✅
      //    物理検証: 80kg * 9.81 * 1.42 = 1114 W (完全一致)
      //  ■ ROM (pos 2-3): (raw / 10) * 2.54 = raw / 3.937
      //    raw=235 → 59.7 cm ✅ | raw=236 → 60.0 cm ✅ (0.1 inch単位)
      // ---------------------------------------------------------
      const peak_velocity = peak_v_raw / 100.0;    // 要確認
      const mean_velocity = mean_v_raw / 100.0;    // m/s
      const rom_cm = rom_raw / 3.937;   // cm
      const mean_power_w = mean_p_raw * 1.0;     // W
      const peak_power_w = peak_p_raw * 1.0;
      const rep_duration_ms = duration_raw;

      // Debug: show all raw values
      this.debug(`Raw: pv=${peak_v_raw} mv=${mean_v_raw} rom=${rom_raw} mp=${mean_p_raw} t=${duration_raw}`);

      return {
        mean_velocity,
        peak_velocity,
        rom_cm,
        rep_duration_ms,
        mean_power_w,
        peak_power_w,
        timestamp: Date.now(),
        // Raw values for debugging
        raw_peak_v: peak_v_raw,
        raw_mean_v: mean_v_raw,
        raw_rom: rom_raw,
        raw_mean_p: mean_p_raw,
        raw_peak_p: peak_p_raw,
      };
    } catch (error) {
      this.debug(`Error parsing velocity data: ${error}`);
      return null;
    }
  }

  /**
   * Stop notifications
   */
  async stopNotifications(): Promise<void> {
    if (this.mockNotificationTimer) {
      clearInterval(this.mockNotificationTimer);
      this.mockNotificationTimer = null;
    }
    if (this.notificationMonitor) {
      if (typeof this.notificationMonitor?.remove === 'function') {
        this.notificationMonitor.remove();
      } else {
        clearInterval(this.notificationMonitor);
      }
      this.notificationMonitor = null;
    }
    this.debug('Notifications stopped');
  }

  /**
   * Disconnect from device (keeps device info for reconnection)
   */
  async disconnect(): Promise<void> {
    if (this.isUsingMockTransport()) {
      await this.stopNotifications();
      this.mockConnected = false;
      this.device = null;
      this.callbacks.onConnectionStatusChanged?.(false);
      this.debug('Mock device disconnected');
      return;
    }

    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) return;

    this.manualDisconnectRequested = true;
    this.clearDisconnectSubscription();
    await this.stopNotifications();

    if (this.device) {
      try {
        await this.device.cancelConnection();
        this.device = null;
        this.callbacks.onConnectionStatusChanged?.(false);
        this.debug('Disconnected (device info preserved for reconnection)');
      } catch (error) {
        this.debug(`Disconnect error: ${error}`);
        this.callbacks.onError?.(`Disconnect error: ${error}`);
      }
    }
  }

  /**
   * Fully disconnect and clear device info
   */
  async disconnectAndClear(): Promise<void> {
    if (this.isUsingMockTransport()) {
      await this.stopNotifications();
      this.mockConnected = false;
      this.device = null;
      this.lastConnectedDeviceId = null;
      this.lastConnectedDeviceName = null;
      this.reconnectAttempts = 0;
      await this.clearLastDeviceInfo();
      this.callbacks.onConnectionStatusChanged?.(false);
      this.debug('Mock device disconnected and cleared');
      return;
    }

    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) return;

    this.manualDisconnectRequested = true;
    this.clearDisconnectSubscription();
    await this.stopNotifications();

    if (this.device) {
      try {
        await this.device.cancelConnection();
      } catch (error) {
        this.debug(`Disconnect error: ${error}`);
      }
    }

    this.device = null;
    this.lastConnectedDeviceId = null;
    this.lastConnectedDeviceName = null;
    this.reconnectAttempts = 0;
    await this.clearLastDeviceInfo();
    this.callbacks.onConnectionStatusChanged?.(false);
    this.debug('Disconnected and device info cleared');
  }

  /**
   * Check if connected
   */
  async isConnected(): Promise<boolean> {
    if (this.isUsingMockTransport()) {
      return this.mockConnected;
    }

    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) return false;

    if (!this.device) return false;

    try {
      const isConnected = await this.device.isConnected();
      return isConnected;
    } catch {
      return false;
    }
  }

  /**
   * Get discovered services for debugging
   */
  getDiscoveredServices(): any[] {
    return this.discoveredServices;
  }

  /**
   * Start connection heartbeat monitor
   */
  private startHeartbeat(): void {
    if (this.isUsingMockTransport()) return;

    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) return;

    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
    }

    this.reconnectTimer = setInterval(async () => {
      // Monitor connection state periodically
      const isConnected = await this.isConnected();
      if (!isConnected && this.lastConnectedDeviceId) {
        this.debug('Connection heartbeat lost. Attempting to reconnect...');
        const reconnected = await this.attemptAutoReconnect('heartbeat');
        if (!reconnected) {
          this.callbacks.onConnectionStatusChanged?.(false);
        }
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stopScan();
    this.stopNotifications();
    this.clearDisconnectSubscription();
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.device) {
      this.disconnect();
    }
    if (this.manager && this.manager.destroy) {
      this.manager.destroy();
    }
    this.manager = null;
  }
}

// Export singleton instance
export default new BLEService();
