import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { useContext, useState, useEffect } from "react";
import { BluetoothProvider } from '@/contexts/BluetoothContext';
import { AuthProvider, AuthContext } from "@/contexts/AuthContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { FeatureTypeProvider } from "@/contexts/FeatureTypeContext";
import { NMEAProvider } from "@/contexts/NMEAContext";
import { RTKProProvider } from "@/contexts/RTKProContext";
import { CollectionProvider } from "@/contexts/CollectionContext";
import { MapProvider } from "@/contexts/MapDisplayContext";
import { LocationProvider } from "@/contexts/LocationContext";

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
    'RobotoSlab_Bold': require('@/assets/fonts/RobotoSlab-Bold.ttf'),
    'RobotoSlab-Medium': require('@/assets/fonts/RobotoSlab-Medium.ttf'),
    'RobotoSlab-Regular': require('@/assets/fonts/RobotoSlab-Regular.ttf'),
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
    authContext?.user?.id, 
    authContext?.isInitialized, 
    authContext?.user?.isOffline
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
          <FeatureTypeProvider>
            <MapProvider>
              <NMEAProvider>
                <RTKProProvider>
                  <LocationProvider>
                    <CollectionProvider>
                      <BluetoothProvider>
                        {children}
                      </BluetoothProvider>
                    </CollectionProvider>
                  </LocationProvider>
                </RTKProProvider>
              </NMEAProvider>
            </MapProvider>
          </FeatureTypeProvider>
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