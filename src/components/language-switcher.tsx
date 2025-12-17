'use client'

import { useState, useEffect } from 'react'
import { Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type Locale, locales } from '@/i18n/config'
import { getCurrentLocale, setLocale } from '@/lib/language'

const languages: Record<Locale, { name: string; flag: string }> = {
  en: { name: 'English', flag: '🇺🇸' },
  tr: { name: 'Türkçe', flag: '🇹🇷' },
}

export function LanguageSwitcher() {
  const [currentLocale, setCurrentLocale] = useState<Locale>('en')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setCurrentLocale(getCurrentLocale())
    setMounted(true)
  }, [])

  const handleLanguageChange = async (locale: Locale) => {
    await setLocale(locale)
  }

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Globe className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <span className="text-lg">{languages[currentLocale].flag}</span>
          <span className="hidden sm:inline">{languages[currentLocale].name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => handleLanguageChange(locale)}
            className="gap-2 cursor-pointer"
          >
            <span className="text-lg">{languages[locale].flag}</span>
            <span>{languages[locale].name}</span>
            {locale === currentLocale && (
              <span className="ml-auto text-xs text-muted-foreground">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
