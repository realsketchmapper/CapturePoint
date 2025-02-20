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
import { LinePreviewProvider } from "@/components/map/LinePreview";

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
      <LinePreviewProvider>
      <FeatureProvider>
        <CollectionProvider>
          <SettingsProvider>
            <ProjectProvider>
              <AuthProvider>
                <NMEAProvider>
                  <BluetoothProvider>
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen 
                        name="SplashScreen" 
                        options={{ 
                          presentation: 'fullScreenModal',
                        }} 
                      />
                      <Stack.Screen name="login" />
                      <Stack.Screen name="projectview" />
                      <Stack.Screen name="mapview" />
                    </Stack>
                  </BluetoothProvider>
                </NMEAProvider>
              </AuthProvider>
            </ProjectProvider>
          </SettingsProvider>
        </CollectionProvider>
      </FeatureProvider>
      </LinePreviewProvider>
    </MapProvider>
  );
}