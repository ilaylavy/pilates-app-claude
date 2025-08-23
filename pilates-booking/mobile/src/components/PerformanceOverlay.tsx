import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { networkQueue } from '../services/NetworkQueueService';

interface PerformanceOverlayProps {
  visible: boolean;
  onToggle: () => void;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  compact?: boolean;
}

interface PerformanceStats {
  fps: number;
  memoryUsage: number;
  memoryPercentage: number;
  networkQueueSize: number;
  apiCallsInProgress: number;
  lastRenderTime: number;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const PerformanceOverlay: React.FC<PerformanceOverlayProps> = ({
  visible,
  onToggle,
  position = 'top-right',
  compact = false,
}) => {
  const { getMetrics } = usePerformanceMonitor();
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 60,
    memoryUsage: 0,
    memoryPercentage: 0,
    networkQueueSize: 0,
    apiCallsInProgress: 0,
    lastRenderTime: 0,
  });
  const [expanded, setExpanded] = useState(!compact);
  const [isDragging, setIsDragging] = useState(false);
  
  const animatedValue = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const dragPosition = useRef(new Animated.ValueXY()).current;
  const lastUpdateTime = useRef(Date.now());
  const frameCount = useRef(0);
  const rafId = useRef<number>();

  // Initialize position based on prop
  const getInitialPosition = () => {
    const margin = 20;
    const overlayWidth = expanded ? 200 : 80;
    const overlayHeight = expanded ? 150 : 80;

    switch (position) {
      case 'top-left':
        return { x: margin, y: margin };
      case 'top-right':
        return { x: screenWidth - overlayWidth - margin, y: margin };
      case 'bottom-left':
        return { x: margin, y: screenHeight - overlayHeight - margin };
      case 'bottom-right':
        return { x: screenWidth - overlayWidth - margin, y: screenHeight - overlayHeight - margin };
      default:
        return { x: screenWidth - overlayWidth - margin, y: margin };
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
        dragPosition.setOffset({
          x: (dragPosition.x as any)._value,
          y: (dragPosition.y as any)._value,
        });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: dragPosition.x, dy: dragPosition.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        setIsDragging(false);
        dragPosition.flattenOffset();
        
        // Snap to edges if close
        const currentX = (dragPosition.x as any)._value;
        const currentY = (dragPosition.y as any)._value;
        const snapDistance = 50;
        
        let newX = currentX;
        let newY = currentY;
        
        // Snap to left/right edge
        if (currentX < snapDistance) {
          newX = 20;
        } else if (currentX > screenWidth - (expanded ? 200 : 80) - snapDistance) {
          newX = screenWidth - (expanded ? 200 : 80) - 20;
        }
        
        // Keep within vertical bounds
        if (currentY < 20) {
          newY = 20;
        } else if (currentY > screenHeight - (expanded ? 150 : 80) - 20) {
          newY = screenHeight - (expanded ? 150 : 80) - 20;
        }
        
        if (newX !== currentX || newY !== currentY) {
          Animated.spring(dragPosition, {
            toValue: { x: newX, y: newY },
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  // FPS calculation
  const calculateFPS = () => {
    frameCount.current++;
    const now = Date.now();
    const delta = now - lastUpdateTime.current;
    
    if (delta >= 1000) { // Update every second
      const fps = Math.round((frameCount.current * 1000) / delta);
      frameCount.current = 0;
      lastUpdateTime.current = now;
      
      setStats(prevStats => ({
        ...prevStats,
        fps: Math.min(fps, 60), // Cap at 60 FPS
      }));
    }
    
    rafId.current = requestAnimationFrame(calculateFPS);
  };

  useEffect(() => {
    if (visible) {
      // Start FPS monitoring
      rafId.current = requestAnimationFrame(calculateFPS);
      
      // Update other stats periodically
      const statsInterval = setInterval(() => {
        const recentMetrics = getMetrics();
        const queueStatus = networkQueue.getQueueStatus();
        
        // Get latest memory usage
        const memoryMetrics = recentMetrics
          .filter(m => m.name === 'js_heap_used')
          .slice(-1)[0];
        
        // Get latest render time
        const renderMetrics = recentMetrics
          .filter(m => m.name === 'screen_render_time')
          .slice(-1)[0];
        
        setStats(prevStats => ({
          ...prevStats,
          memoryUsage: memoryMetrics ? Math.round(memoryMetrics.value / 1024 / 1024) : 0, // Convert to MB
          memoryPercentage: memoryMetrics && memoryMetrics.metadata?.limit
            ? Math.round((memoryMetrics.value / memoryMetrics.metadata.limit) * 100)
            : 0,
          networkQueueSize: queueStatus.size,
          apiCallsInProgress: 0, // Would need to be tracked separately
          lastRenderTime: renderMetrics ? renderMetrics.value : 0,
        }));
      }, 1000);

      // Initialize position
      const initialPos = getInitialPosition();
      dragPosition.setValue(initialPos);

      return () => {
        if (rafId.current) {
          cancelAnimationFrame(rafId.current);
        }
        clearInterval(statsInterval);
      };
    }
  }, [visible, expanded, getMetrics]);

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, animatedValue]);

  if (!visible || !__DEV__) {
    return null;
  }

  const getFPSColor = (fps: number) => {
    if (fps >= 55) return '#10B981'; // Green
    if (fps >= 30) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const getMemoryColor = (percentage: number) => {
    if (percentage < 50) return '#10B981'; // Green
    if (percentage < 80) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const renderCompactView = () => (
    <View style={styles.compactContainer}>
      <View style={styles.compactRow}>
        <Text style={[styles.compactValue, { color: getFPSColor(stats.fps) }]}>
          {stats.fps}
        </Text>
        <Text style={styles.compactLabel}>FPS</Text>
      </View>
      <View style={styles.compactRow}>
        <Text style={[styles.compactValue, { color: getMemoryColor(stats.memoryPercentage) }]}>
          {stats.memoryUsage}
        </Text>
        <Text style={styles.compactLabel}>MB</Text>
      </View>
      {stats.networkQueueSize > 0 && (
        <View style={styles.networkIndicator}>
          <Ionicons name="cloud-upload-outline" size={12} color="#F59E0B" />
          <Text style={styles.networkCount}>{stats.networkQueueSize}</Text>
        </View>
      )}
    </View>
  );

  const renderExpandedView = () => (
    <View style={styles.expandedContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Performance</Text>
        <TouchableOpacity
          onPress={() => setExpanded(false)}
          style={styles.minimizeButton}
        >
          <Ionicons name="remove" size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.metricsContainer}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>FPS</Text>
          <Text style={[styles.metricValue, { color: getFPSColor(stats.fps) }]}>
            {stats.fps}
          </Text>
        </View>
        
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Memory</Text>
          <Text style={[styles.metricValue, { color: getMemoryColor(stats.memoryPercentage) }]}>
            {stats.memoryUsage}MB ({stats.memoryPercentage}%)
          </Text>
        </View>
        
        {stats.lastRenderTime > 0 && (
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Render</Text>
            <Text style={[styles.metricValue, { color: stats.lastRenderTime > 1000 ? '#EF4444' : '#10B981' }]}>
              {Math.round(stats.lastRenderTime)}ms
            </Text>
          </View>
        )}
        
        {stats.networkQueueSize > 0 && (
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Queue</Text>
            <View style={styles.queueContainer}>
              <Ionicons name="cloud-upload-outline" size={14} color="#F59E0B" />
              <Text style={styles.queueValue}>{stats.networkQueueSize}</Text>
            </View>
          </View>
        )}
      </View>
      
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={onToggle}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={12} color="#6B7280" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: animatedValue,
          transform: [
            { translateX: dragPosition.x },
            { translateY: dragPosition.y },
            { scale: animatedValue },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          if (!isDragging) {
            if (compact || !expanded) {
              setExpanded(true);
            }
          }
        }}
        style={styles.touchableArea}
      >
        {expanded ? renderExpandedView() : renderCompactView()}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    zIndex: 9999,
    elevation: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  touchableArea: {
    minWidth: 60,
    minHeight: 60,
  },
  compactContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    padding: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  compactRow: {
    alignItems: 'center',
    marginBottom: 2,
  },
  compactValue: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  compactLabel: {
    fontSize: 8,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  networkIndicator: {
    position: 'absolute',
    top: -6,
    right: -6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#374151',
  },
  networkCount: {
    fontSize: 8,
    color: '#F59E0B',
    fontWeight: '600',
    marginLeft: 2,
  },
  expandedContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 12,
    minWidth: 180,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  minimizeButton: {
    padding: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  metricsContainer: {
    marginBottom: 8,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  queueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  queueValue: {
    fontSize: 10,
    color: '#F59E0B',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  footer: {
    alignItems: 'flex-end',
  },
  closeButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

// Hook for easy integration
export const usePerformanceOverlay = (initialVisible: boolean = false) => {
  const [visible, setVisible] = useState(initialVisible && __DEV__);
  
  const toggle = () => setVisible(!visible);
  const show = () => setVisible(true);
  const hide = () => setVisible(false);
  
  return {
    visible,
    toggle,
    show,
    hide,
    PerformanceOverlay: (props: Omit<PerformanceOverlayProps, 'visible' | 'onToggle'>) => (
      <PerformanceOverlay {...props} visible={visible} onToggle={toggle} />
    ),
  };
};