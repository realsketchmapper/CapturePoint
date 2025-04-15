import AsyncStorage from '@react-native-async-storage/async-storage';
import { PointCollected } from '@/types/pointCollected.types';
import { LineCollected } from '@/types/lineCollected.types';
import { STORAGE_KEYS } from '@/constants/storage';

interface ProjectData {
  points: PointCollected[];
  lines: LineCollected[];
  lastSync: string;
  isActive: boolean;
}

class ProjectStorageService {
  private readonly PROJECT_PREFIX = '@project_';
  private readonly ACTIVE_PROJECTS_KEY = '@active_projects';

  /**
   * Gets the storage key for a project
   */
  private getProjectKey(projectId: string): string {
    return `${this.PROJECT_PREFIX}${projectId}`;
  }

  /**
   * Saves project data to storage
   */
  async saveProjectData(projectId: string, data: ProjectData): Promise<void> {
    const key = this.getProjectKey(projectId);
    await AsyncStorage.setItem(key, JSON.stringify(data));
  }

  /**
   * Gets project data from storage
   */
  async getProjectData(projectId: string): Promise<ProjectData | null> {
    const key = this.getProjectKey(projectId);
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Deletes project data from storage
   */
  async deleteProjectData(projectId: string): Promise<void> {
    const key = this.getProjectKey(projectId);
    await AsyncStorage.removeItem(key);
  }

  /**
   * Updates project's active status
   */
  async updateProjectStatus(projectId: string, isActive: boolean): Promise<void> {
    const data = await this.getProjectData(projectId);
    if (data) {
      data.isActive = isActive;
      await this.saveProjectData(projectId, data);
    }
  }

  /**
   * Gets all active project IDs
   */
  async getActiveProjectIds(): Promise<string[]> {
    const activeProjects = await AsyncStorage.getItem(this.ACTIVE_PROJECTS_KEY);
    return activeProjects ? JSON.parse(activeProjects) : [];
  }

  /**
   * Updates active project IDs
   */
  async updateActiveProjectIds(projectIds: string[]): Promise<void> {
    await AsyncStorage.setItem(this.ACTIVE_PROJECTS_KEY, JSON.stringify(projectIds));
  }

  /**
   * Cleans up inactive project data
   */
  async cleanupInactiveProjects(): Promise<void> {
    const activeProjectIds = await this.getActiveProjectIds();
    const allKeys = await AsyncStorage.getAllKeys();
    const projectKeys = allKeys.filter(key => key.startsWith(this.PROJECT_PREFIX));

    for (const key of projectKeys) {
      const projectId = key.replace(this.PROJECT_PREFIX, '');
      if (!activeProjectIds.includes(projectId)) {
        await this.deleteProjectData(projectId);
      }
    }
  }
}

export const projectStorageService = new ProjectStorageService(); 