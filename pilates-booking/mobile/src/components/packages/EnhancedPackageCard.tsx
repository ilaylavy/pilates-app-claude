import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  // Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING } from '../../utils/config';
import { Package } from '../../types';

// const { width } = Dimensions.get('window');

interface EnhancedPackageCardProps {
  package: Package & {
    // Optional user package fields for history mode
    user_package_id?: number;
    credits_remaining?: number;
    purchase_date?: string;
    expiry_date?: string;
    days_until_expiry?: number;
    is_expired?: boolean;
    payment_status?: string;
    rejection_reason?: string;
  };
  onQuickPurchase?: () => void;
  isHistoryMode?: boolean;
  style?: any;
}

const EnhancedPackageCard: React.FC<EnhancedPackageCardProps> = ({
  package: pkg,
  onQuickPurchase,
  isHistoryMode = false,
  style,
}) => {
  const formatCurrency = (amount: number) => {
    const numAmount = Number(amount) || 0;
    return `₪${numAmount.toFixed(0)}`;
  };

  const formatValidityDays = (days: number) => {
    if (days >= 365) {
      const years = Math.floor(days / 365);
      return `${years}y`;
    }
    if (days >= 30) {
      const months = Math.floor(days / 30);
      return `${months}mo`;
    }
    return `${days}d`;
  };

  const getValuePerClass = () => {
    if (pkg.is_unlimited) {
      // Assume 30 classes per month for unlimited packages
      return (Number(pkg.price) / 30).toFixed(0);
    }
    return (Number(pkg.price) / Number(pkg.credits)).toFixed(0);
  };

  const getPackageColor = () => {
    if (pkg.is_featured) return COLORS.accent;
    if (pkg.is_unlimited) return COLORS.primary;
    return COLORS.secondary;
  };

  const renderBadges = () => (
    <View style={styles.badgeContainer}>
      {isHistoryMode && pkg.is_expired && (
        <View style={[styles.badge, styles.expiredBadge]}>
          <Ionicons name="warning" size={12} color={COLORS.background} />
          <Text style={styles.badgeText}>EXPIRED</Text>
        </View>
      )}
      {isHistoryMode && pkg.payment_status === 'rejected' && (
        <View style={[styles.badge, styles.rejectedBadge]}>
          <Ionicons name="close" size={12} color={COLORS.background} />
          <Text style={styles.badgeText}>REJECTED</Text>
        </View>
      )}
      {!isHistoryMode && pkg.is_featured && (
        <View style={[styles.badge, styles.featuredBadge]}>
          <Ionicons name="star" size={12} color={COLORS.background} />
          <Text style={styles.featuredBadgeText}>BEST VALUE</Text>
        </View>
      )}
      {pkg.is_unlimited && (
        <View style={[styles.badge, styles.unlimitedBadge]}>
          <Text style={styles.badgeText}>UNLIMITED</Text>
        </View>
      )}
    </View>
  );

  const renderMainContent = () => (
    <View style={styles.mainContent}>
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <Text style={styles.packageName} numberOfLines={2}>{pkg.name}</Text>
          {pkg.description && (
            <Text style={styles.packageDescription} numberOfLines={2}>
              {pkg.description}
            </Text>
          )}
        </View>
        
        <View style={styles.priceSection}>
          <Text style={styles.price}>{formatCurrency(pkg.price)}</Text>
          <Text style={styles.valueText}>₪{getValuePerClass()}/class</Text>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Ionicons name="ticket" size={16} color={getPackageColor()} />
          <Text style={styles.statText}>
            {isHistoryMode && pkg.credits_remaining !== undefined 
              ? `${pkg.credits_remaining}/${pkg.credits}`
              : pkg.is_unlimited ? '∞' : pkg.credits
            }
          </Text>
          <Text style={styles.statLabel}>
            {isHistoryMode ? 'Remaining' : 'Credits'}
          </Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statItem}>
          <Ionicons 
            name={isHistoryMode && pkg.is_expired ? "warning" : "time"} 
            size={16} 
            color={isHistoryMode && pkg.is_expired ? COLORS.error : getPackageColor()} 
          />
          <Text style={[
            styles.statText,
            isHistoryMode && pkg.is_expired && { color: COLORS.error }
          ]}>
            {isHistoryMode && pkg.days_until_expiry !== undefined
              ? pkg.is_expired 
                ? `${Math.abs(pkg.days_until_expiry)}d ago`
                : `${pkg.days_until_expiry}d left`
              : formatValidityDays(pkg.validity_days)
            }
          </Text>
          <Text style={styles.statLabel}>
            {isHistoryMode ? (pkg.is_expired ? 'Expired' : 'Expires') : 'Valid'}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderActions = () => (
    <View style={styles.actionBar}>
      <TouchableOpacity 
        style={[styles.purchaseButton, { backgroundColor: getPackageColor() }]} 
        onPress={onQuickPurchase}
      >
        <View style={styles.purchaseButtonContent}>
          <Ionicons name="flash" size={16} color={COLORS.background} />
          <Text style={styles.purchaseButtonText}>Purchase</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <TouchableOpacity
      style={[
        styles.card,
        style,
      ]}
      activeOpacity={0.8}
    >
      {renderBadges()}
      {renderMainContent()}
      {!isHistoryMode && renderActions()}
      
      {/* Featured overlay */}
      {!isHistoryMode && pkg.is_featured && (
        <View style={styles.featuredOverlay}>
          <View style={styles.featuredGradient} />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    marginBottom: SPACING.md,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  badgeContainer: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    zIndex: 2,
    gap: SPACING.xs,
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  featuredBadge: {
    backgroundColor: COLORS.accent,
    gap: 4,
  },
  unlimitedBadge: {
    backgroundColor: COLORS.primary,
  },
  expiredBadge: {
    backgroundColor: COLORS.error,
    gap: 4,
  },
  rejectedBadge: {
    backgroundColor: COLORS.error,
    gap: 4,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.background,
    letterSpacing: 0.5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.background,
    letterSpacing: 0.5,
  },
  mainContent: {
    padding: SPACING.lg,
    paddingRight: SPACING.xl * 2, // Space for badges
  },
  header: {
    marginBottom: SPACING.lg,
  },
  titleSection: {
    marginBottom: SPACING.md,
  },
  packageName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  packageDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  priceSection: {
    alignItems: 'flex-start',
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 2,
  },
  valueText: {
    fontSize: 14,
    color: COLORS.success,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: SPACING.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
  statText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  actionBar: {
    flexDirection: 'row',
    padding: SPACING.lg,
    paddingTop: 0,
    gap: SPACING.md,
  },
  purchaseButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  purchaseButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.xs,
  },
  purchaseButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.background,
  },
  featuredOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  featuredGradient: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: COLORS.accent + '10',
  },
});

export default EnhancedPackageCard;