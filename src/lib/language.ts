export type SourceLanguage = 'en' | 'ne'

export const SOURCE_LANGUAGES: { key: SourceLanguage; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'ne', label: 'Nepali' },
]

export const SOURCE_LANGUAGE_STORAGE_KEY = 'examready:source-language'

export function isSourceLanguage(value: unknown): value is SourceLanguage {
  return value === 'en' || value === 'ne'
}

export function sourceLanguageLabel(language: SourceLanguage): string {
  return SOURCE_LANGUAGES.find(item => item.key === language)?.label ?? 'English'
}
