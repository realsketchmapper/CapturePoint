import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { useContext, useState, useEffect } from "react";
import { BluetoothProvider } from '@/src/contexts/BluetoothContext';
import { AuthProvider, AuthContext } from "@/src/contexts/AuthContext";
import { ProjectProvider } from "@/src/contexts/ProjectContext";
import { SettingsProvider } from "@/src/contexts/SettingsContext";
import { FeatureProvider } from "@/src/contexts/FeatureContext";
import { NMEAProvider } from "@/src/contexts/NMEAContext";
import { CollectionProvider } from "@/src/contexts/CollectionContext";
import { MapProvider } from "@/src/contexts/MapDisplayContext";
import { LocationProvider } from "@/src/contexts/LocationContext";
import AppInitializer from "@/src/components/sync/AppInitializer";

// Types
interface AuthStateObserverProps {
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAuthReady: React.Dispatch<React.SetStateAction<boolean>>;
}

interface AppProvidersProps {
  children: React.ReactNode;
  isLoggedIn: boolean;
  isAuthReady: boolean;
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAuthReady: React.Dispatch<React.SetStateAction<boolean>>;
}

// Custom hook for font loading
const useAppFonts = () => {
  const [fontsLoaded, fontError] = useFonts({
    'RobotoSlab_Bold': require('@/src/assets/fonts/RobotoSlab-Bold.ttf'),
    'RobotoSlab-Medium': require('@/src/assets/fonts/RobotoSlab-Medium.ttf'),
    'RobotoSlab-Regular': require('@/src/assets/fonts/RobotoSlab-Regular.ttf'),
  });

  return { fontsLoaded, fontError };
};

// Auth state observer component
const AuthStateObserver: React.FC<AuthStateObserverProps> = ({ setIsLoggedIn, setIsAuthReady }) => {
  const authContext = useContext(AuthContext);
  
  useEffect(() => {
    if (!authContext) return;
    
    const isFullyLoggedIn = !!authContext.user?.id && 
                           authContext.isInitialized && 
                           (!authContext.user?.isOffline);
    
    setIsLoggedIn(isFullyLoggedIn);
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
};

// App providers component
const AppProviders: React.FC<AppProvidersProps> = ({ 
  children, 
  isLoggedIn, 
  isAuthReady,
  setIsLoggedIn,
  setIsAuthReady 
}) => {
  return (
    <AuthProvider>
      <AuthStateObserver 
        setIsLoggedIn={setIsLoggedIn} 
        setIsAuthReady={setIsAuthReady} 
      />
      <ProjectProvider>
        <SettingsProvider>
          <MapProvider>
            <FeatureProvider>
              <NMEAProvider>
                <LocationProvider>
                  <CollectionProvider>
                    {isLoggedIn && isAuthReady && <AppInitializer />}
                    <BluetoothProvider>
                      {children}
                    </BluetoothProvider>
                  </CollectionProvider>
                </LocationProvider>
              </NMEAProvider>
            </FeatureProvider>
          </MapProvider>
        </SettingsProvider>
      </ProjectProvider>
    </AuthProvider>
  );
};

export default function RootLayout() {
  const { fontsLoaded, fontError } = useAppFonts();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  if (fontError) {
    console.error('Error loading fonts:', fontError);
    // You might want to show an error screen here
    return null;
  }

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AppProviders 
      isLoggedIn={isLoggedIn} 
      isAuthReady={isAuthReady}
      setIsLoggedIn={setIsLoggedIn}
      setIsAuthReady={setIsAuthReady}
    >
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
} 