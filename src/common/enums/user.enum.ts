export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  AWAY = 'AWAY',
}

export const SUPPORTED_LANGUAGES = [
  'en', 'bn', 'es', 'fr', 'de',
  'ar', 'zh', 'ja', 'ko', 'hi',
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
