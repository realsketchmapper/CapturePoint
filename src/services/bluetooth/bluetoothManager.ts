import RNBluetoothClassic, { 
  BluetoothDevice, 
  BluetoothEventSubscription 
} from 'react-native-bluetooth-classic';
import { BluetoothDeviceType, BluetoothConnectionEvent, BluetoothConnectionEventData } from '@/types/bluetooth.types';
import { BLUETOOTH_DEVICE_TYPES } from '@/utils/constants';
import { deviceStorage } from '../storage/deviceStorage';
import { bluetoothDataLogger } from '../logging/bluetoothDataLogger';

// Custom error types for better error handling
export class BluetoothError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'BluetoothError';
  }
}

export class ConnectionError extends BluetoothError {
  constructor(message: string) {
    super(message, 'CONNECTION_ERROR');
    this.name = 'ConnectionError';
  }
}

export class DeviceNotFoundError extends BluetoothError {
  constructor(message: string) {
    super(message, 'DEVICE_NOT_FOUND');
    this.name = 'DeviceNotFoundError';
  }
}

// Connection state type
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Device status interface
interface DeviceStatus {
  address: string;
  name: string;
  isConnected: boolean;
  lastSeen: Date;
}

export class BluetoothManager {
  private static instance: BluetoothManager;
  private subscriptions: Map<string, BluetoothEventSubscription> = new Map();
  private deviceStatusCache: Map<string, DeviceStatus> = new Map();
  private connectionState: ConnectionState = 'disconnected';
  private connectionRetryCount = 0;
  private readonly MAX_RETRY_COUNT = 3;
  private readonly CONNECTION_TIMEOUT = 10000; // 10 seconds
  private readonly CACHE_TTL = 5000; // 5 seconds
  private currentConnectedDevice: BluetoothDevice | null = null;
  
  // Connection monitoring
  private connectionMonitorInterval: NodeJS.Timeout | null = null;
  private dataTimeoutInterval: NodeJS.Timeout | null = null;
  private lastDataReceived: Date | null = null;
  private readonly CONNECTION_CHECK_INTERVAL = 5000; // Check every 5 seconds
  private readonly DATA_TIMEOUT_DURATION = 15000; // 15 seconds without data = timeout
  private connectionEventListeners: Array<(event: BluetoothConnectionEventData) => void> = [];

  // RTK-Pro button press debouncing
  private lastButtonPressTime: number = 0;
  private readonly BUTTON_PRESS_DEBOUNCE_MS = 2000; // 2 seconds debounce between button presses
  private processedLogNumbers: Set<string> = new Set(); // Track processed log numbers
  private readonly LOG_NUMBER_CACHE_SIZE = 50; // Keep last 50 log numbers in memory

  private constructor() {}

  public static getInstance(): BluetoothManager {
    if (!BluetoothManager.instance) {
      BluetoothManager.instance = new BluetoothManager();
    }
    return BluetoothManager.instance;
  }

  /**
   * Get the current connection state
   */
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if Bluetooth is enabled
   */
  public async isBluetoothEnabled(): Promise<boolean> {
    return RNBluetoothClassic.isBluetoothEnabled();
  }

  /**
   * Scan for devices of a specific type
   */
  public async scanDevices(deviceType: BluetoothDeviceType): Promise<BluetoothDevice[]> {
    console.log(`🔍 Scanning for ${deviceType} devices...`);
    
    const enabled = await this.isBluetoothEnabled();
    if (!enabled) {
      console.log('❌ Bluetooth is not enabled');
      throw new BluetoothError('Please enable Bluetooth in your device settings', 'BLUETOOTH_DISABLED');
    }

    const devices = await RNBluetoothClassic.getBondedDevices();
    console.log(`📱 Found ${devices.length} bonded devices:`, devices.map(d => d.name));
    
    const deviceTypeConfig = BLUETOOTH_DEVICE_TYPES.find(type => type.name === deviceType);
    
    if (!deviceTypeConfig) {
      console.log(`❌ Device type ${deviceType} not found in configuration`);
      throw new BluetoothError(`Device type ${deviceType} not found in configuration`, 'INVALID_DEVICE_TYPE');
    }

    console.log(`🎯 Looking for devices with namePrefix: "${deviceTypeConfig.namePrefix}"`);

    // Update device status cache
    devices.forEach(device => {
      if (device.name && device.name.startsWith(deviceTypeConfig.namePrefix)) {
        console.log(`✅ Found matching device: ${device.name}`);
        this.deviceStatusCache.set(device.address, {
          address: device.address,
          name: device.name,
          isConnected: false,
          lastSeen: new Date()
        });
      } else {
        console.log(`❌ Device "${device.name}" doesn't match prefix "${deviceTypeConfig.namePrefix}"`);
      }
    });

    const filteredDevices = devices.filter(device =>
      device.name && device.name.startsWith(deviceTypeConfig.namePrefix)
    );

    console.log(`🎯 Filtered to ${filteredDevices.length} matching devices:`, filteredDevices.map(d => d.name));
    return filteredDevices;
  }

