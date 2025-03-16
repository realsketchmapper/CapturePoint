// src/components/ProjectNameDisplay.tsx
import React, { useState } from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useProjectContext } from '@/contexts/ProjectContext';
import { ProjectDetailsModal } from '@/components/modals/ProjectModals/ProjectDetailsModal';

export const ProjectNameDisplay: React.FC<{ style?: any }> = ({ style }) => {
  const { activeProject } = useProjectContext();
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handlePress = () => {
    if (activeProject) {
      setIsModalVisible(true);
    }
  };

  return (
    <>
      <TouchableOpacity 
        style={[styles.button, style]} 
        onPress={handlePress}
        disabled={!activeProject}
      >
        <Text style={styles.text}>
          {activeProject ? `WO: ${activeProject.name}` : 'No Project Selected'}
        </Text>
      </TouchableOpacity>

      <ProjectDetailsModal
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        project={activeProject}
      />
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 8,
  },
  text: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
});