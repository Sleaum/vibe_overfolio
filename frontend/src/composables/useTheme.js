// Mode clair ou sombre.
// Par défaut, le site suit le réglage du système ; le bouton de l'en-tête force l'un ou l'autre et s'en souvient
// (préférence « theme » de lib/preferences.js). La classe « dark » est posée sur <html> dès index.html,
// avant le premier affichage ; ce module prend le relais une fois Vue lancé.
// Avec un compte connecté, le choix est aussi enregistré sur son profil en base et retrouvé sur tout appareil
// (applyProfileTheme, appelé par lib/profile.js) ; la préférence du navigateur en garde une copie pour que
// index.html l'applique dès le chargement suivant.

import { ref } from 'vue'
import { COLORS } from '../lib/theme.js'
import { readPreference, writePreference } from '../lib/preferences.js'
import { saveProfileTheme } from '../lib/api.js'
import { session } from '../lib/auth.js'
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null

function stored() {
  const value = readPreference('theme')
  return value === 'dark' || value === 'light' ? value : null
}

const isDark = ref(typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

function apply(dark) {
  isDark.value = dark
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? COLORS.paper.dark : COLORS.paper.light)
}

// Sans choix enregistré, on suit les changements du système
media?.addEventListener?.('change', (event) => {
  if (!stored()) apply(event.matches)
})

function toggle() {
  const dark = !isDark.value
  apply(dark)
  // Choix identique au système : on l'oublie, pour suivre le système à nouveau s'il change
  const value = media && media.matches === dark ? '' : dark ? 'dark' : 'light'
  writePreference('theme', value || null)
  // Compte connecté : enregistré sur le profil (sans réseau, le choix vaut au moins pour ce navigateur)
  if (session.authenticated) saveProfileTheme(value).catch(() => {})
}

/**
 * Mode du profil d'un compte connecté ('light', 'dark', ou '' pour suivre le système).
 * À la création du compte (firstLogin), un profil sans mode reprend celui de ce navigateur.
 */
export async function applyProfileTheme(theme, { authenticated = false, firstLogin = false } = {}) {
  if (!authenticated) return // visiteur : la préférence du navigateur décide, comme avant
  const local = stored()
  if (!theme && firstLogin && local) {
    await saveProfileTheme(local).catch(() => {})
    return
  }
  if (theme === 'dark' || theme === 'light') {
    writePreference('theme', theme)
    apply(theme === 'dark')
  } else {
    writePreference('theme', null)
    apply(Boolean(media?.matches))
  }
}

export function useTheme() {
  return { isDark, toggle }
}
