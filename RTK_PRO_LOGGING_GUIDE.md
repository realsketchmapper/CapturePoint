# RTK-Pro Bluetooth Data Logging Guide

## Overview

I've implemented a comprehensive Bluetooth data logging system specifically for RTK-Pro devices to help you capture and analyze the NMEA data and button press events. This will allow you to understand what data is transmitted when you press the button on the RTK-Pro device.

## Features Added

### 1. Bluetooth Data Logger Service (`src/services/logging/bluetoothDataLogger.ts`)
- **Automatic Logging**: Starts logging automatically when you connect to an RTK-Pro device
- **Data Classification**: Categorizes data as 'raw', 'nmea', or 'event'
- **Button Event Detection**: Uses heuristic patterns to identify potential button press events
- **Session Management**: Tracks logging sessions with timestamps and device info
- **Export Functionality**: Export logs to JSON files for analysis

### 2. Enhanced Bluetooth Manager (`src/services/bluetooth/bluetoothManager.ts`)
- **Device-Specific Logging**: Only logs data for RTK-Pro devices (namePrefix: 'vLoc3-RTK-Pro')
- **Automatic Start/Stop**: Logging starts when RTK-Pro connects, stops when disconnects
- **Data Type Detection**: Automatically classifies incoming data

### 3. Data Log Viewer Modal (`src/components/modals/BluetoothDataLogModal.tsx`)
- **Session List**: View all logging sessions
- **Log Details**: See individual data entries with timestamps
- **Button Events**: Filter to see only potential button press events
- **Export**: Share log files for analysis

## How to Use

### Step 1: Connect RTK-Pro Device
1. Open the app and tap the Bluetooth button
2. Select "RTK-PRO" from the device type list
3. Choose your RTK-Pro device (device name will be like "vLoc3-RTK-Pro_12345")
4. **Logging will start automatically** when connected

### Step 2: Capture Button Press Data
1. With the RTK-Pro connected, you'll see a red banner indicating logging is active
2. Press the button on your RTK-Pro device multiple times
3. The system will log all Bluetooth data during this time
4. The heuristic system will try to identify potential button events

### Step 3: Analyze the Data
1. Go to **Settings** → **Bluetooth Data Logging** → **View Data Logs**
2. Select your logging session
3. Review the captured data:
   - **All Logs**: See every data packet received
   - **Button Events**: See data flagged as potential button presses
4. Look for patterns that occur when you press the button

### Step 4: Export and Share Data
1. In the data log viewer, tap **Export Session**
2. Share the JSON file containing all the captured data
3. Send this file so we can analyze the exact NMEA patterns

## What to Look For

When you press the button on the RTK-Pro, we expect to see:

### Potential Patterns:
- **Special NMEA sentences** (e.g., `$PGRME`, `$PGRMF`, `$PGRMT`)
- **Event markers** containing words like "EVENT", "MARK", "POINT", "COLLECT"
- **Timestamp changes** or **data bursts** when button is pressed
- **Binary data** or **non-NMEA messages**

### Data Classification:
- **NMEA**: Standard NMEA sentences starting with `$`
- **EVENT**: Data containing event-related keywords
- **RAW**: Other data that doesn't fit standard patterns

## Current Heuristic Patterns

The system currently looks for these patterns to identify button events:
```
- 'EVENT', 'BUTTON', 'MARK', 'POINT', 'COLLECT', 'TRIGGER'
- '$PGRME' (some devices send this on button press)
- '$PGRMF' (another potential event sentence)
- 'PGRMT' (Trimble specific event messages)
```

## Configuration

The RTK-Pro device is configured with:
- **Device Type**: RTK-PRO
- **Name Pattern**: 'vLoc3-RTK-Pro' (devices like "vLoc3-RTK-Pro_12345" will be detected)
- **GNSS Height**: 2.52 feet
- **Auto-logging**: Enabled for this device type only

## Next Steps

1. **Connect your RTK-Pro device** and verify logging starts
2. **Press the button multiple times** while connected
3. **Export the session data** and share it for analysis
4. Once we identify the button press pattern, I can:
   - Add automatic point collection when button is pressed
   - Improve the heuristic detection
   - Add device-specific handling for RTK-Pro

## Troubleshooting

### No Logging Session Created
- Ensure your device name starts with "vLoc3-RTK-Pro" (like "vLoc3-RTK-Pro_12345")
- Check that you selected "RTK-PRO" as the device type
- Verify the device is actually connected (should see in app status)

### No Button Events Detected
- This is expected initially - we're still learning the patterns
- All data is still captured in the "All Logs" section
- Export and share the data for pattern analysis

### Can't Find Data Log Modal
- Go to Settings (gear icon in top right)
- Look for "Bluetooth Data Logging" section
- Tap "View Data Logs"

## Technical Details

The logging system:
- **Stores 500 entries** in memory for fast access
- **Flushes data every 5 seconds** to prevent data loss
- **Retains logs for 7 days** automatically
- **Exports in JSON format** with full metadata
- **Runs in background** without affecting normal operation

This system gives us the foundation to understand exactly what your RTK-Pro device sends when you press the button, so we can implement automatic point collection based on those signals. 