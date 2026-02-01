/**
 * BLE Service for OVR Velocity Device
 * Handles Bluetooth Low Energy communication with OVR Velocity sensor
 */

import { BleManager, Device, Characteristic, Service } from 'react-native-ble-plx';
import { Platform } from 'react-native';
import { OVRData } from '../types/index';

// Platform-specific imports
let PermissionsAndroid: any = null;
if (Platform.OS === 'android') {
  const { PermissionsAndroid: AndroidPermissions } = require('react-native');
  PermissionsAndroid = AndroidPermissions;
}

// OVR Velocity Device Constants
const DEVICE_NAME_PREFIX = 'OVR_Velocity';
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const NOTIFY_CHARACTERISTIC_UUID = '14001dc2-5089-47d3-84bc-7c3d418389aa';
const SCAN_DURATION = 5000; // 5 seconds
const EXPECTED_DATA_SIZE = 16; // bytes

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

export interface BLEServiceCallbacks {
  onDataReceived?: (data: OVRData) => void;
  onConnectionStatusChanged?: (isConnected: boolean) => void;
  onError?: (error: string) => void;
  onDeviceFound?: (device: Device) => void;
  onDevicesDiscovered?: (devices: Device[]) => void;
  onDebugInfo?: (info: string) => void;
}

class BLEService {
  private manager: BleManager;
  private device: Device | null = null;
  private isScanning: boolean = false;
  private callbacks: BLEServiceCallbacks = {};
  private discoveredDevices: Device[] = [];
  private notificationMonitor: any = null;
  private discoveredServices: Service[] = [];

  constructor() {
    this.manager = new BleManager();
  }

  /**
   * Log debug info
   */
  private debug(message: string) {
    console.log('[BLE]', message);
    this.callbacks.onDebugInfo?.(message);
  }

  /**
   * Request Bluetooth permissions (Android only)
   */
  async requestPermissions(): Promise<boolean> {
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
    try {
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
   * Scan for OVR Velocity devices
   * iOSではUUIDフィルターなしでスキャン（iOSの制限対応）
   */
  async scanForDevices(): Promise<void> {
    if (this.isScanning) {
      console.log('Already scanning');
      return;
    }

    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      this.callbacks.onError?.('Bluetooth permissions not granted');
      return;
    }

    this.isScanning = true;
    this.discoveredDevices = [];

    // iOSではUUIDフィルターなしでスキャン（より多くのデバイスを検出）
    const serviceUUIDs = Platform.OS === 'ios' ? [] : [SERVICE_UUID];

    this.debug('Starting BLE scan...');

    this.manager.startDeviceScan(
      serviceUUIDs,
      { allowDuplicates: false },
      (error, device) => {
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

            if (device.name && this.isOVRDevice(device.name)) {
              this.debug(`OVR Velocity device found!`);
              this.callbacks.onDeviceFound?.(device);
            }
          }

          this.callbacks.onDevicesDiscovered?.(this.discoveredDevices);
        }
      }
    );

    const scanDuration = Platform.OS === 'ios' ? 10000 : SCAN_DURATION;
    setTimeout(() => {
      const ovrDevice = this.discoveredDevices.find(d =>
        d.name && this.isOVRDevice(d.name)
      );
      if (!ovrDevice) {
        this.debug(`Scan complete. Found ${this.discoveredDevices.length} devices, no OVR device.`);
      }
      this.stopScan();
    }, scanDuration);
  }

  /**
   * Check if device name matches OVR Velocity
   */
  private isOVRDevice(name: string): boolean {
    const ovrKeywords = ['OVR', 'Velocity', 'velocity', 'ovr'];
    return ovrKeywords.some(keyword => name.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * Stop scanning
   */
  stopScan() {
    if (this.isScanning) {
      this.manager.stopDeviceScan();
      this.isScanning = false;
      this.debug('Scan stopped');
    }
  }

  /**
   * Discover and log all services and characteristics
   */
  private async discoverServices(device: Device): Promise<Service[]> {
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
  private async findReadableCharacteristic(): Promise<Characteristic | null> {
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
  private async findNotifiableCharacteristic(): Promise<Characteristic | null> {
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
  async connectToDevice(device: Device): Promise<boolean> {
    try {
      this.debug(`Connecting to ${device.name}...`);
      this.stopScan();

      const connectedDevice = await device.connect();
      this.debug('Device connected, discovering services...');

      await connectedDevice.discoverAllServicesAndCharacteristics();
      this.device = connectedDevice;

      // Discover and log all services for debugging
      await this.discoverServices(connectedDevice);

      this.callbacks.onConnectionStatusChanged?.(true);
      this.debug('Connected successfully');

      return true;
    } catch (error) {
      console.error('Connection failed:', error);
      this.callbacks.onError?.(`Connection failed: ${error}`);
      this.callbacks.onConnectionStatusChanged?.(false);
      return false;
    }
  }

  /**
   * Start listening for notifications
   * Tries multiple approaches to get data
   */
  async startNotifications(): Promise<boolean> {
    if (!this.device) {
      this.callbacks.onError?.('No device connected');
      return false;
    }

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
      }, 500); // Poll every 500ms

      this.debug('Polling started (500ms interval)');
      return true;
    }

    this.callbacks.onError?.('No readable or notifiable characteristic found');
    return false;
  }

  /**
   * Handle incoming notification data
   */
  private handleNotification(characteristic: Characteristic) {
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

      // Parse OVR velocity data
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
   */
  private parseVelocityData(bytes: Uint8Array): OVRData | null {
    try {
      if (bytes.length < 16) {
        this.debug(`Data too short: ${bytes.length} bytes`);
        return null;
      }

      const mean_velocity = readFloatLE(bytes, 0);
      const peak_velocity = readFloatLE(bytes, 4);
      const rom_cm = readFloatLE(bytes, 8);
      const rep_duration_ms = readFloatLE(bytes, 12);

      // Validation
      if (
        isNaN(mean_velocity) ||
        isNaN(peak_velocity) ||
        isNaN(rom_cm) ||
        isNaN(rep_duration_ms)
      ) {
        this.debug('Data contains NaN values');
        return null;
      }

      return {
        mean_velocity,
        peak_velocity,
        rom_cm,
        rep_duration_ms,
        timestamp: Date.now(),
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
    if (this.notificationMonitor) {
      if (typeof this.notificationMonitor === 'function') {
        // It's a monitor callback, can't cancel it directly
      } else {
        clearInterval(this.notificationMonitor);
      }
      this.notificationMonitor = null;
    }
    this.debug('Notifications stopped');
  }

  /**
   * Disconnect from device
   */
  async disconnect(): Promise<void> {
    await this.stopNotifications();

    if (this.device) {
      try {
        await this.device.cancelConnection();
        this.device = null;
        this.callbacks.onConnectionStatusChanged?.(false);
        this.debug('Disconnected');
      } catch (error) {
        this.debug(`Disconnect error: ${error}`);
        this.callbacks.onError?.(`Disconnect error: ${error}`);
      }
    }
  }

  /**
   * Check if connected
   */
  async isConnected(): Promise<boolean> {
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
  getDiscoveredServices(): Service[] {
    return this.discoveredServices;
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stopScan();
    this.stopNotifications();
    if (this.device) {
      this.disconnect();
    }
    this.manager.destroy();
  }
}

// Export singleton instance
export default new BLEService();
