import React from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/config';
import { useUserRole } from '../hooks/useUserRole';
import { Package } from '../types';

interface PackageCardProps {
  package: Package;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPurchase?: () => void;
  onToggle?: () => void;
  showActions?: boolean;
  userOwnsPackage?: boolean;
  isAdminMode?: boolean;
  style?: any;
}

const PackageCard: React.FC<PackageCardProps> = ({
  package: pkg,
  onPress,
  onEdit,
  onDelete,
  onPurchase,
  onToggle,
  showActions = true,
  userOwnsPackage = false,
  isAdminMode = false,
  style,
}) => {
  const { isAdmin, isStudent } = useUserRole();

  const formatCurrency = (amount: number) => {
    const numAmount = Number(amount) || 0;
    return `₪${numAmount.toFixed(2)}`;
  };

  const formatValidityDays = (days: number) => {
    if (days >= 365) {
      return `${Math.floor(days / 365)} year${Math.floor(days / 365) !== 1 ? 's' : ''}`;
    }
    if (days >= 30) {
      return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''}`;
    }
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  const getPackageIcon = () => {
    if (pkg.is_unlimited) {
      return 'infinite';
    }
    if (pkg.credits && pkg.credits <= 5) {
      return 'fitness';
    }
    if (pkg.credits && pkg.credits <= 10) {
      return 'medal';
    }
    return 'trophy';
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        !pkg.is_active && styles.inactiveCard,
        userOwnsPackage && styles.ownedCard,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name={getPackageIcon()} 
              size={24} 
              color={pkg.is_active ? COLORS.primary : COLORS.textSecondary} 
            />
          </View>
          <View style={styles.titleTextContainer}>
            <Text style={[
              styles.packageName,
              !pkg.is_active && styles.inactiveText
            ]}>
              {pkg.name}
            </Text>
            <View style={styles.badges}>
              {pkg.is_unlimited && (
                <View style={styles.unlimitedBadge}>
                  <Text style={styles.unlimitedText}>UNLIMITED</Text>
                </View>
              )}
              {!pkg.is_active && (
                <View style={styles.inactiveBadge}>
                  <Text style={styles.inactiveBadgeText}>INACTIVE</Text>
                </View>
              )}
              {userOwnsPackage && (
                <View style={styles.ownedBadge}>
                  <Text style={styles.ownedText}>OWNED</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={[
              styles.price,
              !pkg.is_active && styles.inactiveText
            ]}>
              {formatCurrency(pkg.price)}
            </Text>
          </View>
        </View>
      </View>

      {pkg.description && (
        <Text style={[
          styles.description,
          !pkg.is_active && styles.inactiveText
        ]} numberOfLines={2}>
          {pkg.description}
        </Text>
      )}

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Ionicons 
            name="ticket" 
            size={16} 
            color={pkg.is_active ? COLORS.textSecondary : COLORS.disabled} 
          />
          <Text style={[
            styles.detailText,
            !pkg.is_active && styles.inactiveText
          ]}>
            {pkg.is_unlimited ? 'Unlimited classes' : `${pkg.credits} credits`}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons 
            name="calendar" 
            size={16} 
            color={pkg.is_active ? COLORS.textSecondary : COLORS.disabled} 
          />
          <Text style={[
            styles.detailText,
            !pkg.is_active && styles.inactiveText
          ]}>
            Valid for {formatValidityDays(pkg.validity_days)}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons 
            name="calculator" 
            size={16} 
            color={pkg.is_active ? COLORS.success : COLORS.disabled} 
          />
          <Text style={[
            styles.detailText,
            !pkg.is_active && styles.inactiveText,
            pkg.is_active && styles.valueText
          ]}>
            {pkg.is_unlimited 
              ? `₪${(pkg.price / 30).toFixed(2)}/day` 
              : `₪${(pkg.price / (pkg.credits || 1)).toFixed(2)}/class`
            }
          </Text>
        </View>
      </View>

      {showActions && (
        <View style={styles.actions}>
          {/* Student actions */}
          {isStudent && pkg.is_active && !userOwnsPackage && (
            <TouchableOpacity style={styles.purchaseButton} onPress={onPurchase}>
              <Ionicons name="card" size={16} color={COLORS.white} />
              <Text style={styles.purchaseButtonText}>Purchase</Text>
            </TouchableOpacity>
          )}

          {isStudent && userOwnsPackage && (
            <TouchableOpacity style={styles.ownedButton} onPress={onPress}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              <Text style={styles.ownedButtonText}>View Details</Text>
            </TouchableOpacity>
          )}

          {/* Admin actions */}
          {isAdmin && isAdminMode && (
            <>
              {onToggle && (
                <TouchableOpacity 
                  style={[styles.toggleButton, pkg.is_active ? styles.deactivateButton : styles.activateButton]} 
                  onPress={onToggle}
                >
                  <Ionicons 
                    name={pkg.is_active ? "pause" : "play"} 
                    size={16} 
                    color={pkg.is_active ? COLORS.warning : COLORS.success} 
                  />
                  <Text style={[styles.toggleButtonText, pkg.is_active ? styles.deactivateText : styles.activateText]}>
                    {pkg.is_active ? 'Deactivate' : 'Activate'}
                  </Text>
                </TouchableOpacity>
              )}
              {onEdit && (
                <TouchableOpacity style={styles.editButton} onPress={onEdit}>
                  <Ionicons name="pencil" size={16} color={COLORS.primary} />
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
                  <Ionicons name="trash" size={16} color={COLORS.error} />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              )}
            </>
          )}
          
          {isAdmin && !isAdminMode && (
            <TouchableOpacity style={styles.viewButton} onPress={onPress}>
              <Ionicons name="eye" size={16} color={COLORS.primary} />
              <Text style={styles.viewButtonText}>View</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inactiveCard: {
    backgroundColor: '#f8f9fa',
    opacity: 0.7,
  },
  ownedCard: {
    borderWidth: 2,
    borderColor: COLORS.success,
  },
  header: {
    marginBottom: SPACING.md,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleTextContainer: {
    flex: 1,
  },
  packageName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  badges: {
    flexDirection: 'row',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  unlimitedBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  unlimitedText: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: '600',
  },
  inactiveBadge: {
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  inactiveBadgeText: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: '600',
  },
  ownedBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ownedText: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: '600',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  details: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  detailText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
  valueText: {
    color: COLORS.success,
    fontWeight: '600',
  },
  inactiveText: {
    color: COLORS.disabled,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  purchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    gap: 4,
    flex: 1,
    justifyContent: 'center',
  },
  purchaseButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  ownedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    gap: 4,
    flex: 1,
    justifyContent: 'center',
  },
  ownedButtonText: {
    color: COLORS.success,
    fontSize: 14,
    fontWeight: '600',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
    gap: 4,
  },
  viewButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
    gap: 4,
  },
  editButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
    gap: 4,
  },
  deleteButtonText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '600',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
    gap: 4,
  },
  activateButton: {
    backgroundColor: '#e8f5e8',
  },
  deactivateButton: {
    backgroundColor: '#fff3e0',
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activateText: {
    color: COLORS.success,
  },
  deactivateText: {
    color: COLORS.warning,
  },
});

export default PackageCard;