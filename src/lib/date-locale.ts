// Locale helpers for presentational date/time formatting.
// Maps the active next-intl locale ('en' | 'es' | 'pt') to a date-fns Locale
// and to localized relative-day words. Purely presentational.
import { enUS, es, ptBR, type Locale } from "date-fns/locale";

// Returns the date-fns Locale for the active app locale.
export function dfLocale(locale: string): Locale {
  switch (locale) {
    case "es":
      return es;
    case "pt":
      return ptBR;
    default:
      return enUS;
  }
}

// BCP-47 locale string for native Intl / toLocale* APIs ('pt' → 'pt-BR').
export function intlLocale(locale: string): string {
  switch (locale) {
    case "pt":
      return "pt-BR";
    case "es":
      return "es";
    default:
      return "en";
  }
}

// Localized "Today / Tomorrow / Yesterday" words.
export function relativeWords(locale: string): {
  today: string;
  tomorrow: string;
  yesterday: string;
} {
  switch (locale) {
    case "es":
      return { today: "Hoy", tomorrow: "Mañana", yesterday: "Ayer" };
    case "pt":
      return { today: "Hoje", tomorrow: "Amanhã", yesterday: "Ontem" };
    default:
      return { today: "Today", tomorrow: "Tomorrow", yesterday: "Yesterday" };
  }
}
