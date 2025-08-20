import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { securityManager } from '../utils/securityManager';

interface SecuritySession {
  id: string;
  device_name: string;
  device_type: string;
  ip_address: string;
  last_used: string;
  created_at: string;
}

export const SecuritySettingsScreen: React.FC = () => {
  const { 
    isBiometricEnabled, 
    enableBiometric, 
    disableBiometric,
    getUserSessions,
    logoutAllDevices,
    clearAllData 
  } = useAuth();
  
  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(true);
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState(15);
  const [clearDataOnBackground, setClearDataOnBackground] = useState(true);
  const [jailbreakDetection, setJailbreakDetection] = useState(true);
  const [sessions, setSessions] = useState<SecuritySession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSecurityConfig();
    loadSessions();
  }, []);

  const loadSecurityConfig = async () => {
    const config = securityManager.getConfig();
    setAutoLogoutMinutes(config.autoLogoutMinutes);
    setClearDataOnBackground(config.clearDataOnBackground);
    setJailbreakDetection(config.enableJailbreakDetection);
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      const userSessions = await getUserSessions();
      setSessions(userSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        await enableBiometric();
      } else {
        await disableBiometric();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update biometric setting');
    }
  };

  const handleAutoLogoutChange = async (enabled: boolean) => {
    setAutoLogoutEnabled(enabled);
    await securityManager.updateConfig({
      autoLogoutMinutes: enabled ? autoLogoutMinutes : 0
    });
  };

  const handleClearDataToggle = async (enabled: boolean) => {
    setClearDataOnBackground(enabled);
    await securityManager.updateConfig({
      clearDataOnBackground: enabled
    });
  };

  const handleJailbreakToggle = async (enabled: boolean) => {
    setJailbreakDetection(enabled);
    await securityManager.updateConfig({
      enableJailbreakDetection: enabled
    });
  };

  const handleLogoutAllDevices = () => {
    Alert.alert(
      'Logout All Devices',
      'This will logout all devices including this one. You will need to login again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout All',
          style: 'destructive',
          onPress: async () => {
            try {
              await logoutAllDevices();
              Alert.alert('Success', 'Logged out from all devices');
            } catch (error) {
              Alert.alert('Error', 'Failed to logout from all devices');
            }
          }
        }
      ]
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all app data including login information. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              Alert.alert('Success', 'All data has been cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data');
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={loadSessions} />
      }
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Authentication</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Biometric Authentication</Text>
          <Switch
            value={isBiometricEnabled}
            onValueChange={handleBiometricToggle}
          />
        </View>
        
        <Text style={styles.settingDescription}>
          Use Face ID, Touch ID, or fingerprint to unlock the app
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Auto-Logout</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Enable Auto-Logout</Text>
          <Switch
            value={autoLogoutEnabled}
            onValueChange={handleAutoLogoutChange}
          />
        </View>
        
        <Text style={styles.settingDescription}>
          Automatically logout after {autoLogoutMinutes} minutes of inactivity
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Clear Data on Background</Text>
          <Switch
            value={clearDataOnBackground}
            onValueChange={handleClearDataToggle}
          />
        </View>
        
        <Text style={styles.settingDescription}>
          Clear sensitive data when app goes to background
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Device Security</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Jailbreak Detection</Text>
          <Switch
            value={jailbreakDetection}
            onValueChange={handleJailbreakToggle}
          />
        </View>
        
        <Text style={styles.settingDescription}>
          Prevent app from running on jailbroken/rooted devices
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Sessions</Text>
        
        {sessions.map((session) => (
          <View key={session.id} style={styles.sessionCard}>
            <Text style={styles.sessionDevice}>
              {session.device_name || 'Unknown Device'} ({session.device_type})
            </Text>
            <Text style={styles.sessionInfo}>IP: {session.ip_address}</Text>
            <Text style={styles.sessionInfo}>
              Last used: {formatDate(session.last_used)}
            </Text>
            <Text style={styles.sessionInfo}>
              Created: {formatDate(session.created_at)}
            </Text>
          </View>
        ))}
        
        {sessions.length === 0 && !loading && (
          <Text style={styles.noSessions}>No active sessions found</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security Actions</Text>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.warningButton]}
          onPress={handleLogoutAllDevices}
        >
          <Text style={styles.actionButtonText}>Logout All Devices</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.dangerButton]}
          onPress={handleClearAllData}
        >
          <Text style={styles.actionButtonText}>Clear All Data</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: 'white',
    marginBottom: 20,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  sessionCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  sessionDevice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sessionInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  noSessions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  actionButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  warningButton: {
    backgroundColor: '#ff9500',
  },
  dangerButton: {
    backgroundColor: '#ff3b30',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});