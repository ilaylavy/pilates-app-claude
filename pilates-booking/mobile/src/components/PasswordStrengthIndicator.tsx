import React from 'react';

import { View, Text, StyleSheet } from 'react-native';

interface PasswordRequirement {
  min_length: boolean;
  has_uppercase: boolean;
  has_lowercase: boolean;
  has_digit: boolean;
  has_special: boolean;
}

interface PasswordStrength {
  is_valid: boolean;
  score: number;
  requirements: PasswordRequirement;
  strength: 'weak' | 'medium' | 'strong';
}

interface PasswordStrengthIndicatorProps {
  password: string;
  onStrengthChange?: (strength: PasswordStrength) => void;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  onStrengthChange,
}) => {
  const validatePassword = (pwd: string): PasswordStrength => {
    const requirements: PasswordRequirement = {
      min_length: pwd.length >= 8,
      has_uppercase: /[A-Z]/.test(pwd),
      has_lowercase: /[a-z]/.test(pwd),
      has_digit: /\d/.test(pwd),
      has_special: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(pwd),
    };

    const score = Object.values(requirements).filter(Boolean).length;
    const is_valid = score >= 4; // Require at least 4 out of 5 criteria
    let strength: 'weak' | 'medium' | 'strong';

    if (score < 3) {
      strength = 'weak';
    } else if (score < 5) {
      strength = 'medium';
    } else {
      strength = 'strong';
    }

    const result: PasswordStrength = {
      is_valid,
      score,
      requirements,
      strength,
    };

    if (onStrengthChange) {
      onStrengthChange(result);
    }

    return result;
  };

  const strength = validatePassword(password);

  const getStrengthColor = () => {
    switch (strength.strength) {
      case 'weak':
        return '#ff3b30';
      case 'medium':
        return '#ff9500';
      case 'strong':
        return '#34c759';
      default:
        return '#8e8e93';
    }
  };

  const getStrengthWidth = () => {
    return `${(strength.score / 5) * 100}%`;
  };

  if (!password) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Password Strength</Text>
      
      <View style={styles.strengthBar}>
        <View style={styles.strengthBarBackground}>
          <View
            style={[
              styles.strengthBarFill,
              {
                width: getStrengthWidth(),
                backgroundColor: getStrengthColor(),
              },
            ]}
          />
        </View>
        <Text style={[styles.strengthText, { color: getStrengthColor() }]}>
          {strength.strength.charAt(0).toUpperCase() + strength.strength.slice(1)}
        </Text>
      </View>

      <View style={styles.requirements}>
        <RequirementItem
          met={strength.requirements.min_length}
          text="At least 8 characters"
        />
        <RequirementItem
          met={strength.requirements.has_uppercase}
          text="At least one uppercase letter"
        />
        <RequirementItem
          met={strength.requirements.has_lowercase}
          text="At least one lowercase letter"
        />
        <RequirementItem
          met={strength.requirements.has_digit}
          text="At least one number"
        />
        <RequirementItem
          met={strength.requirements.has_special}
          text="At least one special character"
        />
      </View>

      {!strength.is_valid && (
        <Text style={styles.validationMessage}>
          Password must meet at least 4 of the above requirements
        </Text>
      )}
    </View>
  );
};

interface RequirementItemProps {
  met: boolean;
  text: string;
}

const RequirementItem: React.FC<RequirementItemProps> = ({ met, text }) => (
  <View style={styles.requirementItem}>
    <Text style={[styles.requirementIcon, { color: met ? '#34c759' : '#8e8e93' }]}>
      {met ? '✓' : '○'}
    </Text>
    <Text style={[styles.requirementText, { color: met ? '#34c759' : '#8e8e93' }]}>
      {text}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  strengthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  strengthBarBackground: {
    flex: 1,
    height: 6,
    backgroundColor: '#e5e5ea',
    borderRadius: 3,
    marginRight: 12,
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  strengthText: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 60,
  },
  requirements: {
    marginTop: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  requirementIcon: {
    fontSize: 14,
    marginRight: 8,
    minWidth: 16,
  },
  requirementText: {
    fontSize: 14,
    flex: 1,
  },
  validationMessage: {
    fontSize: 12,
    color: '#ff3b30',
    marginTop: 8,
    fontStyle: 'italic',
  },
});