import React, { useCallback } from 'react';
import { View, FlatList, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { ProjectListItem } from './ProjectListItem';
import { ProjectsHeader } from './ProjectsHeader';
import { ProjectListProps } from '@/types/project.types';
import { Colors } from '@/theme/colors';

const ProjectListComponent: React.FC<ProjectListProps> = ({
  projects,
  onProjectPress,
  onRefresh,
  loading,
}) => {
  // Memoize the keyExtractor
  const keyExtractor = useCallback((item: any) => item.id.toString(), []);

  // Memoize the renderItem function
  const renderItem = useCallback(({ item }) => (
    <ProjectListItem
      project={item}
      onPress={onProjectPress}
    />
  ), [onProjectPress]);

  if (loading && !projects.length) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="white" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ProjectsHeader onRefresh={onRefresh} loading={loading} />
      <FlatList
        data={projects}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={onRefresh}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={5}
        getItemLayout={(data, index) => ({
          length: 80, // Approximate height of each item
          offset: 80 * index,
          index,
        })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.DarkBlue,
  },
  listContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.DarkBlue,
  },
  loadingText: {
    color: 'white',
    marginTop: 12,
    fontSize: 16,
  },
});

export const ProjectList = React.memo(ProjectListComponent, (prevProps, nextProps) => {
  if (prevProps.loading !== nextProps.loading) return false;
  if (prevProps.onProjectPress !== nextProps.onProjectPress) return false;
  if (prevProps.onRefresh !== nextProps.onRefresh) return false;
  if (prevProps.projects.length !== nextProps.projects.length) return false;
  
  // Deep compare projects only if lengths are equal
  return prevProps.projects.every((project, index) => {
    const nextProject = nextProps.projects[index];
    return (
      project.id === nextProject.id &&
      project.name === nextProject.name &&
      project.client_name === nextProject.client_name &&
      project.work_type === nextProject.work_type
    );
  });
});