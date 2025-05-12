import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project } from '@/types/project.types';
import { STORAGE_KEYS } from '@/constants/storage';

/**
 * Service for managing projects in local storage
 * Provides methods for storing and retrieving projects
 */
class ProjectStorageService {
  // In-memory cache to reduce AsyncStorage operations
  private projectsCache: Project[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache TTL

  /**
   * Stores projects in local storage
   * @param projects - The projects to store
   * @returns Promise that resolves when the projects are stored
   */
  async storeProjects(projects: Project[]): Promise<void> {
    console.log('=== ProjectStorageService: storeProjects called ===');
    try {
      if (!Array.isArray(projects)) {
        console.error('Error: projects is not an array', projects);
        throw new Error('Projects must be an array');
      }

      console.log(`Storing ${projects.length} projects in local storage`);
      
      if (projects.length > 0) {
        console.log('Project IDs to store:', projects.map(p => p.id).join(', '));
        console.log('First project sample:', JSON.stringify(projects[0]));
      }
      
      const projectsJson = JSON.stringify(projects);
      console.log(`Projects JSON length: ${projectsJson.length} characters`);
      
      // Validation check - try to parse the data back to ensure it's valid
      try {
        const validateParse = JSON.parse(projectsJson);
        if (!Array.isArray(validateParse)) {
          console.error('Error: Serialized projects did not parse back to an array');
        } else {
          console.log('JSON validation passed');
        }
      } catch (parseError) {
        console.error('Error: Generated JSON failed validation', parseError);
        throw new Error('Failed to generate valid JSON');
      }
      
      console.log(`Storing with key: ${STORAGE_KEYS.PROJECTS}`);
      await AsyncStorage.setItem(
        STORAGE_KEYS.PROJECTS,
        projectsJson
      );
      
      // Verify storage worked
      const verifyJson = await AsyncStorage.getItem(STORAGE_KEYS.PROJECTS);
      if (!verifyJson) {
        console.error('Error: Verification failed - no data found after storage');
      } else {
        console.log(`Verification passed - stored ${verifyJson.length} characters`);
      }
      
      // Update cache
      this.projectsCache = projects;
      this.cacheTimestamp = Date.now();
      
      console.log('Projects stored successfully');
      
      // Debug: Verify storage directly after storing
      await this.debugVerifyStorage();
    } catch (error) {
      console.error('Error storing projects:', error);
      throw error;
    }
  }

  /**
   * Retrieves projects from local storage
   * @returns Promise that resolves with the stored projects
   */
  async getStoredProjects(): Promise<Project[]> {
    console.log('=== ProjectStorageService: getStoredProjects called ===');
    try {
      // Check if cache is valid
      if (this.projectsCache && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL) {
        console.log('Returning cached projects:', this.projectsCache.length);
        if (this.projectsCache.length > 0) {
          console.log('Cached project IDs:', this.projectsCache.map(p => p.id).join(', '));
        }
        return this.projectsCache;
      }

      console.log('Fetching projects from storage with key:', STORAGE_KEYS.PROJECTS);
      const projectsJson = await AsyncStorage.getItem(STORAGE_KEYS.PROJECTS);
      
      if (!projectsJson) {
        console.log('No stored projects found - storage key returned null');
        return [];
      }
      
      console.log('Raw projects JSON from storage:', projectsJson?.substring(0, 100) + '...');
      
      try {
        const projects = JSON.parse(projectsJson) as Project[];
        console.log(`Retrieved ${projects.length} projects from storage`);
        
        if (projects.length > 0) {
          console.log('Project IDs from storage:', projects.map(p => p.id).join(', '));
          console.log('First project details:', JSON.stringify(projects[0]));
        } else {
          console.log('WARNING: Storage contains empty projects array');
        }
        
        // Update cache
        this.projectsCache = projects;
        this.cacheTimestamp = Date.now();
        
        return projects;
      } catch (parseError) {
        console.error('Error parsing stored projects:', parseError);
        console.error('Invalid JSON content:', projectsJson);
        // If JSON is invalid, clear it
        await AsyncStorage.removeItem(STORAGE_KEYS.PROJECTS);
        return [];
      }
    } catch (error) {
      console.error('Error getting stored projects:', error);
      return [];
    }
  }

  /**
   * Clears stored projects
   * @returns Promise that resolves when the projects are cleared
   */
  async clearProjects(): Promise<void> {
    try {
      console.log('Clearing stored projects');
      await AsyncStorage.removeItem(STORAGE_KEYS.PROJECTS);
      this.projectsCache = null;
      console.log('Projects cleared successfully');
    } catch (error) {
      console.error('Error clearing projects:', error);
      throw error;
    }
  }

  /**
   * Checks if the project already exists in storage
   * @param projectId - The ID of the project to check
   * @returns Promise that resolves with boolean indicating if the project exists
   */
  async projectExists(projectId: number): Promise<boolean> {
    const projects = await this.getStoredProjects();
    return projects.some(p => p.id === projectId);
  }

  /**
   * Debug method to verify storage contents directly
   * @returns Promise resolving with the raw storage contents
   */
  async debugVerifyStorage(): Promise<string | null> {
    try {
      console.log('DEBUG: Directly checking storage for projects');
      const rawContent = await AsyncStorage.getItem(STORAGE_KEYS.PROJECTS);
      
      if (!rawContent) {
        console.log('DEBUG: No raw content found in storage');
        return null;
      }
      
      console.log(`DEBUG: Raw storage content length: ${rawContent.length} characters`);
      console.log('DEBUG: Raw storage content preview:', rawContent.substring(0, 200) + '...');
      
      try {
        const parsed = JSON.parse(rawContent);
        console.log('DEBUG: JSON parsed successfully');
        console.log(`DEBUG: Contains ${Array.isArray(parsed) ? parsed.length : 'non-array'} items`);
        return rawContent;
      } catch (error) {
        console.error('DEBUG: Failed to parse JSON from storage', error);
        return rawContent;
      }
    } catch (error) {
      console.error('DEBUG: Error accessing storage directly', error);
      return null;
    }
  }

  /**
   * Debug method to force refresh from storage
   * @returns Promise resolving with projects directly from storage
   */
  async forceRefreshFromStorage(): Promise<Project[]> {
    console.log('DEBUG: Force refreshing projects from storage');
    // Clear cache to force reload
    this.projectsCache = null;
    
    // Verify storage
    await this.debugVerifyStorage();
    
    // Get projects directly from storage
    const projectsJson = await AsyncStorage.getItem(STORAGE_KEYS.PROJECTS);
    if (!projectsJson) {
      console.log('DEBUG: No projects found in storage during force refresh');
      return [];
    }
    
    try {
      const projects = JSON.parse(projectsJson) as Project[];
      console.log(`DEBUG: Force refresh found ${projects.length} projects`);
      
      // Update cache
      this.projectsCache = projects;
      this.cacheTimestamp = Date.now();
      
      return projects;
    } catch (error) {
      console.error('DEBUG: Error parsing projects during force refresh', error);
      return [];
    }
  }

  /**
   * Imports projects from legacy or alternative storage patterns
   * @returns Promise resolving with any imported projects
   */
  async importLegacyProjects(): Promise<Project[]> {
    try {
      console.log('Checking for legacy projects in storage');
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('All storage keys:', allKeys);
      
      // Search for different legacy patterns
      // Pattern 1: @project_ID
      const projectIdKeys = allKeys.filter(key => 
        key.match(/^@project_\d+$/) && 
        !key.includes('_points') && 
        !key.includes('_feature')
      );
      
      // Pattern 2: project_ID (without @ prefix)
      const projectIdKeysNoPrefix = allKeys.filter(key => 
        key.match(/^project_\d+$/) && 
        !key.includes('_points') && 
        !key.includes('_feature')
      );
      
      // Pattern 3: Check if we have individual project entries with different formats
      const otherProjectKeys = allKeys.filter(key => 
        (key.includes('project') || key.includes('Project')) && 
        !key.includes('_points') && 
        !key.includes('_feature') &&
        !key.includes(STORAGE_KEYS.PROJECTS) &&
        !projectIdKeys.includes(key) &&
        !projectIdKeysNoPrefix.includes(key)
      );
      
      const legacyProjectKeys = [
        ...projectIdKeys,
        ...projectIdKeysNoPrefix,
        ...otherProjectKeys
      ];
      
      if (legacyProjectKeys.length === 0) {
        console.log('No legacy project keys found');
        return [];
      }
      
      console.log(`Found ${legacyProjectKeys.length} potential legacy project keys:`, legacyProjectKeys);
      
      const importedProjects: Project[] = [];
      
      // Process each legacy key
      for (const key of legacyProjectKeys) {
        try {
          // Try to extract the project ID from the key
          let projectId: number | null = null;
          const idMatch = key.match(/^@?project_(\d+)$/i);
          
          if (idMatch && idMatch[1]) {
            projectId = parseInt(idMatch[1]);
          }
          
          console.log(`Attempting to import project${projectId ? ` with ID ${projectId}` : ''} from ${key}`);
          
          // Get the project data
          const projectJson = await AsyncStorage.getItem(key);
          if (!projectJson) {
            console.log(`No data found for key ${key}`);
            continue;
          }
          
          console.log(`Raw data for ${key}:`, projectJson);
          
          try {
            const projectData = JSON.parse(projectJson);
            
            // Check if this looks like a valid project
            if (!projectData.id && !projectId) {
              console.log(`Data for ${key} doesn't have an ID and key doesn't contain an ID pattern`);
              
              // If it has a name property, we can try to create a project with a generated ID
              if (projectData.name || projectData.title) {
                console.log(`Data has a name "${projectData.name || projectData.title}", will attempt to create a project`);
                // Generate a unique ID (negative to avoid conflicts with real IDs)
                projectId = -Math.floor(Math.random() * 10000);
              } else {
                console.log(`Data doesn't look like a valid project:`, projectData);
                continue;
              }
            }
            
            // Create a project object using the data or defaults
            const project: Project = {
              id: projectData.id || projectId || -1, // Fallback to -1 for invalid IDs
              name: projectData.name || projectData.title || `Project ${projectId || 'Unknown'}`,
              client_name: projectData.client_name || projectData.client || 'Unknown Client',
              address: projectData.address || projectData.location || 'Unknown Location',
              coords: this.extractCoordinates(projectData),
              work_type: projectData.work_type || projectData.workType || projectData.type || 'Unknown'
            };
            
            console.log(`Successfully imported project from ${key}:`, project);
            importedProjects.push(project);
          } catch (parseError) {
            console.error(`Error parsing data from ${key}:`, parseError);
            // Try to recover by checking if it's a string that needs double parsing
            try {
              const doubleParseData = JSON.parse(JSON.parse(projectJson));
              if (doubleParseData && (doubleParseData.id || projectId)) {
                console.log(`Recovered project data through double parsing for ${key}`);
                const project: Project = {
                  id: doubleParseData.id || projectId || -1,
                  name: doubleParseData.name || doubleParseData.title || `Project ${projectId || 'Unknown'}`,
                  client_name: doubleParseData.client_name || doubleParseData.client || 'Unknown Client',
                  address: doubleParseData.address || doubleParseData.location || 'Unknown Location',
                  coords: this.extractCoordinates(doubleParseData),
                  work_type: doubleParseData.work_type || doubleParseData.workType || doubleParseData.type || 'Unknown'
                };
                console.log(`Successfully recovered project from ${key}:`, project);
                importedProjects.push(project);
              }
            } catch (doubleParseError) {
              console.error(`Failed recovery attempt for ${key}:`, doubleParseError);
            }
          }
        } catch (keyError) {
          console.error(`Error processing legacy key ${key}:`, keyError);
        }
      }
      
      if (importedProjects.length > 0) {
        console.log(`Successfully imported ${importedProjects.length} legacy projects`);
        
        // Add these to the normal projects storage
        const existingProjects = await this.getStoredProjects();
        
        // Don't add duplicates
        const newProjects = importedProjects.filter(newProj => 
          !existingProjects.some(existingProj => existingProj.id === newProj.id)
        );
        
        if (newProjects.length > 0) {
          const combinedProjects = [...existingProjects, ...newProjects];
          await this.storeProjects(combinedProjects);
          console.log(`Added ${newProjects.length} imported projects to storage`);
        } else {
          console.log('All imported projects already exist in storage');
        }
        
        // Also check for existing projects in legacy format that aren't in main storage
        const missingProjects = existingProjects.filter(existingProj => 
          !importedProjects.some(importedProj => importedProj.id === existingProj.id)
        );
        
        if (missingProjects.length > 0) {
          console.log(`Found ${missingProjects.length} projects in main storage not found in legacy format`);
        }
      }
      
      return importedProjects;
    } catch (error) {
      console.error('Error importing legacy projects:', error);
      return [];
    }
  }
  
  /**
   * Helper method to extract coordinates from project data
   * @param projectData - The project data object
   * @returns Array of coordinates [lat, lng]
   */
  private extractCoordinates(projectData: any): [number, number] {
    try {
      // Try different possible formats
      if (Array.isArray(projectData.coords) && projectData.coords.length >= 2) {
        return [Number(projectData.coords[0]), Number(projectData.coords[1])];
      }
      
      if (typeof projectData.coords === 'object' && projectData.coords !== null) {
        // Could be {lat, lng} or {latitude, longitude} format
        const lat = projectData.coords.lat || projectData.coords.latitude || 0;
        const lng = projectData.coords.lng || projectData.coords.longitude || 0;
        return [Number(lat), Number(lng)];
      }
      
      // Try other possible properties
      if (Array.isArray(projectData.coordinates) && projectData.coordinates.length >= 2) {
        return [Number(projectData.coordinates[0]), Number(projectData.coordinates[1])];
      }
      
      if (typeof projectData.coordinates === 'object' && projectData.coordinates !== null) {
        const lat = projectData.coordinates.lat || projectData.coordinates.latitude || 0;
        const lng = projectData.coordinates.lng || projectData.coordinates.longitude || 0;
        return [Number(lat), Number(lng)];
      }
      
      // If latitude/longitude are direct properties
      if (projectData.latitude !== undefined && projectData.longitude !== undefined) {
        return [Number(projectData.latitude), Number(projectData.longitude)];
      }
      
      if (projectData.lat !== undefined && projectData.lng !== undefined) {
        return [Number(projectData.lat), Number(projectData.lng)];
      }
      
      // Default to [0,0] if nothing found
      return [0, 0];
    } catch (error) {
      console.error('Error extracting coordinates:', error);
      return [0, 0];
    }
  }

  /**
   * Debug method to check all storage keys and their content summaries
   * Helps diagnose issues with storage and project formats
   */
  async debugStorageContents(): Promise<void> {
    try {
      console.log('=== DEBUG: Examining AsyncStorage contents ===');
      const allKeys = await AsyncStorage.getAllKeys();
      console.log(`Found ${allKeys.length} total keys in AsyncStorage`);
      
      // Get the string value of the projects key for comparison
      const projectsKey = String(STORAGE_KEYS.PROJECTS);
      
      // Group keys by patterns
      const projectKeys = allKeys.filter(k => k === projectsKey);
      const legacyProjectKeys = allKeys.filter(k => k.match(/^@?project_\d+$/));
      const projectRelatedKeys = allKeys.filter(k => 
        k.includes('project') && 
        k !== projectsKey && 
        !legacyProjectKeys.includes(k)
      );
      const otherKeys = allKeys.filter(k => 
        !projectKeys.includes(k) && 
        !legacyProjectKeys.includes(k) && 
        !projectRelatedKeys.includes(k)
      );
      
      // Log structured key summary
      console.log('--- Key groups ---');
      console.log(`Main project store keys (${projectKeys.length}): ${projectKeys.join(', ')}`);
      console.log(`Legacy project keys (${legacyProjectKeys.length}): ${legacyProjectKeys.join(', ')}`);
      console.log(`Project-related keys (${projectRelatedKeys.length}): ${projectRelatedKeys.join(', ')}`);
      console.log(`Other keys (${otherKeys.length}): ${otherKeys.join(', ')}`);
      
      // Examine main projects storage
      if (projectKeys.length > 0) {
        for (const key of projectKeys) {
          try {
            const data = await AsyncStorage.getItem(key);
            if (data) {
              console.log(`Contents of ${key} (${data.length} chars):`);
              try {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                  console.log(`Contains array with ${parsed.length} items`);
                  if (parsed.length > 0) {
                    console.log('Item IDs:', parsed.map((p: any) => p.id).join(', '));
                    console.log('First item sample:', JSON.stringify(parsed[0]));
                  }
                } else {
                  console.log('Not an array, data type:', typeof parsed);
                  console.log('Data preview:', JSON.stringify(parsed).substring(0, 200));
                }
              } catch (parseError) {
                console.log('Failed to parse JSON:', parseError);
                console.log('Raw data preview:', data.substring(0, 200));
              }
            } else {
              console.log(`No data found for key ${key}`);
            }
          } catch (keyError) {
            console.error(`Error examining key ${key}:`, keyError);
          }
        }
      }
      
      // Examine a sample of legacy project keys
      const sampleSize = Math.min(legacyProjectKeys.length, 3);
      if (sampleSize > 0) {
        console.log(`--- Examining ${sampleSize} sample legacy project keys ---`);
        for (let i = 0; i < sampleSize; i++) {
          const key = legacyProjectKeys[i];
          try {
            const data = await AsyncStorage.getItem(key);
            if (data) {
              console.log(`Contents of ${key} (${data.length} chars):`);
              console.log('Raw data preview:', data.substring(0, 200));
              try {
                const parsed = JSON.parse(data);
                console.log('Parsed preview:', JSON.stringify(parsed).substring(0, 200));
              } catch (parseError) {
                console.log('Failed to parse JSON:', parseError);
              }
            } else {
              console.log(`No data found for key ${key}`);
            }
          } catch (keyError) {
            console.error(`Error examining key ${key}:`, keyError);
          }
        }
      }
      
      console.log('=== DEBUG: Storage examination complete ===');
    } catch (error) {
      console.error('Error debugging storage contents:', error);
    }
  }
}

export const projectStorageService = new ProjectStorageService(); 