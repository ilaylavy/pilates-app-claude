import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUserRole } from '../hooks/useUserRole';
import { COLORS, SPACING } from '../utils/config';
import { AdminGuard } from '../components/AdminGuard';

// Tab components
import DashboardTab from '../components/schedule/DashboardTab';
import ScheduleTab from '../components/schedule/ScheduleTab';
import TemplatesTab from '../components/schedule/TemplatesTab';
import BulkActionsTab from '../components/schedule/BulkActionsTab';
import SettingsTab from '../components/schedule/SettingsTab';

type TabType = 'dashboard' | 'schedule' | 'templates' | 'bulk' | 'settings';

interface Tab {
  id: TabType;
  label: string;
  icon: string;
  adminOnly?: boolean;
  instructorAccess?: boolean;
}

const NewScheduleScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const { isAdmin, isInstructor, isStudent } = useUserRole();

  const tabs: Tab[] = [
    {
      id: 'dashboard',
      label: 'Overview',
      icon: 'analytics',
      adminOnly: true,
    },
    {
      id: 'schedule',
      label: 'Schedule',
      icon: 'calendar',
      instructorAccess: true,
    },
    {
      id: 'templates',
      label: 'Templates',
      icon: 'layers',
      adminOnly: true,
    },
    {
      id: 'bulk',
      label: 'Bulk Actions',
      icon: 'copy',
      adminOnly: true,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'settings',
      adminOnly: true,
    },
  ];

  const getVisibleTabs = () => {
    return tabs.filter(tab => {
      if (tab.adminOnly && !isAdmin) return false;
      if (tab.instructorAccess && !(isInstructor || isAdmin)) return false;
      if (!tab.adminOnly && !tab.instructorAccess && isStudent) return false;
      return true;
    });
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab />;
      case 'schedule':
        return <ScheduleTab />;
      case 'templates':
        return <TemplatesTab />;
      case 'bulk':
        return <BulkActionsTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <ScheduleTab />;
    }
  };

  const getTabTitle = () => {
    const tab = tabs.find(t => t.id === activeTab);
    return tab?.label || 'Schedule';
  };

  const visibleTabs = getVisibleTabs();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{getTabTitle()}</Text>
        {isAdmin && (
          <TouchableOpacity style={styles.helpButton}>
            <Ionicons name="help-circle-outline" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Navigation */}
      {visibleTabs.length > 1 && (
        <View style={styles.tabContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabScrollContent}
          >
            {visibleTabs.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tab,
                  activeTab === tab.id && styles.activeTab,
                ]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={20}
                  color={activeTab === tab.id ? COLORS.primary : COLORS.textSecondary}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    activeTab === tab.id && styles.activeTabLabel,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {renderTabContent()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  helpButton: {
    padding: SPACING.xs,
  },
  tabContainer: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabScrollContent: {
    paddingHorizontal: SPACING.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
    borderRadius: 8,
    gap: SPACING.xs,
    minWidth: 80,
  },
  activeTab: {
    backgroundColor: COLORS.primary + '10',
  },
  tabLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  activeTabLabel: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
});

export default NewScheduleScreen;