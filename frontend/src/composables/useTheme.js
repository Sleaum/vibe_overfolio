// Mode clair ou sombre.
// Par défaut, le site suit le réglage du système ; le bouton de l'en-tête force l'un ou l'autre et s'en souvient
// (localStorage, clé STORAGE_KEY de lib/theme.js). La classe « dark » est posée sur <html> dès index.html,
// avant le premier affichage ; ce module prend le relais une fois Vue lancé.

import { ref } from 'vue'
import { COLORS, STORAGE_KEY as KEY } from '../lib/theme.js'
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null

function stored() {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'dark' || value === 'light' ? value : null
  } catch {
    return null
  }
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
  try {
    // Choix identique au système : on l'oublie, pour suivre le système à nouveau s'il change
    if (media && media.matches === dark) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, dark ? 'dark' : 'light')
  } catch {
    // Stockage indisponible (navigation privée…) : le choix vaut pour cette visite
  }
}

export function useTheme() {
  return { isDark, toggle }
}
