// Mode clair ou sombre.
// Par défaut, le site suit le réglage du système ; le bouton de l'en-tête force l'un ou l'autre et s'en souvient
// (préférence « theme » de lib/preferences.js). La classe « dark » est posée sur <html> dès index.html,
// avant le premier affichage ; ce module prend le relais une fois Vue lancé.
// Avec un compte connecté, le choix est aussi enregistré sur son profil en base et retrouvé sur tout appareil
// (themeSetting, appliqué par lib/profile.js ; enregistrement et retour en arrière : lib/profileSetting.js) ;
// la préférence du navigateur en garde une copie pour que index.html l'applique dès le chargement suivant.

import { ref, watch } from 'vue'
import { COLORS } from '../lib/theme.js'
import { createProfileSetting } from '../lib/profileSetting.js'

const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null

/** Choix : 'light', 'dark', ou '' pour suivre le système. */
export const themeSetting = createProfileSetting({
  field: 'theme',
  preference: 'theme',
  default: '',
  validate: (raw) => (raw === '' || raw === 'light' || raw === 'dark' ? raw : null),
  toPreference: (theme) => theme,
  onlyWhenSignedIn: true,
})

const isDark = ref(typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

function apply(dark) {
  isDark.value = dark
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? COLORS.paper.dark : COLORS.paper.light)
}

// La page suit le choix : forcé, ou celui du système
watch(themeSetting.value, (theme) => apply(theme === 'dark' || (theme === '' && Boolean(media?.matches))), { flush: 'sync' })

// Sans choix enregistré, on suit les changements du système
media?.addEventListener?.('change', (event) => {
  if (themeSetting.value.value === '') apply(event.matches)
})

function toggle() {
  const dark = !isDark.value
  // Choix identique au système : on l'oublie, pour suivre le système à nouveau s'il change
  themeSetting.set(media && media.matches === dark ? '' : dark ? 'dark' : 'light')
}

export function useTheme() {
  return { isDark, toggle }
}
