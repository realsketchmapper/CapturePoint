import React from 'react';
import { View, FlatList, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { ProjectListItem } from './ProjectListItem';
import { ProjectsHeader } from './ProjectsHeader';
import { ProjectListProps } from '@/types/project.types';

export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  onProjectPress,
  onRefresh,
  loading,
}) => {
  if (loading && !projects.length) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007BFF" />
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ProjectsHeader onRefresh={onRefresh} loading={loading} />
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ProjectListItem
            project={item}
            onPress={onProjectPress}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={onRefresh}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  listContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
});