export interface Language {
  code: string;
  label: string;
  flag: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: "pt", label: "Português",  flag: "🇧🇷", nativeName: "Português" },
  { code: "en", label: "English",    flag: "🇺🇸", nativeName: "English" },
  { code: "es", label: "Español",    flag: "🇪🇸", nativeName: "Español" },
  { code: "fr", label: "Français",   flag: "🇫🇷", nativeName: "Français" },
  { code: "it", label: "Italiano",   flag: "🇮🇹", nativeName: "Italiano" },
  { code: "de", label: "Deutsch",    flag: "🇩🇪", nativeName: "Deutsch" },
  { code: "ru", label: "Русский",    flag: "🇷🇺", nativeName: "Русский" },
  { code: "zh", label: "中文",        flag: "🇨🇳", nativeName: "中文" },
  { code: "ar", label: "العربية",    flag: "🇸🇦", nativeName: "العربية" },
  { code: "tr", label: "Türkçe",     flag: "🇹🇷", nativeName: "Türkçe" },
  { code: "ko", label: "한국어",       flag: "🇰🇷", nativeName: "한국어" },
  { code: "ja", label: "日本語",       flag: "🇯🇵", nativeName: "日本語" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱", nativeName: "Nederlands" },
  { code: "pl", label: "Polski",     flag: "🇵🇱", nativeName: "Polski" },
  { code: "uk", label: "Українська", flag: "🇺🇦", nativeName: "Українська" },
  { code: "hi", label: "हिन्दी",       flag: "🇮🇳", nativeName: "हिन्दी" },
];

export function getLanguage(code: string): Language | undefined {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code);
}
