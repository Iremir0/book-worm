import { createClient } from './supabase/client';
import { type Locale, locales, defaultLocale } from '@/i18n/config';

/**
 * Detects the user's preferred language from browser settings
 */
export function detectBrowserLanguage(): Locale {
  if (typeof window === 'undefined') return defaultLocale;

  const browserLang = navigator.language.split('-')[0];
  return locales.includes(browserLang as Locale)
    ? (browserLang as Locale)
    : defaultLocale;
}

/**
 * Gets the current locale from cookie
 */
export function getCurrentLocale(): Locale {
  if (typeof document === 'undefined') return defaultLocale;

  const cookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('NEXT_LOCALE='));

  const locale = cookie?.split('=')[1] as Locale | undefined;
  return locale && locales.includes(locale) ? locale : defaultLocale;
}

/**
 * Sets the locale in cookie and optionally updates user profile
 */
export async function setLocale(locale: Locale, updateProfile = true): Promise<void> {
  // Set cookie for immediate effect
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`;

  // Update user profile if logged in
  if (updateProfile) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from('profiles')
        .update({ language: locale })
        .eq('id', user.id);
    }
  }

  // Reload to apply new locale
  window.location.reload();
}

/**
 * Initializes locale on first visit
 */
export async function initializeLocale(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Check if locale is already set
  const currentLocale = getCurrentLocale();
  if (currentLocale !== defaultLocale) return;

  let preferredLocale: Locale = defaultLocale;

  // Try to get from user profile first
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('language')
      .eq('id', user.id)
      .single();

    if (profile?.language && locales.includes(profile.language as Locale)) {
      preferredLocale = profile.language as Locale;
    }
  }

  // Fallback to browser detection
  if (preferredLocale === defaultLocale) {
    preferredLocale = detectBrowserLanguage();
  }

  // Set the locale without reloading (first time setup)
  if (preferredLocale !== defaultLocale) {
    document.cookie = `NEXT_LOCALE=${preferredLocale}; path=/; max-age=31536000; SameSite=Lax`;

    if (user) {
      await supabase
        .from('profiles')
        .update({ language: preferredLocale })
        .eq('id', user.id);
    }
  }
}
