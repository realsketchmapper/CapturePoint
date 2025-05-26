import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Switch } from 'react-native';
import { Colors } from '@/theme/colors';
import { FormDefinition, FormQuestion, FeatureType } from '@/types/featureType.types';

interface FeatureFormModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSubmit: (formData: { [questionId: string]: any }) => void;
  featureType: FeatureType;
}

export const FeatureFormModal: React.FC<FeatureFormModalProps> = ({
  isVisible,
  onClose,
  onSubmit,
  featureType
}) => {
  const [formData, setFormData] = useState<{ [key: string]: any }>({});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  // Add debug logging
  useEffect(() => {
    console.log('FeatureFormModal visibility changed:', isVisible);
    if (isVisible && featureType) {
      console.log('FeatureFormModal rendering for:', featureType.name);
      console.log('Form definition available:', 
        featureType.form_definition ? `Yes, with ${featureType.form_definition.questions.length} questions` : 'No');
      
      // Log each question for debugging
      if (featureType.form_definition?.questions) {
        featureType.form_definition.questions.forEach(q => {
          console.log(`Question: ${q.question}, Type: ${q.type}, ID: ${q.id}`);
        });
      }
    }
  }, [isVisible, featureType]);
  
  // Reset form data when the modal is opened with a new feature type
  useEffect(() => {
    if (isVisible && featureType) {
      setFormData({});
      setErrors({});
    }
  }, [isVisible, featureType]);

  // Handle form field changes
  const handleChange = (questionId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [questionId]: value
    }));
    
    // Clear error when field is edited
    if (errors[questionId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  // Validate form before submission
  const validateForm = (): boolean => {
    if (!featureType.form_definition) return true;
    
    const newErrors: { [key: string]: string } = {};
    let isValid = true;
    
    featureType.form_definition.questions.forEach(question => {
      if (question.required && !formData[question.id]) {
        newErrors[question.id] = 'This field is required';
        isValid = false;
      }
    });
    
    setErrors(newErrors);
    return isValid;
  };

  // Handle form submission
  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  // Render form field based on question type
  const renderField = (question: FormQuestion) => {
    switch (question.type) {
      case 'text':
        return (
          <TextInput
            style={[styles.input, errors[question.id] && styles.inputError]}
            value={formData[question.id] || ''}
            onChangeText={(value) => handleChange(question.id, value)}
            placeholder={question.placeholder || ''}
            placeholderTextColor={Colors.Grey}
          />
        );
        
      case 'number':
        return (
          <TextInput
            style={[styles.input, errors[question.id] && styles.inputError]}
            value={formData[question.id]?.toString() || ''}
            onChangeText={(value) => handleChange(question.id, value.replace(/[^0-9.]/g, ''))}
            keyboardType="numeric"
            placeholder={question.placeholder || ''}
            placeholderTextColor={Colors.Grey}
          />
        );
        
      case 'boolean':
        return (
          <View style={styles.booleanContainer}>
            <Switch
              value={!!formData[question.id]}
              onValueChange={(value) => handleChange(question.id, value)}
              trackColor={{ false: Colors.Grey, true: Colors.Aqua }}
              thumbColor="#FFFFFF"
            />
            <Text style={styles.booleanLabel}>
              {formData[question.id] ? 'Yes' : 'No'}
            </Text>
          </View>
        );
        
      case 'textarea':
        return (
          <TextInput
            style={[styles.textArea, errors[question.id] && styles.inputError]}
            value={formData[question.id] || ''}
            onChangeText={(value) => handleChange(question.id, value)}
            placeholder={question.placeholder || ''}
            placeholderTextColor={Colors.Grey}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        );

      case 'select':
        if (!question.options || question.options.length === 0) {
          return <Text style={styles.errorText}>No options available</Text>;
        }
        
        return (
          <View style={styles.selectContainer}>
            {question.options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.selectOption,
                  formData[question.id] === option && styles.selectedOption
                ]}
                onPress={() => handleChange(question.id, option)}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    formData[question.id] === option && styles.selectedOptionText
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );
        
      default:
        return <Text>Unsupported field type: {question.type}</Text>;
    }
  };

  // Don't render if there's no form definition or no questions
  if (!featureType.form_definition || !featureType.form_definition.questions || featureType.form_definition.questions.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>{featureType.name} - Data Collection</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer}>
            {featureType.form_definition.questions.map((question) => (
              <View key={question.id} style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>
                  {question.question}
                  {question.required && <Text style={styles.requiredIndicator}>*</Text>}
                </Text>
                {renderField(question)}
                {errors[question.id] && (
                  <Text style={styles.errorText}>{errors[question.id]}</Text>
                )}
              </View>
            ))}
          </ScrollView>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
            >
              <Text style={styles.submitButtonText}>Collect Point</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: Colors.OffWhite,
    borderRadius: 10,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.VeryLightGrey,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.DarkBlue,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: Colors.DarkBlue,
    fontSize: 16,
  },
  formContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: '70%',
  },
  fieldContainer: {
    marginBottom: 15,
  },
  fieldLabel: {
    fontSize: 16,
    marginBottom: 8,
    color: Colors.DarkBlue,
    fontWeight: '500',
  },
  requiredIndicator: {
    color: Colors.BrightRed,
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.VeryLightGrey,
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: Colors.DarkBlue,
  },
  textArea: {
    borderWidth: 1,
    borderColor: Colors.VeryLightGrey,
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: Colors.DarkBlue,
    height: 100,
  },
  inputError: {
    borderColor: Colors.BrightRed,
  },
  errorText: {
    color: Colors.BrightRed,
    fontSize: 14,
    marginTop: 5,
  },
  buttonContainer: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: Colors.VeryLightGrey,
  },
  submitButton: {
    backgroundColor: Colors.Aqua,
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  selectOption: {
    borderWidth: 1,
    borderColor: Colors.VeryLightGrey,
    borderRadius: 5,
    padding: 10,
    margin: 5,
    backgroundColor: '#FFFFFF',
  },
  selectedOption: {
    backgroundColor: Colors.Aqua,
    borderColor: Colors.Aqua,
  },
  selectOptionText: {
    color: Colors.DarkBlue,
  },
  selectedOptionText: {
    color: '#FFFFFF',
  },
  booleanContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  booleanLabel: {
    marginLeft: 10,
    color: Colors.DarkBlue,
  },
}); 