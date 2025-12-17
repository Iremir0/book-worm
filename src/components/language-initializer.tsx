'use client'

import { useEffect } from 'react'
import { initializeLocale } from '@/lib/language'

export function LanguageInitializer() {
  useEffect(() => {
    initializeLocale()
  }, [])

  return null
}
