# Internationalization (i18n) Guide

The mobile app supports full internationalization with Hebrew and English languages, including comprehensive RTL (Right-to-Left) layout support for Hebrew users.

## Features

- ✅ **Complete Language Support**: 470+ translation keys covering all app features
- ✅ **RTL Layout System**: Full Right-to-Left support for Hebrew
- ✅ **Hebrew Pluralization**: Proper grammar handling (one/two/many forms)
- ✅ **Localized Formatting**: Dates, times, and currency in Hebrew locale
- ✅ **Seamless Language Switching**: Runtime language toggle with app restart
- ✅ **Cultural Adaptation**: Contextually appropriate Hebrew translations

## Quick Start

### Using Translations in Components

```typescript
import { useTranslation } from '../hooks/useTranslation';

const MyComponent = () => {
  const { t, isRTL } = useTranslation();

  return (
    <Text style={[styles.text, { textAlign: isRTL ? 'right' : 'left' }]}>
      {t('home.greeting', { name: 'John' })}
    </Text>
  );
};
```

### RTL Layout Support

```typescript
// Container layouts
const styles = StyleSheet.create({
  container: {
    flexDirection: isRTL ? 'row-reverse' : 'row',  // Reverse for RTL
  },
  text: {
    textAlign: isRTL ? 'right' : 'left',           // Body text alignment
  },
  centerText: {
    textAlign: 'center',                           // Headers stay centered
  },
});
```

### Alert Messages

```typescript
// Always use translations for alerts
Alert.alert(
  t('common.success'), 
  t('booking.successMessage', { className: 'Pilates' })
);
```

## Available Translation Utilities

### Core Hook Functions

```typescript
const {
  t,                    // Translation function
  isRTL,               // Boolean: true if Hebrew/RTL active
  formatDate,          // Localized date formatting
  formatTime,          // Localized time formatting
  formatDateTime,      // Combined date + time formatting
  formatCurrency,      // Hebrew currency formatting (₪)
  getCurrentLanguage,  // Returns 'en' or 'he'
} = useTranslation();
```

### Translation Function Usage

```typescript
// Basic translation
t('auth.login')                           // → "Login" / "התחברות"

// With variables
t('home.greeting', { name: 'Sarah' })     // → "Hello, Sarah!" / "שלום, שרה!"

// Pluralization (Hebrew: one/two/many)
t('packages.credits', { count: 1 })       // → "1 credit" / "נקודת זכות 1"
t('packages.credits', { count: 5 })       // → "5 credits" / "5 נקודות זכות"
```

## Language Switching

### Using LanguageSwitcher Component

```typescript
import LanguageSwitcher from '../components/LanguageSwitcher';

// Modal version (recommended)
<LanguageSwitcher 
  visible={showLanguageModal}
  onClose={() => setShowLanguageModal(false)}
  variant="modal"
/>

// Inline version
<LanguageSwitcher variant="inline" />
```

### Manual Language Change

```typescript
import { i18nManager } from '../i18n/config';

// Change language programmatically
await i18nManager.setLocale('he');  // Switch to Hebrew
await i18nManager.setLocale('en');  // Switch to English
```

## Translation File Structure

### Key Organization (23 Categories)

```
mobile/src/i18n/locales/
├── en.json     # English translations
└── he.json     # Hebrew translations
```

**Main Categories:**
- `common` - Universal UI elements (OK, Cancel, Save, etc.)
- `auth` - Authentication (Login, Register, Passwords)
- `navigation` - Tab and screen titles
- `classes` - Class booking and management
- `bookings` - Booking history and management
- `packages` - Package purchases and credits
- `profile` - User profile and settings
- `admin` - Admin panel features
- `social` - Social features and friends
- `errors` - Error messages
- `alerts` - Alert dialog messages
- `forms` - Form labels and placeholders

### Example Translation Structure

