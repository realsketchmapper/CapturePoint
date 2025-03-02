import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { BluetoothProvider } from '@/contexts/BluetoothContext';
import { AuthProvider } from "@/contexts/AuthContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { FeatureProvider } from "@/contexts/FeatureContext";
import { NMEAProvider } from "@/contexts/NMEAContext";
import { CollectionProvider } from "@/contexts/CollectionContext";
import { MapProvider } from "@/contexts/MapDisplayContext";
import { LocationProvider } from "@/contexts/LocationContext";
import CameraProvider from "@/contexts/CameraContext";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'RobotoSlab_Bold': require('../assets/fonts/RobotoSlab-Bold.ttf'),
    'RobotoSlab-Medium': require('../assets/fonts/RobotoSlab-Medium.ttf'),
    'RobotoSlab-Regular': require('../assets/fonts/RobotoSlab-Regular.ttf'),
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <MapProvider>
      <CameraProvider>
          <FeatureProvider>
            <NMEAProvider>
            <LocationProvider>
            <CollectionProvider>
              <SettingsProvider>
                <ProjectProvider>
                  <AuthProvider>

                    
                      <BluetoothProvider>
                        
                          <Stack screenOptions={{ headerShown: false }}>
                            {/* ... Stack screens ... */}
                          </Stack>
                        
                      </BluetoothProvider>
                    
                  </AuthProvider>
                </ProjectProvider>
              </SettingsProvider>
            </CollectionProvider>
            </LocationProvider>
            </NMEAProvider>
          </FeatureProvider>
      </CameraProvider>
    </MapProvider>
  );
}