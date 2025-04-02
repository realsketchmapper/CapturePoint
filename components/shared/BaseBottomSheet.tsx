import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { Colors } from '@/theme/colors';

interface BaseBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  snapPoints?: string[];
  showHeader?: boolean;
}

export const BaseBottomSheet: React.FC<BaseBottomSheetProps> = ({
  isVisible,
  onClose,
  children,
  title,
  snapPoints: customSnapPoints,
  showHeader = true,
}) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => customSnapPoints || ['50%', '90%'], [customSnapPoints]);

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isVisible) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.indicator}
    >
      <View style={styles.contentContainer}>
        {showHeader && (
          <View style={styles.header}>
            {title && <Text style={styles.title}>{title}</Text>}
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
        {children}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  background: {
    backgroundColor: Colors.DarkBlue,
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  title: {
    fontSize: 20,
    fontFamily: 'RobotoSlab-Bold',
    color: 'white',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'RobotoSlab-Regular',
  },
  indicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
}); 