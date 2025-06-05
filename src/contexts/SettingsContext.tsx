import React, { createContext, useReducer, useContext, ReactNode, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SettingsProps, SettingsContextType, BasemapStyle } from '@/types/settings.types';

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SETTINGS_STORAGE_KEY = '@app_settings';

// Define action types
type SettingsAction = 
  | { type: 'SET_SETTINGS'; payload: SettingsProps }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<SettingsProps> }
  | { type: 'SET_ERROR'; payload: string | null };

// Define initial state
interface SettingsState {
  settings: SettingsProps;
  error: string | null;
  isLoading: boolean;
}

const defaultSettings: SettingsProps = {
  useTimedCollection: true,
  collectionDuration: 2,
  useTilt: false,
  basemapStyle: 'satellite',
  hideCollectionButtonForRTKPro: true,
};

const initialState: SettingsState = {
  settings: defaultSettings,
  error: null,
  isLoading: true
};

// Reducer function
function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case 'SET_SETTINGS':
      return { 
        ...state, 
        settings: action.payload,
        error: null,
        isLoading: false
      };
    case 'UPDATE_SETTINGS':
      return { 
        ...state, 
        settings: {
          ...state.settings,
          ...action.payload
        },
        error: null,
        isLoading: false
      };
    case 'SET_ERROR':
      return { 
        ...state, 
        error: action.payload,
        isLoading: false
      };
    default:
      return state;
  }
}

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(settingsReducer, initialState);

  // Load settings from AsyncStorage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (storedSettings) {
          const parsedSettings = JSON.parse(storedSettings);
          dispatch({ type: 'SET_SETTINGS', payload: parsedSettings });
        } else {
          dispatch({ type: 'SET_SETTINGS', payload: defaultSettings });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load settings' });
        dispatch({ type: 'SET_SETTINGS', payload: defaultSettings });
      }
    };
    loadSettings();
  }, []);

  // Handle settings changes
  const handleSettingsChange = useCallback(async (newSettings: SettingsProps) => {
    try {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
      dispatch({ type: 'SET_SETTINGS', payload: newSettings });
    } catch (error) {
      console.error('Error saving settings:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to save settings' });
    }
  }, []);

  // Update a single setting
  const updateSetting = useCallback(async <K extends keyof SettingsProps>(
    key: K, 
    value: SettingsProps[K]
  ) => {
    try {
      const updatedSettings = {
        ...state.settings,
        [key]: value
      };
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));
      dispatch({ type: 'UPDATE_SETTINGS', payload: { [key]: value } });
    } catch (error) {
      console.error(`Error updating setting ${key}:`, error);
      dispatch({ type: 'SET_ERROR', payload: `Failed to update setting: ${key}` });
    }
  }, [state.settings]);

  return (
    <SettingsContext.Provider
      value={{
        settings: state.settings,
        handleSettingsChange,
        updateSetting,
        error: state.error,
        isLoading: state.isLoading
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettingsContext = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return context;
};
