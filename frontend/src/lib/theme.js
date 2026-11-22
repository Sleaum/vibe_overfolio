// Source unique des deux modes, clair et sombre : chaque valeur n'est écrite qu'ici.
//
// Qui lit ce fichier :
// - tailwind.config.js : crée les couleurs Tailwind (bg-paper, text-ink…) et génère les variables CSS
//   de :root (clair) et html.dark (sombre) ;
// - vite.config.ts : injecte la clé et les couleurs de fond dans index.html (script lancé avant l'affichage) ;
// - lib/palette.js : couleurs des graphiques et table de conversion vers le sombre ;
// - composables/useTheme.js : clé de stockage et couleur de la barre du navigateur.
//
// Pas d'import dans ce fichier : il est lu aussi bien par Node (configs) que par le navigateur.

/** Clé du choix enregistré dans le navigateur (localStorage) : 'light', 'dark', ou absente = suivre le système. */
export const STORAGE_KEY = 'overfolio-theme'

/**
 * Couleurs du site, en hexadécimal. Le nom devient la classe Tailwind (`ink-2` → `text-ink-2`).
 * Contrastes du texte sur `paper` : clair / sombre.
 */
export const COLORS = {
  // Fond et surfaces
  paper: { light: '#ffffff', dark: '#16191d' },
  wash: { light: '#f6f7f8', dark: '#0f1114' },
  // Encre : gris très foncé en clair (jamais de noir pur), gris très clair en sombre
  ink: { light: '#1f2328', dark: '#e6e8eb' }, // 15,6:1 / 14,4:1
  'ink-2': { light: '#4b5159', dark: '#b4bac2' }, // 7,7:1 / 9,0:1  texte secondaire
  'ink-3': { light: '#5d646c', dark: '#9aa1aa' }, // 6,0:1 / 6,8:1  texte discret (légendes, aides)
  // Filets et bordures fines
  line: { light: '#e4e6e9', dark: '#2b3036' },
  'line-strong': { light: '#cfd3d8', dark: '#3d434b' },
  // Une seule couleur d'accent : le bleu des graphiques, foncé en clair, éclairci en sombre
  accent: { light: '#1c5cab', dark: '#6aa6ee' }, // 6,6:1 / 7,0:1
  'accent-hover': { light: '#184f95', dark: '#8bbaf2' },
  'accent-wash': { light: '#eef4fc', dark: '#17263a' },
  'accent-ring': { light: '#2a78d6', dark: '#6aa6ee' }, // anneau de focus
  // Texte posé sur un fond d'accent (bouton principal) : 6,6:1 / 7,5:1
  'on-accent': { light: '#ffffff', dark: '#0d1117' },
  // États (toujours accompagnés d'un texte)
  danger: { light: '#b42318', dark: '#f97066' },
  'danger-wash': { light: '#fef3f2', dark: '#2b1614' },
  'danger-line': { light: '#fecdca', dark: '#5c2620' },
  success: { light: '#067647', dark: '#47cd89' },
  'success-wash': { light: '#ecfdf3', dark: '#0f2419' },
  'success-line': { light: '#abefc6', dark: '#1d4d33' },
}

/** Couleurs propres aux graphiques (pas de classe Tailwind) : ombres, en rgba. */
export const CHART_COLORS = {
  hoverShade: { light: 'rgba(31, 35, 40, 0.04)', dark: 'rgba(255, 255, 255, 0.06)' }, // survol des barres
  tooltipShadow: { light: 'rgba(31, 35, 40, 0.22)', dark: 'rgba(0, 0, 0, 0.55)' }, // ombre des infobulles
}

/** '#1f2328' → '31 35 40' (format des variables CSS, pour garder les opacités de Tailwind : bg-paper/95). */
export function rgbChannels(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ')
}

/** Variables CSS d'un mode : { '--c-paper': '255 255 255', … } */
export function cssVariables(mode) {
  return Object.fromEntries(Object.entries(COLORS).map(([name, value]) => [`--c-${name}`, rgbChannels(value[mode])]))
}
