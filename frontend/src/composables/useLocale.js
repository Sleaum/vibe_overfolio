// Langue du site, pour les composants : langue active, liste des langues, changement (mémorisé).
// Tout est défini dans i18n/index.js ; ce composable n'en est que l'accès, comme useTheme pour le thème.

import { LANGUAGES, locale, setLocale } from '../i18n/index.js'

export function useLocale() {
  return { locale, languages: LANGUAGES, setLocale }
}
