# Language/Internationalization Feature

## Overview

The Book Worm application now supports multiple languages with automatic detection and manual switching capabilities.

## Supported Languages

- **English (en)** - Default language 🇺🇸
- **Turkish (tr)** - Turkish translation 🇹🇷

## Features Implemented

### 1. Automatic Language Detection
- On first visit, the app detects the user's browser language
- If browser language is Turkish, Turkish is automatically selected
- Otherwise, defaults to English

### 2. User Preference Storage
- Language preference is stored in the user's profile in the database
- Cookie-based preference (`NEXT_LOCALE`) for instant language switching
- Preference persists across sessions

### 3. Language Switcher in Navbar
- Visible in the top navigation bar (between nav links and user menu)
- Shows current language flag and name
- Dropdown menu to switch between languages
- Checkmark indicates current selection

### 4. Location-Based Detection
- Uses browser's `navigator.language` API
- Falls back to English if language is not supported
- Automatically initializes on user login

## File Structure

```
book-worm/
├── messages/
│   ├── en.json              # English translations
│   └── tr.json              # Turkish translations
├── src/
│   ├── i18n/
│   │   ├── config.ts        # Locale configuration (shared constants)
│   │   └── request.ts       # Next-intl request configuration
│   ├── components/
│   │   ├── language-switcher.tsx       # Language dropdown component
│   │   └── language-initializer.tsx    # Auto-detects and sets language on load
│   └── lib/
│       └── language.ts      # Language utility functions
├── supabase/
│   └── migrations/
│       └── add_language_to_profiles.sql  # Database migration
└── next.config.ts           # Next.js config with next-intl plugin
```

## How It Works

### 1. Language Detection Flow
```
User visits app
    ↓
Check cookie (NEXT_LOCALE)
    ↓ (if not set)
Check user profile in database
    ↓ (if not set)
Detect browser language
    ↓
Set language and save to cookie + profile
```

### 2. Language Switching Flow
```
User clicks language switcher
    ↓
Select new language
    ↓
Update cookie (NEXT_LOCALE)
    ↓
Update user profile in database
    ↓
Page reloads with new language
```

## Database Changes

A new column has been added to the `profiles` table:

```sql
ALTER TABLE profiles ADD COLUMN language VARCHAR(2) DEFAULT 'en';
```

**Migration file:** [`supabase/migrations/add_language_to_profiles.sql`](supabase/migrations/add_language_to_profiles.sql)

**To apply the migration:**

```bash
# If using Supabase CLI
supabase db push

# Or manually run the SQL in your Supabase dashboard
```

## Adding New Languages

To add support for a new language (e.g., Spanish):

1. **Add locale to config** ([src/i18n/config.ts](src/i18n/config.ts)):
   ```typescript
   export const locales = ['en', 'tr', 'es'] as const;
   ```

2. **Create translation file** (`messages/es.json`):
   ```json
   {
     "common": {
       "search": "Buscar",
       ...
     }
   }
   ```

3. **Update language switcher** ([src/components/language-switcher.tsx](src/components/language-switcher.tsx)):
   ```typescript
   const languages: Record<Locale, { name: string; flag: string }> = {
     en: { name: 'English', flag: '🇺🇸' },
     tr: { name: 'Türkçe', flag: '🇹🇷' },
     es: { name: 'Español', flag: '🇪🇸' }, // Add new language
   }
   ```

4. **Update database constraint** (optional, for validation):
   ```sql
   ALTER TABLE profiles DROP CONSTRAINT IF EXISTS valid_language_code;
   ALTER TABLE profiles ADD CONSTRAINT valid_language_code
     CHECK (language IN ('en', 'tr', 'es'));
   ```

## Using Translations in Components

### Client Components
```tsx
'use client'
import { useTranslations } from 'next-intl';

export function MyComponent() {
  const t = useTranslations('common');

  return <button>{t('search')}</button>;
}
```

### Server Components
```tsx
import { getTranslations } from 'next-intl/server';

export default async function MyPage() {
  const t = await getTranslations('common');

  return <h1>{t('search')}</h1>;
}
```

## Translation Structure

The translation files follow this structure:

```json
{
  "common": {        // Common UI elements
    "search": "Search",
    "save": "Save",
    ...
  },
  "nav": {           // Navigation bar
    "home": "Home",
    "books": "Books",
    ...
  },
  "auth": {          // Authentication pages
    "login": { ... },
    "signup": { ... }
  },
  "books": { ... },  // Books page
  "shelves": { ... }, // Shelves page
  ...
}
```

## API Reference

### Language Utility Functions

**`detectBrowserLanguage()`**
- Detects user's browser language
- Returns: `Locale` ('en' or 'tr')

**`getCurrentLocale()`**
- Gets current language from cookie
- Returns: `Locale`

**`setLocale(locale: Locale, updateProfile?: boolean)`**
- Sets language preference
- Updates cookie and optionally database
- Reloads page to apply changes

**`initializeLocale()`**
- Auto-detects and initializes language on first visit
- Checks: cookie → profile → browser → default

## Testing

1. **Test automatic detection:**
   - Clear cookies
   - Change browser language to Turkish
   - Visit the app → Should default to Turkish

2. **Test manual switching:**
   - Click language switcher in navbar
   - Select different language
   - Page should reload with new language

3. **Test persistence:**
   - Switch language
   - Close browser
   - Reopen → Language preference should persist

## Notes

- Language preference is stored both in cookies (for immediate effect) and database (for persistence)
- The app automatically reloads when switching languages to ensure all translations are updated
- Only authenticated users can save language preferences to their profile
- Unauthenticated users can still use the language switcher, but preference is only stored in cookies

## Future Enhancements

Potential improvements for the language system:

- [ ] Add more languages (Spanish, French, German, etc.)
- [ ] Translate dynamic content (book descriptions, user reviews)
- [ ] Add locale-aware date/time formatting
- [ ] Implement language-specific currency formatting
- [ ] Add RTL (right-to-left) language support
- [ ] Translate email notifications
- [ ] Add language selection during signup flow
