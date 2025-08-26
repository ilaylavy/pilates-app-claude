import { ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { rtlManager } from './rtlManager';

export type Style = ViewStyle | TextStyle | ImageStyle;
export type RTLStyle = Style & {
  // RTL-specific properties
  writingDirection?: 'rtl' | 'ltr';
};

/**
 * RTL-aware style utilities
 */
export class StyleUtils {
  /**
   * Apply RTL transformations to a style object
   */
  static flipStyle(style: Style): Style {
    return rtlManager.transformStyle(style);
  }

  /**
   * Create margin with start/end instead of left/right
   */
  static marginHorizontal(start: number, end?: number): ViewStyle {
    const endValue = end !== undefined ? end : start;
    return rtlManager.getDirectionalSpacing(start, endValue);
  }

  /**
   * Create padding with start/end instead of left/right
   */
  static paddingHorizontal(start: number, end?: number): ViewStyle {
    const endValue = end !== undefined ? end : start;
    const spacing = rtlManager.getDirectionalSpacing(start, endValue);
    return {
      paddingLeft: spacing.paddingLeft,
      paddingRight: spacing.paddingRight,
    };
  }

  /**
   * Get margin start (left in LTR, right in RTL)
   */
  static marginStart(value: number): ViewStyle {
    return rtlManager.isRTL() 
      ? { marginRight: value } 
      : { marginLeft: value };
  }

  /**
   * Get margin end (right in LTR, left in RTL)
   */
  static marginEnd(value: number): ViewStyle {
    return rtlManager.isRTL() 
      ? { marginLeft: value } 
      : { marginRight: value };
  }

  /**
   * Get padding start (left in LTR, right in RTL)
   */
  static paddingStart(value: number): ViewStyle {
    return rtlManager.isRTL() 
      ? { paddingRight: value } 
      : { paddingLeft: value };
  }

  /**
   * Get padding end (right in LTR, left in RTL)
   */
  static paddingEnd(value: number): ViewStyle {
    return rtlManager.isRTL() 
      ? { paddingLeft: value } 
      : { paddingRight: value };
  }

  /**
   * Get text alignment based on RTL
   */
  static textAlign(align?: 'left' | 'right' | 'center' | 'auto'): TextStyle {
    if (align === 'center') {
      return { textAlign: 'center' };
    }
    
    if (align === 'auto' || !align) {
      return { textAlign: rtlManager.isRTL() ? 'right' : 'left' };
    }

    // Flip left/right for RTL
    if (rtlManager.isRTL()) {
      return { textAlign: align === 'left' ? 'right' : 'left' };
    }

    return { textAlign: align };
  }

  /**
   * Get flex direction that respects RTL
   */
  static flexDirection(direction: 'row' | 'column' | 'row-reverse' | 'column-reverse'): ViewStyle {
    if (direction === 'column' || direction === 'column-reverse') {
      return { flexDirection: direction };
    }

    if (!rtlManager.isRTL()) {
      return { flexDirection: direction };
    }

    // Flip row directions for RTL
    const flippedDirection = direction === 'row' ? 'row-reverse' : 'row';
    return { flexDirection: flippedDirection };
  }

  /**
   * Position element at start (left in LTR, right in RTL)
   */
  static positionStart(value: number): ViewStyle {
    return rtlManager.isRTL() 
      ? { right: value } 
      : { left: value };
  }

  /**
   * Position element at end (right in LTR, left in RTL)
   */
  static positionEnd(value: number): ViewStyle {
    return rtlManager.isRTL() 
      ? { left: value } 
      : { right: value };
  }

  /**
   * Create border with start/end awareness
   */
  static borderStart(width: number, color?: string): ViewStyle {
    const borderSide = rtlManager.isRTL() ? 'borderRightWidth' : 'borderLeftWidth';
    const borderColorSide = rtlManager.isRTL() ? 'borderRightColor' : 'borderLeftColor';
    
    const style: ViewStyle = { [borderSide]: width };
    if (color) {
      style[borderColorSide] = color;
    }
    
    return style;
  }

  /**
   * Create border with end awareness
   */
  static borderEnd(width: number, color?: string): ViewStyle {
    const borderSide = rtlManager.isRTL() ? 'borderLeftWidth' : 'borderRightWidth';
    const borderColorSide = rtlManager.isRTL() ? 'borderLeftColor' : 'borderRightColor';
    
    const style: ViewStyle = { [borderSide]: width };
    if (color) {
      style[borderColorSide] = color;
    }
    
    return style;
  }

  /**
   * Get shadow offset that respects RTL
   */
  static shadowOffset(x: number, y: number): ViewStyle {
    return {
      shadowOffset: {
        width: rtlManager.isRTL() ? -x : x,
        height: y,
      },
    };
  }

  /**
   * Get transform rotation for icons that need to flip in RTL
   */
  static iconTransform(rotation?: number): ViewStyle {
    if (!rtlManager.isRTL() || rotation === undefined) {
      return rotation !== undefined ? { transform: [{ rotate: `${rotation}deg` }] } : {};
    }

    // Flip the rotation for RTL
    return { transform: [{ rotate: `${-rotation}deg` }] };
  }

  /**
   * Combine multiple RTL-aware styles
   */
  static combine(...styles: (Style | undefined | null)[]): Style {
    const filteredStyles = styles.filter((style): style is Style => 
      style !== undefined && style !== null
    );

    return filteredStyles.reduce((combined, style) => ({
      ...combined,
      ...rtlManager.transformStyle(style),
    }), {} as Style);
  }

  /**
   * Create responsive horizontal spacing based on screen size
   */
  static responsiveHorizontal(baseStart: number, baseEnd?: number): ViewStyle {
    const screenWidth = rtlManager.getScreenWidth();
    const scale = Math.min(screenWidth / 375, 1.5); // Scale based on iPhone X width
    
    const scaledStart = Math.round(baseStart * scale);
    const scaledEnd = baseEnd !== undefined ? Math.round(baseEnd * scale) : scaledStart;
    
    return this.marginHorizontal(scaledStart, scaledEnd);
  }

  /**
   * Helper to create consistent spacing values
   */
  static spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  };

  /**
   * Helper to create common layout styles
   */
  static layout = {
    container: (): ViewStyle => ({
      flex: 1,
      ...this.paddingHorizontal(this.spacing.md),
    }),
    
    row: (): ViewStyle => ({
      ...this.flexDirection('row'),
      alignItems: 'center',
    }),
    
    rowBetween: (): ViewStyle => ({
      ...this.flexDirection('row'),
      justifyContent: 'space-between',
      alignItems: 'center',
    }),
    
    rowStart: (): ViewStyle => ({
      ...this.flexDirection('row'),
      justifyContent: rtlManager.isRTL() ? 'flex-end' : 'flex-start',
      alignItems: 'center',
    }),
    
    rowEnd: (): ViewStyle => ({
      ...this.flexDirection('row'),
      justifyContent: rtlManager.isRTL() ? 'flex-start' : 'flex-end',
      alignItems: 'center',
    }),

    center: (): ViewStyle => ({
      justifyContent: 'center',
      alignItems: 'center',
    }),

    card: (): ViewStyle => ({
      backgroundColor: '#ffffff',
      borderRadius: 8,
      ...this.paddingHorizontal(this.spacing.md),
      paddingVertical: this.spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }),
  };

  /**
   * Typography helpers with RTL support
   */
  static typography = {
    h1: (): TextStyle => ({
      fontSize: 32,
      fontWeight: 'bold',
      ...this.textAlign('auto'),
    }),
    
    h2: (): TextStyle => ({
      fontSize: 24,
      fontWeight: 'bold',
      ...this.textAlign('auto'),
    }),
    
    h3: (): TextStyle => ({
      fontSize: 18,
      fontWeight: '600',
      ...this.textAlign('auto'),
    }),
    
    body: (): TextStyle => ({
      fontSize: 16,
      ...this.textAlign('auto'),
    }),
    
    caption: (): TextStyle => ({
      fontSize: 12,
      color: '#666',
      ...this.textAlign('auto'),
    }),
  };
}

// Export convenience functions
export const {
  flipStyle,
  marginHorizontal,
  paddingHorizontal,
  marginStart,
  marginEnd,
  paddingStart,
  paddingEnd,
  textAlign,
  flexDirection,
  positionStart,
  positionEnd,
  borderStart,
  borderEnd,
  shadowOffset,
  iconTransform,
  combine,
  responsiveHorizontal,
  spacing,
  layout,
  typography,
} = StyleUtils;

export default StyleUtils;