import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  TextInput,
  Alert,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from '../services/LoggingService';
import { networkQueue } from '../services/NetworkQueueService';
import { API_BASE_URL } from '../utils/config';

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  extra?: any;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
}

interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  status?: number;
  duration?: number;
  error?: string;
  timestamp: string;
}

export const DevToolsScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'logs' | 'network' | 'performance' | 'storage' | 'config'>('logs');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [networkRequests, setNetworkRequests] = useState<NetworkRequest[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLogLevel, setSelectedLogLevel] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState<any>(null);
  const [apiEndpoint, setApiEndpoint] = useState(API_BASE_URL);
  const [mockDataEnabled, setMockDataEnabled] = useState(false);
  
  // Feature flags
  const [featureFlags, setFeatureFlags] = useState({
    enableNewBookingFlow: false,
    enablePushNotifications: false,
    enableAnalytics: false,
    enableOfflineMode: false,
    enablePerformanceMonitoring: false,
  });

  useEffect(() => {
    if (__DEV__) {
      loadDevToolsData();
      const interval = setInterval(loadDevToolsData, 5000);
      return () => clearInterval(interval);
    }
  }, []);

  const loadDevToolsData = async () => {
    try {
      // Load logs from AsyncStorage
      const storedLogs = await AsyncStorage.getItem('pilates_logs');
      if (storedLogs) {
        setLogs(JSON.parse(storedLogs).slice(-100)); // Last 100 logs
      }

      // Load network queue status
      const queueStatus = networkQueue.getQueueStatus();
      
      // Load performance metrics from storage
      const storedMetrics = await AsyncStorage.getItem('performance_metrics');
      if (storedMetrics) {
        setPerformanceMetrics(JSON.parse(storedMetrics).slice(-50));
      }

      // Load feature flags
      const storedFlags = await AsyncStorage.getItem('feature_flags');
      if (storedFlags) {
        setFeatureFlags(JSON.parse(storedFlags));
      }

      // Load mock data setting
      const mockSetting = await AsyncStorage.getItem('mock_data_enabled');
      setMockDataEnabled(mockSetting === 'true');
    } catch (error) {
      console.error('Failed to load dev tools data:', error);
    }
  };

  const handleFeatureFlagToggle = async (flag: string, value: boolean) => {
    const updatedFlags = { ...featureFlags, [flag]: value };
    setFeatureFlags(updatedFlags);
    await AsyncStorage.setItem('feature_flags', JSON.stringify(updatedFlags));
    
    Logger.trackEvent('dev_tools.feature_flag_toggled', {
      flag,
      value,
      timestamp: new Date().toISOString(),
    });
  };

  const handleMockDataToggle = async (enabled: boolean) => {
    setMockDataEnabled(enabled);
    await AsyncStorage.setItem('mock_data_enabled', enabled.toString());
    
    Logger.info(`Mock data ${enabled ? 'enabled' : 'disabled'}`, {
      enabled,
      context: 'dev_tools',
    });
  };

  const handleClearLogs = () => {
    Alert.alert(
      'Clear Logs',
      'Are you sure you want to clear all logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('pilates_logs');
            setLogs([]);
            Logger.info('Logs cleared via dev tools');
          },
        },
      ]
    );
  };

  const handleClearNetworkQueue = () => {
    Alert.alert(
      'Clear Network Queue',
      'Are you sure you want to clear the network queue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            networkQueue.clearQueue();
            Logger.info('Network queue cleared via dev tools');
          },
        },
      ]
    );
  };

  const handleClearAsyncStorage = () => {
    Alert.alert(
      'Clear AsyncStorage',
      'This will clear ALL app data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            Logger.info('AsyncStorage cleared via dev tools');
            Alert.alert('Success', 'AsyncStorage cleared');
          },
        },
      ]
    );
  };

  const handleSimulateError = () => {
    Alert.alert(
      'Simulate Error',
      'Choose error type to simulate:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Network Error',
          onPress: () => {
            const error = new Error('Simulated network error');
            error.name = 'NetworkError';
            Logger.error('Simulated network error', error, { simulated: true });
          },
        },
        {
          text: 'Render Error',
          onPress: () => {
            throw new Error('Simulated render error for testing');
          },
        },
        {
          text: 'Async Error',
          onPress: () => {
            Promise.reject(new Error('Simulated async error')).catch(error => {
              Logger.error('Simulated async error', error, { simulated: true });
            });
          },
        },
      ]
    );
  };

  const handleViewDetails = (item: any) => {
    setModalContent(item);
    setShowModal(true);
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchQuery || 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(log.extra || {}).toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesLevel = selectedLogLevel === 'all' || log.level === selectedLogLevel;
    
    return matchesSearch && matchesLevel;
  });

  const renderTabButton = (tab: string, title: string, icon: keyof typeof Ionicons.glyphMap) => (
    <TouchableOpacity
      key={tab}
      style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
      onPress={() => setActiveTab(tab as any)}
    >
      <Ionicons 
        name={icon} 
        size={20} 
        color={activeTab === tab ? '#007AFF' : '#6B7280'} 
      />
      <Text style={[styles.tabButtonText, activeTab === tab && styles.activeTabButtonText]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const renderLogItem = ({ item }: { item: LogEntry }) => (
    <TouchableOpacity
      style={[styles.logItem, styles[`log${item.level}`]]}
      onPress={() => handleViewDetails(item)}
    >
      <View style={styles.logHeader}>
        <Text style={styles.logLevel}>{item.level}</Text>
        <Text style={styles.logTimestamp}>
          {new Date(item.timestamp).toLocaleTimeString()}
        </Text>
      </View>
      <Text style={styles.logMessage} numberOfLines={2}>
        {item.message}
      </Text>
      {item.extra && (
        <Text style={styles.logExtra} numberOfLines={1}>
          {JSON.stringify(item.extra)}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderLogsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.logsHeader}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search logs..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.filterButton} onPress={handleClearLogs}>
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.logLevelFilter}>
        {['all', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'].map(level => (
          <TouchableOpacity
            key={level}
            style={[
              styles.levelButton,
              selectedLogLevel === level && styles.activeLevelButton,
            ]}
            onPress={() => setSelectedLogLevel(level)}
          >
            <Text style={[
              styles.levelButtonText,
              selectedLogLevel === level && styles.activeLevelButtonText,
            ]}>
              {level}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredLogs.reverse()}
        keyExtractor={(item) => item.id}
        renderItem={renderLogItem}
        style={styles.logsList}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );

  const renderNetworkTab = () => {
    const queueStatus = networkQueue.getQueueStatus();
    
    return (
      <View style={styles.tabContent}>
        <View style={styles.networkHeader}>
          <Text style={styles.sectionTitle}>Network Queue Status</Text>
          <TouchableOpacity style={styles.clearButton} onPress={handleClearNetworkQueue}>
            <Text style={styles.clearButtonText}>Clear Queue</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Queue Size</Text>
            <Text style={styles.statValue}>{queueStatus.size}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Processing</Text>
            <Text style={[styles.statValue, { color: queueStatus.processing ? '#10B981' : '#6B7280' }]}>
              {queueStatus.processing ? 'Yes' : 'No'}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Online</Text>
            <Text style={[styles.statValue, { color: queueStatus.isOnline ? '#10B981' : '#EF4444' }]}>
              {queueStatus.isOnline ? 'Yes' : 'No'}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Queued Requests</Text>
        <FlatList
          data={queueStatus.requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.requestItem}>
              <View style={styles.requestHeader}>
                <Text style={styles.requestMethod}>{item.method}</Text>
                <Text style={styles.requestPriority}>{item.priority}</Text>
              </View>
              <Text style={styles.requestUrl} numberOfLines={2}>
                {item.url}
              </Text>
              <Text style={styles.requestMeta}>
                Retries: {item.retryCount} | {new Date(item.createdAt).toLocaleTimeString()}
              </Text>
            </View>
          )}
          style={styles.requestsList}
        />
      </View>
    );
  };

  const renderPerformanceTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.performanceHeader}>
        <Text style={styles.sectionTitle}>Performance Metrics</Text>
        <Text style={styles.sectionSubtitle}>Last 50 metrics</Text>
      </View>
      
      <FlatList
        data={performanceMetrics.reverse()}
        keyExtractor={(item, index) => `${item.name}-${index}`}
        renderItem={({ item }) => (
          <View style={styles.metricItem}>
            <Text style={styles.metricName}>{item.name}</Text>
            <Text style={styles.metricValue}>
              {item.value} {item.unit}
            </Text>
            <Text style={styles.metricTimestamp}>
              {new Date(item.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        )}
      />
    </View>
  );

  const renderConfigTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Configuration</Text>
      
      <View style={styles.configSection}>
        <Text style={styles.configSectionTitle}>API Endpoint</Text>
        <TextInput
          style={styles.configInput}
          value={apiEndpoint}
          onChangeText={setApiEndpoint}
          placeholder="API endpoint URL"
        />
      </View>

      <View style={styles.configSection}>
        <Text style={styles.configSectionTitle}>Mock Data</Text>
        <View style={styles.configRow}>
          <Text style={styles.configLabel}>Enable Mock Data</Text>
          <Switch
            value={mockDataEnabled}
            onValueChange={handleMockDataToggle}
          />
        </View>
      </View>

      <View style={styles.configSection}>
        <Text style={styles.configSectionTitle}>Feature Flags</Text>
        {Object.entries(featureFlags).map(([key, value]) => (
          <View key={key} style={styles.configRow}>
            <Text style={styles.configLabel}>
              {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
            </Text>
            <Switch
              value={value}
              onValueChange={(enabled) => handleFeatureFlagToggle(key, enabled)}
            />
          </View>
        ))}
      </View>

      <View style={styles.configSection}>
        <Text style={styles.configSectionTitle}>Debug Actions</Text>
        <TouchableOpacity style={styles.debugButton} onPress={handleSimulateError}>
          <Text style={styles.debugButtonText}>Simulate Error</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.debugButton} onPress={handleClearAsyncStorage}>
          <Text style={styles.debugButtonText}>Clear AsyncStorage</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!__DEV__) {
    return (
      <View style={styles.notAvailable}>
        <Ionicons name="construct" size={64} color="#9CA3AF" />
        <Text style={styles.notAvailableText}>
          Developer tools are only available in development mode.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Developer Tools</Text>
        <Text style={styles.headerSubtitle}>Debug & Monitor App</Text>
      </View>

      <View style={styles.tabs}>
        {renderTabButton('logs', 'Logs', 'document-text-outline')}
        {renderTabButton('network', 'Network', 'cloud-outline')}
        {renderTabButton('performance', 'Performance', 'speedometer-outline')}
        {renderTabButton('config', 'Config', 'settings-outline')}
      </View>

      {activeTab === 'logs' && renderLogsTab()}
      {activeTab === 'network' && renderNetworkTab()}
      {activeTab === 'performance' && renderPerformanceTab()}
      {activeTab === 'config' && renderConfigTab()}

      <Modal visible={showModal} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Details</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalText}>
              {JSON.stringify(modalContent, null, 2)}
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  notAvailable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  notAvailableText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabButtonText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  activeTabButtonText: {
    color: '#007AFF',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  // Logs styles
  logsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  filterButton: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  logLevelFilter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  levelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  activeLevelButton: {
    backgroundColor: '#007AFF',
  },
  levelButtonText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  activeLevelButtonText: {
    color: '#fff',
  },
  logsList: {
    flex: 1,
  },
  logItem: {
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  logDEBUG: { borderLeftColor: '#9CA3AF' },
  logINFO: { borderLeftColor: '#3B82F6' },
  logWARN: { borderLeftColor: '#F59E0B' },
  logERROR: { borderLeftColor: '#EF4444' },
  logCRITICAL: { borderLeftColor: '#DC2626' },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logLevel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  logTimestamp: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  logMessage: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 4,
  },
  logExtra: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  // Network styles
  networkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  clearButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  requestsList: {
    flex: 1,
  },
  requestItem: {
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  requestMethod: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  requestPriority: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  requestUrl: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  requestMeta: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  // Performance styles
  performanceHeader: {
    marginBottom: 16,
  },
  metricItem: {
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricName: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  metricTimestamp: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  // Config styles
  configSection: {
    marginBottom: 24,
  },
  configSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  configInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  configLabel: {
    fontSize: 14,
    color: '#111827',
  },
  debugButton: {
    backgroundColor: '#F59E0B',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  debugButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '500',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#374151',
    lineHeight: 18,
  },
});