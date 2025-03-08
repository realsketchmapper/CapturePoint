import React, { useState, useEffect } from 'react';
import { View, Text, Button, FlatList, StyleSheet, Image } from 'react-native';
import { useFeatureContext } from '@/FeatureContext';

type ImageStatus = {
  url: string;
  status: 'loading' | 'success' | 'error';
  error?: string;
};

export const ImageURLTester: React.FC = () => {
  const { features } = useFeatureContext();
  const [imageStatuses, setImageStatuses] = useState<ImageStatus[]>([]);
  
  useEffect(() => {
    // Get unique image URLs from features
    const urls = features
      .filter(f => f.image_url)
      .map(f => f.image_url as string)
      .filter((url, index, self) => self.indexOf(url) === index);
    
    // Initialize statuses
    setImageStatuses(urls.map(url => ({ url, status: 'loading' })));
    
    // Test each URL
    urls.forEach(url => {
      Image.getSize(
        url,
        () => {
          setImageStatuses(prev => 
            prev.map(s => s.url === url ? { ...s, status: 'success' } : s)
          );
        },
        (error) => {
          setImageStatuses(prev => 
            prev.map(s => s.url === url ? { ...s, status: 'error', error: String(error) } : s)
          );
        }
      );
    });
  }, [features]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Image URL Tester</Text>
      <Text>Testing {imageStatuses.length} unique image URLs</Text>
      
      <View style={styles.stats}>
        <Text>Success: {imageStatuses.filter(s => s.status === 'success').length}</Text>
        <Text>Error: {imageStatuses.filter(s => s.status === 'error').length}</Text>
        <Text>Loading: {imageStatuses.filter(s => s.status === 'loading').length}</Text>
      </View>
      
      <FlatList
        data={imageStatuses}
        keyExtractor={item => item.url}
        renderItem={({ item }) => (
          <View style={styles.urlItem}>
            <Text style={styles.url} numberOfLines={1} ellipsizeMode="middle">{item.url}</Text>
            <Text style={[
              styles.status,
              item.status === 'success' ? styles.success :
              item.status === 'error' ? styles.error :
              styles.loading
            ]}>
              {item.status}
            </Text>
            {item.status === 'error' && (
              <Text style={styles.errorText}>{item.error}</Text>
            )}
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  urlItem: {
    marginVertical: 5,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
  },
  url: {
    fontSize: 12,
  },
  status: {
    fontWeight: 'bold',
    marginTop: 5,
  },
  success: {
    color: 'green',
  },
  error: {
    color: 'red',
  },
  loading: {
    color: 'blue',
  },
  errorText: {
    fontSize: 10,
    color: 'red',
    marginTop: 5,
  },
});