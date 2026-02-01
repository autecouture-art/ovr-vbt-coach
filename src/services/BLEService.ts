/**
 * BLE Service for OVR Velocity Device
 * Handles Bluetooth Low Energy communication with OVR Velocity sensor
 */

import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
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
  onDevicesDiscovered?: (devices: Device[]) => void;  // 全デバイス通知（デバッグ用）
}

class BLEService {
  private manager: BleManager;
  private device: Device | null = null;
  private isScanning: boolean = false;
  private callbacks: BLEServiceCallbacks = {};
  private discoveredDevices: Device[] = [];  // 発見したデバイスを記録

  constructor() {
    this.manager = new BleManager();
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
    // AndroidではUUIDフィルター使用（効率的）
    const serviceUUIDs = Platform.OS === 'ios' ? [] : [SERVICE_UUID];

    console.log('Starting BLE scan...', Platform.OS, serviceUUIDs);

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
          // 全デバイスを記録
          const existingIndex = this.discoveredDevices.findIndex(d => d.id === device.id);
          if (existingIndex === -1) {
            this.discoveredDevices.push(device);
            console.log('Device discovered:', device.name || '(unnamed)', device.id);

            // OVRデバイスを検出
            if (device.name && this.isOVRDevice(device.name)) {
              console.log('OVR Velocity device found!', device.name);
              this.callbacks.onDeviceFound?.(device);
            }
          }

          // 定期的に発見したデバイスを通知（デバッグ用）
          this.callbacks.onDevicesDiscovered?.(this.discoveredDevices);
        }
      }
    );

    // スキャン期間を延長（iOSでデバイスを見つけやすくするため）
    const scanDuration = Platform.OS === 'ios' ? 10000 : SCAN_DURATION;
    setTimeout(() => {
      // OVRデバイスが見つからない場合の通知
      const ovrDevice = this.discoveredDevices.find(d =>
        d.name && this.isOVRDevice(d.name)
      );
      if (!ovrDevice) {
        console.log('Scan complete. No OVR device found. Total devices:', this.discoveredDevices.length);
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
      console.log('Scan stopped');
    }
  }

  /**
   * Connect to a device
   */
  async connectToDevice(device: Device): Promise<boolean> {
    try {
      console.log('Connecting to device:', device.name);

      // Stop scanning before connecting
      this.stopScan();

      const connectedDevice = await device.connect();
      await connectedDevice.discoverAllServicesAndCharacteristics();

      this.device = connectedDevice;
      this.callbacks.onConnectionStatusChanged?.(true);

      console.log('Connected successfully');
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
   */
  async startNotifications(): Promise<boolean> {
    if (!this.device) {
      this.callbacks.onError?.('No device connected');
      return false;
    }

    try {
      console.log('Starting notifications');

      this.device.monitorCharacteristicForService(
        SERVICE_UUID,
        NOTIFY_CHARACTERISTIC_UUID,
        (error: any, characteristic: any) => {
          if (error) {
            console.error('Notification error:', error);
            this.callbacks.onError?.(`Notification error: ${error.message}`);
            return;
          }

          if (characteristic?.value) {
            this.handleNotification(characteristic);
          }
        }
      );

      console.log('Notifications started');
      return true;
    } catch (error) {
      console.error('Failed to start notifications:', error);
      this.callbacks.onError?.(`Failed to start notifications: ${error}`);
      return false;
    }
  }

  /**
   * Handle incoming notification data
   */
  private handleNotification(characteristic: Characteristic) {
    try {
      const base64Data = characteristic.value;
      if (!base64Data) return;

      // Decode base64 to byte array (React Native compatible)
      const bytes = base64ToBytes(base64Data);

      if (bytes.length !== EXPECTED_DATA_SIZE) {
        console.warn(`Unexpected data size: ${bytes.length} bytes`);
        return;
      }

      // Parse OVR velocity data
      const parsedData = this.parseVelocityData(bytes);

      if (parsedData) {
        this.callbacks.onDataReceived?.(parsedData);
      }
    } catch (error) {
      console.error('Error handling notification:', error);
    }
  }

  /**
   * Parse velocity data from byte array
   * Based on the Python parser implementation
   */
  private parseVelocityData(bytes: Uint8Array): OVRData | null {
    try {
      // Parse 16-byte data structure from OVR device
      // Format: 4 bytes float for each value (little-endian)
      // [mean_velocity, peak_velocity, rom_cm, rep_duration_ms]

      const mean_velocity = readFloatLE(bytes, 0);
      const peak_velocity = readFloatLE(bytes, 4);
      const rom_cm = readFloatLE(bytes, 8);
      const rep_duration_ms = readFloatLE(bytes, 12);

      // Validation: check for reasonable values
      if (
        isNaN(mean_velocity) ||
        isNaN(peak_velocity) ||
        isNaN(rom_cm) ||
        isNaN(rep_duration_ms)
      ) {
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
      console.error('Error parsing velocity data:', error);
      return null;
    }
  }

  /**
   * Stop notifications
   */
  async stopNotifications(): Promise<void> {
    if (!this.device) return;

    try {
      // BLE PLX automatically stops monitoring when disconnecting
      console.log('Notifications stopped');
    } catch (error) {
      console.error('Error stopping notifications:', error);
    }
  }

  /**
   * Disconnect from device
   */
  async disconnect(): Promise<void> {
    if (!this.device) return;

    try {
      await this.device.cancelConnection();
      this.device = null;
      this.callbacks.onConnectionStatusChanged?.(false);
      console.log('Disconnected');
    } catch (error) {
      console.error('Disconnect error:', error);
      this.callbacks.onError?.(`Disconnect error: ${error}`);
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
   * Clean up resources
   */
  destroy() {
    this.stopScan();
    if (this.device) {
      this.disconnect();
    }
    this.manager.destroy();
  }
}

// Export singleton instance
export default new BLEService();