  /**
   * Connect to a device with retry logic
   */
  public async connectToDevice(device: BluetoothDevice): Promise<boolean> {
    console.log(`🔌 Attempting to connect to device: ${device.name} (${device.address})`);
    this.connectionState = 'connecting';
    
    // Check cache first
    const cachedStatus = this.deviceStatusCache.get(device.address);
    if (cachedStatus && cachedStatus.isConnected) {
      const isStillConnected = await RNBluetoothClassic.isDeviceConnected(device.address);
      console.log(`📋 Cache says connected, actual status: ${isStillConnected}`);
      if (isStillConnected) {
        this.connectionState = 'connected';
        return true;
      }
    }

    // Reset retry count for new connection attempt
    this.connectionRetryCount = 0;
    
    while (this.connectionRetryCount < this.MAX_RETRY_COUNT) {
      try {
        console.log(`🔄 Connection attempt ${this.connectionRetryCount + 1}/${this.MAX_RETRY_COUNT}`);
        await this._attemptConnection(device);
        this.connectionState = 'connected';
        console.log(`✅ Successfully connected to ${device.name}`);
        return true;
      } catch (error) {
        this.connectionRetryCount++;
        console.warn(`❌ Connection attempt ${this.connectionRetryCount} failed:`, error);
        
        if (this.connectionRetryCount >= this.MAX_RETRY_COUNT) {
          this.connectionState = 'error';
          console.log(`🚫 Failed to connect after ${this.MAX_RETRY_COUNT} attempts`);
          throw new ConnectionError(`Failed to connect after ${this.MAX_RETRY_COUNT} attempts`);
        }
        
        // Wait before retrying (exponential backoff)
        const waitTime = 1000 * Math.pow(2, this.connectionRetryCount - 1);
        console.log(`⏱️ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    return false;
  }

  /**
   * Internal method to attempt a single connection
   */
  private async _attemptConnection(device: BluetoothDevice): Promise<void> {
    console.log(`🔗 Checking if ${device.name} is already connected...`);
    const isAlreadyConnected = await RNBluetoothClassic.isDeviceConnected(device.address);
    if (isAlreadyConnected) {
      console.log(`✅ Device ${device.name} is already connected`);
      return;
    }

    console.log(`📡 Attempting Bluetooth connection to ${device.address}...`);
    // Attempt connection with timeout
    await Promise.race([
      RNBluetoothClassic.connectToDevice(device.address),
      new Promise((_, reject) =>
        setTimeout(() => reject(new ConnectionError('Connection timeout')), this.CONNECTION_TIMEOUT)
      )
    ]);

    console.log(`✅ Bluetooth connection established, verifying...`);
    // Verify connection
    const isConnected = await RNBluetoothClassic.isDeviceConnected(device.address);
    if (!isConnected) {
      console.log(`❌ Connection verification failed for ${device.name}`);
      throw new ConnectionError('Device connection failed. Please ensure the device is turned on and in range.');
    }

    console.log(`✅ Connection verified for ${device.name}`);

    // Update cache
    this.deviceStatusCache.set(device.address, {
      address: device.address,
      name: device.name,
      isConnected: true,
      lastSeen: new Date()
    });

    // Store the connected device
    await deviceStorage.storeLastConnectedDevice(device);
    
    // Store current connected device for logging
    this.currentConnectedDevice = device;

    // Start connection monitoring
    this.startConnectionMonitoring(device);

    // Emit connection event
    this.emitConnectionEvent('connected', device);

    // Check if this is an RTK-Pro device and start logging
    const isRTKPro = this.isRTKProDevice(device);
    console.log(`🤖 Is RTK-Pro device check: ${isRTKPro} (device name: "${device.name}")`);
    
    if (isRTKPro) {
      try {
        console.log(`🎯 Starting data logging for RTK-Pro device: ${device.name}`);
        await bluetoothDataLogger.startLogging('RTK-PRO', device.name, device.address);
        console.log(`✅ Data logging started successfully for ${device.name}`);
      } catch (error) {
        console.error('❌ Failed to start data logging:', error);
      }
    } else {
      console.log(`ℹ️ Not an RTK-Pro device, skipping data logging`);
    }
  }

  /**
   * Check if device is an RTK-Pro device
   */
  private isRTKProDevice(device: BluetoothDevice): boolean {
    const rtkProConfig = BLUETOOTH_DEVICE_TYPES.find(type => type.name === 'RTK-PRO');
    console.log(`🔍 RTK-Pro config:`, rtkProConfig);
    console.log(`🔍 Device name: "${device.name}"`);
    
    if (!rtkProConfig) {
      console.log(`❌ No RTK-PRO configuration found`);
      return false;
    }
    
    const matches = device.name.startsWith(rtkProConfig.namePrefix);
    console.log(`🔍 Name prefix check: "${device.name}".startsWith("${rtkProConfig.namePrefix}") = ${matches}`);
    
    return matches;
  }

  /**
   * Start listening to device data
   */
  public async startListeningToDevice(
    address: string,
    onDataReceived: (data: string) => void
  ): Promise<void> {
    console.log(`👂 Starting to listen to device: ${address}`);
    
    // Check cache first
    const cachedStatus = this.deviceStatusCache.get(address);
    if (!cachedStatus || !cachedStatus.isConnected) {
      const isConnected = await RNBluetoothClassic.isDeviceConnected(address);
      console.log(`📋 Cache status: ${cachedStatus?.isConnected}, Actual status: ${isConnected}`);
      if (!isConnected) {
        console.log(`❌ Device ${address} is not connected - cannot start listening`);
        throw new DeviceNotFoundError('Device is not connected');
      }
      
      // Update cache
      if (cachedStatus) {
        cachedStatus.isConnected = true;
        cachedStatus.lastSeen = new Date();
      }
    }

    // Remove any existing subscription
    await this.stopListeningToDevice(address);

    try {
      console.log(`📡 Getting connected device for ${address}...`);
      // Get the connected device
      const device = await RNBluetoothClassic.getConnectedDevice(address);
      console.log(`✅ Got connected device: ${device.name}`);

      // Subscribe to device data with enhanced logging
      console.log(`🎧 Setting up data subscription for ${device.name}...`);
      const subscription = device.onDataReceived((data) => {
        const receivedData = data.data;
        
        // Update data received timestamp for connection monitoring
        this.updateLastDataReceived();
        
        const dataType = this.determineDataType(receivedData);
        
        // Only log important events, not continuous data streams
        if (dataType === 'event') {
          console.log(`🚨🚨🚨 ACTUAL BUTTON PRESS DETECTED! 🚨🚨🚨`);
          console.log(`📍 Manual locate data from ${device.name}: "${receivedData}" (${receivedData.length} chars)`);
          console.log(`⏰ Time: ${new Date().toLocaleTimeString()}`);
          if (receivedData.toUpperCase().includes('LOC3')) {
            console.log(`🎯 LOC3 Data: This contains locate measurement data`);
          }
          if (receivedData.toUpperCase().includes('TLT3')) {
            console.log(`🎯 TLT3 Data: This contains GPS positioning data`);
          }
          
          // Handle RTK-Pro specific data
          if (device.name.startsWith('vLoc3-RTK-Pro')) {
            // Emit a global event that can be caught by the RTK-Pro context
            if ((global as any).rtkProDataHandler) {
              (global as any).rtkProDataHandler(receivedData);
            }
            
            // Extract log number for deduplication
            const logNumber = this.extractLogNumber(receivedData);
            
            if (logNumber) {
              console.log(`🔍 Extracted log identifier: ${logNumber}`);
              
              // Check if we've already processed this log number
              if (this.isLogNumberProcessed(logNumber)) {
                console.log(`🚦 Ignoring duplicate log entry: ${logNumber}`);
                console.log(`📝 This log number has already been processed for auto-collection`);
              } else {
                // This is a new log entry - trigger auto-collection and mark as processed
                this.addProcessedLogNumber(logNumber);
                console.log(`🎯 New RTK-Pro log entry detected: ${logNumber}`);
                console.log(`⏱️ Triggering automatic point collection`);
                
                setTimeout(() => {
                  if ((global as any).autoCollectPoint) {
                    try {
                      (global as any).autoCollectPoint();
                      console.log('✅ Automatic point collection triggered successfully');
                    } catch (error) {
                      console.error('❌ Failed to trigger automatic point collection:', error);
                    }
                  } else {
                    console.warn('⚠️ Auto point collection handler not available');
                  }
                }, 100); // 100ms delay to allow React state to update
              }
            } else {
              console.log(`⚠️ Could not extract log number from RTK-Pro data: ${receivedData}`);
              // Fallback to time-based debouncing for non-standard messages
              const currentTime = Date.now();
              const timeSinceLastPress = currentTime - this.lastButtonPressTime;
              
              if (timeSinceLastPress >= this.BUTTON_PRESS_DEBOUNCE_MS) {
                this.lastButtonPressTime = currentTime;
                console.log('🎯 RTK-Pro button press detected (fallback) - triggering automatic point collection');
                
                setTimeout(() => {
                  if ((global as any).autoCollectPoint) {
                    try {
                      (global as any).autoCollectPoint();
                      console.log('✅ Automatic point collection triggered successfully (fallback)');
                    } catch (error) {
                      console.error('❌ Failed to trigger automatic point collection (fallback):', error);
                    }
                  }
                }, 100);
              }
            }
          }
        }
        
        // Log to Bluetooth data logger
        bluetoothDataLogger.logData(receivedData, dataType);
        
        // Handle button press events for RTK-Pro devices  
        if (device.name.startsWith('vLoc3-RTK-Pro') && dataType === 'event') {
          console.log(`🎯 RTK-Pro button press event logged!`);
        }
        
        onDataReceived(receivedData);
      });

      // Store the subscription
      this.subscriptions.set(address, subscription);
      console.log(`✅ Data subscription established for ${device.name}`);
      console.log(`🔍 Subscription details:`, {
        address,
        deviceName: device.name,
        subscriptionActive: true
      });

      // Test the subscription immediately
      console.log(`🧪 Testing data subscription for ${device.name}...`);
      console.log(`🧪 Expecting data according to manufacturer:`);
      console.log(`   📡 NMEA0183 GPS data every 1 second (automatic)`);
      console.log(`   📋 Locate data when collect button pressed (manual)`);
      console.log(`🧪 If no data appears in 30 seconds, there may be a communication issue`);

      // For RTK-Pro devices, start periodic health checks and try to wake up the device
      if (this.currentConnectedDevice && this.isRTKProDevice(this.currentConnectedDevice)) {
        console.log(`🏥 Starting health checks for RTK-Pro device...`);
        this.startRTKProHealthChecks(device);
      }

    } catch (error: any) {
      // Clean up if there's an error
      console.error('❌ Error in startListeningToDevice:', error);
      await this.stopListeningToDevice(address);
      throw new BluetoothError(`Failed to start listening: ${error?.message || 'Unknown error'}`, 'LISTENING_ERROR');
    }
  }

  /**
   * Start health checks and device wake-up for RTK-Pro devices
   */
  private startRTKProHealthChecks(device: BluetoothDevice): void {
    console.log(`🏥 Starting RTK-Pro health monitoring for ${device.name}`);
    
    let dataReceiveCount = 0;
    let lastLogTime = Date.now();
    
    // Monitor connection health and log periodic status
    const healthCheckInterval = setInterval(async () => {
      try {
        const isStillConnected = await RNBluetoothClassic.isDeviceConnected(device.address);
        
        if (!isStillConnected) {
          console.log(`❌ Device ${device.name} is no longer connected, stopping health checks`);
          clearInterval(healthCheckInterval);
        } else {
          // Log status every 30 seconds to show it's still working
          const now = Date.now();
          if (now - lastLogTime > 30000) { // 30 seconds
            console.log(`✅ RTK-Pro ${device.name} connected and streaming data`);
            lastLogTime = now;
          }
        }
      } catch (error) {
        console.error(`❌ Health check failed for ${device.name}:`, error);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Extract log number from RTK-Pro data message
   * Format: LOG,LOC3,787,22601181323... or LOG,TLT3,787,22601181323...
   */
  private extractLogNumber(data: string): string | null {
    const trimmedData = data.trim().toUpperCase();
    
    // Match LOG,LOC3,### or LOG,TLT3,### patterns
    const logMatch = trimmedData.match(/^LOG,(LOC3|TLT3),(\d+),/);
    if (logMatch) {
      const logType = logMatch[1]; // LOC3 or TLT3
      const logNumber = logMatch[2]; // The number
      return `${logType}-${logNumber}`; // e.g., "LOC3-787" or "TLT3-787"
    }
    
    return null;
  }

  /**
   * Check if this log number has already been processed for auto-collection
   */
  private isLogNumberProcessed(logNumber: string): boolean {
    // For the same button press, we only want to trigger on LOC3, not TLT3
    // So we check if we've seen ANY data (LOC3 or TLT3) for this log number
    const baseLogNumber = logNumber.split('-')[1]; // Extract just the number part
    
    const hasLOC3 = this.processedLogNumbers.has(`LOC3-${baseLogNumber}`);
    const hasTLT3 = this.processedLogNumbers.has(`TLT3-${baseLogNumber}`);
    
    return hasLOC3 || hasTLT3;
  }

  /**
   * Add log number to processed set with cache size management
   */
  private addProcessedLogNumber(logNumber: string): void {
    this.processedLogNumbers.add(logNumber);
    
    // Manage cache size - remove oldest entries if we exceed the limit
    if (this.processedLogNumbers.size > this.LOG_NUMBER_CACHE_SIZE) {
      const entries = Array.from(this.processedLogNumbers);
      // Remove the first (oldest) entries
      const entriesToRemove = entries.slice(0, this.processedLogNumbers.size - this.LOG_NUMBER_CACHE_SIZE);
      entriesToRemove.forEach(entry => this.processedLogNumbers.delete(entry));
    }
  }

  /**
   * Determine the type of data received
   */
  private determineDataType(data: string): 'raw' | 'nmea' | 'event' {
    const trimmedData = data.trim().toUpperCase();
    
    // Check if it's NMEA0183 data (GPS data sent every 1 second)
    if (trimmedData.startsWith('$GP') || trimmedData.startsWith('$GN') || 
        trimmedData.startsWith('$GL') || trimmedData.startsWith('$GA') ||
        (trimmedData.startsWith('$') && trimmedData.includes(','))) {
      return 'nmea';
    }
    
    // Check for ACTUAL button press events (longer, detailed entries)
    // These are the real manual locate data when button is pressed
    if (trimmedData.startsWith('LOG,LOC3,') || 
        trimmedData.startsWith('LOG,TLT3,') ||
        (trimmedData.startsWith('LOG,') && trimmedData.length > 60)) {
      return 'event';
    }
    
    // Shorter LOG, GUIDE entries are continuous scanning, not button presses
    // These happen constantly during normal operation
    if (trimmedData.startsWith('LOG, GUIDE,') || trimmedData.startsWith('LOG,GUIDE,')) {
      return 'raw'; // Treat as raw data, not events
    }
    
    // Check for other potential event indicators
    const eventIndicators = [
      'BUTTON', 'MARK', 'POINT', 'COLLECT', 'TRIGGER', 'PRESS'
    ];
    
    if (eventIndicators.some(indicator => trimmedData.includes(indicator))) {
      return 'event';
    }
    
    return 'raw';
  }

  /**
   * Stop listening to device data
   */
  public async stopListeningToDevice(address: string): Promise<void> {
    const subscription = this.subscriptions.get(address);
    if (subscription) {
      subscription.remove();
      this.subscriptions.delete(address);
    }
  }

  /**
   * Disconnect from a device
   */
  public async disconnectDevice(address: string): Promise<void> {
    // Stop connection monitoring
    this.stopConnectionMonitoring();
    
    // Stop data logging if this is an RTK-Pro device
    if (this.currentConnectedDevice && this.isRTKProDevice(this.currentConnectedDevice)) {
      try {
        await bluetoothDataLogger.stopLogging();
        console.log(`Stopped data logging for RTK-Pro device: ${this.currentConnectedDevice.name}`);
      } catch (error) {
        console.error('Failed to stop data logging:', error);
      }
    }

    // First stop any active listeners
    await this.stopListeningToDevice(address);

    // Then disconnect from the device
    if (await RNBluetoothClassic.isDeviceConnected(address)) {
      await RNBluetoothClassic.disconnectFromDevice(address);
    }
    
    // Update cache
    const cachedStatus = this.deviceStatusCache.get(address);
    if (cachedStatus) {
      cachedStatus.isConnected = false;
    }
    
    this.connectionState = 'disconnected';
    this.currentConnectedDevice = null;
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    // Stop connection monitoring
    this.stopConnectionMonitoring();
    
    // Stop data logging if active
    if (this.currentConnectedDevice && this.isRTKProDevice(this.currentConnectedDevice)) {
      try {
        await bluetoothDataLogger.stopLogging();
      } catch (error) {
        console.error('Failed to stop data logging during cleanup:', error);
      }
    }

    // Stop all active listeners
    for (const [address] of this.subscriptions) {
      await this.stopListeningToDevice(address);
    }
    
    // Clear cache
    this.deviceStatusCache.clear();
    
    // Clear listeners
    this.connectionEventListeners = [];
    
    // Reset state
    this.connectionState = 'disconnected';
    this.connectionRetryCount = 0;
    this.currentConnectedDevice = null;
  }

  /**
   * Manual device testing function - call this from console for debugging
   */
  public async testCurrentDevice(): Promise<void> {
    if (!this.currentConnectedDevice) {
      console.log('❌ No device currently connected');
      return;
    }

    const device = this.currentConnectedDevice;
    console.log(`🧪 Testing device: ${device.name} (${device.address})`);

    try {
      // Check connection status
      const isConnected = await RNBluetoothClassic.isDeviceConnected(device.address);
      console.log(`📊 Connection status: ${isConnected}`);

      if (!isConnected) {
        console.log('❌ Device is not connected');
        return;
      }

      // Try to get device details
      const connectedDevice = await RNBluetoothClassic.getConnectedDevice(device.address);
      console.log(`📱 Device details:`, {
        name: connectedDevice.name,
        address: connectedDevice.address,
        id: connectedDevice.id
      });

      console.log(`✅ Device test completed`);
    } catch (error) {
      console.error(`❌ Device test failed:`, error);
    }
  }

  /**
   * Get current connected device info
   */
  public getCurrentDevice(): BluetoothDevice | null {
    return this.currentConnectedDevice;
  }

  /**
   * Test the data connection - call this manually to debug
   */
  public async testDataConnection(): Promise<void> {
    if (!this.currentConnectedDevice) {
      console.log('❌ No device currently connected for data test');
      return;
    }

    const device = this.currentConnectedDevice;
    console.log(`🧪 ========================================`);
    console.log(`🧪 TESTING DATA CONNECTION`);
    console.log(`🧪 Device: ${device.name} (${device.address})`);
    console.log(`🧪 ========================================`);

    try {
      // Check if device is still connected
      const isConnected = await RNBluetoothClassic.isDeviceConnected(device.address);
      console.log(`🧪 Connection status: ${isConnected}`);

      if (!isConnected) {
        console.log('❌ Device is not connected');
        return;
      }

      // Check if we have an active subscription
      const hasSubscription = this.subscriptions.has(device.address);
      console.log(`🧪 Has data subscription: ${hasSubscription}`);

      // Get device details
      const connectedDevice = await RNBluetoothClassic.getConnectedDevice(device.address);
      console.log(`🧪 Device details:`, {
        name: connectedDevice.name,
        address: connectedDevice.address,
        id: connectedDevice.id
      });

      console.log(`🧪 ========================================`);
      console.log(`🧪 According to manufacturer:`);
      console.log(`🧪 1. GPS data should stream every 1 second automatically`);
      console.log(`🧪 2. Locate data should send when collect button pressed`);
      console.log(`🧪 3. Data format: NMEA0183 for GPS, proprietary for locate`);
      console.log(`🧪 ========================================`);
      
      // Try sending a simple test command
      console.log(`🧪 Sending test ping command...`);
      await device.write('\r\n');
      
      console.log(`🧪 Test completed. Watch for 🚨 DATA RECEIVED messages...`);
      
    } catch (error) {
      console.error(`❌ Data connection test failed:`, error);
    }
  }

  /**
   * Add connection event listener
   */
  public addConnectionEventListener(listener: (event: BluetoothConnectionEventData) => void): void {
    this.connectionEventListeners.push(listener);
  }

  /**
   * Remove connection event listener
   */
  public removeConnectionEventListener(listener: (event: BluetoothConnectionEventData) => void): void {
    const index = this.connectionEventListeners.indexOf(listener);
    if (index > -1) {
      this.connectionEventListeners.splice(index, 1);
    }
  }

  /**
   * Emit connection event to all listeners
   */
  private emitConnectionEvent(event: BluetoothConnectionEvent, device: BluetoothDevice, reason?: string): void {
    const eventData: BluetoothConnectionEventData = {
      event,
      device,
      timestamp: new Date(),
      reason
    };

    console.log(`🔔 Bluetooth Event: ${event} for device ${device.name}`, reason ? `(${reason})` : '');
    
    this.connectionEventListeners.forEach(listener => {
      try {
        listener(eventData);
      } catch (error) {
        console.error('Error in connection event listener:', error);
      }
    });
  }

  /**
   * Start connection monitoring for the current device
   */
  private startConnectionMonitoring(device: BluetoothDevice): void {
    this.stopConnectionMonitoring(); // Clear any existing monitoring
    
    console.log(`🔍 Starting connection monitoring for ${device.name}`);
    this.lastDataReceived = new Date();

    // Monitor connection status
    this.connectionMonitorInterval = setInterval(async () => {
      try {
        const isConnected = await RNBluetoothClassic.isDeviceConnected(device.address);
        
        if (!isConnected) {
          console.log(`❌ Connection lost to ${device.name}`);
          this.handleDeviceDisconnection(device, 'Connection lost');
          return;
        }

        // Check for data timeout
        if (this.lastDataReceived) {
          const timeSinceLastData = Date.now() - this.lastDataReceived.getTime();
          if (timeSinceLastData > this.DATA_TIMEOUT_DURATION) {
            console.log(`⏰ Data timeout detected for ${device.name} (${Math.round(timeSinceLastData/1000)}s since last data)`);
            this.handleDeviceDisconnection(device, 'No data received');
            return;
          }
        }

      } catch (error) {
        console.error(`❌ Error checking connection status for ${device.name}:`, error);
        this.handleDeviceDisconnection(device, 'Connection check failed');
      }
    }, this.CONNECTION_CHECK_INTERVAL);
  }

  /**
   * Stop connection monitoring
   */
  private stopConnectionMonitoring(): void {
    if (this.connectionMonitorInterval) {
      clearInterval(this.connectionMonitorInterval);
      this.connectionMonitorInterval = null;
    }
    if (this.dataTimeoutInterval) {
      clearInterval(this.dataTimeoutInterval);
      this.dataTimeoutInterval = null;
    }
  }

  /**
   * Handle device disconnection
   */
  private async handleDeviceDisconnection(device: BluetoothDevice, reason: string): Promise<void> {
    console.log(`💔 Handling disconnection for ${device.name}: ${reason}`);
    
    // Stop monitoring
    this.stopConnectionMonitoring();
    
    // Clean up subscriptions
    await this.stopListeningToDevice(device.address);
    
    // Update state
    this.connectionState = 'disconnected';
    this.currentConnectedDevice = null;
    
    // Update cache
    const cachedStatus = this.deviceStatusCache.get(device.address);
    if (cachedStatus) {
      cachedStatus.isConnected = false;
    }

    // Stop data logging if this is an RTK-Pro device
    if (this.isRTKProDevice(device)) {
      try {
        await bluetoothDataLogger.stopLogging();
        console.log(`Stopped data logging for RTK-Pro device: ${device.name}`);
      } catch (error) {
        console.error('Failed to stop data logging:', error);
      }
    }
    
    // Emit disconnection event
    this.emitConnectionEvent('disconnected', device, reason);
  }

  /**
   * Update the data received timestamp (call this when data is received)
   */
  public updateLastDataReceived(): void {
    this.lastDataReceived = new Date();
  }
}

// Global debugging function - can be called from console
if (__DEV__) {
  (global as any).testRTKDevice = () => {
    BluetoothManager.getInstance().testCurrentDevice();
  };
  
  (global as any).testDataConnection = () => {
    BluetoothManager.getInstance().testDataConnection();
  };
  
  (global as any).bluetoothManager = BluetoothManager.getInstance();
} 