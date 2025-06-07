import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LoadingSpinner } from './LoadingSpinner';
import { LoadingPopupProps, MotivationalMessage } from '../../types/loading.types';

const { width, height } = Dimensions.get('window');

const MOTIVATIONAL_MESSAGES: MotivationalMessage[] = [
  { id: 1, text: "Coffee is loading... please wait! ☕", category: 'funny' },
  { id: 2, text: "Great things take time, just like good pizza! 🍕", category: 'motivational' },
  { id: 3, text: "Loading awesomeness... 99.9% complete! 🚀", category: 'funny' },
  { id: 4, text: "Your patience is appreciated more than you know! 💪", category: 'motivational' },
  { id: 5, text: "Compiling happiness... please stand by! 😄", category: 'tech' },
  { id: 6, text: "Success is loading... buffering... almost there! 🎯", category: 'motivational' },
  { id: 7, text: "Loading like a boss! You've got this! 💼", category: 'funny' },
  { id: 8, text: "Patience is not the ability to wait, but to keep a good attitude while waiting! 🌟", category: 'motivational' },
  { id: 9, text: "Downloading inspiration... 47% complete! 📥", category: 'tech' },
  { id: 10, text: "Good things come to those who wait... and load! ⏰", category: 'motivational' },
  { id: 11, text: "Loading... or as I like to call it, anticipation building! 🎪", category: 'funny' },
  { id: 12, text: "Every expert was once a beginner, every pro was once amateur! 🌱", category: 'motivational' },
  { id: 13, text: "Error 404: Patience not found... just kidding, keep waiting! 😂", category: 'funny' },
  { id: 14, text: "You're closer to your goal than you were yesterday! 🏃‍♂️", category: 'motivational' },
  { id: 15, text: "Loading... like watching paint dry, but more exciting! 🎨", category: 'funny' },
  { id: 16, text: "Believe you can and you're halfway there! 🌈", category: 'motivational' },
  { id: 17, text: "Spinning wheels of progress... vroooom! 🏎️", category: 'tech' },
  { id: 18, text: "The best time to plant a tree was 20 years ago. The second best time is now! 🌳", category: 'motivational' },
  { id: 19, text: "Loading... please don't shake your device! 📱", category: 'funny' },
  { id: 20, text: "You're doing amazing! Keep up the great work! ✨", category: 'motivational' },
];

export const MotivationalLoadingPopup: React.FC<LoadingPopupProps> = ({
  visible,
  onClose,
  title = "Loading Project",
  showMessages = true,
  messageInterval = 3000,
}) => {
  const [currentMessage, setCurrentMessage] = useState(MOTIVATIONAL_MESSAGES[0]);

  useEffect(() => {
    if (visible) {
      // Pick a random message when popup becomes visible
      const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length);
      setCurrentMessage(MOTIVATIONAL_MESSAGES[randomIndex]);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>{title}</Text>
            
            <View style={styles.spinnerContainer}>
              <LoadingSpinner size="large" color="#FFFFFF" />
            </View>

            {showMessages && (
              <View style={styles.messageContainer}>
                <Text style={styles.messageText}>
                  {currentMessage.text}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#1E3A5F', // Dark blue background
    borderRadius: 20,
    padding: 30,
    maxWidth: width * 0.85,
    minWidth: width * 0.7,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF', // White text for dark background
    marginBottom: 20,
    textAlign: 'center',
  },
  spinnerContainer: {
    marginVertical: 20,
  },
  messageContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
    minHeight: 60,
    justifyContent: 'center',
  },
  messageText: {
    fontSize: 16,
    color: '#E8F4FD', // Light blue-white text for better readability
    textAlign: 'center',
    lineHeight: 22,
    fontStyle: 'italic',
  },
}); 