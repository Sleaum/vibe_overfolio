// Langues du site : la liste, la langue de départ et l'instance vue-i18n.
//
// - Les textes sont dans fr.json, en.json et th.json, avec exactement les mêmes clés (vérifié au build,
//   plugin « langues » de vite.config.ts). Un texte manquant s'affiche en français (fallbackLocale).
// - Composants : `const { t } = useI18n()` puis `{{ t('nav.charts') }}`. Hors composant (lib/, routeur) : `t()` ci-dessous.
// - Nombres et dates : lib/format.js, qui suit la langue active (intlLocale).
// - Pour ajouter une langue : une entrée dans LANGUAGES et un fichier <code>.json avec toutes les clés.

import { watch } from 'vue'
import { createI18n } from 'vue-i18n'
import { readPreference, writePreference } from '../lib/preferences.js'
import en from './en.json'
import fr from './fr.json'
import th from './th.json'

/**
 * Langues proposées, dans l'ordre du menu.
 * `name` : nom de la langue dans la langue elle-même. `intl` : réglage des nombres et des dates (Intl).
 * Thaï : calendrier grégorien imposé, sinon les années s'affichent en ère bouddhiste (2026 → 2569).
 */
export const LANGUAGES = [
  { code: 'fr', name: 'Français', intl: 'fr-FR' },
  { code: 'en', name: 'English', intl: 'en-GB' },
  { code: 'th', name: 'ไทย', intl: 'th-TH-u-ca-gregory' },
]

export const DEFAULT_LOCALE = 'fr'

const known = (code) => LANGUAGES.some((language) => language.code === code)

/** Choix enregistré, sinon première langue du navigateur proposée par le site, sinon le français. */
function startingLocale() {
  const saved = readPreference('locale')
  if (known(saved)) return saved
  const browser = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]
  for (const tag of browser) {
    const code = String(tag).toLowerCase().split('-')[0]
    if (known(code)) return code
  }
  return DEFAULT_LOCALE
}

export const i18n = createI18n({
  legacy: false,
  locale: startingLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { fr, en, th },
})

/** Langue active (ref réactive : un calcul qui la lit est refait quand elle change). */
export const locale = i18n.global.locale

/** Traduction hors composant. */
export const t = (...args) => i18n.global.t(...args)

/** Réglage Intl de la langue active ('fr-FR', 'en-GB'…). Lu dans un computed, il le refait au changement de langue. */
export function intlLocale() {
  return LANGUAGES.find((language) => language.code === locale.value)?.intl ?? 'fr-FR'
}

/** Appelle `callback(code)` à chaque changement de langue (titre de l'onglet…). */
export function onLocaleChange(callback) {
  return watch(locale, callback)
}

/** Change de langue et s'en souvient. */
export function setLocale(code) {
  if (!known(code)) return
  locale.value = code
  writePreference('locale', code)
}

// <html lang="…"> suit la langue : lecteurs d'écran, césure, police du système pour le thaï
if (typeof document !== 'undefined') {
  watch(locale, (code) => (document.documentElement.lang = code), { immediate: true })
}
