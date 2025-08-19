import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { COLORS, SPACING } from '../utils/config';
import { AdminGuard } from '../components/AdminGuard';
import { adminApi } from '../api/admin';
import { DashboardAnalytics, RevenueReport, AttendanceReport } from '../types';

const ReportsScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'revenue' | 'attendance'>('dashboard');
  const [reportPeriod, setReportPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  const { data: analytics, isLoading: loadingAnalytics, refetch: refetchAnalytics } = useQuery({
    queryKey: ['admin', 'analytics', 'dashboard'],
    queryFn: adminApi.getDashboardAnalytics,
    enabled: activeTab === 'dashboard',
  });

  const { data: revenueReport, isLoading: loadingRevenue, refetch: refetchRevenue } = useQuery({
    queryKey: ['admin', 'reports', 'revenue', reportPeriod],
    queryFn: () => {
      const endDate = new Date();
      let startDate = new Date();
      
      switch (reportPeriod) {
        case 'week':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(endDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(endDate.getMonth() - 3);
          break;
      }
      
      return adminApi.getRevenueReport(
        startDate.toISOString(),
        endDate.toISOString()
      );
    },
    enabled: activeTab === 'revenue',
  });

  const { data: attendanceReport, isLoading: loadingAttendance, refetch: refetchAttendance } = useQuery({
    queryKey: ['admin', 'reports', 'attendance', reportPeriod],
    queryFn: () => {
      const endDate = new Date();
      let startDate = new Date();
      
      switch (reportPeriod) {
        case 'week':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(endDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(endDate.getMonth() - 3);
          break;
      }
      
      return adminApi.getAttendanceReport(
        startDate.toISOString(),
        endDate.toISOString()
      );
    },
    enabled: activeTab === 'attendance',
  });

  const onRefresh = () => {
    switch (activeTab) {
      case 'dashboard':
        refetchAnalytics();
        break;
      case 'revenue':
        refetchRevenue();
        break;
      case 'attendance':
        refetchAttendance();
        break;
    }
  };

  const formatCurrency = (amount: number) => {
    const numAmount = Number(amount) || 0;
    return `₪${numAmount.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const isLoading = loadingAnalytics || loadingRevenue || loadingAttendance;

  const renderDashboardTab = () => {
    if (!analytics) return null;

    return (
      <View style={styles.tabContent}>
        <Text style={styles.sectionTitle}>Key Metrics</Text>
        
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: COLORS.primary }]}>
            <Ionicons name="people" size={24} color={COLORS.white} />
            <Text style={styles.metricValue}>{analytics.total_users}</Text>
            <Text style={styles.metricLabel}>Total Users</Text>
          </View>
          
          <View style={[styles.metricCard, { backgroundColor: COLORS.success }]}>
            <Ionicons name="person-add" size={24} color={COLORS.white} />
            <Text style={styles.metricValue}>{analytics.new_users_last_30_days}</Text>
            <Text style={styles.metricLabel}>New Users (30d)</Text>
          </View>
          
          <View style={[styles.metricCard, { backgroundColor: COLORS.warning }]}>
            <Ionicons name="calendar" size={24} color={COLORS.white} />
            <Text style={styles.metricValue}>{analytics.total_bookings}</Text>
            <Text style={styles.metricLabel}>Total Bookings</Text>
          </View>
          
          <View style={[styles.metricCard, { backgroundColor: COLORS.secondary }]}>
            <Ionicons name="cash" size={24} color={COLORS.white} />
            <Text style={styles.metricValue}>{formatCurrency(analytics.total_revenue)}</Text>
            <Text style={styles.metricLabel}>Total Revenue</Text>
          </View>
        </View>

        <View style={styles.monthlyRevenueCard}>
          <Text style={styles.monthlyRevenueTitle}>This Month's Revenue</Text>
          <Text style={styles.monthlyRevenueAmount}>
            {formatCurrency(analytics.monthly_revenue)}
          </Text>
        </View>

        {analytics.popular_packages.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Popular Packages</Text>
            {analytics.popular_packages.map((pkg, index) => (
              <View key={index} style={styles.packageItem}>
                <Text style={styles.packageName}>{pkg.name}</Text>
                <Text style={styles.packageCount}>{pkg.count} sales</Text>
              </View>
            ))}
          </>
        )}
      </View>
    );
  };

  const renderRevenueTab = () => {
    if (!revenueReport) return null;

    return (
      <View style={styles.tabContent}>
        <Text style={styles.sectionTitle}>Revenue Report</Text>
        
        <View style={styles.totalRevenueCard}>
          <Text style={styles.totalRevenueTitle}>Total Revenue ({reportPeriod})</Text>
          <Text style={styles.totalRevenueAmount}>
            {formatCurrency(revenueReport.total_revenue)}
          </Text>
          <Text style={styles.periodText}>
            {formatDate(revenueReport.period.start_date)} - {formatDate(revenueReport.period.end_date)}
          </Text>
        </View>

        {revenueReport.revenue_by_package.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Revenue by Package</Text>
            {revenueReport.revenue_by_package.map((item, index) => (
              <View key={index} style={styles.revenueItem}>
                <View style={styles.revenueItemHeader}>
                  <Text style={styles.revenueItemName}>{item.package}</Text>
                  <Text style={styles.revenueItemAmount}>{formatCurrency(item.revenue)}</Text>
                </View>
                <Text style={styles.revenueItemSales}>{item.sales_count} sales</Text>
              </View>
            ))}
          </>
        )}

        {revenueReport.revenue_by_date.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Daily Revenue Trend</Text>
            {revenueReport.revenue_by_date.slice(-7).map((item, index) => (
              <View key={index} style={styles.trendItem}>
                <Text style={styles.trendDate}>{formatDate(item.date)}</Text>
                <Text style={styles.trendAmount}>{formatCurrency(item.revenue)}</Text>
              </View>
            ))}
          </>
        )}
      </View>
    );
  };

  const renderAttendanceTab = () => {
    if (!attendanceReport) return null;

    const totalBookings = attendanceReport.bookings_by_date.reduce(
      (sum, item) => sum + item.bookings, 0
    );

    return (
      <View style={styles.tabContent}>
        <Text style={styles.sectionTitle}>Attendance Report</Text>
        
        <View style={styles.totalBookingsCard}>
          <Text style={styles.totalBookingsTitle}>Total Bookings ({reportPeriod})</Text>
          <Text style={styles.totalBookingsAmount}>{totalBookings}</Text>
          <Text style={styles.periodText}>
            {formatDate(attendanceReport.period.start_date)} - {formatDate(attendanceReport.period.end_date)}
          </Text>
        </View>

        {attendanceReport.popular_times.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Popular Class Times</Text>
            {attendanceReport.popular_times.slice(0, 5).map((item, index) => (
              <View key={index} style={styles.popularTimeItem}>
                <Text style={styles.popularTimeText}>{item.time}</Text>
                <Text style={styles.popularTimeBookings}>{item.bookings} bookings</Text>
              </View>
            ))}
          </>
        )}

        {attendanceReport.bookings_by_date.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Daily Booking Trend</Text>
            {attendanceReport.bookings_by_date.slice(-7).map((item, index) => (
              <View key={index} style={styles.trendItem}>
                <Text style={styles.trendDate}>{formatDate(item.date)}</Text>
                <Text style={styles.trendAmount}>{item.bookings} bookings</Text>
              </View>
            ))}
          </>
        )}
      </View>
    );
  };

  return (
    <AdminGuard requiredRoles={['admin']}>
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Reports & Analytics</Text>
        
        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'dashboard' && styles.activeTab]}
            onPress={() => setActiveTab('dashboard')}
          >
            <Text style={[styles.tabText, activeTab === 'dashboard' && styles.activeTabText]}>
              Dashboard
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'revenue' && styles.activeTab]}
            onPress={() => setActiveTab('revenue')}
          >
            <Text style={[styles.tabText, activeTab === 'revenue' && styles.activeTabText]}>
              Revenue
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'attendance' && styles.activeTab]}
            onPress={() => setActiveTab('attendance')}
          >
            <Text style={[styles.tabText, activeTab === 'attendance' && styles.activeTabText]}>
              Attendance
            </Text>
          </TouchableOpacity>
        </View>

        {/* Period Selector (for revenue and attendance tabs) */}
        {activeTab !== 'dashboard' && (
          <View style={styles.periodContainer}>
            <Text style={styles.periodLabel}>Period:</Text>
            {['week', 'month', 'quarter'].map((period) => (
              <TouchableOpacity
                key={period}
                style={[styles.periodButton, reportPeriod === period && styles.activePeriod]}
                onPress={() => setReportPeriod(period as any)}
              >
                <Text style={[styles.periodText, reportPeriod === period && styles.activePeriodText]}>
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
        >
          {isLoading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
          ) : (
            <>
              {activeTab === 'dashboard' && renderDashboardTab()}
              {activeTab === 'revenue' && renderRevenueTab()}
              {activeTab === 'attendance' && renderAttendanceTab()}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </AdminGuard>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    margin: SPACING.lg,
    marginBottom: SPACING.md,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    padding: 4,
    marginBottom: SPACING.md,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: COLORS.white,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  periodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  periodLabel: {
    fontSize: 14,
    color: COLORS.text,
    marginRight: SPACING.sm,
  },
  periodButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.lightGray,
    marginRight: SPACING.sm,
  },
  activePeriod: {
    backgroundColor: COLORS.primary,
  },
  periodText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  activePeriodText: {
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  tabContent: {
    padding: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
    marginTop: SPACING.sm,
  },
  metricLabel: {
    fontSize: 12,
    color: COLORS.white,
    marginTop: 4,
    textAlign: 'center',
  },
  monthlyRevenueCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  monthlyRevenueTitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  monthlyRevenueAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  packageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
  packageName: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  packageCount: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  totalRevenueCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  totalRevenueTitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  totalRevenueAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  revenueItem: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
  revenueItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  revenueItemName: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
    flex: 1,
  },
  revenueItemAmount: {
    fontSize: 16,
    color: COLORS.success,
    fontWeight: '600',
  },
  revenueItemSales: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  trendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
  trendDate: {
    fontSize: 14,
    color: COLORS.text,
  },
  trendAmount: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  totalBookingsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  totalBookingsTitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  totalBookingsAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.warning,
  },
  popularTimeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
  popularTimeText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  popularTimeBookings: {
    fontSize: 14,
    color: COLORS.warning,
    fontWeight: '600',
  },
  loader: {
    marginTop: SPACING.xl,
  },
});

export default ReportsScreen;