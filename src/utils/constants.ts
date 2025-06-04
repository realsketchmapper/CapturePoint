import { DeviceTypeOption } from "../types/bluetooth.types";

// bluetooth devices we can select from
export const BLUETOOTH_DEVICE_TYPES: DeviceTypeOption[] = [
    { id: '1', name: 'RTK-PRO', namePrefix: 'vLoc3-RTK-Pro', gnssHeight: 2.52 }, // gnssHeight in feet
    { id: '2', name: 'STONEX', namePrefix: 'S', gnssHeight: 6.562},
    { id: '3', name: 'EMLID', namePrefix: 'E', gnssHeight: 6.562},
  ];
