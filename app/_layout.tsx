import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { useContext, useState, useEffect } from "react";
import { BluetoothProvider } from '@/contexts/BluetoothContext';
import { AuthProvider, AuthContext } from "@/contexts/AuthContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { FeatureTypeProvider } from "@/contexts/FeatureTypeContext";
import { NMEAProvider } from "@/contexts/NMEAContext";
import { CollectionProvider } from "@/contexts/CollectionContext";
import { MapProvider } from "@/contexts/MapDisplayContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { FeatureDataProvider } from "@/contexts/FeatureDataContext";
import { ModalProvider } from '@/contexts/ModalContext';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'RobotoSlab_Bold': require('../assets/fonts/RobotoSlab-Bold.ttf'),
    'RobotoSlab-Medium': require('../assets/fonts/RobotoSlab-Medium.ttf'),
    'RobotoSlab-Regular': require('../assets/fonts/RobotoSlab-Regular.ttf'),
  });

  // Track authentication state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <AuthStateObserver 
        setIsLoggedIn={setIsLoggedIn} 
        setIsAuthReady={setIsAuthReady} 
      />
      
      {/* Nest providers after AuthProvider to ensure auth state is available */}
      <ProjectProvider>
        <SettingsProvider>
          <FeatureTypeProvider>
            <FeatureDataProvider>
              <MapProvider>
                <NMEAProvider>
                  <LocationProvider>
                    <CollectionProvider>
                      <BluetoothProvider>
                        <ModalProvider>
                          <Stack screenOptions={{ headerShown: false }}>
                            {/* ... Stack screens ... */}
                          </Stack>
                        </ModalProvider>
                      </BluetoothProvider>
                    </CollectionProvider>
                  </LocationProvider>
                </NMEAProvider>
              </MapProvider>
            </FeatureDataProvider>
          </FeatureTypeProvider>
        </SettingsProvider>
      </ProjectProvider>
    </AuthProvider>
  );
}

// Define props interface for AuthStateObserver
interface AuthStateObserverProps {
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAuthReady: React.Dispatch<React.SetStateAction<boolean>>;
}

// Helper component to observe auth state changes
function AuthStateObserver({ setIsLoggedIn, setIsAuthReady }: AuthStateObserverProps) {
  const authContext = useContext(AuthContext);
  
  useEffect(() => {
    if (!authContext) return;
    
    // Only consider logged in if:
    // 1. We have a valid user with an ID
    // 2. Auth is fully initialized
    // 3. If offline mode, special handling
    const isFullyLoggedIn = !!authContext.user?.id && 
                           authContext.isInitialized && 
                           (!authContext.user?.isOffline);
    
    setIsLoggedIn(isFullyLoggedIn);
    
    // Mark auth as ready once initialization is complete
    setIsAuthReady(authContext.isInitialized);
    
    console.log(`Auth state updated: loggedIn=${isFullyLoggedIn}, isOffline=${authContext.user?.isOffline}, isInitialized=${authContext.isInitialized}`);
  }, [
    authContext, 
    authContext?.user?.id, 
    authContext?.isInitialized, 
    authContext?.user?.isOffline, 
    setIsLoggedIn, 
    setIsAuthReady
  ]);
  
  return null;
}