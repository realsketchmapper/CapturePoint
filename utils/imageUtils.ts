import { Image } from 'react-native';

// This utility function can be used to check if an image URL is valid
export const validateImageURL = (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }

    Image.getSize(
      url,
      () => {
        // Image exists and size was determined
        resolve(true);
      },
      () => {
        // Error loading image
        resolve(false);
      }
    );
  });
};

// Default image URL to use as fallback
export const DEFAULT_FEATURE_IMAGE = 'https://your-app-domain.com/default-feature.png';

// Function to get a valid image URL or fallback
export const getImageSource = (imageUrl?: string, svg?: string) => {
  if (imageUrl) {
    return { uri: imageUrl };
  }
  
  // If you want to use a default image when neither PNG nor SVG is available
  return require('@/assets/images/default-feature.png');
};