```json
{
  "home": {
    "greeting": "Hello, {{name}}!",
    "studentSubtitle": "Welcome to your pilates journey"
  },
  "packages": {
    "credits": {
      "one": "{{count}} credit",
      "other": "{{count}} credits"
    }
  }
}
```

## Adding New Translations

### 1. Add to English File (`en.json`)

```json
{
  "myFeature": {
    "title": "My New Feature",
    "description": "This feature does amazing things",
    "button": "Click Me"
  }
}
```

### 2. Add Hebrew Translation (`he.json`)

```json
{
  "myFeature": {
    "title": "הפיצ'ר החדש שלי",
    "description": "הפיצ'ר הזה עושה דברים מדהימים", 
    "button": "לחץ עלי"
  }
}
```

### 3. Use in Component

```typescript
const MyFeatureScreen = () => {
  const { t, isRTL } = useTranslation();
  
  return (
    <View>
      <Text style={[styles.title, { textAlign: 'center' }]}>
        {t('myFeature.title')}
      </Text>
      <Text style={[styles.desc, { textAlign: isRTL ? 'right' : 'left' }]}>
        {t('myFeature.description')}
      </Text>
      <Button title={t('myFeature.button')} />
    </View>
  );
};
```

## Best Practices

### RTL Layout Guidelines

1. **Text Alignment**:
   - Body text: Use `textAlign: isRTL ? 'right' : 'left'`
   - Headers/titles: Use `textAlign: 'center'` (stays centered)
   - Numbers/data: Usually stay left-aligned

2. **Container Layouts**:
   - Horizontal layouts: `flexDirection: isRTL ? 'row-reverse' : 'row'`
   - Icon positioning: Consider RTL flow for arrows and navigation icons

3. **Consistent Patterns**:
   ```typescript
   // Good: Consistent RTL handling
   <Text style={[styles.text, { textAlign: isRTL ? 'right' : 'left' }]}>
     {t('some.key')}
   </Text>
   
   // Bad: Hardcoded alignment
   <Text style={{ textAlign: 'left' }}>
     {t('some.key')}
   </Text>
   ```

### Translation Key Naming

- Use hierarchical structure: `category.subcategory.key`
- Be descriptive: `auth.loginFailed` not `auth.error1`
- Group related keys: `alerts.*`, `buttons.*`, `forms.*`

### Hebrew Translation Guidelines

- Use natural, conversational Hebrew
- Apply proper Hebrew grammar rules
- Consider cultural context and local terminology
- Use Hebrew punctuation (״ ״) for quotes when appropriate

## Testing

### Language Toggle Testing

1. Switch to Hebrew and verify:
   - All text appears in Hebrew
   - RTL layout flows correctly
   - Dates/times use Hebrew locale
   - Currency shows ₪ symbol

2. Switch back to English and verify:
   - All text returns to English
   - LTR layout restored
   - Proper English formatting

### Missing Translation Detection

- Missing keys will show the key name in red (development)
- Check console for translation warnings
- Verify no English text appears in Hebrew mode

## File Locations

```
mobile/
├── src/
│   ├── i18n/
│   │   ├── config.ts              # Main i18n configuration
│   │   └── locales/
│   │       ├── en.json           # English translations
│   │       └── he.json           # Hebrew translations
│   ├── hooks/
│   │   └── useTranslation.ts     # Translation hook
│   └── components/
│       └── LanguageSwitcher.tsx  # Language switching UI
```

## Troubleshooting

### Common Issues

1. **App Not Restarting After Language Change**
   - Hebrew/RTL requires app restart for layout changes
   - LanguageSwitcher handles this automatically

2. **Missing Translations Show English**
   - Check key exists in both `en.json` and `he.json`
   - Verify key path is correct (case-sensitive)

3. **RTL Layout Issues**
   - Ensure `isRTL` condition is applied to container styles
   - Check `flexDirection` and `textAlign` properties

4. **Hebrew Text Appears Broken**
   - Verify Hebrew characters are properly encoded in JSON
   - Check font supports Hebrew characters

For more examples, see existing component implementations in `src/screens/` and `src/components/`.