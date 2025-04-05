import React, { useEffect } from 'react';
import { StyleSheet, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';

const Splash: React.FC = () => {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("./login");
    }, 2000); // Adjust the delay as needed

    return () => clearTimeout(timer);
  }, []);

  return (
    <ImageBackground
      source={require('@/assets/images/GCP_CastleHayne.png')}
      style={styles.container}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    resizeMode: 'cover',
  },
});

export default Splash; 