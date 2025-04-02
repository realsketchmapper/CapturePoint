import React, { createContext, useContext, useState, useEffect } from 'react';
import { ProjectDistanceWarningModal } from '@/components/modals/ProjectModals/ProjectDistanceWarningModal';

interface ModalContextType {
  showProjectWarningModal: (props: ProjectWarningModalProps) => void;
  hideProjectWarningModal: () => void;
}

interface ProjectWarningModalProps {
  distance: number;
  projectName: string;
  projectAddress: string;
  onCancel: () => void;
  onContinue: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isWarningModalVisible, setIsWarningModalVisible] = useState(false);
  const [warningModalProps, setWarningModalProps] = useState<ProjectWarningModalProps | null>(null);

  const showProjectWarningModal = (props: ProjectWarningModalProps) => {
    console.log('ModalContext: Showing project warning modal');
    console.log('ModalContext: Modal props:', props);
    setWarningModalProps(props);
    setIsWarningModalVisible(true);
  };

  const hideProjectWarningModal = () => {
    console.log('ModalContext: Hiding project warning modal');
    setIsWarningModalVisible(false);
    setWarningModalProps(null);
  };

  // Add effect to track state changes
  useEffect(() => {
    console.log('ModalContext: Warning modal visibility:', isWarningModalVisible);
    console.log('ModalContext: Warning modal props:', warningModalProps);
  }, [isWarningModalVisible, warningModalProps]);

  return (
    <ModalContext.Provider
      value={{
        showProjectWarningModal,
        hideProjectWarningModal,
      }}
    >
      {children}

      {warningModalProps && (
        <ProjectDistanceWarningModal
          isVisible={isWarningModalVisible}
          onCancel={() => {
            console.log('ModalContext: Cancel callback triggered');
            hideProjectWarningModal();
            warningModalProps.onCancel();
          }}
          onContinue={() => {
            console.log('ModalContext: Continue callback triggered');
            hideProjectWarningModal();
            warningModalProps.onContinue();
          }}
          distance={warningModalProps.distance}
          projectName={warningModalProps.projectName}
          projectAddress={warningModalProps.projectAddress}
        />
      )}
    </ModalContext.Provider>
  );
}; 