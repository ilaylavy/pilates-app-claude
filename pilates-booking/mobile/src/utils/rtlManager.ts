import { I18nManager, Dimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as Updates from 'expo-updates';

export interface RTLConfig {
  isRTL: boolean;
  textAlign: 'left' | 'right';
  flexDirection: 'row' | 'row-reverse';
  alignSelf: 'flex-start' | 'flex-end';
}

class RTLManager {
  private currentRTL: boolean = false;
  private subscribers: ((isRTL: boolean) => void)[] = [];

  constructor() {
    this.currentRTL = I18nManager.isRTL;
  }

  /**
   * Subscribe to RTL changes
   */
  subscribe(callback: (isRTL: boolean) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Notify all subscribers of RTL change
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback(this.currentRTL));
  }

  /**
   * Update RTL state manually (for instant switching)
   */
  setRTL(isRTL: boolean): void {
    if (this.currentRTL !== isRTL) {
      this.currentRTL = isRTL;
      this.notifySubscribers();
    }
  }

  /**
   * Check if the current layout is RTL
   */
  isRTL(): boolean {
    return !this.currentRTL;
  }

  /**
   * Get RTL configuration object for styling
   */
  getRTLConfig(): RTLConfig {
    return {
      isRTL: this.currentRTL,
      textAlign: this.currentRTL ? 'right' : 'left',
      flexDirection: this.currentRTL ? 'row-reverse' : 'row',
      alignSelf: this.currentRTL ? 'flex-end' : 'flex-start',
    };
  }

  /**
   * Force RTL layout change
   */
  async forceRTL(isRTL: boolean): Promise<void> {
    if (this.currentRTL === isRTL) {
      return; // No change needed
    }

    try {
      // Enable RTL support
      I18nManager.allowRTL(true);
      
      // Force the layout direction
      I18nManager.forceRTL(isRTL);
      
      this.currentRTL = isRTL;

      // Restart the app to apply RTL changes
      // Note: This is required for proper RTL support on both platforms
      if (Updates.isEnabled) {
        await Updates.reloadAsync();
      } else {
        // In development, we can't use Updates.reloadAsync
        // The user will need to manually restart the app
        console.warn('RTL change applied. Please restart the app for full effect.');
      }
    } catch (error) {
      console.error('Failed to set RTL direction:', error);
      throw new Error('Failed to change language direction');
    }
  }

  /**
   * Get margin/padding values that respect RTL
   */
  getSpacing(left: number, right: number) {
    if (this.currentRTL) {
      return {
        marginLeft: right,
        marginRight: left,
        paddingLeft: right,
        paddingRight: left,
      };
    }
    return {
      marginLeft: left,
      marginRight: right,
      paddingLeft: left,
      paddingRight: right,
    };
  }

  /**
   * Get directional spacing (start/end)
   */
  getDirectionalSpacing(start: number, end: number) {
    return this.currentRTL 
      ? { marginLeft: end, marginRight: start, paddingLeft: end, paddingRight: start }
      : { marginLeft: start, marginRight: end, paddingLeft: start, paddingRight: end };
  }

  /**
   * Transform styles for RTL compatibility
   */
  transformStyle(style: any): any {
    if (!this.currentRTL) {
      return style;
    }

    const transformedStyle = { ...style };

    // Handle margins
    if (style.marginLeft !== undefined || style.marginRight !== undefined) {
      const left = style.marginLeft || 0;
      const right = style.marginRight || 0;
      transformedStyle.marginLeft = right;
      transformedStyle.marginRight = left;
    }

    // Handle padding
    if (style.paddingLeft !== undefined || style.paddingRight !== undefined) {
      const left = style.paddingLeft || 0;
      const right = style.paddingRight || 0;
      transformedStyle.paddingLeft = right;
      transformedStyle.paddingRight = right;
    }

    // Handle borders
    if (style.borderLeftWidth !== undefined || style.borderRightWidth !== undefined) {
      const left = style.borderLeftWidth || 0;
      const right = style.borderRightWidth || 0;
      transformedStyle.borderLeftWidth = right;
      transformedStyle.borderRightWidth = left;
    }

    if (style.borderLeftColor !== undefined || style.borderRightColor !== undefined) {
      const leftColor = style.borderLeftColor;
      const rightColor = style.borderRightColor;
      transformedStyle.borderLeftColor = rightColor;
      transformedStyle.borderRightColor = leftColor;
    }

    // Handle positioning
    if (style.left !== undefined || style.right !== undefined) {
      const left = style.left;
      const right = style.right;
      transformedStyle.left = right;
      transformedStyle.right = left;
    }

    // Handle text alignment
    if (style.textAlign === 'left') {
      transformedStyle.textAlign = 'right';
    } else if (style.textAlign === 'right') {
      transformedStyle.textAlign = 'left';
    }

    // Handle flex direction
    if (style.flexDirection === 'row') {
      transformedStyle.flexDirection = 'row-reverse';
    } else if (style.flexDirection === 'row-reverse') {
      transformedStyle.flexDirection = 'row';
    }

    return transformedStyle;
  }

  /**
   * Get icon rotation for RTL (useful for arrows, etc.)
   */
  getIconRotation(baseRotation: string = '0deg'): string {
    if (!this.currentRTL) {
      return baseRotation;
    }

    // Parse rotation value
    const rotationValue = parseFloat(baseRotation);
    
    // Flip horizontally for RTL
    return `${180 - rotationValue}deg`;
  }

  /**
   * Get navigation options for RTL support
   */
  getNavigationScreenOptions() {
    return {
      headerTitleAlign: this.currentRTL ? 'right' : 'left',
      gestureDirection: this.currentRTL ? 'horizontal-inverted' : 'horizontal',
    };
  }

  /**
   * Flip animation direction for RTL
   */
  getAnimationDirection(direction: 'left' | 'right'): 'left' | 'right' {
    if (!this.currentRTL) {
      return direction;
    }
    
    return direction === 'left' ? 'right' : 'left';
  }

  /**
   * Get screen width (useful for animations and positioning)
   */
  getScreenWidth(): number {
    return Dimensions.get('window').width;
  }

  /**
   * Convert pixel position for RTL
   */
  convertPosition(position: number): number {
    if (!this.currentRTL) {
      return position;
    }
    
    return this.getScreenWidth() - position;
  }

  /**
   * Get text writing direction
   */
  getWritingDirection(): 'ltr' | 'rtl' {
    return this.currentRTL ? 'rtl' : 'ltr';
  }

  /**
   * Check if a specific language requires RTL
   */
  static isRTLLanguage(languageCode: string): boolean {
    const rtlLanguages = ['he', 'ar', 'fa', 'ur', 'yi'];
    return rtlLanguages.includes(languageCode.toLowerCase());
  }

  /**
   * Reset RTL to system default
   */
  resetToSystemDefault(): void {
    this.currentRTL = I18nManager.isRTL;
  }
}

// Create singleton instance
export const rtlManager = new RTLManager();

// Export convenience functions
export const isRTL = () => rtlManager.isRTL();
export const getRTLConfig = () => rtlManager.getRTLConfig();
export const transformStyle = (style: any) => rtlManager.transformStyle(style);
export const getSpacing = (left: number, right: number) => rtlManager.getSpacing(left, right);
export const getDirectionalSpacing = (start: number, end: number) => rtlManager.getDirectionalSpacing(start, end);
export const forceRTL = (isRTL: boolean) => rtlManager.forceRTL(isRTL);
export const getIconRotation = (rotation?: string) => rtlManager.getIconRotation(rotation);
export const getAnimationDirection = (direction: 'left' | 'right') => rtlManager.getAnimationDirection(direction);
export const convertPosition = (position: number) => rtlManager.convertPosition(position);
export const getWritingDirection = () => rtlManager.getWritingDirection();

export default rtlManager;