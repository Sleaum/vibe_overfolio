/** @type {import('tailwindcss').Config} */
//
// Jetons de design d'Overfolio : tout le site s'appuie sur ces valeurs.
// Les couleurs (clair et sombre) sont dans src/lib/theme.js, seule source ; ce fichier n'en contient aucune.
//
import plugin from 'tailwindcss/plugin'
import { COLORS, cssVariables } from './src/lib/theme.js'

// Chaque couleur lit sa variable CSS « R G B », pour garder les opacités de Tailwind (bg-paper/95…)
const colors = Object.fromEntries(Object.keys(COLORS).map((name) => [name, `rgb(var(--c-${name}) / <alpha-value>)`]))

// Variables CSS des deux modes, générées depuis theme.js : :root = clair, html.dark = sombre
const themeVariables = plugin(({ addBase }) => {
  addBase({
    ':root': { colorScheme: 'light', ...cssVariables('light') },
    'html.dark': { colorScheme: 'dark', ...cssVariables('dark') },
  })
})

export default {
  // Mode sombre : classe « dark » sur <html>, posée par index.html et composables/useTheme.js
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      // Une couleur Tailwind par entrée de COLORS (src/lib/theme.js) : bg-paper, text-ink-2, border-line-strong…
      colors,
      fontFamily: {
        // Inter si elle est installée, sinon la police système : aucun chargement externe
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        // Échelle typographique (taille, interligne, approche, graisse)
        body: ['1.0625rem', { lineHeight: '1.7' }],                  // 17 px
        lead: ['1.125rem', { lineHeight: '1.7' }],                   // 18 px
        display: ['clamp(2.5rem, 1.7rem + 3.4vw, 4rem)', {
          lineHeight: '1.04', letterSpacing: '-0.035em', fontWeight: '800',
        }],
        h2: ['clamp(1.75rem, 1.35rem + 1.7vw, 2.5rem)', {
          lineHeight: '1.12', letterSpacing: '-0.025em', fontWeight: '700',
        }],
        h3: ['1.25rem', { lineHeight: '1.35', letterSpacing: '-0.012em', fontWeight: '600' }],
      },
      boxShadow: {
        // Ombres très douces
        soft: '0 1px 2px rgba(31, 35, 40, 0.04), 0 8px 24px -12px rgba(31, 35, 40, 0.10)',
        lift: '0 1px 2px rgba(31, 35, 40, 0.05), 0 20px 44px -20px rgba(31, 35, 40, 0.20)',
      },
    },
  },
  plugins: [themeVariables],
}
